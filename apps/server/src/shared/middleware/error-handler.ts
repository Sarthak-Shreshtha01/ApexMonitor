import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { errorBody } from '@shared/http/api-contract';

const knownErrorMap: Record<string, { status: number; code: string; message: string }> = {
  EMAIL_IN_USE: { status: 409, code: 'CONFLICT', message: 'Email is already in use' },
  INVALID_CREDENTIALS: { status: 401, code: 'UNAUTHORIZED', message: 'Invalid credentials' },
  INVALID_REFRESH_TOKEN: { status: 401, code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
  USER_NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'User not found' },
  PROJECT_ACCESS_DENIED: { status: 403, code: 'FORBIDDEN', message: 'Project access denied' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded (events per minute for this project)' },
  KEY_NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Key not found' },
  TRACE_NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Trace not found' },
  BILLING_NOT_CONFIGURED: { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Billing is not configured on this server' },
  INVALID_SIGNATURE: { status: 401, code: 'UNAUTHORIZED', message: 'Invalid webhook signature' },
  INVALID_WEBHOOK_PAYLOAD: { status: 400, code: 'VALIDATION_ERROR', message: 'Webhook payload is not valid base64 JSON' },
};

function getRequestId(req: Request): string {
  return String((req as Request & { id?: string }).id ?? req.headers['x-request-id'] ?? 'unknown');
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorBody(res, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = getRequestId(req);

  if (err instanceof ZodError) {
    res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'Request validation failed', err.flatten()));
    return;
  }

  // Errors from express.json() (body-parser) carry their own HTTP status: malformed JSON is
  // a client error (400), an oversized body 413, an unsupported charset 415.
  const parserError = bodyParserError(err);
  if (parserError) {
    res.status(parserError.status).json(errorBody(res, parserError.code, parserError.message));
    return;
  }

  // Message broker down or pushing back: the batch was NOT accepted, so the client should retry.
  if (err instanceof Error && err.name === 'BrokerUnavailableError') {
    res.setHeader('Retry-After', '5');
    res.status(503).json(errorBody(res, 'SERVICE_UNAVAILABLE', 'Ingestion is temporarily unavailable; retry shortly'));
    return;
  }

  // Rate limited: tell the client when to come back.
  if (err instanceof Error && err.name === 'RateLimitedError') {
    const { limit, retryAfterSeconds } = (err as Error & { decision: { limit: number; retryAfterSeconds: number } }).decision;
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', '0');
  }

  if (err instanceof Error && knownErrorMap[err.message]) {
    const mapped = knownErrorMap[err.message];
    res.status(mapped.status).json(errorBody(res, mapped.code, mapped.message));
    return;
  }

  console.error('Unhandled API error', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });

  res.status(500).json(errorBody(res, 'INTERNAL_ERROR', 'Unexpected server error'));
}

function bodyParserError(err: unknown): { status: number; code: string; message: string } | null {
  if (!(err instanceof Error)) return null;
  const { type, status } = err as Error & { type?: string; status?: number };
  if (typeof type !== 'string') return null;
  if (!['entity.', 'charset.', 'encoding.'].some((prefix) => type.startsWith(prefix))) return null;
  if (type === 'entity.parse.failed') return { status: 400, code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' };
  if (type === 'entity.too.large') return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large (limit 2 MB)' };
  if (type === 'charset.unsupported' || type === 'encoding.unsupported') {
    return { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported request body encoding' };
  }
  const code = typeof status === 'number' && status >= 400 && status < 500 ? status : 400;
  return { status: code, code: 'VALIDATION_ERROR', message: 'Request body could not be read' };
}
