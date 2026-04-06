import { RegisterRequest } from './../../../../server/src/modules/users/dto/user.dto';
import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

// DTOs based on SRS
export interface LoginDto {
  email: string;
  passwordHash: string; // Assuming hashing is handled before or at this layer
}

export interface RegisterDto {
  fullName: string;
  email: string;
  passwordHash: string;
}

export interface AuthResponse {
  accessToken: string;
  // Refresh token is in httpOnly cookie
}

export const authService = {
  login: async (data: LoginDto): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(ENDPOINTS.auth.login, data);
    return response.data;
  },
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    // Assuming a register endpoint exists in the expanded REST API
    const response = await apiClient.post<AuthResponse>(ENDPOINTS.auth.register, data);
    return response.data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post(ENDPOINTS.auth.logout);
  }
};