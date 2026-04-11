import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  company?: string;
  jobTitle?: string;
  timezone?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  oauthStartUrl: (provider: 'google' | 'github', mode: 'login' | 'register'): string => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${baseUrl}${ENDPOINTS.auth.oauthStart(provider, mode)}`;
  },
  login: async (data: LoginDto): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(ENDPOINTS.auth.login, data);
    return response.data;
  },
  register: async (data: RegisterDto): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(ENDPOINTS.auth.register, data);
    return response.data;
  },
  refresh: async (): Promise<RefreshResponse> => {
    const response = await apiClient.post<RefreshResponse>(ENDPOINTS.auth.refresh, {});
    return response.data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post(ENDPOINTS.auth.logout);
  }
};