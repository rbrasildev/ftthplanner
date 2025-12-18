import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const projects = await prisma.project.findMany({
            include: {
                _count: {
                    select: { ctos: true, cables: true, pops: true }
                }
            }
        });
        console.log('Projects and Counts:', JSON.stringify(projects, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
