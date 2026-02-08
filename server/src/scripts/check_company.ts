
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCompany(name: string) {
    const company = await prisma.company.findFirst({
        where: { name: { contains: name, mode: 'insensitive' } },
        include: { plan: true }
    });

    if (!company) {
        console.log(`Company ${name} not found`);
        return;
    }

    console.log("--- Company Info ---");
    console.log(`ID: ${company.id}`);
    console.log(`Name: ${company.name}`);
    console.log(`Status: ${company.status}`);
    console.log(`Plan: ${company.plan?.name || 'NONE'}`);
    console.log(`Expires At: ${company.subscriptionExpiresAt}`);

}

checkCompany("HRB LACERDA LTDA").then(() => prisma.$disconnect());
