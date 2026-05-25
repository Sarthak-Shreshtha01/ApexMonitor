import { Request, Response, NextFunction } from 'express';
import { LogsService } from './logs.service';
import { LogsQueryDto } from './dto/logs-query.dto';
import { errorBody, successBody } from '@shared/http/api-contract';

export class LogsController {
  private service = new LogsService();

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const parsed = LogsQueryDto.parse(req.query);
      const result = await this.service.list(userId, parsed);

      res.status(200).json(successBody(res, {
        page: parsed.page,
        limit: parsed.limit,
        ...result,
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project logs'));
        return;
      }

      next(error);
    }
  };
}
