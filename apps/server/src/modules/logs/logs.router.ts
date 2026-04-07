import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { LogsController } from './logs.controller';

const router = Router();
const controller = new LogsController();

router.get('/', requireAuth, controller.list);

export { router as logsRouter };
