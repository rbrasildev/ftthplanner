import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Directory for logos (same as in controllers)
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'logos');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function runProductionFix() {
    try {
        console.log('--- STARTING PRODUCTION FIX ---');

        // 1. Repair UTF-8 Encoding in Database
        console.log('1. Repairing UTF-8 encoding...');
        const fixStr = (text: string) => {
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
                .replace(/Ã´/g, 'ô')
                .replace(/Â /g, ' ');
        };

        // Plans
        const plans = await prisma.plan.findMany();
        for (const plan of plans) {
            const newName = fixStr(plan.name);
            if (newName !== plan.name) {
                console.log(`   Fixed Plan: ${plan.name} -> ${newName}`);
                await prisma.plan.update({ where: { id: plan.id }, data: { name: newName } });
            }
        }

        // Templates
        const templates = await prisma.emailTemplate.findMany();
        for (const temp of templates) {
            const newSub = fixStr(temp.subject);
            const newBody = fixStr(temp.body);
            if (newSub !== temp.subject || newBody !== temp.body) {
                console.log(`   Fixed Template: ${temp.slug}`);
                await prisma.emailTemplate.update({
                    where: { id: temp.id },
                    data: { subject: newSub, body: newBody }
                });
            }
        }

        // SaaS Config (Name)
        const config = await prisma.saaSConfig.findUnique({ where: { id: 'global' } });
        if (config) {
            const newAppName = fixStr(config.appName);
            if (newAppName !== config.appName) {
                console.log(`   Fixed App Name: ${config.appName} -> ${newAppName}`);
                await prisma.saaSConfig.update({ where: { id: 'global' }, data: { appName: newAppName } });
            }
        }

        // 2. Convert Base64 Logo to File
        console.log('2. Checking for Base64 Logo to convert...');
        const currentConfig = await prisma.saaSConfig.findUnique({ where: { id: 'global' } });
        if (currentConfig?.appLogoUrl && currentConfig.appLogoUrl.startsWith('data:')) {
            const logoBase64 = currentConfig.appLogoUrl;
            const matches = logoBase64.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const extension = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                const fileName = `saas_logo_converted_${Date.now()}.${extension}`;
                const filePath = path.join(UPLOADS_DIR, fileName);

                fs.writeFileSync(filePath, buffer);
                const publicUrl = `/api/uploads/logos/${fileName}`;

                await prisma.saaSConfig.update({
                    where: { id: 'global' },
                    data: { appLogoUrl: publicUrl }
                });
                console.log(`   Converted Base64 Logo to: ${publicUrl}`);
            }
        } else {
            console.log('   No Base64 logo found or already converted.');
        }

        console.log('--- PRODUCTION FIX COMPLETE ---');

    } catch (error) {
        console.error('Fatal error during production fix:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runProductionFix();
