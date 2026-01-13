import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedDefaultPlans = async () => {
    try {
        console.log('Seeding default plans...');

        const plans = [
            {
                name: 'Plano Trial',
                price: 0,
                priceYearly: 0,
                type: 'TRIAL',
                trialDurationDays: 7,
                limits: { maxProjects: 1, maxUsers: 1, maxCTOs: 500, maxPOPs: 1 },
                features: ['1 Projeto', '1 Usuário', 'Mapas Básicos'],
                isRecommended: false,
                stripePriceId: 'price_TRIAL_TIER_PLACEHOLDER',
                stripePriceIdYearly: 'price_TRIAL_TIER_YEARLY_PLACEHOLDER'
            },
            {
                name: 'Plano Básico',
                price: 99.90,
                priceYearly: 999.00,
                type: 'STANDARD',
                limits: { maxProjects: 50, maxUsers: 10, maxCTOs: 5, maxPOPs: 10 },
                features: ['50 Projetos', '10 Usuários', 'Suporte por Email'],
                isRecommended: false,
                stripePriceId: 'price_BASIC_TIER_PLACEHOLDER',
                stripePriceIdYearly: 'price_BASIC_TIER_YEARLY_PLACEHOLDER'
            },
            {
                name: 'Plano Intermediário',
                price: 199.90,
                priceYearly: 1999.00,
                type: 'STANDARD',
                limits: { maxProjects: 10, maxUsers: 10, maxCTOs: 2000, maxPOPs: 10 },
                features: ['10 Projetos', '10 Usuários', 'Suporte Prioritário'],
                isRecommended: true,
                stripePriceId: 'price_INTERMEDIATE_TIER_PLACEHOLDER',
                stripePriceIdYearly: 'price_INTERMEDIATE_TIER_YEARLY_PLACEHOLDER'
            },
            {
                name: 'Plano Ilimitado',
                price: 399.90,
                priceYearly: 3999.00,
                type: 'ENTERPRISE',
                limits: { maxProjects: 999999, maxUsers: 999999, maxCTOs: 999999, maxPOPs: 999999 },
                features: ['Tudo Ilimitado', 'Suporte Dedicado', 'Backup Automático'],
                isRecommended: false,
                stripePriceId: 'price_UNLIMITED_TIER_PLACEHOLDER',
                stripePriceIdYearly: 'price_UNLIMITED_TIER_YEARLY_PLACEHOLDER'
            }
        ];

        for (const plan of plans) {
            const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
            if (!existing) {
                await prisma.plan.create({ data: plan });
                console.log(`Created plan: ${plan.name}`);
            }
        }
    } catch (error) {
        console.error('Error seeding plans:', error);
    }
};

import bcrypt from 'bcryptjs';

export const seedSuperAdmin = async () => {
    try {
        const adminUsername = 'admin';
        const adminPassword = 'admin'; // Default password

        const existingAdmin = await prisma.user.findUnique({ where: { username: adminUsername } });
        if (!existingAdmin) {
            console.log('Seeding Super Admin user...');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);

            // Create admin user without company first
            await prisma.user.create({
                data: {
                    username: adminUsername,
                    email: 'admin@ftthplanner.com',
                    passwordHash: hashedPassword,
                    role: 'SUPER_ADMIN',
                    active: true
                }
            });
            console.log(`Created Super Admin: ${adminUsername} / ${adminPassword}`);
        }
    } catch (error) {
        console.error('Error seeding admin:', error);
    }
};
