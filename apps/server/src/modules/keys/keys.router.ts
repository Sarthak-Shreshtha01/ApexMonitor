import { Router } from 'express';
import { requireAuth } from '@shared/middleware/require-auth';
import { KeysController } from './keys.controller';

const router = Router();
const controller = new KeysController();

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.delete('/:keyId', requireAuth, controller.revoke);

export { router as keysRouter };
