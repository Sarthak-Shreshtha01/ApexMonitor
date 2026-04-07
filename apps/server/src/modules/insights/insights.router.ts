import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { InsightsController } from './insights.controller';

const router = Router();
const controller = new InsightsController();

router.get('/', requireAuth, controller.listRecent);

export { router as insightsRouter };
