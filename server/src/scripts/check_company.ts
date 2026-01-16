
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCompany(name: string) {
    const company = await prisma.company.findFirst({
        where: { name: { contains: name, mode: 'insensitive' } },
        include: { plan: true, subscription: true }
    });

    if (!company) {
        console.log(`Company ${name} not found`);
        return;
    }

    console.log("--- Company Info ---");
    console.log(`ID: ${company.id}`);
    console.log(`Name: ${company.name}`);
    console.log(`Status: ${company.status}`);
    console.log(`Plan: ${company.plan?.name || 'NONE'}`);
    console.log(`Stripe Customer ID: ${company.stripeCustomerId || 'NONE'}`);
    console.log(`Expires At: ${company.subscriptionExpiresAt}`);

    console.log("\n--- Subscription Record ---");
    if (company.subscription) {
        console.log(`Stripe Sub ID: ${company.subscription.stripeSubscriptionId}`);
        console.log(`Status: ${company.subscription.status}`);
        console.log(`Current Period End: ${company.subscription.currentPeriodEnd}`);
    } else {
        console.log("No subscription record found in DB");
    }
}

checkCompany("HRB LACERDA LTDA").then(() => prisma.$disconnect());
