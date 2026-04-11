import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { ProjectsController } from './projects.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new ProjectsController();

router.get(SERVER_ENDPOINTS.projects.root, requireAuth, controller.listMine);
router.post(SERVER_ENDPOINTS.projects.root, requireAuth, controller.createMine);

export { router as projectsRouter };
