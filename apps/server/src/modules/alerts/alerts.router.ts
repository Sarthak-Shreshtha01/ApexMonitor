import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { requireProjectAccess } from '@shared/middleware/require-project-access';
import { asyncHandler } from '@shared/middleware/async-handler';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';
import { AlertsController } from './alerts.controller';

const router = Router();
const controller = new AlertsController();
const E = SERVER_ENDPOINTS.alerts;

// Any project member can read; only owners can change rules (they send data to external URLs).
router.get(E.rules, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.listRules));
router.post(E.rules, requireAuth, requireProjectAccess({ source: 'body', requireOwner: true }), asyncHandler(controller.createRule));
router.patch(E.rule, requireAuth, requireProjectAccess({ source: 'query', requireOwner: true }), asyncHandler(controller.updateRule));
router.delete(E.rule, requireAuth, requireProjectAccess({ source: 'query', requireOwner: true }), asyncHandler(controller.deleteRule));
router.get(E.events, requireAuth, requireProjectAccess({ source: 'query' }), asyncHandler(controller.listEvents));

export { router as alertsRouter };
