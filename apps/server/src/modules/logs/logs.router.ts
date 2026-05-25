import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { LogsController } from './logs.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';
import { requireProjectAccess } from '@shared/middleware/require-project-access';

const router = Router();
const controller = new LogsController();

router.get(SERVER_ENDPOINTS.logs.root, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.list));

export { router as logsRouter };
