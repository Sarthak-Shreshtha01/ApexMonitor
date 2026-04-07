import { Request, Response, NextFunction } from 'express';
import { LogsService } from './logs.service';
import { LogsQueryDto } from './dto/logs-query.dto';

export class LogsController {
  private service = new LogsService();

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing JWT Token' });
        return;
      }

      const parsed = LogsQueryDto.parse(req.query);
      const result = await this.service.list(userId, parsed);

      res.status(200).json({
        page: parsed.page,
        limit: parsed.limit,
        ...result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json({ error: 'FORBIDDEN', message: 'No access to project logs' });
        return;
      }

      next(error);
    }
  };
}
