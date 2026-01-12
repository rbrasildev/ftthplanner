import express from 'express';
import { StripeService } from '../services/billing/stripeService';

const router = express.Router();

// POST /api/billing/create-customer
router.post('/create-customer', async (req, res) => {
    try {
        const { companyId, email, name } = req.body;
        // Verify user permission (e.g. is OWNER of companyId) - TODO: Add auth middleware
        const customerId = await StripeService.createCustomer(companyId, email, name);
        res.json({ customerId });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/billing/create-subscription
router.post('/create-subscription', async (req, res) => {
    try {
        // userId from Auth Middleware
        const { companyId, priceId, paymentMethodId, email } = req.body;
        // The email should be passed from frontend (UpgradePlanModal -> BillingModal -> here)
        // or fetched from user service via userId. Here we accept it from body for simplicity/updates.

        const result = await StripeService.createSubscription({
            companyId,
            email, // actually needs to be the billing email
            priceId,
            paymentMethodId
        });

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/billing/webhook
// This route needs raw body for signature verification.
// Ensure generic express.json() middleware doesn't pre-parse this if configured globally without exclusion.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
        return res.status(400).send('Missing Stripe Signature');
    }

    try {
        const success = await StripeService.handleWebhook(signature as string, req.body);
        if (success) {
            res.json({ received: true });
        } else {
            res.status(400).send('Webhook Error');
        }
    } catch (error: any) {
        console.error('Webhook Error:', error.message);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

export default router;
