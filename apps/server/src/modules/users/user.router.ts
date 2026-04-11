import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth } from '@shared/middleware/require-auth';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new UserController();

router.post(SERVER_ENDPOINTS.users.register, controller.register);
router.post(SERVER_ENDPOINTS.users.login, controller.login);
router.post(SERVER_ENDPOINTS.users.logout, controller.logout);

// Profile endpoints
router.get(SERVER_ENDPOINTS.users.me, requireAuth, controller.getProfile);
router.patch(SERVER_ENDPOINTS.users.me, requireAuth, controller.updateProfile);

// Team management endpoints
router.get(SERVER_ENDPOINTS.users.members, requireAuth, controller.listProjectMembers);
router.post(SERVER_ENDPOINTS.users.members, requireAuth, controller.addProjectMember);
router.patch(SERVER_ENDPOINTS.users.member, requireAuth, controller.updateMemberRole);
router.delete(SERVER_ENDPOINTS.users.member, requireAuth, controller.removeMember);

export { router as userRouter };