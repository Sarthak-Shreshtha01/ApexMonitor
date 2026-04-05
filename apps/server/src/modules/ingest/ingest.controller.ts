import { Request, Response, NextFunction } from 'express';
import { IngestService } from './ingest.service';
import { IngestBatchDto } from './dto/ingest-batch.dto';

export class IngestController {
  private service: IngestService;

  constructor() {
    this.service = new IngestService();
  }

  public ingestBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body using Zod
      const validatedData = IngestBatchDto.parse(req.body);
      
      // Process batch
      const result = await this.service.processBatch(validatedData);
      
      // 202 Accepted indicates async processing
      res.status(202).json({
        status: 'queued',
        ...result
      });
    } catch (error: any) {
      if (error.message === 'RATE_LIMITED') {
        res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Project RPM limit exceeded.' });
        return;
      }
      next(error); // Pass Zod validation errors to global error handler
    }
  };
}