import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function repair() {
    try {
        console.log('--- REPAIRING DATABASE ENCODING ---');

        // 1. Repair Plans
        const plans = await prisma.plan.findMany();
        for (const plan of plans) {
            let newName = plan.name;
            if (newName.includes('Ã¡')) newName = newName.replace(/Ã¡/g, 'á');
            if (newName.includes('Ã©')) newName = newName.replace(/Ã©/g, 'é');
            if (newName.includes('Ã­')) newName = newName.replace(/Ã­/g, 'í');
            if (newName.includes('Ã³')) newName = newName.replace(/Ã³/g, 'ó');
            if (newName.includes('Ãº')) newName = newName.replace(/Ãº/g, 'ú');
            if (newName.includes('Ã£')) newName = newName.replace(/Ã£/g, 'ã');
            if (newName.includes('Ãµ')) newName = newName.replace(/Ãµ/g, 'õ');
            if (newName.includes('Ã§')) newName = newName.replace(/Ã§/g, 'ç');

            if (newName !== plan.name) {
                console.log(`Updating Plan: "${plan.name}" -> "${newName}"`);
                await prisma.plan.update({
                    where: { id: plan.id },
                    data: { name: newName }
                });
            }
        }

        // 2. Repair Templates
        const templates = await prisma.emailTemplate.findMany();
        for (const temp of templates) {
            let newSubject = temp.subject;
            let newBody = temp.body;

            const fix = (text: string) => {
                if (!text) return text;
                return text
                    .replace(/Ã¡/g, 'á')
                    .replace(/Ã©/g, 'é')
                    .replace(/Ã­/g, 'í')
                    .replace(/Ã³/g, 'ó')
                    .replace(/Ãº/g, 'ú')
                    .replace(/Ã£/g, 'ã')
                    .replace(/Ãµ/g, 'õ')
                    .replace(/Ã§/g, 'ç')
                    .replace(/Ãª/g, 'ê')
                    .replace(/Â /g, ' ');
            };

            newSubject = fix(newSubject);
            newBody = fix(newBody);

            if (newSubject !== temp.subject || newBody !== temp.body) {
                console.log(`Updating Template: "${temp.slug}"`);
                await prisma.emailTemplate.update({
                    where: { id: temp.id },
                    data: { subject: newSubject, body: newBody }
                });
            }
        }

        // 3. Repair SaaS Config
        const config = await prisma.saaSConfig.findUnique({ where: { id: 'global' } });
        if (config) {
            let newAppName = config.appName;
            const fix = (text: string) => {
                if (!text) return text;
                return text
                    .replace(/Ã¡/g, 'á')
                    .replace(/Ã©/g, 'é')
                    .replace(/Ã­/g, 'í')
                    .replace(/Ã³/g, 'ó')
                    .replace(/Ãº/g, 'ú')
                    .replace(/Ã£/g, 'ã')
                    .replace(/Ãµ/g, 'õ')
                    .replace(/Ã§/g, 'ç')
                    .replace(/Ãª/g, 'ê');
            };
            newAppName = fix(newAppName);
            if (newAppName !== config.appName) {
                console.log(`Updating SaaS Config Name: "${config.appName}" -> "${newAppName}"`);
                await prisma.saaSConfig.update({
                    where: { id: 'global' },
                    data: { appName: newAppName }
                });
            }
        }

        console.log('--- REPAIR COMPLETE ---');

    } catch (e) {
        console.error('Repair failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

repair();
