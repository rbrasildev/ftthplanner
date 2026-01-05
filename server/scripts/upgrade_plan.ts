
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upgrade() {
    const companyId = 'd5ac6e72-a7ce-41d5-951b-ca75ec34fe1b'; // TelecomNormas

    try {
        const basicPlan = await prisma.plan.findFirst({ where: { name: 'Plano Básico' } });
        if (!basicPlan) {
            console.error("Plano Básico not found!");
            return;
        }

        await prisma.company.update({
            where: { id: companyId },
            data: { planId: basicPlan.id }
        });

        console.log(`Successfully upgraded company ${companyId} to ${basicPlan.name}`);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

upgrade();
