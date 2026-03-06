import { PrismaClient } from '@prisma/client';
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';

const prisma = new PrismaClient();

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    options: { timeout: 10000 }
});

const preApprovalPlanClient = new PreApprovalPlan(client);

async function syncPlans() {
    const plans = await prisma.plan.findMany({
        where: { active: true, price: { gt: 0 } }
    });

    for (const plan of plans) {
        console.log(`Syncing plan: ${plan.name} (Price: ${plan.price})`);

        try {
            const body = {
                auto_recurring: {
                    currency_id: 'BRL',
                    transaction_amount: plan.price,
                    frequency: 1,
                    frequency_type: 'months',
                    billing_day: 10,
                    billing_day_proportional: false
                },
                reason: `FTTH Planner - ${plan.name}`,
                back_url: process.env.VITE_API_URL || 'https://ftthplanner.com.br'
            };

            const createdPlan = await preApprovalPlanClient.create({ body: body as any });

            console.log(`Created new Mercado Pago Plan for ${plan.name} -> ID: ${createdPlan.id}`);

            await prisma.plan.update({
                where: { id: plan.id },
                data: { mercadopagoId: createdPlan.id }
            });
            console.log(`Updated database for plan ${plan.name}.`);
        } catch (err: any) {
            console.error(`Failed to sync plan ${plan.name}:`, err.response?.data || err.message);
        }
    }
}

syncPlans()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log('Done syncing plans!');
    });
