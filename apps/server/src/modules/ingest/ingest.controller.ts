import { Request, Response, NextFunction } from 'express';
import { IngestService } from './ingest.service';
import { IngestBatchDto } from './dto/ingest-batch.dto';
import { errorBody, successBody } from '@shared/http/api-contract';

export class IngestController {
  private service: IngestService;

  constructor() {
    this.service = new IngestService();
  }

  public ingestBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body using Zod
      const validatedData = IngestBatchDto.parse({
        ...req.body,
        idempotencyKey: this.resolveIdempotencyKey(req),
      });
      
      // Process batch
      const result = await this.service.processBatch(validatedData);
      
      // 202 Accepted indicates async processing
      res.status(202).json(successBody(res, {
        status: 'queued',
        ...result
      }));
    } catch (error: any) {
      if (error.message === 'RATE_LIMITED') {
        res.status(429).json(errorBody(res, 'RATE_LIMIT_EXCEEDED', 'Project RPM limit exceeded.'));
        return;
      }
      next(error); // Pass Zod validation errors to global error handler
    }
  };

  private resolveIdempotencyKey(req: Request): string | undefined {
    const headerValue = req.headers['x-idempotency-key'];
    if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
      return headerValue.trim().slice(0, 128);
    }

    return undefined;
  }
}