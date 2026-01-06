import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const username = 'admin';
    const user = await prisma.user.findUnique({
        where: { username },
        include: {
            company: {
                include: {
                    plan: true
                }
            }
        }
    });

    if (!user) {
        console.log('User admin not found');
        return;
    }

    console.log('User:', user.username);
    console.log('Company:', user.company?.name);
    console.log('Plan:', user.company?.plan?.name);
    console.log('Limits:', user.company?.plan?.limits);

    const plans = await prisma.plan.findMany();
    console.log('--- ALL PLANS ---');
    plans.forEach(p => {
        console.log(`Plan: ${p.name}, Limits:`, p.limits);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
