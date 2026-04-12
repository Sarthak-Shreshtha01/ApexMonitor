import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { ProjectsController } from './projects.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';

const router = Router();
const controller = new ProjectsController();

router.get(SERVER_ENDPOINTS.projects.root, requireAuth, asyncHandler(controller.listMine));
router.post(SERVER_ENDPOINTS.projects.root, requireAuth, asyncHandler(controller.createMine));

export { router as projectsRouter };
