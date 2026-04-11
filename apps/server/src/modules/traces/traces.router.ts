import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { TracesController } from './traces.controller';

const router = Router();
const controller = new TracesController();

router.get('/', requireAuth, controller.list);
router.get('/:traceId', requireAuth, controller.detail);

export { router as tracesRouter };
