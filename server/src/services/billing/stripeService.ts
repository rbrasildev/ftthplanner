import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    // apiVersion defaulted to latest supported by SDK
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

        // DEBUG: Verify keys and IDs
        console.log(`[StripeService] Creating sub for Company: ${companyId}`);
        console.log(`[StripeService] Price ID: ${priceId}`);
        console.log(`[StripeService] Key Prefix: ${process.env.STRIPE_SECRET_KEY?.substring(0, 8)}...`);

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
            expand: ['latest_invoice.payment_intent'],
            trial_period_days: trialDays > 0 ? trialDays : undefined,
            metadata: { companyId },
        });

        // Store basic sub info (status 'incomplete' initially)
        await this.upsertSubscriptionInDb(subscription, companyId);

        // If active or trialing immediately (no payment action needed)
        if (subscription.status === 'active' || subscription.status === 'trialing') {
            return { subscriptionId: subscription.id, status: subscription.status };
        }

        // Requires payment action (SCA, etc.) or just initial payment
        const invoice = subscription.latest_invoice as any;
        const paymentIntent = invoice?.payment_intent as any;

        return {
            subscriptionId: subscription.id,
            clientSecret: paymentIntent?.client_secret,
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
            console.error(`Webhook signature verification failed: ${err.message}`);
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
                currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            },
            update: {
                stripeSubscriptionId: stripeSub.id,
                status: stripeSub.status,
                currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            }
        });
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
