import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
    {
        name: 'Plano Trial',
        price: 0,
        limits: {
            maxProjects: 1,
            maxUsers: 1,
            maxCTOs: 500,
            maxPOPs: 1
        }
    },
    {
        name: 'Plano BÃ¡sico',
        price: 99.90,
        limits: {
            maxProjects: 50,
            maxUsers: 10,
            maxCTOs: 500,
            maxPOPs: 10
        }
    },
    {
        name: 'Plano IntermediÃ¡rio',
        price: 199.90,
        limits: {
            maxProjects: 10,
            maxUsers: 10,
            maxCTOs: 2000,
            maxPOPs: 10
        }
    },
    {
        name: 'Plano Ilimitado',
        price: 399.90,
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
