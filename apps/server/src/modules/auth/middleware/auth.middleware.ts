import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth.service';

declare global {
  namespace Express {
    interface Request {
      project?: { id: string };
    }
  }
}

const authService = new AuthService();

export const validateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing X-API-Key header' });
  }

  try {
    const projectId = await authService.validateApiKey(apiKey);
    
    // Attach to request for downstream use (cite: 1105)
    req.project = { id: projectId }; 
    next();
  } catch (error) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid API Key' });
  }
};

export const validateRumWriteKey = async (req: Request, res: Response, next: NextFunction) => {
  const rumKey = req.headers['x-rum-key'] as string;

  if (!rumKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing X-RUM-Key header' });
  }

  try {
    const projectId = await authService.validateRumWriteKey(rumKey, String(req.headers.origin ?? ''));
    req.project = { id: projectId };
    next();
  } catch (error) {
    if (error instanceof Error && error.message === 'ORIGIN_NOT_ALLOWED') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Origin not allowed for this RUM key' });
    }

    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid RUM write key' });
  }
};