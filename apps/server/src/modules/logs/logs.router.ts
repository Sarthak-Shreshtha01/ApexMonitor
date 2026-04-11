import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { LogsController } from './logs.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new LogsController();

router.get(SERVER_ENDPOINTS.logs.root, requireAuth, controller.list);

export { router as logsRouter };
