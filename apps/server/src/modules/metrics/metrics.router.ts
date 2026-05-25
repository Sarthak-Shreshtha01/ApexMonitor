import { Router } from 'express';
import { MetricsController } from './metrics.controller';
import { requireAuth } from '@shared/middleware/require-auth';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { asyncHandler } from '@shared/middleware/async-handler';
import { requireProjectAccess } from '@shared/middleware/require-project-access';

const router = Router();
const controller = new MetricsController();

// GET /api/v1/metrics/overview
router.get(SERVER_ENDPOINTS.metrics.overview, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.getOverview));

// GET /api/v1/metrics/latency
router.get(SERVER_ENDPOINTS.metrics.latency, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.getLatency));

// GET /api/v1/metrics/operations
router.get(SERVER_ENDPOINTS.metrics.operations, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.getOperations));

export { router as metricsRouter };