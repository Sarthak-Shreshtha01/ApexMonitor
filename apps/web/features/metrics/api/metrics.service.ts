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

export interface OperationsMetricsResponse {
  timeframe: string;
  totals: {
    requests: number;
    errors: number;
  };
  statusBreakdown: {
    ok2xx: { count: number; rate: number };
    redirect3xx: { count: number; rate: number };
    client4xx: { count: number; rate: number };
    server5xx: { count: number; rate: number };
  };
  regions: Array<{
    region: string;
    requests: number;
    errorRate: number;
    avgLatency: number;
  }>;
  nodes: Array<{
    nodeId: string;
    source: string;
    requests: number;
    errorRate: number;
    avgLatency: number;
    status: 'ok' | 'warning' | 'critical';
  }>;
  generatedAt: string;
}

export const metricsService = {
  getOverview: async (projectId: string, timeframe: string): Promise<OverviewMetricsResponse> => {
    const response = await apiClient.get<OverviewMetricsResponse>(ENDPOINTS.metrics.overview, {
      params: { projectId, timeframe }
    });
    return response.data;
  },

  getOperations: async (projectId: string, timeframe: string): Promise<OperationsMetricsResponse> => {
    const response = await apiClient.get<OperationsMetricsResponse>(ENDPOINTS.metrics.operations, {
      params: { projectId, timeframe }
    });
    return response.data;
  },
};