import { Request, Response, NextFunction } from 'express';
import { InsightsService } from './insights.service';
import { InsightsQueryDto } from './dto/insights-query.dto';

export class InsightsController {
  private service = new InsightsService();

  listRecent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing JWT Token' });
        return;
      }

      const parsed = InsightsQueryDto.parse(req.query);
      const insights = await this.service.listRecent(userId, parsed);

      res.status(200).json({
        projectId: parsed.projectId,
        insights,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json({ error: 'FORBIDDEN', message: 'No access to project insights' });
        return;
      }

      next(error);
    }
  };
}
