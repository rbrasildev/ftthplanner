import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { SgpService } from './sgp.service';
import logger from '../../lib/logger';

export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const tenantId = req.params.tenantId;
        const sgpType = req.params.sgpType; // e.g., 'IXC' or 'GENERIC'

        if (!tenantId || !sgpType) {
            return res.status(400).json({ error: 'Missing tenantId or sgpType parameters' });
        }

        // Processing the webhook asynchronously so we can quickly respond with 200 OK
        // to avoid timeout from SGP systems like IXC.
        SgpService.processWebhook(tenantId, sgpType, req.body, req.headers).catch(error => {
            logger.error(`[SGP Controller] Async processing error for tenant ${tenantId}: ${error.message}`);
        });

        // Immediately respond 200 OK
        res.status(200).json({ message: 'Webhook received' });
    } catch (error: any) {
        logger.error(`[SGP Controller] Webhook error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error while receiving webhook' });
    }
};

// --- Admin Endpoints ---

export const getIntegrationSettings = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        const { sgpType } = req.params;

        if (!userId) {
            logger.warn(`[SGP Controller] Unauthorized access attempt (No userId in token)`);
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const settings = await prisma.integrationSettings.findFirst({
            where: { userId, sgpType }
        });

        res.json(settings || { active: false, sgpType, apiUrl: '', apiApp: '', apiToken: '', webhookSecret: '' });
    } catch (error: any) {
        logger.error(`[SGP Controller] Error fetching settings: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const saveIntegrationSettings = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        const { sgpType } = req.params;
        const { active, apiUrl, apiApp, apiToken, webhookSecret } = req.body;

        if (!userId) {
            logger.warn(`[SGP Controller] Unauthorized save attempt (No userId in token)`);
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let settings = await prisma.integrationSettings.findFirst({
            where: { userId, sgpType }
        });

        if (settings) {
            settings = await prisma.integrationSettings.update({
                where: { id: settings.id },
                data: { active, apiUrl, apiApp, apiToken, webhookSecret }
            });
        } else {
            settings = await prisma.integrationSettings.create({
                data: { userId, sgpType, active, apiUrl, apiApp, apiToken, webhookSecret }
            });
        }

        res.json(settings);
    } catch (error: any) {
        logger.error(`[SGP Controller] Error saving settings: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};


export const getIntegrationConflicts = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const conflicts = await prisma.integrationConflict.findMany({
            where: { userId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' }
        });

        // Enrich with customer name and CTO name from the DB
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const enriched = await Promise.all(conflicts.map(async (conflict) => {
            let customerName = (conflict.payload as any)?.customerName || null;
            let ctoName = (conflict.payload as any)?.ctoName || null;

            if ((!customerName || !ctoName) && conflict.customerId) {
                const customer = await prisma.customer.findFirst({
                    where: { document: conflict.customerId, companyId: user?.companyId ?? undefined },
                    include: { cto: true }
                });
                if (!customerName) customerName = customer?.name || null;
                if (!ctoName && customer?.cto) ctoName = customer.cto.name || null;
            }

            return {
                ...conflict,
                payload: {
                    ...(conflict.payload as object),
                    customerName: customerName || conflict.customerId,
                    ctoName: ctoName || null
                }
            };
        }));

        res.json(enriched);
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
};


export const resolveIntegrationConflict = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        const { id } = req.params;
        const { status } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        await prisma.integrationConflict.updateMany({
            where: { id, userId },
            data: { status }
        });

        res.json({ success: true });
    } catch (error: any) {
        logger.error(`[SGP Controller] Error resolving conflict: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const applyIntegrationConflict = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        const { id } = req.params;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const result = await SgpService.applyConflict(userId, id);
        res.json(result);
    } catch (error: any) {
        logger.error(`[SGP Controller] Error applying conflict: ${error.message}`);
        res.status(400).json({ error: error.message || 'Erro ao aplicar conflito' });
    }
};

export const searchSgpCustomer = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        const { sgpType } = req.params;
        const { cpfCnpj } = req.body;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!cpfCnpj) return res.status(400).json({ error: 'Missing cpfCnpj' });

        const customer = await SgpService.searchCustomer(userId, sgpType, cpfCnpj);
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found in SGP' });
        }

        res.json(customer);
    } catch (error: any) {
        logger.error(`[SGP Controller] Search error: ${error.message}`);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

export const syncAllStatuses = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        const { sgpType } = req.params;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const result = await SgpService.syncAllStatuses(userId, sgpType);
        res.json(result);
    } catch (error: any) {
        logger.error(`[SGP Controller] Sync error: ${error.message}`);
        res.status(500).json({ error: error.message || 'Internal server error during bulk sync' });
    }
};
