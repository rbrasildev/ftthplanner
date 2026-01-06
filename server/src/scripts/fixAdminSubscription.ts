import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const username = 'admin';
    const user = await prisma.user.findUnique({
        where: { username },
        include: { company: true }
    });

    if (!user || !user.company) {
        console.log('User or company not found');
        return;
    }

    console.log(`Fixing subscription for ${user.username} (${user.company.name})...`);

    // Ensure Plan is Unlimited
    const unlimitedPlan = await prisma.plan.findFirst({ where: { name: 'Plano Ilimitado' } });
    if (!unlimitedPlan) {
        console.error('Unlimited Plan not found!');
        return;
    }

    await prisma.company.update({
        where: { id: user.company.id },
        data: {
            planId: unlimitedPlan.id,
            subscriptionExpiresAt: null // Clear expiration to stop "Trial" logic
        }
    });

    console.log('✅ Subscription Fixed: Plan set to Unlimited, Expiration cleared.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
