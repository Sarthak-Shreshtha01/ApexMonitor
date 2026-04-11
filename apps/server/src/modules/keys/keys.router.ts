import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { KeysController } from './keys.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new KeysController();

router.get(SERVER_ENDPOINTS.keys.root, requireAuth, controller.list);
router.post(SERVER_ENDPOINTS.keys.root, requireAuth, controller.create);
router.delete(SERVER_ENDPOINTS.keys.key, requireAuth, controller.revoke);

export { router as keysRouter };
