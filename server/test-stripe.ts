import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16' as any,
});

async function testStripe() {
    try {
        console.log("Stripe Key:", process.env.STRIPE_SECRET_KEY ? "Loaded" : "Missing");
        
        // Find a company
        const company = await prisma.company.findFirst({
            include: { users: true, plan: true }
        });
        
        if (!company || !company.plan) {
            console.log("No company with a plan found.");
            return;
        }
        
        console.log(`Using Company: ${company.name}, Plan: ${company.plan.name}, stripeId: ${company.plan.stripeId || 'None'}`);

        let stripeCustomerId = (company as any).stripeCustomerId;

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: company.users?.[0]?.email,
                name: company.name,
                metadata: {
                    companyId: company.id
                }
            });
            stripeCustomerId = customer.id;
            console.log("Created new customer:", stripeCustomerId);
        }

        const stripePriceId = company.plan.stripeId;
        let subscriptionItems = [];

        if (stripePriceId) {
            subscriptionItems = [{ price: stripePriceId }];
        } else {
            console.log("Creating product inline...");
            const product = await stripe.products.create({
                name: company.plan.name,
                description: `SaaS Subscription - ${company.plan.name}`,
            });

            subscriptionItems = [{
                price_data: {
                    currency: 'BRL',
                    product: product.id,
                    unit_amount: Math.round(company.plan.price * 100),
                    recurring: { interval: 'month' as const },
                },
            }];
        }

        console.log("Creating subscription with items:", JSON.stringify(subscriptionItems));
        
        const subscription = await stripe.subscriptions.create({
            customer: stripeCustomerId,
            items: subscriptionItems,
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
                companyId: company.id,
                planId: company.plan.id
            }
        });

        console.log("Success! Subscription ID:", subscription.id);
    } catch (err: any) {
        console.error("STRIPE ERROR:");
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

testStripe();
