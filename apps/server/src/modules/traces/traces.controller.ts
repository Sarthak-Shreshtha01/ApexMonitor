import { NextFunction, Request, Response } from 'express';
import { TraceDetailQueryDto, TracesQueryDto } from './dto/traces-query.dto';
import { TracesService } from './traces.service';
import { errorBody, successBody } from '@shared/http/api-contract';

export class TracesController {
  private service = new TracesService();

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const parsed = TracesQueryDto.parse(req.query);
      const result = await this.service.list(userId, parsed);

      res.status(200).json(successBody(res, {
        page: parsed.page,
        limit: parsed.limit,
        ...result,
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project traces'));
        return;
      }
      next(error);
    }
  };

  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const traceId = req.params.traceId as string;
      const parsed = TraceDetailQueryDto.parse(req.query);
      const trace = await this.service.detail(userId, traceId, parsed);

      res.status(200).json(successBody(res, { trace }));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project traces'));
        return;
      }
      if (error instanceof Error && error.message === 'TRACE_NOT_FOUND') {
        res.status(404).json(errorBody(res, 'NOT_FOUND', 'Trace not found'));
        return;
      }
      next(error);
    }
  };
}
