import { Router } from 'express';
import { AuthController } from './auth.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { requireAuth } from '@shared/middleware/require-auth';
import { asyncHandler } from '@shared/middleware/async-handler';

const router = Router();
const controller = new AuthController();

router.post(SERVER_ENDPOINTS.auth.login, asyncHandler(controller.login));
router.post(SERVER_ENDPOINTS.auth.refresh, asyncHandler(controller.refresh));
router.post(SERVER_ENDPOINTS.auth.logout, asyncHandler(controller.logout));
router.get(SERVER_ENDPOINTS.auth.oauthStart, asyncHandler(controller.oauthStart));
router.get(SERVER_ENDPOINTS.auth.oauthCallback, asyncHandler(controller.oauthCallback));

// POST /api/v1/auth/keys
router.post(SERVER_ENDPOINTS.auth.keys, asyncHandler(controller.generateKey));
router.post(SERVER_ENDPOINTS.auth.rumKeys, requireAuth, asyncHandler(controller.generateRumKey));

export { router as authRouter };