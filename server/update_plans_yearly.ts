
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating plans with yearly prices...');

    // Update Basic Plan
    await prisma.plan.updateMany({
        where: { name: { contains: 'Básico' } },
        data: {
            priceYearly: 299.00,
            stripePriceIdYearly: 'price_BASIC_TIER_YEARLY_PLACEHOLDER'
        }
    });
    console.log('Updated Basic Plans');

    // Update Unlimited/Pro Plan
    await prisma.plan.updateMany({
        where: { OR: [{ name: { contains: 'Ilimitado' } }, { name: { contains: 'Pro' } }] },
        data: {
            priceYearly: 999.00,
            stripePriceIdYearly: 'price_UNLIMITED_TIER_YEARLY_PLACEHOLDER'
        }
    });
    console.log('Updated Unlimited/Pro Plans');

    // Update Free Plan
    await prisma.plan.updateMany({
        where: { name: { contains: 'Grátis' } },
        data: {
            priceYearly: 0,
            stripePriceIdYearly: 'price_FREE_TIER_YEARLY_PLACEHOLDER'
        }
    });
    console.log('Updated Free Plans');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
