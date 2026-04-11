import { Router } from 'express';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { validateRumWriteKey } from '@modules/auth/middleware/auth.middleware';
import { requireAuth } from '@shared/middleware/require-auth';
import { RumController } from './rum.controller';

const router = Router();
const controller = new RumController();

// Ingest path for browser telemetry: fast 202 + async queueing.
router.post(SERVER_ENDPOINTS.rum.root, validateRumWriteKey, controller.ingest);

// Authenticated analytics APIs.
router.get(SERVER_ENDPOINTS.rum.overview, requireAuth, controller.overview);
router.get(SERVER_ENDPOINTS.rum.series, requireAuth, controller.series);
router.get(SERVER_ENDPOINTS.rum.paths, requireAuth, controller.paths);
router.get(SERVER_ENDPOINTS.rum.devices, requireAuth, controller.devices);
router.get(SERVER_ENDPOINTS.rum.geo, requireAuth, controller.geo);
router.get(SERVER_ENDPOINTS.rum.referrers, requireAuth, controller.referrers);

export { router as rumRouter };
