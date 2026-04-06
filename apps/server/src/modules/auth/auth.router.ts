import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const controller = new AuthController();

router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

// POST /api/v1/auth/keys
router.post('/keys', controller.generateKey);

export { router as authRouter };