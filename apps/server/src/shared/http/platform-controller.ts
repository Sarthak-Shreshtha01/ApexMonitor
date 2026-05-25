import { Request, Response } from 'express';
import { PlatformHealthService } from '@shared/services/platform-health.service';
import { errorBody, successBody } from '@shared/http/api-contract';

const healthService = new PlatformHealthService();

export class PlatformController {
  health = (_req: Request, res: Response): void => {
    res.status(200).json(successBody(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }));
  };

  ready = async (_req: Request, res: Response): Promise<void> => {
    try {
      const snapshot = await healthService.snapshot();
      const isReady = Object.values(snapshot.services).every((status) => status === 'ok');
      res.status(isReady ? 200 : 503).json(successBody(res, {
        ready: isReady,
        snapshot,
      }));
    } catch {
      res.status(503).json(errorBody(res, 'SERVICE_UNAVAILABLE', 'Platform is not ready'));
    }
  };

  metrics = async (_req: Request, res: Response): Promise<void> => {
    try {
      const snapshot = await healthService.snapshot();
      res.status(200).json(successBody(res, {
        uptimeSeconds: snapshot.uptimeSeconds,
        memoryUsageMb: snapshot.memoryUsageMb,
        services: snapshot.services,
        queues: snapshot.queues,
      }));
    } catch {
      res.status(503).json(errorBody(res, 'SERVICE_UNAVAILABLE', 'Unable to read platform metrics'));
    }
  };
}
