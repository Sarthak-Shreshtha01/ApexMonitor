import { Router } from 'express';
import { BillingController } from './billing.controller';
import { requireAuth } from '@shared/middleware/require-auth';
import { SERVER_ENDPOINTS } from '@shared/constants/endpoints';

const router = Router();
const controller = new BillingController();

// Human-initiated (Protected by JWT)
router.post(SERVER_ENDPOINTS.billing.checkout, requireAuth, controller.checkout);

// Machine-initiated (Public, Protected by Cryptography)
router.post(SERVER_ENDPOINTS.billing.webhookPhonePe, controller.webhook);

export { router as billingRouter };