import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { username: 'admin' },
        include: { company: true }
    });

    if (!user || !user.company) {
        console.log("User 'admin' NOT found or has no company!");
        return;
    }

    console.log(`User: ${user.username}`);
    console.log(`Role: ${user.role}`);
    console.log(`Company: ${user.company.name}`);
    console.log(`Company ID: ${user.companyId}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
