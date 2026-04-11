import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth } from '@shared/middleware/require-auth';

const router = Router();
const controller = new UserController();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);

// Profile endpoints
router.get('/me', requireAuth, controller.getProfile);
router.patch('/me', requireAuth, controller.updateProfile);

// Team management endpoints
router.get('/:projectId/members', requireAuth, controller.listProjectMembers);
router.post('/:projectId/members', requireAuth, controller.addProjectMember);
router.patch('/:projectId/members/:memberId', requireAuth, controller.updateMemberRole);
router.delete('/:projectId/members/:memberId', requireAuth, controller.removeMember);

export { router as userRouter };