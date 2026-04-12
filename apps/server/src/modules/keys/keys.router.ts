import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { KeysController } from './keys.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';

const router = Router();
const controller = new KeysController();

router.get(SERVER_ENDPOINTS.keys.root, requireAuth, asyncHandler(controller.list));
router.get(SERVER_ENDPOINTS.keys.stats, requireAuth, asyncHandler(controller.stats));
router.post(SERVER_ENDPOINTS.keys.root, requireAuth, asyncHandler(controller.create));
router.delete(SERVER_ENDPOINTS.keys.key, requireAuth, asyncHandler(controller.revoke));

export { router as keysRouter };
