import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const username = process.argv[2] || 'superadmin';
    const password = process.argv[3] || 'admin123';

    console.log(`Creating Super Admin: ${username}...`);

    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if exists
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        console.log('User already exists. Updating role to SUPER_ADMIN...');
        await prisma.user.update({
            where: { id: existing.id },
            data: {
                role: 'SUPER_ADMIN',
                passwordHash: hashedPassword
            }
        });
        console.log('Updated.');
        return;
    }

    const user = await prisma.user.create({
        data: {
            username,
            email: `${username}@ftthplanner.com`,
            passwordHash: hashedPassword,
            role: 'SUPER_ADMIN',
            // No company needed
        }
    });

    console.log(`Super Admin created successfully!`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
