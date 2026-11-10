import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth.service';
import { errorBody, getRequestId } from '@shared/http/api-contract';

declare global {
  namespace Express {
    interface Request {
      project?: { id: string; role?: string };
    }
  }
}

const authService = new AuthService();

/**
 * Only a key that is really wrong gets 401/403. If the check itself fails (database or Redis
 * unreachable), answer 503 + Retry-After: SDKs drop batches on 401 but retry on 503.
 */
function keyCheckFailed(res: Response, error: unknown, invalidMessage: string): void {
  const reason = error instanceof Error ? error.message : '';
  if (reason === 'UNAUTHORIZED') {
    res.status(401).json(errorBody(res, 'UNAUTHORIZED', invalidMessage));
    return;
  }
  if (reason === 'ORIGIN_NOT_ALLOWED') {
    res.status(403).json(errorBody(res, 'FORBIDDEN', 'Origin not allowed for this RUM key'));
    return;
  }
  console.error('❌ [Auth] Key check failed', { requestId: getRequestId(res), error: reason || String(error) });
  res.setHeader('Retry-After', '5');
  res.status(503).json(errorBody(res, 'SERVICE_UNAVAILABLE', 'Could not verify the key right now; retry shortly'));
}

export const validateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing X-API-Key header'));
    return;
  }

  let projectId: string;
  try {
    projectId = await authService.validateApiKey(apiKey);
  } catch (error) {
    keyCheckFailed(res, error, 'Invalid API Key');
    return;
  }
  // The project always comes from the key (tenant rule).
  req.project = { id: projectId };
  next();
};

export const validateRumWriteKey = async (req: Request, res: Response, next: NextFunction) => {
  const rumKey = req.headers['x-rum-key'] as string;

  if (!rumKey) {
    res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing X-RUM-Key header'));
    return;
  }

  let projectId: string;
  try {
    projectId = await authService.validateRumWriteKey(rumKey, String(req.headers.origin ?? ''));
  } catch (error) {
    keyCheckFailed(res, error, 'Invalid RUM write key');
    return;
  }
  req.project = { id: projectId };
  next();
};
