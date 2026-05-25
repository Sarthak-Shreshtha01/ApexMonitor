import { Request, Response, NextFunction } from 'express';
import { RumService } from './rum.service';
import { RumIngestBatchDto } from './dto/rum-ingest.dto';
import { RumQueryDto } from './dto/rum-query.dto';
import { errorBody, successBody } from '@shared/http/api-contract';

export class RumController {
  private service = new RumService();

  ingest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json(errorBody(res, 'UNSUPPORTED_MEDIA_TYPE', 'Expected application/json payload'));
        return;
      }

      const projectId = req.project?.id;
      if (!projectId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing ingest key'));
        return;
      }

      const validated = RumIngestBatchDto.parse(req.body);
      const result = await this.service.processBatch(validated, {
        projectId,
        origin: String(req.headers.origin ?? ''),
        referrer: String(req.headers.referer ?? ''),
        userAgent: String(req.headers['user-agent'] ?? ''),
        ip: this.resolveIp(req),
        countryCode: this.resolveCountry(req),
        regionCode: this.resolveRegion(req),
        idempotencyKey: this.resolveIdempotencyKey(req),
      });

      res.status(202).json(successBody(res, { status: 'queued', ...result }));
    } catch (error) {
      if (error instanceof Error && error.message === 'RATE_LIMITED') {
        res.status(429).json(errorBody(res, 'RATE_LIMIT_EXCEEDED', 'RUM ingest limit exceeded'));
        return;
      }

      next(error);
    }
  };

  overview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    this.handleQuery(req, res, next, (userId, query) => this.service.getOverview(userId, query));
  };

  series = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    this.handleQuery(req, res, next, (userId, query) => this.service.getSeries(userId, query));
  };

  paths = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    this.handleQuery(req, res, next, (userId, query) => this.service.getTopPaths(userId, query));
  };

  devices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    this.handleQuery(req, res, next, (userId, query) => this.service.getDeviceBreakdown(userId, query));
  };

  geo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    this.handleQuery(req, res, next, (userId, query) => this.service.getGeoBreakdown(userId, query));
  };

  referrers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    this.handleQuery(req, res, next, (userId, query) => this.service.getReferrerBreakdown(userId, query));
  };

  private async handleQuery(
    req: Request,
    res: Response,
    next: NextFunction,
    action: (userId: string, query: ReturnType<typeof RumQueryDto.parse>) => Promise<unknown>
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json(errorBody(res, 'UNAUTHORIZED', 'Missing JWT Token'));
        return;
      }

      const query = RumQueryDto.parse(req.query);
      const data = await action(userId, query);
      res.status(200).json(successBody(res, { data }));
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_ACCESS_DENIED') {
        res.status(403).json(errorBody(res, 'FORBIDDEN', 'No access to project RUM analytics'));
        return;
      }

      next(error);
    }
  }

  private resolveIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }

    return req.ip || '0.0.0.0';
  }

  private resolveCountry(req: Request): string {
    const candidate =
      req.headers['cf-ipcountry'] ||
      req.headers['x-vercel-ip-country'] ||
      req.headers['x-country-code'];

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim().toUpperCase().slice(0, 2);
    }

    return 'XX';
  }

  private resolveRegion(req: Request): string {
    const candidate =
      req.headers['x-vercel-ip-country-region'] ||
      req.headers['x-region-code'] ||
      req.headers['cf-region'];

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim().toUpperCase().slice(0, 16);
    }

    return 'UNKNOWN';
  }

  private resolveIdempotencyKey(req: Request): string | undefined {
    const value = req.headers['x-idempotency-key'];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().slice(0, 128);
    }

    return undefined;
  }
}
