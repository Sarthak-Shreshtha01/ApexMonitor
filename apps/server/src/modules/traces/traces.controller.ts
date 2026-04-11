import { NextFunction, Request, Response } from 'express';
import { TraceDetailQueryDto, TracesQueryDto } from './dto/traces-query.dto';
import { TracesService } from './traces.service';

export class TracesController {
  private service = new TracesService();

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing JWT Token' });
        return;
      }

      const parsed = TracesQueryDto.parse(req.query);
      const result = await this.service.list(userId, parsed);

      res.status(200).json({
        page: parsed.page,
        limit: parsed.limit,
        ...result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json({ error: 'FORBIDDEN', message: 'No access to project traces' });
        return;
      }
      next(error);
    }
  };

  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing JWT Token' });
        return;
      }

      const traceId = req.params.traceId as string;
      const parsed = TraceDetailQueryDto.parse(req.query);
      const trace = await this.service.detail(userId, traceId, parsed);

      res.status(200).json({ trace });
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json({ error: 'FORBIDDEN', message: 'No access to project traces' });
        return;
      }
      if (error instanceof Error && error.message === 'TRACE_NOT_FOUND') {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Trace not found' });
        return;
      }
      next(error);
    }
  };
}
