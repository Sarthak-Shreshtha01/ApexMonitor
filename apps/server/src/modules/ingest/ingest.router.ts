import { Router } from 'express';
import { IngestController } from './ingest.controller';
import { validateApiKey } from '@modules/auth/middleware/auth.middleware';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new IngestController();

// POST /api/v1/ingest
router.post(SERVER_ENDPOINTS.ingest.root, validateApiKey, controller.ingestBatch);

export { router as ingestRouter };