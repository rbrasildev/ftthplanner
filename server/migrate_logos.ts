import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateLogos() {
    console.log('Migrating logo URLs...');

    const companies = await prisma.company.findMany({
        where: {
            logoUrl: {
                startsWith: '/uploads/'
            }
        }
    });

    console.log(`Found ${companies.length} companies to migrate.`);

    for (const company of companies) {
        if (company.logoUrl) {
            const newUrl = company.logoUrl.replace('/uploads/', '/api/uploads/');
            await prisma.company.update({
                where: { id: company.id },
                data: { logoUrl: newUrl }
            });
            console.log(`Updated logoUrl for company ${company.name}: ${company.logoUrl} -> ${newUrl}`);
        }
    }

    console.log('Migration complete.');
    process.exit(0);
}

migrateLogos().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
