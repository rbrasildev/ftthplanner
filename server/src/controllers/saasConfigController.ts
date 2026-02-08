import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from './auditController';

const prisma = new PrismaClient();

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
