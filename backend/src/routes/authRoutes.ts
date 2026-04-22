import { Router } from 'express';
import { authController } from '../controllers/authController';

const router = Router();

router.get('/nonce/:address', authController.getNonce.bind(authController));
router.post('/verify', authController.verifySignature.bind(authController));

export default router;
