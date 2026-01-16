
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
    try {
        console.log('--- Database Diagnostic ---');

        // Check if column exists in PG
        const columns: any = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'companies' 
      AND column_name = 'billing_mode'
    `;

        console.log('Database Check:', columns);

        // Check if Prisma model has it
        const sample = await prisma.company.findFirst();
        console.log('Prisma Sample Company:', sample ? { id: sample.id, name: sample.name, billingMode: (sample as any).billingMode } : 'No companies found');

        if (columns.length === 0) {
            console.error('❌ COLUMN billing_mode MISSING IN DATABASE!');
        } else {
            console.log('✅ Column exists in database.');
        }

    } catch (err) {
        console.error('❌ Diagnostic failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();
