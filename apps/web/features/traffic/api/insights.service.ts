import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface InsightItem {
  id: number;
  projectId: string;
  endpoint: string | null;
  severity: InsightSeverity;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

interface InsightsResponse {
  projectId: string;
  insights: InsightItem[];
}

export const insightsService = {
  async list(projectId: string, limit = 8): Promise<InsightItem[]> {
    const response = await apiClient.get<InsightsResponse>(ENDPOINTS.insights.list, {
      params: { projectId, limit },
    });

    return response.data.insights;
  },
};
