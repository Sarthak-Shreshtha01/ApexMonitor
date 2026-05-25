import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { InsightsController } from './insights.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';
import { requireProjectAccess } from '@shared/middleware/require-project-access';

const router = Router();
const controller = new InsightsController();

router.get(SERVER_ENDPOINTS.insights.root, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.listRecent));

export { router as insightsRouter };
