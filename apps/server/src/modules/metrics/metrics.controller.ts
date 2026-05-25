import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { errorBody, successBody } from '@shared/http/api-contract';

export class MetricsController {
  private service: MetricsService;

  constructor() {
    this.service = new MetricsService();
  }

  public getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const query = MetricsQueryDto.parse(req.query);
      const data = await this.service.getOverview(query, userId);

      res.status(200).json(successBody(res, data));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project metrics'));
        return;
      }

      next(error);
    }
  };

  public getLatency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const query = MetricsQueryDto.parse(req.query);

      const data = await this.service.getLatencyBreakdown(query, userId);
      
      res.status(200).json(successBody(res, data));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project metrics'));
        return;
      }

      next(error); // Pass Zod errors to global handler
    }
  };

  public getOperations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const query = MetricsQueryDto.parse(req.query);
      const data = await this.service.getOperations(query, userId);

      res.status(200).json(successBody(res, data));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project metrics'));
        return;
      }

      next(error);
    }
  };
}