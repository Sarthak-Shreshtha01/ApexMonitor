import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export interface ApiKeyItem {
  id: number;
  projectId: string;
  projectName: string;
  label: string;
  keyPrefix: string;
  maskedKey: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ListKeysResponse {
  keys: ApiKeyItem[];
}

interface CreateKeyResponse {
  message: string;
  keyId: number;
  keyPrefix: string;
  plaintextKey: string;
  label: string;
  projectId: string;
}

export const keysService = {
  async list(projectId?: string): Promise<ApiKeyItem[]> {
    const response = await apiClient.get<ListKeysResponse>(ENDPOINTS.keys.list, {
      params: projectId ? { projectId } : undefined,
    });

    return response.data.keys;
  },

  async create(input: { projectId: string; label: string }): Promise<CreateKeyResponse> {
    const response = await apiClient.post<CreateKeyResponse>(ENDPOINTS.keys.create, input);
    return response.data;
  },

  async revoke(keyId: number, projectId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.keys.revoke(keyId), {
      params: { projectId },
    });
  },
};
