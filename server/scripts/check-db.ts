import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const companies = await prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { plan: true }
    });
    console.log(JSON.stringify(companies, null, 2));
    await prisma.$disconnect();
}
check();
