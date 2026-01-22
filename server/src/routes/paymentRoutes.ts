import { Router } from 'express';
import { processPayment, subscribe, handleWebhook, cancelSubscription } from '../controllers/paymentController';

import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/process_payment', processPayment);
router.post('/subscribe', authenticateToken, subscribe);
router.post('/webhook', handleWebhook);
router.post('/cancel_subscription', authenticateToken, cancelSubscription);

export default router;
