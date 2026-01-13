import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as any, // Lock to a stable version knowing we need PI on invoice
});

interface CreateSubscriptionParams {
    companyId: string;
    email: string;
    paymentMethodId?: string;
    priceId: string;
    trialDays?: number;
}

export class StripeService {

    // Create a new Customer in Stripe
    static async createCustomer(companyId: string, email: string, name: string) {
        // Check if company already has stripe ID
        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (company?.stripeCustomerId) return company.stripeCustomerId;

        const customer = await stripe.customers.create({
            email,
            name,
            metadata: { companyId },
        });

        await prisma.company.update({
            where: { id: companyId },
            data: { stripeCustomerId: customer.id },
        });

        return customer.id;
    }

    // Create a Subscription (returns clientSecret if incomplete/requires action)
    static async createSubscription({ companyId, email, paymentMethodId, priceId, trialDays = 0 }: CreateSubscriptionParams) {
        let uniqueCompany = await prisma.company.findUnique({ where: { id: companyId } });

        if (!uniqueCompany) throw new Error('Company not found');

        let customerId = uniqueCompany.stripeCustomerId;

        // Ensure customer exists
        if (!customerId) {
            customerId = await this.createCustomer(companyId, email, uniqueCompany.name);
        }

        // Attach payment method if provided
        if (paymentMethodId && customerId) {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });

            // Set as default
            await stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
        }

        // Create the subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId!,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            collection_method: 'charge_automatically',
            expand: ['latest_invoice.payment_intent'],
            trial_period_days: trialDays > 0 ? trialDays : undefined,
            metadata: { companyId },
        });

        // Store basic sub info
        await this.upsertSubscriptionInDb(subscription, companyId);

        // If active or trialing immediately (no payment action needed)
        if (subscription.status === 'active' || subscription.status === 'trialing') {
            return { subscriptionId: subscription.id, status: subscription.status };
        }

        // Requires payment action
        let invoice = subscription.latest_invoice as any;

        // Ensure invoice object is available
        if (typeof invoice === 'string') {
            invoice = await stripe.invoices.retrieve(invoice, { expand: ['payment_intent'] });
        } else if (!invoice.payment_intent) {
            invoice = await stripe.invoices.retrieve(invoice.id, { expand: ['payment_intent'] });
        }

        // RETRY LOGIC: Ensure PaymentIntent is available
        let attempts = 0;
        while (!invoice.payment_intent && attempts < 3) {
            attempts++;
            await new Promise(r => setTimeout(r, 1000));
            invoice = await stripe.invoices.retrieve(invoice.id, { expand: ['payment_intent'] });

            // Force finalization if still draft
            if (invoice.status === 'draft') {
                invoice = await stripe.invoices.finalizeInvoice(invoice.id, { expand: ['payment_intent'] });
            }
        }

        const paymentIntent = invoice?.payment_intent as any;
        const clientSecret = paymentIntent?.client_secret;

        if (!clientSecret && subscription.status === 'incomplete') {
            // Fallback error if still missing, but cleaner
            throw new Error(`Falha no pagamento: Segredo de pagamento não gerado (Invoice: ${invoice.id}). Tente novamente.`);
        }

        return {
            subscriptionId: subscription.id,
            clientSecret: clientSecret,
            status: subscription.status,
        };
    }

    // Cancel Subscription
    static async cancelSubscription(companyId: string) {
        const sub = await prisma.subscription.findUnique({ where: { companyId } });
        if (!sub) throw new Error('No subscription found');

        const deleted = await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        await this.upsertSubscriptionInDb(deleted, companyId);
        return deleted;
    }

    // List Plans (to help frontend)
    static async listPrices() {
        const prices = await stripe.prices.list({
            active: true,
            limit: 10,
            expand: ['data.product']
        });
        return prices.data;
    }

    // Webhook Handler
    static async handleWebhook(signature: string, rawBody: Buffer) {
        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET as string
            );
        } catch (err: any) {
            const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
            console.error(`[Webhook Debug] Signature Verification Failed!`);
            console.error(`- Secret in ENV: '${secret.substring(0, 10)}...' (Total Length: ${secret.length})`);
            console.error(`- Header Signature: '${signature}'`);
            console.error(`- Raw Body Type: ${typeof rawBody}`);
            console.error(`- Raw Body Length: ${Buffer.isBuffer(rawBody) ? rawBody.length : (rawBody as any)?.length}`);
            console.error(`- Raw Body Preview: ${(rawBody as any)?.toString?.().substring(0, 50)}...`);
            console.error(`- Error Message: ${err.message}`);
            return false;
        }

        const dataObject = event.data.object as any;
        const companyId = dataObject.metadata?.companyId;

        console.log(`Processing Webhook: ${event.type} for Company: ${companyId}`);

        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                if (companyId) {
                    await this.upsertSubscriptionInDb(dataObject, companyId);
                    await this.syncCompanyStatus(companyId, dataObject.status);
                } else {
                    // Try to find by stripe_customer_id if metadata missing
                    const customerId = dataObject.customer;
                    if (customerId && typeof customerId === 'string') {
                        const company = await prisma.company.findFirst({ where: { stripeCustomerId: customerId } });
                        if (company) {
                            await this.upsertSubscriptionInDb(dataObject, company.id);
                            await this.syncCompanyStatus(company.id, dataObject.status);
                        }
                    }
                }
                break;

            case 'invoice.payment_failed':
                // Logic to mark as past_due is usually handled by subscription.updated, 
                // but we can add specific notifications here if needed.
                break;
        }

        return true;
    }

    // Helper: Upsert DB
    private static async upsertSubscriptionInDb(stripeSub: any, companyId: string) {
        await prisma.subscription.upsert({
            where: { companyId },
            create: {
                companyId,
                stripeSubscriptionId: stripeSub.id,
                stripeCustomerId: stripeSub.customer as string,
                status: stripeSub.status,
                currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            },
            update: {
                stripeSubscriptionId: stripeSub.id,
                status: stripeSub.status,
                currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            }
        });

        // Sync Plan if active
        // Retrieve the price ID from the subscription items
        const priceId = stripeSub.items?.data?.[0]?.price?.id;

        if (priceId && ['active', 'trialing'].includes(stripeSub.status)) {
            const plan = await prisma.plan.findFirst({
                where: {
                    OR: [
                        { stripePriceId: priceId },
                        { stripePriceIdYearly: priceId }
                    ]
                }
            });
            if (plan) {
                console.log(`[StripeService] Syncing Company ${companyId} to Plan ${plan.name} (${plan.id})`);
                await prisma.company.update({
                    where: { id: companyId },
                    data: {
                        planId: plan.id,
                        subscriptionExpiresAt: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null
                    }
                });
            } else {
                console.warn(`[StripeService] Plan not found for Price ID: ${priceId}`);
            }
        }
    }

    // Helper: Sync Company Status
    private static async syncCompanyStatus(companyId: string, subStatus: string) {
        // Map Stripe status to internal logic if needed, currently storing raw status or simplified
        // Active states: trialing, active
        // Inactive states: past_due, canceled, incomplete, incomplete_expired, unpaid

        // Example: Update company 'status' field if you want one-source-of-truth on Company table
        // But we have Subscription table now. 
        // Let's keep Company.status generic (ACTIVE, SUSPENDED)

        let newStatus = 'ACTIVE';
        if (['past_due', 'canceled', 'unpaid', 'incomplete_expired'].includes(subStatus)) {
            newStatus = 'SUSPENDED';
        } else if (subStatus === 'trialing') {
            newStatus = 'TRIAL'; // If your Company status supports TRIAL enum/string
        }

        await prisma.company.update({
            where: { id: companyId },
            data: {
                status: newStatus
            }
        });
    }
}
