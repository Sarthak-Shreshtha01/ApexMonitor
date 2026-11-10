import { ApexApiError, ApexNetworkError } from './errors.js';
import type {
  ApexClientOptions,
  ApexErrorPayload,
  ApiSuccessEnvelope,
  HttpMethod,
  HttpResponseMeta,
  RequestOptions,
  RetryConfig,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 300,
};

/**
 * Statuses worth retrying. 409 is not one of them: a conflict (e.g. email already taken)
 * comes back the same every time.
 */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * The server rejected the request without acting on it, so even a POST without an
 * idempotency key can be sent again.
 */
const REJECTED_UNPROCESSED_STATUS = new Set([429, 503]);

/** Methods that are safe to repeat: the second call can't create anything twice. */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);

/** Header the server reads for deduplication. */
export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly retry: RetryConfig;
  private readonly auth: ApexClientOptions['auth'];
  private readonly fetcher: typeof fetch;

  constructor(options: ApexClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.retry = {
      maxRetries: options.retry?.maxRetries ?? DEFAULT_RETRY.maxRetries,
      baseDelayMs: options.retry?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs,
    };
    this.auth = options.auth;
    this.fetcher = options.fetcher ?? fetch;

    if (!this.baseUrl) {
      throw new Error('Apex SDK requires a non-empty baseUrl');
    }
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const result = await this.requestWithMeta<T>(method, path, options);
    return result.data;
  }

  async requestWithMeta<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<{ data: T; meta: HttpResponseMeta }> {
    const url = this.buildUrl(path, options.query);
    const headers = await this.buildHeaders(options);
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    // Re-sending a POST/PATCH that may have reached the server could create it twice,
    // unless the server can deduplicate it by idempotency key.
    const safeToRepeat = IDEMPOTENT_METHODS.has(method.toUpperCase()) || Boolean(options.idempotencyKey);

    let attempt = 0;

    while (true) {
      const controller = new AbortController();
      const signal = mergeAbortSignals(options.signal, controller.signal);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.fetcher(url, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal,
        });

        clearTimeout(timeout);

        const payload = await this.readPayload(response);
        if (response.ok) {
          const requestId = response.headers.get('x-request-id') ?? undefined;
          return {
            data: this.unwrapSuccessEnvelope<T>(payload),
            meta: {
              status: response.status,
              requestId,
              headers: response.headers,
            },
          };
        }

        const retryable = RETRYABLE_STATUS.has(response.status) && (safeToRepeat || REJECTED_UNPROCESSED_STATUS.has(response.status));
        const errorPayload = this.toErrorPayload(payload);
        errorPayload.requestId = errorPayload.requestId ?? response.headers.get('x-request-id') ?? undefined;
        const error = new ApexApiError(response.status, errorPayload, retryable);

        if (!retryable || attempt >= this.retry.maxRetries) {
          throw error;
        }
      } catch (error) {
        clearTimeout(timeout);

        // Cancelled by the caller: give up immediately, never retry.
        if (options.signal?.aborted) {
          throw error;
        }

        // Our own timeout fired: report it as a network error (retryable).
        const failure = controller.signal.aborted && isAbortError(error)
          ? new ApexNetworkError(`Request timed out after ${timeoutMs} ms`)
          : error;

        const retryable = failure instanceof ApexApiError ? failure.isRetryable : safeToRepeat && this.isRetryableError(failure);
        if (!retryable || attempt >= this.retry.maxRetries) {
          if (failure instanceof Error) {
            throw failure;
          }

          throw new ApexNetworkError('Unexpected network failure');
        }
      }

      attempt += 1;
      await wait(this.backoff(attempt));
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private async buildHeaders(options: RequestOptions): Promise<Record<string, string>> {
    const authHeaders = await this.getAuthHeaders();

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...this.defaultHeaders,
      ...authHeaders,
      ...(options.headers ?? {}),
    };

    if (options.idempotencyKey) {
      headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;
    }

    if (!headers['x-request-id']) {
      headers['x-request-id'] = createRequestId();
    }

    return headers;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.auth) {
      return {};
    }

    if (this.auth.type === 'custom') {
      return await this.auth.getHeaders();
    }

    if (this.auth.type === 'bearer') {
      return {
        authorization: `Bearer ${await resolveValue(this.auth.token)}`,
      };
    }

    const headerName = this.auth.headerName ?? (this.auth.type === 'rumKey' ? 'x-rum-key' : 'x-api-key');
    return {
      [headerName]: await resolveValue(this.auth.key),
    };
  }

  private async readPayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();
    return text.length > 0 ? text : null;
  }

  private toErrorPayload(payload: unknown): ApexErrorPayload {
    if (payload && typeof payload === 'object') {
      return payload as ApexErrorPayload;
    }

    return {
      message: typeof payload === 'string' ? payload : 'Request failed',
    };
  }

  private unwrapSuccessEnvelope<T>(payload: unknown): T {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return (payload as ApiSuccessEnvelope<T>).data;
    }

    return payload as T;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof ApexApiError) {
      return error.isRetryable;
    }

    if (error instanceof TypeError) {
      return true;
    }

    return error instanceof ApexNetworkError;
  }

  private backoff(attempt: number): number {
    const jitter = Math.floor(Math.random() * 100);
    return this.retry.baseDelayMs * 2 ** (attempt - 1) + jitter;
  }
}

async function resolveValue(value: string | (() => string | Promise<string>)): Promise<string> {
  if (typeof value === 'function') {
    return await value();
  }

  return value;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function mergeAbortSignals(primary?: AbortSignal, fallback?: AbortSignal): AbortSignal | undefined {
  if (primary && fallback) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      return AbortSignal.any([primary, fallback]);
    }

    if (primary.aborted || fallback.aborted) {
      const controller = new AbortController();
      controller.abort();
      return controller.signal;
    }

    const controller = new AbortController();
    const abort = (): void => controller.abort();
    primary.addEventListener('abort', abort, { once: true });
    fallback.addEventListener('abort', abort, { once: true });
    return controller.signal;
  }

  return primary ?? fallback;
}
