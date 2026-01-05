import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

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

        res.json(logs);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
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
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
};
