
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLimits() {
    try {
        // Find the first company (assuming single tenant/dev for now, or listing all)
        const companies = await prisma.company.findMany({
            include: {
                plan: true,
                _count: {
                    select: {
                        projects: true
                    }
                }
            }
        });

        for (const company of companies) {
            console.log(`\nCompany: ${company.name} (ID: ${company.id})`);
            console.log(`Plan: ${company.plan?.name}`);
            console.log(`Limits:`, company.plan?.limits);

            const projectCount = await prisma.project.count({ where: { companyId: company.id } });
            const ctoCount = await prisma.cto.count({ where: { companyId: company.id } });
            const popCount = await prisma.pop.count({ where: { companyId: company.id } });
            const cableCount = await prisma.cable.count({ where: { companyId: company.id } });

            console.log(`Usage:`);
            console.log(`- Projects: ${projectCount}`);
            console.log(`- CTOs: ${ctoCount}`);
            console.log(`- POPs: ${popCount}`);
            console.log(`- Cables: ${cableCount}`);
        }

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLimits();
