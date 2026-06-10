import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';
import { logAudit } from './auditController';

// Gera código alfanumérico curto (6 chars) sem caracteres ambíguos (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(len = 6): string {
    let out = '';
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
}

// Dedup window pra visitas: 24h. Mesmo ipHash+userAgent dentro desse intervalo
// pro mesmo consultor não gera linha nova (evita inflar visits com refresh/F5).
const VISIT_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

function hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

// --- ADMIN: CRUD de consultores ---

export const listConsultants = async (_req: AuthRequest, res: Response) => {
    try {
        const consultants = await prisma.consultant.findMany({
            orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
            include: {
                _count: { select: { companies: true, visits: true } }
            }
        });
        res.json(consultants);
    } catch (error) {
        logger.error(`[Referral] listConsultants failed: ${error}`);
        res.status(500).json({
            error: 'Failed to list consultants',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const createConsultant = async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, phone, commissionPct, notes, code: providedCode } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }

        // Garante código único — tenta o fornecido, ou gera novo até achar livre.
        let code = (providedCode && typeof providedCode === 'string')
            ? providedCode.trim().toUpperCase()
            : generateCode();
        for (let i = 0; i < 8; i++) {
            const exists = await prisma.consultant.findUnique({ where: { code } });
            if (!exists) break;
            if (providedCode) return res.status(409).json({ error: 'code already in use' });
            code = generateCode();
        }

        const consultant = await prisma.consultant.create({
            data: {
                name: name.trim(),
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                code,
                commissionPct: typeof commissionPct === 'number' ? commissionPct : 10,
                notes: notes?.trim() || null,
                active: true,
            }
        });

        if (req.user?.id) await logAudit(req.user.id, 'CREATE', 'consultant', consultant.id, { name, code }, req.ip);
        res.status(201).json(consultant);
    } catch (error) {
        logger.error(`[Referral] createConsultant failed: ${error}`);
        res.status(500).json({
            error: 'Failed to create consultant',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateConsultant = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, email, phone, commissionPct, notes, active } = req.body;

        // Code não é editável após criação — evita quebrar links já distribuídos.
        const consultant = await prisma.consultant.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: String(name).trim() }),
                ...(email !== undefined && { email: email ? String(email).trim() : null }),
                ...(phone !== undefined && { phone: phone ? String(phone).trim() : null }),
                ...(commissionPct !== undefined && { commissionPct: Number(commissionPct) }),
                ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
                ...(active !== undefined && { active: Boolean(active) }),
            }
        });

        if (req.user?.id) await logAudit(req.user.id, 'UPDATE', 'consultant', id, req.body, req.ip);
        res.json(consultant);
    } catch (error) {
        logger.error(`[Referral] updateConsultant failed: ${error}`);
        res.status(500).json({
            error: 'Failed to update consultant',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const deleteConsultant = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        // ON DELETE: companies.referredById vira NULL (não quebra empresa);
        // referral_visits cascade delete (não tem valor histórico standalone).
        await prisma.consultant.delete({ where: { id } });
        if (req.user?.id) await logAudit(req.user.id, 'DELETE', 'consultant', id, {}, req.ip);
        res.status(204).send();
    } catch (error) {
        logger.error(`[Referral] deleteConsultant failed: ${error}`);
        res.status(500).json({
            error: 'Failed to delete consultant',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// --- ADMIN: estatísticas detalhadas ---

export const getConsultantStats = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const consultant = await prisma.consultant.findUnique({ where: { id } });
        if (!consultant) return res.status(404).json({ error: 'consultant not found' });

        // Métricas agregadas
        const [visitsTotal, companies] = await Promise.all([
            prisma.referralVisit.count({ where: { consultantId: id } }),
            prisma.company.findMany({
                where: { referredById: id },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    referredAt: true,
                    subscriptionExpiresAt: true,
                    plan: { select: { id: true, name: true, price: true } },
                    users: {
                        where: { role: 'OWNER', deletedAt: null },
                        select: { username: true, email: true },
                        take: 1
                    },
                    invoices: {
                        where: { status: 'PAID' },
                        select: { amount: true, paidAt: true }
                    }
                },
                orderBy: { referredAt: 'desc' }
            })
        ]);

        // Calcula receita confirmada (somatória das invoices PAID das empresas).
        const revenueByCompany = companies.map(c => {
            const revenue = c.invoices.reduce((s: number, i: any) => s + (i.amount || 0), 0);
            return {
                id: c.id,
                name: c.name,
                status: c.status,
                planName: c.plan?.name || null,
                planPrice: c.plan?.price || 0,
                ownerName: c.users[0]?.username || null,
                ownerEmail: c.users[0]?.email || null,
                referredAt: c.referredAt,
                subscriptionExpiresAt: c.subscriptionExpiresAt,
                revenue,
                isPaying: revenue > 0,
            };
        });

        const totalRevenue = revenueByCompany.reduce((s, c) => s + c.revenue, 0);
        const payingCount = revenueByCompany.filter(c => c.isPaying).length;
        const signupsTotal = companies.length;
        const commissionPct = consultant.commissionPct || 0;
        const estimatedCommission = totalRevenue * (commissionPct / 100);

        res.json({
            consultant: {
                id: consultant.id,
                name: consultant.name,
                code: consultant.code,
                email: consultant.email,
                phone: consultant.phone,
                commissionPct: consultant.commissionPct,
                active: consultant.active,
                notes: consultant.notes,
            },
            metrics: {
                visits: visitsTotal,
                signups: signupsTotal,
                paying: payingCount,
                conversionRate: visitsTotal > 0 ? signupsTotal / visitsTotal : 0,
                paidConversionRate: signupsTotal > 0 ? payingCount / signupsTotal : 0,
                revenue: totalRevenue,
                estimatedCommission,
            },
            companies: revenueByCompany,
        });
    } catch (error) {
        logger.error(`[Referral] getConsultantStats failed: ${error}`);
        res.status(500).json({
            error: 'Failed to get consultant stats',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// --- PÚBLICO: registra visita ao link ?ref=<code> ---

export const registerVisit = async (req: Request, res: Response) => {
    try {
        const { code } = req.params;
        if (!code) return res.status(400).json({ error: 'code required' });

        const consultant = await prisma.consultant.findUnique({
            where: { code: code.trim().toUpperCase() },
            select: { id: true, active: true }
        });
        if (!consultant || !consultant.active) {
            // Não vaza se o código existe ou não — só registra silenciosamente.
            return res.status(200).json({ ok: true });
        }

        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
            || req.socket.remoteAddress
            || 'unknown';
        const ipHash = hashIp(ip);
        const userAgent = (req.headers['user-agent'] || '').slice(0, 500);
        const referer = (req.headers['referer'] || req.headers['referrer'] || '') as string;

        // Dedup: mesmo ipHash+userAgent pro mesmo consultor dentro de 24h não conta.
        const recent = await prisma.referralVisit.findFirst({
            where: {
                consultantId: consultant.id,
                ipHash,
                userAgent,
                visitedAt: { gte: new Date(Date.now() - VISIT_DEDUP_WINDOW_MS) }
            },
            select: { id: true }
        });
        if (recent) return res.status(200).json({ ok: true, deduped: true });

        await prisma.referralVisit.create({
            data: {
                consultantId: consultant.id,
                ipHash,
                userAgent,
                referer: referer.slice(0, 500) || null,
            }
        });

        res.status(200).json({ ok: true });
    } catch (error) {
        logger.error(`[Referral] registerVisit failed: ${error}`);
        // Falhar silenciosamente — visita não cadastrada não deve quebrar UX.
        res.status(200).json({ ok: false });
    }
};

// --- PÚBLICO: valida código (pra UI mostrar "indicado por João") ---

export const lookupConsultant = async (req: Request, res: Response) => {
    try {
        const { code } = req.params;
        const consultant = await prisma.consultant.findUnique({
            where: { code: (code || '').trim().toUpperCase() },
            select: { name: true, active: true }
        });
        if (!consultant || !consultant.active) {
            return res.status(404).json({ error: 'not found' });
        }
        res.json({ name: consultant.name });
    } catch (error) {
        res.status(500).json({ error: 'lookup failed' });
    }
};
