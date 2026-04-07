import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export interface ProjectSummary {
  id: string;
  name: string;
  ownerUserId: string;
  role: string;
  plan: string;
  rateLimitRpm: number;
  logRetentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export const projectsService = {
  async listMine(): Promise<ProjectSummary[]> {
    const response = await apiClient.get<{ projects: ProjectSummary[] }>(ENDPOINTS.projects.listMine);
    return response.data.projects;
  },

  async create(name: string): Promise<ProjectSummary> {
    const response = await apiClient.post<{ project: ProjectSummary }>(ENDPOINTS.projects.create, { name });
    return response.data.project;
  },
};
