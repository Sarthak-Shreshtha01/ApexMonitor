import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { KeysController } from './keys.controller';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';
import { requireProjectAccess } from '@shared/middleware/require-project-access';

const router = Router();
const controller = new KeysController();

router.get(SERVER_ENDPOINTS.keys.root, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.list));
router.get(SERVER_ENDPOINTS.keys.stats, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.stats));
router.post(SERVER_ENDPOINTS.keys.root, requireAuth, requireProjectAccess({ source: 'body', requireOwner: true }), asyncHandler(controller.create));
router.delete(SERVER_ENDPOINTS.keys.key, requireAuth, requireProjectAccess({ source: 'query', requireOwner: true }), asyncHandler(controller.revoke));

export { router as keysRouter };
