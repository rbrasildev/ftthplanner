
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Migrating Plan Features to Translation Keys...');

    // Update Free Plan
    await prisma.plan.updateMany({
        where: { name: { contains: 'Grátis' } },
        data: {
            features: ['feature_1_project', 'feature_1_user', 'feature_basic_maps']
        }
    });

    // Update Basic Plan
    await prisma.plan.updateMany({
        where: { name: { contains: 'Básico' } },
        data: {
            features: ['feature_5_projects', 'feature_3_users', 'feature_email_support']
        }
    });

    // Update Unlimited/Pro Plan
    await prisma.plan.updateMany({
        where: { OR: [{ name: { contains: 'Ilimitado' } }, { name: { contains: 'Pro' } }] },
        data: {
            features: ['feature_unlimited_all', 'feature_priority_support', 'feature_auto_backup']
        }
    });

    console.log('Plan features updated successfully!');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
