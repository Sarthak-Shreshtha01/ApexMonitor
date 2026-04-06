import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export interface OverviewMetricsResponse {
  rps: number;
  errorRate: number;
  topEndpoints: Array<{ endpoint: string; rps: number; p99: number }>;
}

export const metricsService = {
  getOverview: async (projectId: string, timeframe: string): Promise<OverviewMetricsResponse> => {
    const response = await apiClient.get<OverviewMetricsResponse>(ENDPOINTS.metrics.overview, {
      params: { projectId, timeframe } // [cite: 1030]
    });
    return response.data;
  }
};