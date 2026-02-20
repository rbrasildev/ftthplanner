
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking Prisma Client...");
    if ('customer' in prisma) {
        console.log("SUCCESS: prisma.customer model exists.");
        // @ts-ignore
        const count = await prisma.customer.count();
        console.log(`Current customer count: ${count}`);
    } else {
        console.error("FAILURE: prisma.customer model is MISSING.");
        console.log("Available models:", Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
