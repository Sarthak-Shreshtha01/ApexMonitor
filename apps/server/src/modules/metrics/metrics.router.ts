import { Router } from 'express';
import { MetricsController } from './metrics.controller';
import { requireAuth } from '@shared/middleware/require-auth';

const router = Router();
const controller = new MetricsController();

// GET /api/v1/metrics/overview
router.get('/overview', requireAuth, controller.getOverview);

// GET /api/v1/metrics/latency
router.get('/latency', requireAuth, controller.getLatency);

export { router as metricsRouter };