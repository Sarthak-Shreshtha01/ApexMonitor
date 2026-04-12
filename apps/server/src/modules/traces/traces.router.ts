import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { TracesController } from './traces.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';

const router = Router();
const controller = new TracesController();

router.get(SERVER_ENDPOINTS.traces.root, requireAuth, asyncHandler(controller.list));
router.get(SERVER_ENDPOINTS.traces.detail, requireAuth, asyncHandler(controller.detail));

export { router as tracesRouter };
