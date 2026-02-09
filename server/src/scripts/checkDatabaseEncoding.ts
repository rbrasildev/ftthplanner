import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
    try {
        const plans = await prisma.plan.findMany({ select: { id: true, name: true } });
        const config = await prisma.saaSConfig.findUnique({
            where: { id: 'global' },
            select: { id: true, appName: true }
        });
        const templates = await prisma.emailTemplate.findMany({ select: { slug: true, subject: true } });

        console.log('--- PLANS ---');
        console.log(plans);

        console.log('--- SAAS CONFIG ---');
        console.log(config);

        console.log('--- TEMPLATES ---');
        console.log(templates);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
