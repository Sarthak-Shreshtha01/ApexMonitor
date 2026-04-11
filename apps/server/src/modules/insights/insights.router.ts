import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { InsightsController } from './insights.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new InsightsController();

router.get(SERVER_ENDPOINTS.insights.root, requireAuth, controller.listRecent);

export { router as insightsRouter };
