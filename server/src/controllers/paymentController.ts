import { Request, Response } from 'express';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';

import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Initialize the client object with the access token from environment variables
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    options: { timeout: 10000, idempotencyKey: 'ftth-planner-payment' }
});

const preapproval = new PreApproval(client);
const payment = new Payment(client);

export const subscribe = async (req: AuthRequest, res: Response) => {
    try {
        const { planId, token, payment_method_id, payer, installments, issuer_id } = req.body;
        const companyId = req.user?.companyId;

        if (!companyId) {
            return res.status(401).json({ error: 'User does not belong to a company.' });
        }

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

        // CHECK IF PLAN HAS A MERCADOPAGO PLAN ID (Recurring)
        if (plan.mercadopagoId) {
            isSubscription = true;
            // Date for next payment (usually immediate for first)
            // But for PreApproval we usually just create it and it charges.

            const subscriptionBody = {
                body: {
                    reason: `Subscription: ${plan.name} (Company: ${companyId})`,
                    auto_recurring: {
                        frequency: 1,
                        frequency_type: 'months',
                        transaction_amount: plan.price,
                        currency_id: 'BRL'
                    },
                    back_url: process.env.VITE_API_URL || 'https://ftthplanner.com.br', // Redirect after payment
                    payer_email: payer.email,
                    card_token_id: token, // Card token from frontend
                    status: 'authorized', // Auto-approve
                    external_reference: companyId, // To identify in webhooks
                    // Enhanced data for anti-fraud
                    payment_method_id: payment_method_id,
                    payer: {
                        email: payer.email,
                        identification: payer.identification
                    }
                } as any // Cast to any because definitions might be missing these fields for PreApproval
            };

            try {
                // Note: 'create' for PreApproval might verify the card and set up recurrence
                result = await preapproval.create(subscriptionBody);
            } catch (subError: any) {
                console.error('PreApproval Create Error:', subError);
                // Fallback or re-throw
                throw subError;
            }

        } else {
            // FALLBACK TO ONE-TIME PAYMENT (Old Logic)
            const paymentBody = {
                body: {
                    transaction_amount: plan.price,
                    token: token,
                    description: `Subscription: ${plan.name} (Company: ${companyId})`,
                    installments: Number(installments || 1),
                    payment_method_id: payment_method_id,
                    issuer_id: issuer_id,
                    payer: {
                        email: payer.email,
                        identification: payer.identification
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
                }
            };
            result = await payment.create(paymentBody);
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
        }

        return res.status(200).json({
            id: result.id,
            status: result.status,
            status_detail: (result as any).status_detail || 'active', // PreApproval might not have status_detail
        });

    } catch (error: any) {
        console.error('Subscription Error:', error);
        const errorMessage = error.message || 'Unknown error during subscription';
        return res.status(500).json({
            error: 'Error processing subscription',
            details: errorMessage
        });
    }
};



export const processPayment = async (req: Request, res: Response) => {
    try {
        const { token, payment_method_id, transaction_amount, payer, installments, issuer_id, description } = req.body;

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
            }
        };

        const result = await payment.create(paymentData);

        return res.status(200).json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail,
        });

    } catch (error: any) {
        console.error('Mercado Pago Error:', error);

        // Handle specific Mercado Pago errors if possible, otherwise generic
        const errorMessage = error.message || 'Unknown error occurred during payment processing';
        return res.status(500).json({
            error: 'Error processing payment',
            details: errorMessage
        });
    }
};

export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const { query, body } = req;
        const topic = query.topic || query.type;
        const id = query.id || body.data?.id; // Payment ID or Preapproval ID

        console.log('Webhook received:', { topic, id });

        if (!id) {
            return res.status(200).send('OK (No ID)');
        }

        if (topic === 'payment') {
            const paymentInfo = await payment.get({ id: String(id) });
            const companyId = paymentInfo.metadata?.company_id || paymentInfo.external_reference;

            if (companyId && paymentInfo.status === 'approved') {
                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1);

                await prisma.company.update({
                    where: { id: companyId },
                    data: {
                        status: 'ACTIVE',
                        subscriptionExpiresAt: nextMonth
                    }
                });
                console.log(`Company ${companyId} subscription EXTENDED via payment webhook.`);
            }
        } else if (topic === 'subscription_preapproval') {
            // Handle Subscription events (e.g., cancelled, paused)
            const preapprovalInfo = await preapproval.get({ id: String(id) });
            const externalRef = preapprovalInfo.external_reference; // We stored companyId here

            if (externalRef) {
                if (preapprovalInfo.status === 'cancelled') {
                    // Optionally set status to CANCELLED or similar, but maybe just let it expire?
                    // Let's just log for now, or maybe remove the planId?
                    console.log(`Subscription ${id} for company ${externalRef} was CANCELLED.`);
                    // Potentially update DB to reflect cancellation pending
                }
            }
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook Error:', error);
        // Always return 200 to avoid retries from MP if it's just our logic failing
        return res.status(200).send('OK (Error handled)');
    }
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Company not found' });

        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company || !company.mercadopagoSubscriptionId) {
            return res.status(400).json({ error: 'No active subscription found to cancel.' });
        }

        // Cancel on Mercado Pago
        await preapproval.update({
            id: company.mercadopagoSubscriptionId,
            body: { status: 'cancelled' }
        });

        // Update local DB
        // We might want to keep the plan active until subscriptionExpiresAt
        // But remove the subscription ID so we don't try to cancel again
        await prisma.company.update({
            where: { id: companyId },
            data: {
                mercadopagoSubscriptionId: null
                // We keep status ACTIVE and subscriptionExpiresAt as is, so they finish the paid period
            }
        });

        res.json({ message: 'Subscription cancelled successfully.' });

    } catch (error: any) {
        console.error('Cancel Subscription Error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription', details: error.message });
    }
};
