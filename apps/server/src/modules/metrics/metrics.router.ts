import { Router } from 'express';
import { MetricsController } from './metrics.controller';

const router = Router();
const controller = new MetricsController();

// GET /api/v1/metrics/latency
router.get('/latency', controller.getLatency);

export { router as metricsRouter };