import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'logos');

async function convertBase64ToFile() {
    try {
        const config = await prisma.saaSConfig.findUnique({ where: { id: 'global' } });
        if (!config || !config.appLogoUrl || !config.appLogoUrl.startsWith('data:')) {
            console.log('No Base64 logo found in DB');
            return;
        }

        const logoBase64 = config.appLogoUrl;
        const matches = logoBase64.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            console.log('Invalid image format');
            return;
        }

        const extension = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `saas_logo_fixed_${Date.now()}.${extension}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }

        fs.writeFileSync(filePath, buffer);
        const publicUrl = `/api/uploads/logos/${fileName}`;

        // Update DB to use this new URL instead of Base64
        await prisma.saaSConfig.update({
            where: { id: 'global' },
            data: { appLogoUrl: publicUrl }
        });

        console.log('--- SUCCESS ---');
        console.log('Public URL:', publicUrl);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

convertBase64ToFile();
