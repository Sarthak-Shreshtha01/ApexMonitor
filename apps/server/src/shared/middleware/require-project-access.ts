import { NextFunction, Request, Response } from 'express';
import { UserService } from '@modules/users/user.service';
import { errorBody } from '@shared/http/api-contract';

declare global {
  namespace Express {
    interface Request {
      project?: { id: string; role?: string };
    }
  }
}

type ProjectSource = 'params' | 'query' | 'body';

interface RequireProjectAccessOptions {
  source?: ProjectSource;
  key?: string;
  requireOwner?: boolean;
}

const userService = new UserService();

function readProjectId(req: Request, source: ProjectSource, key: string): string | undefined {
  if (source === 'params') {
    return typeof req.params[key] === 'string' ? req.params[key] : undefined;
  }

  if (source === 'query') {
    const value = req.query[key];
    return typeof value === 'string' ? value : undefined;
  }

  const value = req.body?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function requireProjectAccess(options: RequireProjectAccessOptions = {}) {
  const source = options.source ?? 'query';
  const key = options.key ?? 'projectId';
  const requireOwner = options.requireOwner ?? false;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
      return;
    }

    const projectId = readProjectId(req, source, key);
    if (!projectId) {
      res.status(400).json(errorBody(res, 'VALIDATION_ERROR', 'Missing projectId'));
      return;
    }

    try {
      const projects = await userService.listProjects(userId);
      const project = projects.find((item) => item.id === projectId);

      if (!project) {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to this project'));
        return;
      }

      if (requireOwner && project.role !== 'owner') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'Owner access required'));
        return;
      }

      req.project = { id: projectId, role: project.role };
      next();
    } catch (error) {
      next(error);
    }
  };
}
