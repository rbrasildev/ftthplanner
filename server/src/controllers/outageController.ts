import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { AuthRequest } from '../middleware/auth';

/**
 * GET /api/outages
 *   ?status=ACTIVE|RESOLVED|ALL   (default ACTIVE)
 *   ?days=N                       (default 30, só vale pra RESOLVED/ALL)
 *
 * Retorna a lista de incidents da company do user logado. Inclui o nome do
 * CTO (lookup) e dados básicos pra UI listar sem precisar fazer N+1.
 */
export const listOutages = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

        const status = (req.query.status as string)?.toUpperCase() || 'ACTIVE';
        const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);

        const where: any = { companyId };
        if (status === 'ACTIVE') {
            where.status = 'ACTIVE';
        } else if (status === 'RESOLVED') {
            where.status = 'RESOLVED';
            where.startedAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
        } else if (status === 'ALL') {
            where.startedAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
        }

        const incidents = await prisma.outageIncident.findMany({
            where,
            orderBy: [
                { status: 'asc' }, // ACTIVE primeiro (vem antes alfabeticamente)
                { startedAt: 'desc' }
            ],
            take: 200, // hard cap
        });

        // N+1 mitigation — single batch lookup pros nomes/projects dos CTOs
        const ctoIds = [...new Set(incidents.map(i => i.ctoId))];
        const ctos = ctoIds.length
            ? await prisma.cto.findMany({
                where: { id: { in: ctoIds } },
                select: { id: true, name: true, projectId: true, lat: true, lng: true }
            })
            : [];
        const ctoMap = new Map(ctos.map(c => [c.id, c]));

        const enriched = incidents.map(i => {
            const cto = ctoMap.get(i.ctoId);
            const durationMs = i.status === 'RESOLVED' && i.resolvedAt
                ? i.resolvedAt.getTime() - i.startedAt.getTime()
                : Date.now() - i.startedAt.getTime();
            return {
                id: i.id,
                ctoId: i.ctoId,
                ctoName: cto?.name || null,
                projectId: cto?.projectId || null,
                lat: cto?.lat || null,
                lng: cto?.lng || null,
                startedAt: i.startedAt,
                resolvedAt: i.resolvedAt,
                affectedCount: i.affectedCount,
                totalCount: i.totalCount,
                affectedRatio: i.totalCount > 0 ? i.affectedCount / i.totalCount : 0,
                durationMs,
                status: i.status,
            };
        });

        res.json(enriched);
    } catch (error: any) {
        logger.error(`[Outage Controller] List error: ${error.message}`);
        res.status(500).json({ error: 'Failed to list outages' });
    }
};

/**
 * GET /api/outages/:id
 * Retorna o incident + lista dos clientes do CTO no momento ATUAL (não snapshot).
 * Útil pra UI mostrar exatamente quem está offline agora.
 */
export const getOutageDetail = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

        const incident = await prisma.outageIncident.findFirst({
            where: { id: req.params.id, companyId }
        });
        if (!incident) return res.status(404).json({ error: 'Outage not found' });

        const cto = await prisma.cto.findUnique({
            where: { id: incident.ctoId },
            select: { id: true, name: true, projectId: true, lat: true, lng: true }
        });

        const customers = await prisma.customer.findMany({
            where: {
                companyId,
                ctoId: incident.ctoId,
                deletedAt: null,
                status: { in: ['ACTIVE', 'SUSPENDED'] },
            },
            select: {
                id: true,
                name: true,
                document: true,
                phone: true,
                status: true,
                connectionStatus: true,
                splitterPortIndex: true,
            },
            orderBy: { splitterPortIndex: 'asc' }
        });

        res.json({
            ...incident,
            cto,
            customers,
        });
    } catch (error: any) {
        logger.error(`[Outage Controller] Detail error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch outage detail' });
    }
};

/**
 * GET /api/outages/active-ctos
 * Resposta enxuta: só os ctoIds com incident ACTIVE.
 * Usado pelo mapa pra desenhar o ring vermelho — não precisa do payload todo.
 */
export const getActiveCtoIds = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

        const active = await prisma.outageIncident.findMany({
            where: { companyId, status: 'ACTIVE' },
            select: { ctoId: true, affectedCount: true, totalCount: true, startedAt: true }
        });

        res.json(active);
    } catch (error: any) {
        logger.error(`[Outage Controller] Active CTOs error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch active CTOs' });
    }
};

/**
 * POST /api/outages/simulate/:ctoId
 * Cria/resolve um incident FAKE pra testar o anel visual no mapa sem
 * precisar desconectar clientes reais. Toggle:
 *   - Se não há incident ACTIVE pra esse CTO → cria com counts artificiais
 *   - Se já há → resolve (marca como RESOLVED)
 * Sempre escopo da company do user logado. Restrito a OWNER/ADMIN
 * (validação já no middleware da rota).
 */
export const simulateOutage = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

        const { ctoId } = req.params;
        if (!ctoId) return res.status(400).json({ error: 'ctoId required' });

        // Confirma que o CTO existe e é dessa company (segurança básica)
        const cto = await prisma.cto.findFirst({
            where: { id: ctoId, companyId },
            select: { id: true, name: true }
        });
        if (!cto) return res.status(404).json({ error: 'CTO not found in your company' });

        const existing = await prisma.outageIncident.findFirst({
            where: { companyId, ctoId, status: 'ACTIVE' }
        });

        if (existing) {
            await prisma.outageIncident.update({
                where: { id: existing.id },
                data: { status: 'RESOLVED', resolvedAt: new Date() }
            });
            logger.info(`[Outage Simulate] Resolved fake incident for CTO ${cto.name}`);
            return res.json({ action: 'resolved', incidentId: existing.id, ctoName: cto.name });
        }

        // Conta clientes reais pra parecer plausível na UI; se 0, usa 5/16 fake.
        const customerCount = await prisma.customer.count({
            where: { companyId, ctoId, deletedAt: null, status: { in: ['ACTIVE', 'SUSPENDED'] } }
        });
        const totalCount = customerCount > 0 ? customerCount : 16;
        const affectedCount = Math.max(3, Math.ceil(totalCount * 0.5));

        const created = await prisma.outageIncident.create({
            data: {
                companyId, ctoId,
                affectedCount, totalCount,
                status: 'ACTIVE',
                startedAt: new Date(),
            }
        });
        logger.info(`[Outage Simulate] Created fake incident for CTO ${cto.name} (${affectedCount}/${totalCount})`);
        res.json({ action: 'created', incidentId: created.id, ctoName: cto.name, affectedCount, totalCount });
    } catch (error: any) {
        logger.error(`[Outage Controller] Simulate error: ${error.message}`);
        res.status(500).json({ error: 'Failed to simulate outage' });
    }
};
