import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedDefaultPlans = async () => {
    try {
        console.log('Seeding default plans...');

        const plans = [
            {
                name: 'Plano Grátis',
                price: 0,
                type: 'STANDARD',
                limits: { maxProjects: 1, maxUsers: 1, maxCTOs: 10, maxPOPs: 1 },
                features: ['1 Projeto', '1 Usuário', 'Mapas Básicos'],
                isRecommended: false
            },
            {
                name: 'Plano Básico',
                price: 29.90,
                type: 'STANDARD',
                limits: { maxProjects: 5, maxUsers: 3, maxCTOs: 100, maxPOPs: 10 },
                features: ['5 Projetos', '3 Usuários', 'Suporte por Email'],
                isRecommended: false
            },
            {
                name: 'Plano Ilimitado',
                price: 99.90,
                type: 'TRIAL', // Using TRIAL type here so it picks up the Trial Duration logic if used as trial
                trialDurationDays: 15,
                limits: { maxProjects: 999999, maxUsers: 999999, maxCTOs: 999999, maxPOPs: 999999 },
                features: ['Tudo Ilimitado', 'Suporte Prioritário', 'Backup Automático'],
                isRecommended: true
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
