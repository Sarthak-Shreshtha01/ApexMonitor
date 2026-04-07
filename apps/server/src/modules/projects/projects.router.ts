import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { ProjectsController } from './projects.controller';

const router = Router();
const controller = new ProjectsController();

router.get('/', requireAuth, controller.listMine);
router.post('/', requireAuth, controller.createMine);

export { router as projectsRouter };
