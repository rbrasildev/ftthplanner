import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from './auditController';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'logos');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const getSaaSConfig = async (req: Request, res: Response) => {
    try {
        let config = await prisma.saaSConfig.findUnique({
            where: { id: 'global' }
        });

        if (!config) {
            config = await prisma.saaSConfig.create({
                data: { id: 'global', appName: 'FTTH Planner' }
            });
        }

        res.json(config);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch SaaS config',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateSaaSConfig = async (req: AuthRequest, res: Response) => {
    try {
        const {
            appName, appLogoUrl, faviconUrl, supportEmail, supportPhone, websiteUrl,
            appDescription, appKeywords, ogImageUrl,
            socialFacebook, socialTwitter, socialInstagram, socialLinkedin, socialYoutube,
            heroPreviewUrl, ctaBgImageUrl, footerDesc, copyrightText
        } = req.body;

        const config = await prisma.saaSConfig.upsert({
            where: { id: 'global' },
            create: {
                id: 'global',
                appName, appLogoUrl, faviconUrl, supportEmail, supportPhone, websiteUrl,
                appDescription, appKeywords, ogImageUrl,
                socialFacebook, socialTwitter, socialInstagram, socialLinkedin, socialYoutube,
                heroPreviewUrl, ctaBgImageUrl, footerDesc, copyrightText
            },
            update: {
                appName, appLogoUrl, faviconUrl, supportEmail, supportPhone, websiteUrl,
                appDescription, appKeywords, ogImageUrl,
                socialFacebook, socialTwitter, socialInstagram, socialLinkedin, socialYoutube,
                heroPreviewUrl, ctaBgImageUrl, footerDesc, copyrightText
            }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'UPDATE_SAAS_CONFIG', 'SYSTEM', 'global', { appName }, req.ip);
        }

        res.json(config);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to update SaaS config',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const uploadSaaSLogo = async (req: AuthRequest, res: Response) => {
    try {
        const { logoBase64 } = req.body;
        if (!logoBase64) return res.status(400).json({ error: 'Logo data is required' });

        // Extract format and data
        const matches = logoBase64.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        const extension = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `saas_logo_${Date.now()}.${extension}`;

        const filePath = path.join(UPLOADS_DIR, fileName);

        // Delete old logo if it exists (only if it's a managed file)
        const config = await prisma.saaSConfig.findUnique({ where: { id: 'global' } });
        if (config?.appLogoUrl && config.appLogoUrl.includes('/api/uploads/logos/')) {
            const oldFileName = config.appLogoUrl.split('/').pop();
            if (oldFileName) {
                const oldFilePath = path.join(UPLOADS_DIR, oldFileName);
                if (fs.existsSync(oldFilePath)) {
                    try {
                        fs.unlinkSync(oldFilePath);
                    } catch (e) {
                        console.error('Failed to delete old SaaS logo:', e);
                    }
                }
            }
        }

        fs.writeFileSync(filePath, buffer);

        const logoUrl = `/api/uploads/logos/${fileName}`;
        await prisma.saaSConfig.upsert({
            where: { id: 'global' },
            create: { id: 'global', appLogoUrl: logoUrl },
            update: { appLogoUrl: logoUrl }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'UPLOAD_SAAS_LOGO', 'SYSTEM', 'global', { fileName }, req.ip);
        }

        res.json({ success: true, logoUrl });
    } catch (error) {
        console.error('SaaS logo upload error:', error);
        res.status(500).json({ error: 'Failed to upload SaaS logo' });
    }
};
