import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@shared/auth/tokens';
import { errorBody } from '@shared/http/api-contract';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

/** Requires a valid **access** token. Refresh and OAuth-state tokens are rejected. */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
};
