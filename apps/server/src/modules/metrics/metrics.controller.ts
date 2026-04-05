import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';
import { MetricsQueryDto } from './dto/metrics-query.dto';

export class MetricsController {
  private service: MetricsService;

  constructor() {
    this.service = new MetricsService();
  }

  public getLatency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // In a real app, projectId comes from the Auth middleware. 
      // For now, we will allow it via query string.
      const query = MetricsQueryDto.parse(req.query);
      
      const data = await this.service.getLatencyBreakdown(query);
      
      res.status(200).json({ data });
    } catch (error) {
      next(error); // Pass Zod errors to global handler
    }
  };
}