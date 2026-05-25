export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApexErrorPayload {
  error?: string;
  code?: string;
  message?: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiSuccessEnvelope<T> {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiListResponse<T> {
  data: T[];
  nextCursor?: string;
  total?: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
}

export type AuthStrategy =
  | { type: 'bearer'; token: string | (() => string | Promise<string>) }
  | { type: 'apiKey'; key: string | (() => string | Promise<string>); headerName?: string }
  | { type: 'rumKey'; key: string | (() => string | Promise<string>); headerName?: string }
  | { type: 'custom'; getHeaders: () => Record<string, string> | Promise<Record<string, string>> };

export interface ApexClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  retry?: Partial<RetryConfig>;
  defaultHeaders?: Record<string, string>;
  auth?: AuthStrategy;
  fetcher?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export interface HttpResponseMeta {
  status: number;
  requestId?: string;
  headers: Headers;
}
