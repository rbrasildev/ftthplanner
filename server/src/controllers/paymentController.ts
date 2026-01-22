import { Request, Response } from 'express';
import { MercadoPagoConfig, Payment } from 'mercadopago';

import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Initialize the client object with the access token from environment variables
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    options: { timeout: 5000, idempotencyKey: 'ftth-planner-payment' }
});

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

        // 2. Prepare Payment Data
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
                }
            }
        };

        // 3. Process Payment via Mercado Pago
        const result = await payment.create(paymentBody);

        if (result.status === 'approved') {
            // 4. Update Company Subscription on Success
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1); // 30 days subscription

            await prisma.company.update({
                where: { id: companyId },
                data: {
                    planId: plan.id,
                    status: 'ACTIVE',
                    subscriptionExpiresAt: nextMonth
                }
            });
        }

        return res.status(200).json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail,
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

const payment = new Payment(client);

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
                    email: payer.email,
                    identification: payer.identification
                },
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
        const id = query.id || body.data?.id;

        console.log('Webhook received:', { topic, id });

        if (!id) {
            return res.status(200).send('OK (No ID)');
        }

        if (topic === 'payment') {
            const paymentInfo = await payment.get({ id: String(id) });
            const companyId = paymentInfo.metadata?.company_id;

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
                console.log(`Company ${companyId} subscription activated via webhook.`);
            }
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook Error:', error);
        // Always return 200 to avoid retries from MP if it's just our logic failing
        return res.status(200).send('OK (Error handled)');
    }
};
