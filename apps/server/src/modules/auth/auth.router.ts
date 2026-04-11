import { Router } from 'express';
import { AuthController } from './auth.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { requireAuth } from '@shared/middleware/require-auth';

const router = Router();
const controller = new AuthController();

router.post(SERVER_ENDPOINTS.auth.login, controller.login);
router.post(SERVER_ENDPOINTS.auth.refresh, controller.refresh);
router.post(SERVER_ENDPOINTS.auth.logout, controller.logout);

// POST /api/v1/auth/keys
router.post(SERVER_ENDPOINTS.auth.keys, controller.generateKey);
router.post(SERVER_ENDPOINTS.auth.rumKeys, requireAuth, controller.generateRumKey);

export { router as authRouter };