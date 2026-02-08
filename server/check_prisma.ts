
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    try {
        console.log('Available models:', Object.keys(prisma).filter(k => k.indexOf('_') !== 0));
        const templatesCount = await (prisma as any).emailTemplate.count();
        console.log('Templates count:', templatesCount);
        process.exit(0);
    } catch (err: any) {
        console.error('Check failed:', err.message);
        process.exit(1);
    }
}

check();
