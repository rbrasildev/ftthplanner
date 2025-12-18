import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ctos' AND column_name = 'id'
    `;
        console.log('CTO ID Column Info:', JSON.stringify(result, null, 2));

        const projectResult = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'id'
    `;
        console.log('Project ID Column Info:', JSON.stringify(projectResult, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
