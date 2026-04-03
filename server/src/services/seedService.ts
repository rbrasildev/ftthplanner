import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import bcrypt from 'bcryptjs';

export const seedDefaultPlans = async () => {
    try {
        logger.info('Seeding default plans...');

        const plans = [
            {
                name: 'Plano Grátis',
                price: 0,
                priceYearly: 0,
                type: 'TRIAL',
                trialDurationDays: 7,
                limits: { maxProjects: 1, maxUsers: 1, maxCTOs: 500, maxPOPs: 1 },
                features: ['feature_basic_maps'],
                isRecommended: false,
            },
            {
                name: 'Plano Básico',
                price: 99.90,
                priceYearly: 999.00,
                type: 'STANDARD',
                limits: { maxProjects: 3, maxUsers: 10, maxCTOs: 1000, maxPOPs: 5 },
                features: ['feature_diagram', 'feature_cto_editor', 'feature_optical_calc', 'feature_import_export_kmz', 'feature_otdr', 'feature_vfl', 'feature_support_whatsapp'],
                isRecommended: false,
            },
            {
                name: 'Plano Intermediário',
                price: 199.90,
                priceYearly: 1999.00,
                type: 'STANDARD',
                limits: { maxProjects: 10, maxUsers: 20, maxCTOs: 2000, maxPOPs: 10 },
                features: ['feature_diagram', 'feature_cto_editor', 'feature_optical_calc', 'feature_import_export_kmz', 'feature_otdr', 'feature_vfl', 'feature_support_whatsapp_chat', 'feature_auto_backup'],
                isRecommended: true,
            },
            {
                name: 'Plano Ilimitado',
                price: 399.90,
                priceYearly: 3999.00,
                type: 'ENTERPRISE',
                limits: { maxProjects: 999999, maxUsers: 999999, maxCTOs: 999999, maxPOPs: 999999 },
                features: ['feature_diagram', 'feature_cto_editor', 'feature_optical_calc', 'feature_import_export_kmz', 'feature_otdr', 'feature_vfl', 'feature_dedicated_support', 'feature_auto_backup'],
                isRecommended: false,
            }
        ];

        for (const plan of plans) {
            const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
            if (!existing) {
                await prisma.plan.create({ data: plan });
                logger.info(`Created plan: ${plan.name}`);
            }
        }
    } catch (error: any) {
        logger.error(`Error seeding plans: ${error.message}`);
    }
};


export const seedSuperAdmin = async () => {
    try {
        const adminEmail = 'admin@ftthplanner.com';
        const adminUsername = 'admin';
        const adminPassword = 'admin'; // Default password

        const existingAdmin = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: adminEmail },
                    { username: adminUsername }
                ]
            }
        });

        if (!existingAdmin) {
            logger.info('Seeding Super Admin user...');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);

            await prisma.user.create({
                data: {
                    username: adminUsername,
                    email: adminEmail,
                    passwordHash: hashedPassword,
                    role: 'SUPER_ADMIN',
                    active: true
                }
            });
            logger.info(`Created Super Admin: ${adminEmail}`);
        } else {
            logger.info('Super Admin already exists. Skipping seed.');
        }
    } catch (error: any) {
        logger.error(`Error seeding admin: ${error.message}`);
    }
};
