import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth } from '@shared/middleware/require-auth';

const router = Router();
const controller = new UserController();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);

// Example of a protected dashboard route using the new middleware
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export { router as userRouter };