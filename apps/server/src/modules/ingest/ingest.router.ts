import { Router } from 'express';
import { IngestController } from './ingest.controller';
import { validateApiKey } from '@modules/auth/middleware/auth.middleware';

const router = Router();
const controller = new IngestController();

// POST /api/v1/ingest
router.post('/', validateApiKey ,controller.ingestBatch);

export { router as ingestRouter };