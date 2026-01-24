
import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking plans in database...');
        const plans = await prisma.plan.findMany();
        console.log(`Found ${plans.length} plans:`);
        plans.forEach(p => console.log(`- ${p.name} (Active: ${p.active})`));
    } catch (e) {
        console.error('Error checking plans:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
