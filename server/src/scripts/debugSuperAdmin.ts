import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const username = 'superadmin'; // Assuming this is the user
    const user = await prisma.user.findUnique({
        where: { username },
        include: { company: true }
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    console.log('User found:');
    console.log(JSON.stringify(user, null, 2));

    // Explicitly check boolean
    console.log('Is Active (typeof):', typeof user.active);
    console.log('Is Active (value):', user.active);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
