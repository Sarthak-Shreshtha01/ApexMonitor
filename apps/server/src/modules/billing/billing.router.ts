import { Router } from 'express';
import { BillingController } from './billing.controller';
import { requireAuth } from '@shared/middleware/require-auth';

const router = Router();
const controller = new BillingController();

// Human-initiated (Protected by JWT)
router.post('/checkout', requireAuth, controller.checkout);

// Machine-initiated (Public, Protected by Cryptography)
router.post('/webhook/phonepe', controller.webhook);

export { router as billingRouter };