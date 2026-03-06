import { Request, Response } from 'express';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';

import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Initialize the client object with the access token from environment variables
if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    console.warn('WARNING: MERCADOPAGO_ACCESS_TOKEN is not set in environment variables.');
}

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    options: { timeout: 10000, idempotencyKey: 'ftth-planner-payment' }
});

const preapproval = new PreApproval(client);
const payment = new Payment(client);

export const subscribe = async (req: AuthRequest, res: Response) => {
    try {
        const { planId, token, payment_method_id, payer, installments, issuer_id, deviceId } = req.body;
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
                    preapproval_plan_id: plan.mercadopagoId,
                    payer_email: payer.email,
                    card_token_id: token,
                    back_url: process.env.VITE_API_URL || 'https://ftthplanner.com.br',
                    status: 'authorized',
                    external_reference: companyId,
                } as any,
                requestOptions: deviceId ? { headers: { 'X-meli-session-id': String(deviceId) } } as any : undefined
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
                        first_name: payer.first_name,
                        last_name: payer.last_name,
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
                },
                requestOptions: deviceId ? { headers: { 'X-meli-session-id': String(deviceId) } } as any : undefined
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
        console.error('Subscription Error:', error);

        let errorMessage = error.message || 'Unknown error during subscription';
        let errorDetails = error;

        // Try to extract more details from Mercado Pago error
        if (error.response?.data) {
            console.error('Mercado Pago API Error Details:', JSON.stringify(error.response.data, null, 2));
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
            requestOptions: deviceId ? { headers: { 'X-meli-session-id': String(deviceId) } } as any : undefined
        };

        const result = await payment.create(paymentData as any);

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

        // Set expiration for Pix (e.g., 30 minutes from now)
        const dateOfExpiration = new Date();
        dateOfExpiration.setMinutes(dateOfExpiration.getMinutes() + 30);

        const paymentBody = {
            body: {
                transaction_amount: plan.price,
                description: `FTTH Planner - Assinatura: ${plan.name}`,
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name || 'Cliente',
                    identification: payer.identification || undefined
                },
                date_of_expiration: dateOfExpiration.toISOString(),
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
        console.error('Create Pix Error:', error);
        return res.status(500).json({
            error: 'Error generating Pix payment',
            details: error.message || error.response?.data
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

                console.log(`Company ${companyId} subscription EXTENDED via payment webhook. ID: ${id}`);
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

export const getInvoiceStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId;

        if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

        const invoice = await prisma.invoice.findFirst({
            where: { id: id, companyId: companyId },
            select: { status: true }
        });

        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        return res.json({ status: invoice.status });
    } catch (error) {
        console.error('Get Invoice Status Error:', error);
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
        console.error('Get Invoices Error:', error);
        return res.status(500).json({ error: 'Failed to fetch invoices' });
    }
};
