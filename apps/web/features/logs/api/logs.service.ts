import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export type StatusClass = '2xx' | '3xx' | '4xx' | '5xx';

export interface LogsQuery {
  projectId: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  statusClass?: StatusClass;
  endpoint?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface LogItem {
  reqId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  ip: string;
  userAgent: string;
  region: string;
  timestamp: string;
  sdkVersion: string;
  tags: string[];
}

export interface LogsResponse {
  page: number;
  limit: number;
  total: number;
  logs: LogItem[];
  summary: {
    total: number;
    errorRate: number;
    avgLatency: number;
  };
}

export const logsService = {
  async list(query: LogsQuery): Promise<LogsResponse> {
    const response = await apiClient.get<LogsResponse>(ENDPOINTS.logs.list, {
      params: query,
    });

    return response.data;
  },
};
