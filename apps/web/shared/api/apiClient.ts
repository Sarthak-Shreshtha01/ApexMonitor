import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ENDPOINTS } from './endpoints';
import { useAuthStore } from '@/features/auth/state/auth.store';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // [cite: 750]
  withCredentials: true, // Crucial for httpOnly refresh cookies [cite: 751]
  timeout: 15000, // [cite: 753]
});

// Request Interceptor: Attach in-memory Access Token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken; // [cite: 758]
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`; // [cite: 759]
  }
  return config;
});

let isRefreshing = false; // [cite: 762]
type FailedQueueItem = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};

let failedQueue: FailedQueueItem[] = []; // [cite: 764]

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((item) => {
    if (error) {
      item.reject(error);
      return;
    }

    if (token) {
      item.resolve(token);
    }
  });

  failedQueue = [];
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

const AUTH_ENDPOINTS = [
  ENDPOINTS.auth.login,
  ENDPOINTS.auth.register,
  ENDPOINTS.auth.refresh,
  ENDPOINTS.auth.logout,
];

const isAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

// Response Interceptor: Handle 401 Auto-Refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url);

    if (shouldAttemptRefresh) { // [cite: 772]
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject }); // [cite: 774]
        }).then((token) => {
          if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true; // [cite: 775]
      isRefreshing = true; // [cite: 776]

      try {
        const storedRefreshToken = useAuthStore.getState().refreshToken;
        if (!storedRefreshToken) {
          throw new Error('MISSING_REFRESH_TOKEN');
        }

        const { data } = await axios.post<RefreshResponse>(ENDPOINTS.auth.refresh, { refreshToken: storedRefreshToken }, {
          baseURL: process.env.NEXT_PUBLIC_API_URL,
          withCredentials: true // [cite: 778]
        });

        const newAccessToken = data.accessToken;
        const newRefreshToken = data.refreshToken;

        useAuthStore.getState().setTokens({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        });

        processQueue(null, newAccessToken); // [cite: 780]

        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest); // [cite: 781]

      } catch (refreshError) {
        processQueue(refreshError, null); // [cite: 783]
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false; // [cite: 787]
      }
    }
    return Promise.reject(error);
  }
);