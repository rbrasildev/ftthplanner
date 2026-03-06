import { Router } from 'express';
import { processPayment, subscribe, handleWebhook, cancelSubscription, createPixPayment, getInvoiceStatus, getInvoices } from '../controllers/paymentController';

import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/process_payment', processPayment);
router.post('/subscribe', authenticateToken, subscribe);
router.post('/webhook', handleWebhook);
router.post('/cancel_subscription', authenticateToken, cancelSubscription);
router.post('/create_pix', authenticateToken, createPixPayment);
router.get('/invoices', authenticateToken, getInvoices);
router.get('/invoice/:id/status', authenticateToken, getInvoiceStatus);

export default router;
