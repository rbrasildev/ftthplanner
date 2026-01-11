import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({ where: { username: 'admin' } });

    if (!user) {
        console.log("User 'admin' not found.");
        return;
    }

    console.log(`Current Role: ${user.role}`);

    const updated = await prisma.user.update({
        where: { username: 'admin' },
        data: { role: 'OWNER' }
    });

    console.log(`Updated Role: ${updated.role}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
