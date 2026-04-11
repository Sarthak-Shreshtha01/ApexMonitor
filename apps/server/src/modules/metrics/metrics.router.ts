import { Router } from 'express';
import { MetricsController } from './metrics.controller';
import { requireAuth } from '@shared/middleware/require-auth';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new MetricsController();

// GET /api/v1/metrics/overview
router.get(SERVER_ENDPOINTS.metrics.overview, requireAuth, controller.getOverview);

// GET /api/v1/metrics/latency
router.get(SERVER_ENDPOINTS.metrics.latency, requireAuth, controller.getLatency);

// GET /api/v1/metrics/operations
router.get(SERVER_ENDPOINTS.metrics.operations, requireAuth, controller.getOperations);

export { router as metricsRouter };