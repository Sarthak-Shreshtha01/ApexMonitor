import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth } from '@shared/middleware/require-auth';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';

const router = Router();
const controller = new UserController();

router.post(SERVER_ENDPOINTS.users.register, asyncHandler(controller.register));
router.post(SERVER_ENDPOINTS.users.login, asyncHandler(controller.login));
router.post(SERVER_ENDPOINTS.users.logout, asyncHandler(controller.logout));

// Profile endpoints
router.get(SERVER_ENDPOINTS.users.me, requireAuth, asyncHandler(controller.getProfile));
router.patch(SERVER_ENDPOINTS.users.me, requireAuth, asyncHandler(controller.updateProfile));

// Team management endpoints
router.get(SERVER_ENDPOINTS.users.members, requireAuth, asyncHandler(controller.listProjectMembers));
router.post(SERVER_ENDPOINTS.users.members, requireAuth, asyncHandler(controller.addProjectMember));
router.patch(SERVER_ENDPOINTS.users.member, requireAuth, asyncHandler(controller.updateMemberRole));
router.delete(SERVER_ENDPOINTS.users.member, requireAuth, asyncHandler(controller.removeMember));

export { router as userRouter };