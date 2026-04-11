import { apiClient } from '@/shared/api/apiClient';
import { ENDPOINTS } from '@/shared/api/endpoints';

export interface TracesQuery {
  projectId: string;
  page?: number;
  limit?: number;
  statusClass?: '2xx' | '3xx' | '4xx' | '5xx';
  search?: string;
  from?: string;
  to?: string;
}

export interface TraceListItem {
  traceId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
  region: string;
  ip: string;
}

export interface TraceSpanItem {
  spanId: string;
  name: string;
  service: string;
  durationMs: number;
  startOffsetMs: number;
  attributes: Record<string, string | number | boolean>;
}

export interface TraceDetail {
  traceId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
  region: string;
  ip: string;
  userAgent: string;
  sdkVersion: string;
  tags: string[];
  spans: TraceSpanItem[];
}

interface TracesListResponse {
  traces: TraceListItem[];
  total: number;
  page: number;
  limit: number;
}

interface TraceDetailResponse {
  trace: TraceDetail;
}

export const tracesService = {
  async list(query: TracesQuery): Promise<TracesListResponse> {
    const response = await apiClient.get<TracesListResponse>(ENDPOINTS.traces.list, {
      params: query,
    });
    return response.data;
  },

  async detail(traceId: string, projectId: string): Promise<TraceDetail> {
    const response = await apiClient.get<TraceDetailResponse>(ENDPOINTS.traces.detail(traceId), {
      params: { projectId },
    });
    return response.data.trace;
  },
};
