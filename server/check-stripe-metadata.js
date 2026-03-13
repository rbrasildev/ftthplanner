const Stripe = require('stripe');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});

async function run() {
    try {
        console.log("Fetching latest invoices...");
        const invoices = await stripe.invoices.list({ limit: 3 });
        for (const invoice of invoices.data) {
            console.log(`\nInvoice ${invoice.id} - Status: ${invoice.status}`);
            const subscriptionId = invoice.subscription;
            if (subscriptionId) {
                console.log(`  -> Subscription ID: ${subscriptionId}`);
                const sub = await stripe.subscriptions.retrieve(subscriptionId);
                console.log(`  -> Metadata:`, sub.metadata);
            } else {
                console.log(`  -> No subscription attached to this invoice.`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

run();
