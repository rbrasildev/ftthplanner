import { Request, Response } from 'express';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';

import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import Stripe from 'stripe';
import logger from '../lib/logger';

// Initialize Stripe lazily to ensure process.env is fully loaded via dotenv
let stripeInstance: Stripe | null = null;
const getStripe = () => {
    if (!stripeInstance) {
        if (!process.env.STRIPE_SECRET_KEY) {
            logger.error('CRITICAL: STRIPE_SECRET_KEY is missing in env!');
        }
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2023-10-16' as any,
        });
    }
    return stripeInstance;
};

// Initialize the client object with the access token from environment variables
if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    logger.warn('WARNING: MERCADOPAGO_ACCESS_TOKEN is not set in environment variables.');
}

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    options: { timeout: 10000 }
});

const preapproval = new PreApproval(client);
const payment = new Payment(client);

// ------------- STRIPE IMPLEMENTATION -------------

export const createStripeIntent = async (req: AuthRequest, res: Response) => {
    try {
        const { planId } = req.body;
        const companyId = req.user?.companyId;

        if (!companyId) return res.status(401).json({ error: 'User does not belong to a company.' });

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: { users: true }
        });

        if (!company) return res.status(404).json({ error: 'Company not found.' });

        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found.' });

        // Retrieve or create Stripe Customer
        let stripeCustomerId = (company as any).stripeCustomerId as string | undefined;
        const stripe = getStripe();

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: company.users?.[0]?.email,
                name: company.name,
                metadata: {
                    companyId: companyId
                }
            });
            stripeCustomerId = customer.id;
            
            // Save customer ID for future use (requires adding this field to schema later, or saving in metadata. 
            // For now, if schema doesn't have stripeCustomerId, we'll just create a new one each time to avoid crashing.
            // Let's assume Prisma schema doesn't have it yet. We will just use the new customer.)
            try {
                // Ignore TS error if field doesn't exist yet, we will just silently fail to save it
                await (prisma.company as any).update({
                    where: { id: companyId },
                    data: { stripeCustomerId: customer.id }
                });
            } catch (e) { logger.debug("Could not save stripeCustomerId, column might not exist."); }
        }

        // Check if plan has a pre-existing Stripe Price ID
        const stripePriceId = plan.stripeId;

        let subscriptionItems = [];

        if (stripePriceId) {
            subscriptionItems = [{
                price: stripePriceId, // Use the price ID from the admin panel directly
            }];
        } else {
            // Fallback: Create a unique product for this plan inline (if stripeId wasn't set)
            const product = await stripe.products.create({
                name: plan.name,
                description: `SaaS Subscription - ${plan.name}`,
            });

            subscriptionItems = [{
                price_data: {
                    currency: 'BRL',
                    product: product.id,
                    unit_amount: Math.round(plan.price * 100), // Stripe works in cents
                    recurring: {
                        interval: 'month' as const,
                    },
                },
            }];
        }

        // Create a generic Subscription or PaymentIntent.
        const subscription = await stripe.subscriptions.create({
            customer: stripeCustomerId,
            items: subscriptionItems,
            payment_behavior: 'default_incomplete',
            payment_settings: { 
                save_default_payment_method: 'on_subscription',
                payment_method_options: {
                    card: { request_three_d_secure: 'any' }
                }
            },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
                companyId: companyId,
                planId: plan.id
            }
        });

        const invoice = subscription.latest_invoice as any;
        const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

        res.json({
            clientSecret: paymentIntent.client_secret,
            subscriptionId: subscription.id
        });

    } catch (error: any) {
        logger.error(`Stripe Intent Error: ${error.message}`);
        require('fs').writeFileSync('stripe-error.log', String(error.stack || error.message) + '\n' + JSON.stringify(error, null, 2));
        res.status(500).json({ error: 'Stripe Error: ' + (error.message || 'Unknown'), details: error.message });
    }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
        logger.error('Stripe Webhook missing signature or secret');
        return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    let event: Stripe.Event;
    const stripe = getStripe();

    try {
        // Stripe requires the raw body, assuming index.ts maps /api/payments/stripe-webhook to raw express middleware
        // Alternatively, if body-parser is already parsing JSON globally, we may need to verify from req.body directly
        // Warning: if express.json() is applied globally before this route, signature verification will fail unless raw body is saved.
        // For standard implementations, we will attempt to parse it or trust it if testing locally.
        const payload = (req as any).rawBody || req.body;
        event = stripe.webhooks.constructEvent(payload, sig as string, webhookSecret);
    } catch (err: any) {
        logger.error(`Stripe Webhook Signature Verification Failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object as any;
            const subscriptionId = invoice.subscription as string;
            
            let companyId = invoice.metadata?.companyId;
            let planId = invoice.metadata?.planId;

            if (subscriptionId) {
                // Retrieve subscription to get metadata
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                companyId = companyId || subscription.metadata?.companyId;
                planId = planId || subscription.metadata?.planId;
            }

            if (companyId && planId) {
                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1); // Simplistic 30 day bump

                await prisma.company.update({
                    where: { id: companyId },
                    data: {
                        planId: planId,
                        status: 'ACTIVE',
                        subscriptionExpiresAt: nextMonth
                    }
                });
                logger.info(`Stripe Webhook: Activated company ${companyId} on plan ${planId}`);
            } else {
                logger.info(`Stripe Webhook: Unhandled invoice ${invoice.id} payment_succeeded (missing companyId/planId)`);
            }
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.stack || error.message : String(error);
        logger.error(`Error processing Stripe webhook: ${errMsg}`);
        require('fs').appendFileSync(require('path').join(__dirname, '../../stripe-error.log'), `\n[WEBHOOK ERR] ${new Date().toISOString()}:\n${errMsg}\n`);
        return res.status(500).json({ error: 'Failed to process webhook', details: errMsg });
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
};

// ------------- MERCADO PAGO IMPLEMENTATION -------------

export const subscribe = async (req: AuthRequest, res: Response) => {
    try {
        const { planId, token, payment_method_id, payer, installments, issuer_id, deviceId } = req.body;
        const companyId = req.user?.companyId;

        if (!companyId) {
            return res.status(401).json({ error: 'User does not belong to a company.' });
        }

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: { users: true }
        });

        // 1. Fetch Plan Details (Secure Price)
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found.' });
        }

        if (plan.price <= 0) {
            // Free plan logic - just update
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);

            await prisma.company.update({
                where: { id: companyId },
                data: {
                    planId: plan.id,
                    status: 'ACTIVE',
                    subscriptionExpiresAt: nextYear
                }
            });
            return res.json({ status: 'approved', message: 'Free plan activated' });
        }

        // 3. Process Payment/Subscription via Mercado Pago
        let result;
        let isSubscription = false;

        // Sanitize payer data for both PreApproval and Fallback
        const rawName = payer.first_name || 'Cliente';
        const nameParts = rawName.trim().split(' ');
        const firstName = nameParts[0].substring(0, 256);
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ').substring(0, 256) : undefined;

        // Try to construct a valid phone number from the company/user
        const rawPhone = company?.phone || (company as any)?.users?.[0]?.phone || '11999999999';
        const cleanPhone = rawPhone.replace(/\D/g, '');
        const phoneAreaCode = cleanPhone.length >= 10 ? cleanPhone.substring(0, 2) : '11';
        const phoneNumber = cleanPhone.length >= 10 ? cleanPhone.substring(2) : '999999999';

        // Mock address to satisfy MP anti-fraud structural validation
        const mockAddress = {
            zip_code: '01001000', // Praça da Sé, SP (Generic valid format)
            street_name: 'Rua Principal',
            street_number: 123
        };

        // CHECK IF PLAN HAS A MERCADOPAGO PLAN ID (Recurring)
        if (plan.mercadopagoId) {
            isSubscription = true;
            // Date for next payment (usually immediate for first)
            // But for PreApproval we usually just create it and it charges.

            const subscriptionBody = {
                body: {
                    preapproval_plan_id: plan.mercadopagoId,
                    payer_email: payer.email,
                    payer_first_name: firstName,
                    payer_last_name: lastName,
                    card_token_id: token,
                    back_url: process.env.APP_URL || process.env.VITE_API_URL || 'https://ftthplanner.com.br',
                    status: 'authorized',
                    external_reference: companyId,
                } as any,
                requestOptions: deviceId ? { customHeaders: { 'X-meli-session-id': String(deviceId) } } as any : undefined
            };

            try {
                // Note: 'create' for PreApproval might verify the card and set up recurrence
                result = await preapproval.create(subscriptionBody);
            } catch (subError: any) {
                logger.error(`Mercado Pago PreApproval Create Error: ${subError.message}`);
                // Fallback or re-throw
                throw subError;
            }

        } else {
            // FALLBACK TO ONE-TIME PAYMENT (Old Logic)
            const paymentBody = {
                body: {
                    transaction_amount: Number(plan.price),
                    token: token,
                    description: `Subscription: ${plan.name} (Company: ${companyId})`,
                    installments: Number(installments || 1),
                    payment_method_id: payment_method_id,
                    issuer_id: issuer_id,
                    payer: {
                        email: payer.email,
                        first_name: firstName,
                        last_name: lastName,
                        phone: {
                            area_code: phoneAreaCode,
                            number: phoneNumber
                        },
                        address: mockAddress,
                        identification: payer.identification && payer.identification.number ? {
                            type: payer.identification.type ? String(payer.identification.type).toUpperCase() : 'CPF',
                            number: String(payer.identification.number).replace(/\D/g, '')
                        } : { type: 'CPF', number: '00000000000' }
                    },
                    metadata: {
                        company_id: companyId,
                        plan_id: plan.id
                    },
                    additional_info: {
                        items: [
                            {
                                id: plan.id,
                                title: plan.name,
                                description: `Subscription: ${plan.name}`,
                                quantity: 1,
                                unit_price: Number(plan.price),
                                category_id: 'services'
                            }
                        ]
                    }
                },
                requestOptions: deviceId ? { customHeaders: { 'X-meli-session-id': String(deviceId) } } as any : undefined
            };
            result = await payment.create(paymentBody as any);
        }

        // 4. Update Company Subscription on Success
        // For subscriptions, status usually starts as 'authorized' or 'pending'
        const isApproved = result.status === 'approved' || result.status === 'authorized';

        if (isApproved) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1); // 30 days subscription

            if (isSubscription) {
                await prisma.company.update({
                    where: { id: companyId },
                    data: {
                        planId: plan.id,
                        status: 'PENDING', // Wait for webhook payment approval
                        mercadopagoSubscriptionId: String(result.id)
                    }
                });
            } else {
                await prisma.company.update({
                    where: { id: companyId },
                    data: {
                        planId: plan.id,
                        status: 'ACTIVE',
                        subscriptionExpiresAt: nextMonth,
                        mercadopagoSubscriptionId: undefined
                    }
                });
            }
        } else {
            return res.status(400).json({
                error: 'Payment rejected',
                message: `Pagamento recusado (${(result as any).status_detail || result.status}). Verifique o cartão.`,
                details: result
            });
        }

        return res.status(200).json({
            id: result.id,
            status: result.status,
            status_detail: (result as any).status_detail || 'active',
        });

    } catch (error: any) {
        logger.error(`Mercado Pago Subscription Error: ${error.message}`);

        let errorMessage = error.message || 'Unknown error during subscription';
        let errorDetails = error;

        // Try to extract more details from Mercado Pago error
        if (error.response?.data) {
            logger.error(`Mercado Pago API Error Details: ${JSON.stringify(error.response.data)}`);
            errorMessage = error.response.data.message || errorMessage;
            errorDetails = error.response.data;
        }

        return res.status(500).json({
            error: 'Error processing subscription',
            message: errorMessage,
            details: errorDetails
        });
    }
};



export const processPayment = async (req: Request, res: Response) => {
    try {
        const { token, payment_method_id, transaction_amount, payer, installments, issuer_id, description, deviceId } = req.body;

        // Basic validation
        if (!token || !payment_method_id || !transaction_amount || !payer || !payer.email) {
            return res.status(400).json({ error: 'Missing required payment data: token, payment_method_id, transaction_amount, payer.email are required.' });
        }

        const paymentData = {
            body: {
                transaction_amount: Number(transaction_amount),
                token: token,
                description: description || 'FTTH Planner Subscription',
                installments: Number(installments || 1),
                payment_method_id: payment_method_id,
                issuer_id: issuer_id,
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: payer.identification
                },
                additional_info: {
                    items: [
                        {
                            id: 'subscription-item',
                            title: description || 'FTTH Planner Subscription',
                            description: description || 'FTTH Planner Subscription',
                            quantity: 1,
                            unit_price: Number(transaction_amount),
                            category_id: 'services'
                        }
                    ]
                }
            },
            requestOptions: deviceId ? { customHeaders: { 'X-meli-session-id': String(deviceId) } } as any : undefined
        };

        const result = await payment.create(paymentData as any);

        return res.status(200).json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail,
        });

    } catch (error: any) {
        logger.error(`Mercado Pago Payment Error: ${error.message}`);

        // Handle specific Mercado Pago errors if possible, otherwise generic
        const errorMessage = error.message || 'Unknown error occurred during payment processing';
        return res.status(500).json({
            error: 'Error processing payment',
            details: errorMessage
        });
    }
};

export const createPixPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { planId, payer } = req.body;
        const companyId = req.user?.companyId;

        if (!companyId) return res.status(401).json({ error: 'User does not belong to a company.' });
        if (!planId || !payer || !payer.email) return res.status(400).json({ error: 'Missing required data (planId, payer.email).' });

        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found.' });

        // Update company payment method preference
        await prisma.company.update({
            where: { id: companyId },
            data: { paymentMethod: 'PIX' }
        });

        // MercadoPago requires an explicit GMT offset like -03:00 or Z
        const dateOfExpiration = new Date();
        dateOfExpiration.setHours(dateOfExpiration.getHours() + 24);

        // Formata data ISO com offset para satisfazer MP (ex: 2024-05-15T10:00:00.000-03:00)
        // Isso evita bugs de TZ ('Z' as vezes é rejeitado dependendo da conta)
        const tzo = -dateOfExpiration.getTimezoneOffset();
        const dif = tzo >= 0 ? '+' : '-';
        const pad = (num: number) => {
            const norm = Math.floor(Math.abs(num));
            return (norm < 10 ? '0' : '') + norm;
        };
        const isoExpiration = dateOfExpiration.getFullYear() +
            '-' + pad(dateOfExpiration.getMonth() + 1) +
            '-' + pad(dateOfExpiration.getDate()) +
            'T' + pad(dateOfExpiration.getHours()) +
            ':' + pad(dateOfExpiration.getMinutes()) +
            ':' + pad(dateOfExpiration.getSeconds()) +
            '.' + (dateOfExpiration.getMilliseconds() / 1000).toFixed(3).slice(2, 5) +
            dif + pad(tzo / 60) + ':' + pad(tzo % 60);

        // Sanitize payer data
        const rawName = payer.first_name || 'Cliente';
        const nameParts = rawName.trim().split(' ');
        const firstName = nameParts[0].substring(0, 256);
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ').substring(0, 256) : undefined;

        const cleanIdentification = payer.identification && payer.identification.number ? {
            type: payer.identification.type ? String(payer.identification.type).toUpperCase() : 'CPF',
            number: String(payer.identification.number).replace(/\D/g, '')
        } : { type: 'CPF', number: '00000000000' };

        const paymentBody = {
            body: {
                transaction_amount: Number(plan.price),
                description: `FTTH Planner - Assinatura: ${plan.name}`,
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: firstName,
                    last_name: lastName,
                    identification: cleanIdentification
                },
                date_of_expiration: isoExpiration,
                external_reference: companyId,
                metadata: {
                    company_id: companyId,
                    plan_id: plan.id,
                    type: 'SUBSCRIPTION_PIX'
                }
            }
        };

        const result = await payment.create(paymentBody);

        const qrCode = result.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64;

        if (!qrCode) {
            throw new Error('QR Code was not generated by Mercado Pago.');
        }

        // Save Invoice in local DB
        const invoice = await prisma.invoice.create({
            data: {
                companyId,
                planId,
                amount: plan.price,
                status: 'PENDING',
                paymentMethod: 'PIX',
                mercadopagoPaymentId: String(result.id),
                qrCode,
                qrCodeBase64,
                expiresAt: dateOfExpiration
            }
        });

        return res.status(200).json({
            id: result.id,
            status: result.status,
            qr_code: qrCode,
            qr_code_base64: qrCodeBase64,
            expires_at: dateOfExpiration,
            invoiceId: invoice.id
        });

    } catch (error: any) {
        logger.error(`Mercado Pago Create Pix Error: ${error.message}`);
        return res.status(500).json({
            error: 'Error generating Pix payment',
            details: error.response?.data || { message: error.message },
            message: error.message
        });
    }
};


export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const { query, body } = req;
        // Mercado Pago can send notifications via IPN (query params) or Webhooks (body)
        const topic = query.topic || query.type || body.type || body.action?.split('.')[0];
        const id = query.id || body.data?.id || body.id;

        logger.info(`Mercado Pago Webhook received: topic=${topic}, id=${id}, body.action=${body.action}`);
        
        // Log body for debugging purposes if needed (careful with sensitive data)
        if (process.env.NODE_ENV === 'development') {
            logger.debug(`MP Webhook Body: ${JSON.stringify(body)}`);
        }

        if (!id) {
            return res.status(200).send('OK (No ID)');
        }

        // We only process 'payment' topic for PIX and one-time payments activation
        if (topic === 'payment') {
            const paymentInfo = await payment.get({ id: String(id) });
            const companyId = paymentInfo.metadata?.company_id || paymentInfo.external_reference;
            const planId = paymentInfo.metadata?.plan_id;

            logger.info(`Processing payment ${id} for company ${companyId}. Status: ${paymentInfo.status}`);

            if (companyId && paymentInfo.status === 'approved') {
                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1);

                // Update company status, expiration AND planId
                await prisma.company.update({
                    where: { id: companyId },
                    data: {
                        status: 'ACTIVE',
                        subscriptionExpiresAt: nextMonth,
                        planId: planId || undefined // Only update if planId is present in metadata
                    }
                });

                // If it's a known Invoice (Pix or manual payment), mark as PAID
                const localInvoice = await prisma.invoice.findUnique({
                    where: { mercadopagoPaymentId: String(id) }
                });
                if (localInvoice && localInvoice.status !== 'PAID') {
                    await prisma.invoice.update({
                        where: { id: localInvoice.id },
                        data: { status: 'PAID' }
                    });
                }

                logger.info(`Company ${companyId} subscription ACTIVATED/EXTENDED via payment webhook. ID: ${id}, Plan: ${planId}`);
            }
        } else if (topic === 'subscription_preapproval') {
            // Handle Subscription events (e.g., cancelled, paused)
            const preapprovalInfo = await preapproval.get({ id: String(id) });
            const externalRef = preapprovalInfo.external_reference; // We stored companyId here

            if (externalRef) {
                if (preapprovalInfo.status === 'cancelled') {
                    logger.info(`Mercado Pago Subscription ${id} for company ${externalRef} was CANCELLED.`);
                }
            }
        }

        return res.status(200).send('OK');

    } catch (error) {
        logger.error(`Mercado Pago Webhook Logic Error: ${error instanceof Error ? error.message : String(error)}`);
        // Always return 200 to avoid retries from MP if it's just our logic failing
        return res.status(200).send('OK (Error handled)');
    }
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Company not found' });

        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company) return res.status(404).json({ error: 'Company not found' });

        // If there's a MercadoPago recurring subscription, cancel it remotely
        if (company.mercadopagoSubscriptionId) {
            try {
                await preapproval.update({
                    id: company.mercadopagoSubscriptionId,
                    body: { status: 'cancelled' }
                });
            } catch (mpError: any) {
                // Log but don't block - subscription may already be cancelled on MP side
                logger.warn(`MP cancel failed (may be already cancelled): ${mpError.message}`);
            }
        }

        // Deactivate locally: clear subscription ID, set status to CANCELLED
        // Keep subscriptionExpiresAt so they finish the paid period
        await prisma.company.update({
            where: { id: companyId },
            data: {
                mercadopagoSubscriptionId: null,
                status: 'CANCELLED'
            }
        });

        res.json({ message: 'Subscription cancelled successfully.' });

    } catch (error: any) {
        logger.error(`Cancel Subscription Error: ${error.message}`);
        res.status(500).json({ error: 'Failed to cancel subscription', details: error.message });
    }
};

export const getInvoiceStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId;

        if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

        const invoice = await prisma.invoice.findFirst({
            where: { id: id, companyId: companyId },
            select: { status: true, mercadopagoPaymentId: true, planId: true, createdAt: true }
        });

        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        // Fallback: If still PENDING and has a MercadoPago payment ID,
        // check directly with MercadoPago in case the webhook was missed.
        // Only check if invoice is older than 30 seconds (avoid hammering MP API on initial polls).
        if (invoice.status === 'PENDING' && invoice.mercadopagoPaymentId) {
            const ageMs = Date.now() - new Date(invoice.createdAt).getTime();
            if (ageMs > 30_000) {
                try {
                    const paymentInfo = await payment.get({ id: invoice.mercadopagoPaymentId });
                    if (paymentInfo.status === 'approved') {
                        logger.info(`[getInvoiceStatus] Fallback: Payment ${invoice.mercadopagoPaymentId} approved (webhook missed). Activating...`);

                        // Activate subscription
                        const nextMonth = new Date();
                        nextMonth.setMonth(nextMonth.getMonth() + 1);
                        await prisma.company.update({
                            where: { id: companyId },
                            data: {
                                status: 'ACTIVE',
                                subscriptionExpiresAt: nextMonth,
                                planId: invoice.planId || undefined
                            }
                        });

                        // Mark invoice as PAID
                        await prisma.invoice.update({
                            where: { id },
                            data: { status: 'PAID' }
                        });

                        return res.json({ status: 'PAID' });
                    }
                } catch (mpError) {
                    // If MP API fails, just return current DB status (don't block the user)
                    logger.warn(`[getInvoiceStatus] Fallback MP check failed: ${mpError instanceof Error ? mpError.message : String(mpError)}`);
                }
            }
        }

        return res.json({ status: invoice.status });
    } catch (error) {
        logger.error(`Get Invoice Status Error: ${error instanceof Error ? error.message : String(error)}`);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const getInvoices = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;

        if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

        const invoices = await prisma.invoice.findMany({
            where: { companyId: companyId },
            orderBy: { createdAt: 'desc' },
            include: {
                plan: {
                    select: { name: true }
                }
            }
        });

        return res.json(invoices.map(inv => ({
            id: inv.id,
            planName: inv.plan?.name || 'Assinatura',
            amount: inv.amount,
            status: inv.status,
            paymentMethod: inv.paymentMethod,
            createdAt: inv.createdAt,
            expiresAt: inv.expiresAt,
            qrCode: inv.qrCode,
            qrCodeBase64: inv.qrCodeBase64,
            mercadopagoPaymentId: inv.mercadopagoPaymentId
        })));
    } catch (error) {
        logger.error(`Get Invoices Error: ${error instanceof Error ? error.message : String(error)}`);
        return res.status(500).json({ error: 'Failed to fetch invoices' });
    }
};
