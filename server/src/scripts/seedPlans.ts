import { prisma } from '../lib/prisma';

const plans = [
    {
        name: 'Plano Grátis',
        price: 0,
        priceYearly: 0,
        limits: { maxProjects: 1, maxUsers: 1, maxCTOs: 500, maxPOPs: 1 },
        features: ['feature_basic_maps'],
    },
    {
        name: 'Plano Básico',
        price: 99.90,
        priceYearly: 999.00,
        limits: { maxProjects: 3, maxUsers: 10, maxCTOs: 1000, maxPOPs: 5 },
        features: ['feature_diagram', 'feature_cto_editor', 'feature_optical_calc', 'feature_import_export_kmz', 'feature_otdr', 'feature_vfl', 'feature_support_whatsapp'],
    },
    {
        name: 'Plano Intermediário',
        price: 199.90,
        priceYearly: 1999.00,
        limits: { maxProjects: 10, maxUsers: 20, maxCTOs: 2000, maxPOPs: 10 },
        features: ['feature_diagram', 'feature_cto_editor', 'feature_optical_calc', 'feature_import_export_kmz', 'feature_otdr', 'feature_vfl', 'feature_support_whatsapp_chat', 'feature_auto_backup'],
        isRecommended: true,
    },
    {
        name: 'Plano Ilimitado',
        price: 399.90,
        priceYearly: 3999.00,
        limits: { maxProjects: 999999, maxUsers: 999999, maxCTOs: 999999, maxPOPs: 999999 },
        features: ['feature_diagram', 'feature_cto_editor', 'feature_optical_calc', 'feature_import_export_kmz', 'feature_otdr', 'feature_vfl', 'feature_dedicated_support', 'feature_auto_backup'],
    }
];

async function main() {
    console.log('Updating Plans...');

    for (const p of plans) {
        const existing = await prisma.plan.findFirst({ where: { name: p.name } });
        if (existing) {
            console.log(`Updating ${p.name}...`);
            await prisma.plan.update({
                where: { id: existing.id },
                data: {
                    price: p.price,
                    priceYearly: p.priceYearly,
                    limits: p.limits,
                    features: p.features,
                    isRecommended: (p as any).isRecommended ?? false,
                }
            });
        } else {
            console.log(`Creating ${p.name}...`);
            await prisma.plan.create({
                data: {
                    name: p.name,
                    price: p.price,
                    priceYearly: p.priceYearly,
                    limits: p.limits,
                    features: p.features,
                    isRecommended: (p as any).isRecommended ?? false,
                }
            });
        }
    }

    console.log('Plans updated successfully!');
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
