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

            case 'invoice.payment_succeeded':
                const invoice = dataObject;
                if (invoice.subscription) {
                    // Force refresh subscription from Stripe to get latest status (e.g. active)
                    const latestSub = await stripe.subscriptions.retrieve(invoice.subscription as string);
                    const compId = latestSub.metadata?.companyId || invoice.metadata?.companyId; // Try both

                    if (compId) {
                        console.log(`[StripeService] Invoice Payment Succeeded. Waking up Subscription ${latestSub.id} for Company ${compId}`);
                        await this.upsertSubscriptionInDb(latestSub, compId);
                        await this.syncCompanyStatus(compId, latestSub.status);
                    } else {
                        console.warn(`[StripeService] Invoice paid but no CompanyID found in metadata. Sub: ${latestSub.id}`);
                    }
                }
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


        // Sync Plan if active
        // Retrieve the price ID from the subscription items
        const priceId = stripeSub.items?.data?.[0]?.price?.id;

        console.log(`[StripeService] Syncing Subscription. Status: ${stripeSub.status}, PriceID: ${priceId}, CompanyID: ${companyId} `);

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
                console.log(`[StripeService] ✅ Plan FOUND: ${plan.name} (${plan.id}). Updating Company...`);
                await prisma.company.update({
                    where: { id: companyId },
                    data: {
                        planId: plan.id,
                        subscriptionExpiresAt: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null
                    }
                });
                console.log(`[StripeService] Company ${companyId} updated successfully.`);
            } else {
                console.error(`[StripeService] ❌ Plan NOT FOUND for Price ID: ${priceId} `);
                // Fallback debugging: List all plans to see what we have
                const allPlans = await prisma.plan.findMany({ select: { id: true, name: true, stripePriceId: true, stripePriceIdYearly: true } });
                console.error(`[StripeService] Available Plans in DB: `, JSON.stringify(allPlans, null, 2));
            }
        } else {
            console.log(`[StripeService] Skipping Plan Sync.PriceID present: ${!!priceId}, Status: ${stripeSub.status} `);
        }
    }

    // Helper: Sync Company Status
    private static async syncCompanyStatus(companyId: string, subStatus: string) {
        // --- NEW LOGIC: HYBRID BILLING CONTROL ---
        // We check if the company is in STRIPE or MANUAL billing mode.
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: { plan: true }
        });

        if (!company) return;

        // If billing mode is MANUAL, we do NOT allow Stripe webhooks to suspend the account.
        if (company.billingMode === 'MANUAL' && ['past_due', 'canceled', 'unpaid', 'incomplete_expired'].includes(subStatus)) {
            console.log(`[StripeService] ✋ BYPASSING suspension for Company ${companyId} (${company.name}). Manual Billing Mode active.`);
            return;
        }

        let newStatus = 'ACTIVE';
        if (['past_due', 'canceled', 'unpaid', 'incomplete_expired'].includes(subStatus)) {
            newStatus = 'SUSPENDED';
            console.log(`[StripeService] ⚠️ SUSPENDING Company ${companyId} due to Stripe status: ${subStatus}`);
        } else if (subStatus === 'trialing') {
            newStatus = 'TRIAL';
        }

        await prisma.company.update({
            where: { id: companyId },
            data: {
                status: newStatus
            }
        });
        console.log(`[StripeService] Sync Status Complete: Company ${companyId} is now ${newStatus}`);
    }
}
