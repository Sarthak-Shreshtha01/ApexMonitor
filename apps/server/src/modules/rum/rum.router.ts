import { Router } from 'express';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { validateRumWriteKey } from '@modules/auth/middleware/auth.middleware';
import { requireAuth } from '@shared/middleware/require-auth';
import { RumController } from './rum.controller';
import { asyncHandler } from '@shared/middleware/async-handler';

const router = Router();
const controller = new RumController();

// Ingest path for browser telemetry: fast 202 + async queueing.
router.post(SERVER_ENDPOINTS.rum.root, validateRumWriteKey, asyncHandler(controller.ingest));

// Authenticated analytics APIs.
router.get(SERVER_ENDPOINTS.rum.overview, requireAuth, asyncHandler(controller.overview));
router.get(SERVER_ENDPOINTS.rum.series, requireAuth, asyncHandler(controller.series));
router.get(SERVER_ENDPOINTS.rum.paths, requireAuth, asyncHandler(controller.paths));
router.get(SERVER_ENDPOINTS.rum.devices, requireAuth, asyncHandler(controller.devices));
router.get(SERVER_ENDPOINTS.rum.geo, requireAuth, asyncHandler(controller.geo));
router.get(SERVER_ENDPOINTS.rum.referrers, requireAuth, asyncHandler(controller.referrers));

export { router as rumRouter };
