import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { TracesController } from './traces.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';
import { requireProjectAccess } from '@shared/middleware/require-project-access';

const router = Router();
const controller = new TracesController();

router.get(SERVER_ENDPOINTS.traces.root, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.list));
router.get(SERVER_ENDPOINTS.traces.detail, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.detail));

export { router as tracesRouter };
