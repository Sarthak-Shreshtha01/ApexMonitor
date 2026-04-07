import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export interface OverviewMetricsResponse {
  summary: {
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    p99Latency: number;
    avgLatency: number;
    rps: number;
    apdex: number;
  };
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    requests: number;
    errors: number;
    errorRate: number;
    p99Latency: number;
    avgLatency: number;
  }>;
  series: Array<{
    bucket: string;
    requestCount: number;
    errorCount: number;
    avgLatency: number;
  }>;
}

export const metricsService = {
  getOverview: async (projectId: string, timeframe: string): Promise<OverviewMetricsResponse> => {
    const response = await apiClient.get<OverviewMetricsResponse>(ENDPOINTS.metrics.overview, {
      params: { projectId, timeframe }
    });
    return response.data;
  }
};