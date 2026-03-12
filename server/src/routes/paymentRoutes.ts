import { Router } from 'express';
import express from 'express';
import { processPayment, subscribe, handleWebhook, cancelSubscription, createPixPayment, getInvoiceStatus, getInvoices, createStripeIntent, handleStripeWebhook } from '../controllers/paymentController';

import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/process_payment', processPayment);
router.post('/subscribe', authenticateToken, subscribe);
router.post('/webhook', handleWebhook);

// Stripe endpoints
router.post('/create-stripe-intent', authenticateToken, createStripeIntent);
// Note: webhook should ideally use raw body, but we leave it default here inside the auth-less route. 
// If it fails signature verification due to JSON parsing, index.ts must be updated.
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

router.post('/cancel_subscription', authenticateToken, cancelSubscription);
router.post('/create_pix', authenticateToken, createPixPayment);
router.get('/invoices', authenticateToken, getInvoices);
router.get('/invoice/:id/status', authenticateToken, getInvoiceStatus);

export default router;
