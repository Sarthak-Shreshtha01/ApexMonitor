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