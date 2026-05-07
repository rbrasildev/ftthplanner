import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

// Get Audit Logs
export const getAuditLogs = async (req: AuthRequest, res: Response) => {
    try {
        const { limit = 50, entity, action } = req.query;

        const where: any = {};
        if (entity) where.entity = String(entity);
        if (action) where.action = String(action);

        const logs = await prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { username: true, role: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });

        // Resolve targetId → human name for display.
        // Audit details may carry { targetType: 'USER'|'COMPANY', targetId } —
        // we batch-fetch the referenced users/companies and inject targetName
        // so the UI can render a name instead of a UUID.
        const userIds = new Set<string>();
        const companyIds = new Set<string>();
        for (const log of logs) {
            const d = log.details as any;
            if (d && typeof d === 'object') {
                if (d.targetType === 'USER' && d.targetId) userIds.add(String(d.targetId));
                else if (d.targetType === 'COMPANY' && d.targetId) companyIds.add(String(d.targetId));
            }
        }

        const [users, companies] = await Promise.all([
            userIds.size > 0
                ? prisma.user.findMany({
                    where: { id: { in: [...userIds] } },
                    select: { id: true, username: true }
                })
                : Promise.resolve([] as { id: string; username: string }[]),
            companyIds.size > 0
                ? prisma.company.findMany({
                    where: { id: { in: [...companyIds] } },
                    select: { id: true, name: true }
                })
                : Promise.resolve([] as { id: string; name: string }[])
        ]);

        const userMap = new Map(users.map(u => [u.id, u.username]));
        const companyMap = new Map(companies.map(c => [c.id, c.name]));

        const enriched = logs.map(log => {
            const d = log.details as any;
            if (!d || typeof d !== 'object') return log;
            let targetName: string | null = null;
            if (d.targetType === 'USER' && d.targetId) targetName = userMap.get(String(d.targetId)) || null;
            else if (d.targetType === 'COMPANY' && d.targetId) targetName = companyMap.get(String(d.targetId)) || null;
            if (targetName) {
                return { ...log, details: { ...d, targetName } };
            }
            return log;
        });

        res.json(enriched);
    } catch (error: any) {
        logger.error(`Error fetching audit logs: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};

// Log Audit Entry (Internal Helper)
export const logAudit = async (userId: string, action: string, entity: string, entityId: string, details: any = {}, ipAddress?: string) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entity,
                entityId,
                details,
                ipAddress
            }
        });
    } catch (error: any) {
        logger.error(`Failed to create audit log: ${error.message}`);
    }
};
