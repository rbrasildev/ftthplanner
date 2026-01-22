import { Router } from 'express';
import { processPayment, subscribe, handleWebhook } from '../controllers/paymentController';

import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/process_payment', processPayment);
router.post('/subscribe', authenticateToken, subscribe);
router.post('/webhook', handleWebhook);

export default router;
