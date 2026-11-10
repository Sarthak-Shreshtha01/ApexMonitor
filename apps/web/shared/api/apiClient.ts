import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ENDPOINTS } from './endpoints';
import { clearAuth, getAccessToken, setAccessToken } from '@/features/auth/state/auth.store';
import { isPublicPath, loginUrlFor } from '@/shared/routes/session-gate';

type ApiSuccessEnvelope<T> = {
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
};

const unwrapApiData = <T>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccessEnvelope<T>).data;
  }

  return payload as T;
};

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // sends the httpOnly refresh cookie to the API
  timeout: 15000,
});

// Request Interceptor: Attach in-memory Access Token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let pendingRefresh: Promise<string> | null = null;

/**
 * Gets a new access token using the httpOnly refresh cookie. Concurrent callers share one
 * request. On failure the session is over: auth state is cleared (KI-40) and the error is
 * rethrown; callers decide whether to redirect.
 */
export function refreshAccessToken(): Promise<string> {
  pendingRefresh ??= axios
    .post<ApiSuccessEnvelope<{ accessToken: string }> | { accessToken: string }>(ENDPOINTS.auth.refresh, {}, {
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      withCredentials: true,
      // Required by the API when refreshing with the cookie (blocks cross-site refreshes).
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    .then(({ data }) => {
      const { accessToken } = unwrapApiData<{ accessToken: string }>(data);
      setAccessToken(accessToken);
      return accessToken;
    })
    .catch((error: unknown) => {
      clearAuth();
      throw error;
    })
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
}

/** Sends the browser to the login page unless it is already on a public page. */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (isPublicPath(pathname)) return;
  window.location.assign(loginUrlFor(pathname, search));
}

const AUTH_ENDPOINTS = [
  ENDPOINTS.auth.login,
  ENDPOINTS.auth.register,
  ENDPOINTS.auth.refresh,
  ENDPOINTS.auth.logout,
  ENDPOINTS.auth.oauthExchange,
];

const isAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

// Response Interceptor: unwrap the envelope; on 401 refresh once and replay.
apiClient.interceptors.response.use(
  (response) => {
    response.data = unwrapApiData(response.data);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url);

    if (!shouldAttemptRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    let token: string;
    try {
      token = await refreshAccessToken();
    } catch (refreshError) {
      // The session can't be renewed: auth state is already cleared; go to /login (KI-40).
      redirectToLogin();
      return Promise.reject(refreshError);
    }

    if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
    return apiClient(originalRequest);
  }
);
