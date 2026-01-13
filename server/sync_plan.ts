import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2023-10-16' as any,
});

async function main() {
    // const companyId = 'fd7ab609-781c-40c3-bc42-6aed35544dc9';
    console.log('Finding company with subscription...');
    const sub = await prisma.subscription.findFirst();
    if (!sub) {
        console.error('No subscription found in DB to sync.');
        return;
    }
    const companyId = sub.companyId;
    console.log(`Syncing plan for company: ${companyId}`);

    console.log(`Fetching Stripe Subscription: ${sub.stripeSubscriptionId}`);
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

    const priceId = stripeSub.items.data[0].price.id;
    console.log(`Stripe Price ID: ${priceId}`);

    const plan = await prisma.plan.findFirst({
        where: {
            OR: [
                { stripePriceId: priceId },
                { stripePriceIdYearly: priceId }
            ]
        }
    });
    if (!plan) {
        console.error(`Plan not found locally for price ID: ${priceId}`);
        return;
    }

    const expiresAt = stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : null;
    console.log(`Updating company to Plan: ${plan.name} (${plan.id}), Expires: ${expiresAt}`);
    await prisma.company.update({
        where: { id: companyId },
        data: {
            planId: plan.id,
            subscriptionExpiresAt: expiresAt
        }
    });

    console.log('Sync Complete!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
