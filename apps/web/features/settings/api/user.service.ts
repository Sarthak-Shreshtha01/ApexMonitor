import { apiClient 
} from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UpdateProfileRequest {
  name: string;
  email: string;
}

export class UserService {
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get<{ profile: UserProfile }>(ENDPOINTS.user.profile);
    return response.data.profile;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    const response = await apiClient.patch<{ profile: UserProfile }>(ENDPOINTS.user.profile, data);
    return response.data.profile;
  }
}

export const userService = new UserService();
