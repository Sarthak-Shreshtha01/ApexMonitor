import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ENDPOINTS } from './endpoints';
// Note: Assumes auth store is built according to SRS [cite: 924]
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
let failedQueue: Array<{ resolve: (val?: unknown) => void; reject: (err: unknown) => void }> = []; // [cite: 764]

// Response Interceptor: Handle 401 Auto-Refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) { // [cite: 772]
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject }); // [cite: 774]
        }).then((token) => {
          if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true; // [cite: 775]
      isRefreshing = true; // [cite: 776]

      try {
        const { data } = await axios.post<{ accessToken: string }>(ENDPOINTS.auth.refresh, {}, {
          baseURL: process.env.NEXT_PUBLIC_API_URL,
          withCredentials: true // [cite: 778]
        });
        
        const newToken = data.accessToken;
        useAuthStore.getState().setAccessToken(newToken); // [cite: 779]

        failedQueue.forEach((prom) => prom.resolve(newToken)); // [cite: 780]
        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest); // [cite: 781]
        
      } catch (refreshError) {
        failedQueue.forEach((prom) => prom.reject(refreshError)); // [cite: 783]
        useAuthStore.getState().logout(); // [cite: 784]
        window.location.href = '/login'; // [cite: 785]
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false; // [cite: 787]
        failedQueue = []; // [cite: 788]
      }
    }
    return Promise.reject(error);
  }
);