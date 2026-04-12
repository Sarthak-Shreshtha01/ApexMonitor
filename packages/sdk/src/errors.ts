import type { ApexErrorPayload } from './types.js';

export class ApexApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown;
  public readonly requestId?: string;
  public readonly isRetryable: boolean;

  constructor(status: number, payload: ApexErrorPayload, isRetryable: boolean) {
    const code = payload.code ?? payload.error ?? 'API_ERROR';
    const message = payload.message ?? `Request failed with status ${status}`;
    super(message);

    this.name = 'ApexApiError';
    this.status = status;
    this.code = code;
    this.details = payload.details;
    this.requestId = payload.requestId;
    this.isRetryable = isRetryable;
  }
}

export class ApexNetworkError extends Error {
  public readonly isRetryable: boolean;

  constructor(message: string) {
    super(message);
    this.name = 'ApexNetworkError';
    this.isRetryable = true;
  }
}
