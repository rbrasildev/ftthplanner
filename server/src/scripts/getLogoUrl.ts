import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getLogo() {
    try {
        const config = await prisma.saaSConfig.findUnique({ where: { id: 'global' } });
        console.log('--- LOGO URL IN DATABASE ---');
        console.log(config?.appLogoUrl);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getLogo();
