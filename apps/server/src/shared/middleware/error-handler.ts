import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { errorBody } from '@shared/http/api-contract';

const knownErrorMap: Record<string, { status: number; code: string; message: string }> = {
  EMAIL_IN_USE: { status: 409, code: 'CONFLICT', message: 'Email is already in use' },
  INVALID_CREDENTIALS: { status: 401, code: 'UNAUTHORIZED', message: 'Invalid credentials' },
  INVALID_REFRESH_TOKEN: { status: 401, code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
  USER_NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'User not found' },
  PROJECT_ACCESS_DENIED: { status: 403, code: 'FORBIDDEN', message: 'Project access denied' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' },
  KEY_NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Key not found' },
  TRACE_NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Trace not found' },
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
