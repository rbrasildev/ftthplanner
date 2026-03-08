
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Create Plan if not exists (should be there from seed, but just in case)
    let plan = await prisma.plan.findFirst({ where: { name: 'Plano Trial' } });
    if (!plan) {
        plan = await prisma.plan.create({
            data: {
                name: 'Plano Trial',
                price: 0,
                type: 'TRIAL',
                features: '["all_features"]',
                limits: '{}'
            }
        });
    }

    const user = await prisma.user.upsert({
        where: { email: 'admin@test.com' },
        update: {},
        create: {
            username: 'admin',
            email: 'admin@test.com',
            passwordHash: hashedPassword,
            role: 'OWNER',
            active: true
        }
    });

    const company = await prisma.company.create({
        data: {
            name: 'Test Company',
            status: 'ACTIVE',
            planId: plan.id,
            users: { connect: { id: user.id } }
        }
    });

    await prisma.user.update({
        where: { id: user.id },
        data: { companyId: company.id }
    });

    console.log('User created: admin@test.com / 123456');
}

createTestUser()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
