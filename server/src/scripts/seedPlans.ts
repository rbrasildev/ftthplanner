import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
    {
        name: 'Plano Grátis',
        price: 0,
        limits: {
            maxProjects: 10,
            maxUsers: 5,
            maxCTOs: 5000,
            maxPOPs: 200
        }
    },
    {
        name: 'Plano Básico',
        price: 149.90,
        limits: {
            maxProjects: 50,
            maxUsers: 10,
            maxCTOs: 50000,
            maxPOPs: 1000
        }
    },
    {
        name: 'Plano Intermediário',
        price: 399.90,
        limits: {
            maxProjects: 200,
            maxUsers: 50,
            maxCTOs: 200000,
            maxPOPs: 5000
        }
    },
    {
        name: 'Plano Ilimitado',
        price: 899.90,
        limits: {
            maxProjects: 999999,
            maxUsers: 999999,
            maxCTOs: 999999,
            maxPOPs: 999999
        }
    }
];

async function main() {
    console.log('Seeding Plans...');

    for (const p of plans) {
        const existing = await prisma.plan.findFirst({ where: { name: p.name } });
        if (existing) {
            console.log(`Updating ${p.name}...`);
            await prisma.plan.update({
                where: { id: existing.id },
                data: {
                    price: p.price,
                    limits: p.limits
                }
            });
        } else {
            console.log(`Creating ${p.name}...`);
            await prisma.plan.create({
                data: {
                    name: p.name,
                    price: p.price,
                    limits: p.limits
                }
            });
        }
    }

    console.log('Plans seeded successfully!');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
