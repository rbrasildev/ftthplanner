import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Data Migration for Multi-Tenancy...");

    // 1. Find all users without a company
    // Currently, companyId is optional, so we look for nulls or all users since we just added the column.
    const users = await prisma.user.findMany({
        where: {
            companyId: null
        },
        include: {
            projects: true
        }
    });

    console.log(`Found ${users.length} users to migrate.`);

    for (const user of users) {
        console.log(`Migrating user: ${user.username} (${user.id})`);

        // 2. Create Company for User
        const companyName = `${user.username}'s Company`;
        const company = await prisma.company.create({
            data: {
                name: companyName,
                users: {
                    connect: { id: user.id } // Connect user to company
                }
            }
        });

        console.log(`  Created Company: ${company.name} (${company.id})`);

        // 3. Update User with Company and Role (Already connected above, but setting role)
        await prisma.user.update({
            where: { id: user.id },
            data: {
                companyId: company.id,
                role: 'OWNER'
            }
        });

        // 4. Update Projects
        // We find all projects owned by this user
        const projects = await prisma.project.findMany({
            where: { userId: user.id }
        });

        console.log(`  Found ${projects.length} projects to migrate.`);

        for (const project of projects) {
            await prisma.project.update({
                where: { id: project.id },
                data: { companyId: company.id }
            });

            // 5. Update Equipment (CTO, POP, CABLE)
            // Ideally we do this in bulk or by project ID

            const updateCtos = prisma.cto.updateMany({
                where: { projectId: project.id },
                data: { companyId: company.id }
            });

            const updatePops = prisma.pop.updateMany({
                where: { projectId: project.id },
                data: { companyId: company.id }
            });

            const updateCables = prisma.cable.updateMany({
                where: { projectId: project.id },
                data: { companyId: company.id }
            });

            await Promise.all([updateCtos, updatePops, updateCables]);
            console.log(`    Migrated equipment for project ${project.name}`);
        }
    }

    console.log("Migration completed successfully.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
