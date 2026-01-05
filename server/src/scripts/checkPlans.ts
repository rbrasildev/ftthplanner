import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.plan.count();
    console.log(`Total Plans: ${counts}`);
    const plans = await prisma.plan.findMany();
    console.log(JSON.stringify(plans, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
