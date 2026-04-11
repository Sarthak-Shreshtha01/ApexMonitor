import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { TracesController } from './traces.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new TracesController();

router.get(SERVER_ENDPOINTS.traces.root, requireAuth, controller.list);
router.get(SERVER_ENDPOINTS.traces.detail, requireAuth, controller.detail);

export { router as tracesRouter };
