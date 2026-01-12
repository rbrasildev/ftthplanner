import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Create default plans
    const plans = [
        {
            name: 'Plano Grátis',
            price: 0.0,
            type: 'STANDARD',
            features: JSON.stringify(['basic_features']),
            limits: JSON.stringify({ projects: 1, users: 1 }),
            stripePriceId: 'price_H5ggYJDqBQ3', // EXAMPLE
        },
        {
            name: 'Plano Ilimitado',
            price: 99.90,
            type: 'ENTERPRISE',
            features: JSON.stringify(['all_features']),
            limits: JSON.stringify({ projects: 999, users: 999 }),
            stripePriceId: 'price_H5ggYJDqBQ4', // EXAMPLE
        },
    ];

    for (const plan of plans) {
        const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
        if (!existing) {
            await prisma.plan.create({ data: plan });
            console.log(`Created plan: ${plan.name}`);
        } else {
            console.log(`Plan already exists: ${plan.name}`);
        }
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
