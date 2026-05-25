import { Response } from 'express';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | string;

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
  requestId: string;
  details?: unknown;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccessBody<T> {
  data: T;
  meta: ApiMeta;
}

export function getRequestId(res: Response): string {
  return String(res.getHeader('x-request-id') ?? 'unknown');
}

export function successBody<T>(res: Response, data: T): ApiSuccessBody<T> {
  return {
    data,
    meta: {
      requestId: getRequestId(res),
      timestamp: new Date().toISOString(),
    },
  };
}

export function errorBody(res: Response, error: ApiErrorCode, message: string, details?: unknown): ApiErrorBody {
  return {
    error,
    message,
    requestId: getRequestId(res),
    ...(details !== undefined ? { details } : {}),
  };
}
