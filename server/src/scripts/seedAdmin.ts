import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Super Admin...');

    const username = 'admin';
    const password = 'admin';
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Ensure Admin Company Exists (Optional, but good for relationship integrity)
    // We try to find a system company or create one.
    let company = await prisma.company.findFirst({ where: { name: 'Admin System' } });

    if (!company) {
        // Try to find ANY company to attach to, or create one
        const anyCompany = await prisma.company.findFirst();
        if (anyCompany) {
            company = anyCompany;
        } else {
            console.log('Creating Admin Company...');
            company = await prisma.company.create({
                data: {
                    name: 'Admin System',
                    status: 'ACTIVE'
                }
            });
        }
    }

    // 2. Create/Update Admin User
    const user = await prisma.user.upsert({
        where: { username },
        update: {
            passwordHash: hashedPassword,
            role: UserRole.SUPER_ADMIN,
            companyId: company?.id,
            active: true
        },
        create: {
            username,
            passwordHash: hashedPassword,
            role: UserRole.SUPER_ADMIN,
            companyId: company?.id,
            active: true
        }
    });

    console.log(`
    ✅ Super Admin Seeded Successfully!
    Username: ${user.username}
    Password: ${password}
    Role: ${user.role}
    `);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
