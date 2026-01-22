
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
    try {
        const hrb = await prisma.company.findFirst({
            where: { name: { contains: 'HRB LACERDA' } }
        });

        if (hrb) {
            const updated = await prisma.company.update({
                where: { id: hrb.id },
                data: {
                    status: 'ACTIVE',
                    subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
                }
            });
            console.log('✅ FIXED HRB LACERDA:', updated.name, 'Status:', updated.status);
        } else {
            console.log('❌ HRB LACERDA not found.');
            const all = await prisma.company.findMany({ select: { name: true } });
            console.log('All companies:', all.map(c => c.name));
        }
    } catch (err) {
        console.error('❌ Failed to fix:', err);
    } finally {
        await prisma.$disconnect();
    }
}

fix();
