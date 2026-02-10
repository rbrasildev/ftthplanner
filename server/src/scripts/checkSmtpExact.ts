import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const smtp = await prisma.smtpConfig.findUnique({ where: { id: 'global' } });
    if (smtp) {
        console.log('---SMTP DETAILS---');
        console.log(`HOST: |${smtp.host}|`);
        console.log(`PORT: ${smtp.port}`);
        console.log(`USER: |${smtp.user}|`);
        console.log(`FROM: |${smtp.fromEmail}|`);
        console.log(`SECURE: ${smtp.secure}`);
    }
}

check().catch(console.error).finally(() => prisma.$disconnect());
