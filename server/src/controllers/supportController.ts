import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const createSupportSession = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { targetUserId } = req.body;

    // Only SUPER_ADMIN or ADMIN can create a support session.
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            include: { company: true }
        });

        if (!targetUser) {
            return res.status(404).json({ error: 'Usuário alvo não encontrado' });
        }

        // Create the session in DB
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        const session = await prisma.adminSupportSession.create({
            data: {
                adminId: user.id,
                targetUserId: targetUser.id,
                expiresAt,
                ipAddress: req.ip || '',
                userAgent: req.headers['user-agent'] || ''
            }
        });

        // Log the creation
        await prisma.supportAccessLog.create({
            data: {
                adminId: user.id,
                targetUserId: targetUser.id,
                action: 'START_SESSION',
                resourceType: 'SYSTEM',
                ipAddress: req.ip || ''
            }
        });

        // Generate the Support Token
        const tokenPayload = {
            id: targetUser.id,
            username: targetUser.username,
            companyId: targetUser.companyId,
            role: 'support',         // Explicitly support role
            adminId: user.id,
            supportSessionId: session.id
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET as string, { expiresIn: '30m' });

        res.json({ token, expiresAt, targetUser: { id: targetUser.id, name: targetUser.username, company: targetUser.company?.name } });

    } catch (error) {
        console.error("Create Support Session Error:", error);
        res.status(500).json({ error: 'Erro interno ao criar sessão de suporte' });
    }
};

export const endSupportSession = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;

    if (!user) return res.status(401).send();

    try {
        let sessionId = req.body.sessionId || user.supportSessionId;

        if (sessionId) {
            await prisma.adminSupportSession.updateMany({
                where: { id: sessionId },
                data: { revokedAt: new Date() }
            });

            if (user.role === 'support') {
                await prisma.supportAccessLog.create({
                    data: {
                        adminId: user.adminId || '',
                        targetUserId: user.id,
                        action: 'END_SESSION',
                        resourceType: 'SYSTEM',
                        ipAddress: req.ip || ''
                    }
                });
            }

            res.json({ success: true, message: 'Sessão de suporte encerrada.' });
        } else {
            res.status(400).json({ error: 'ID da sessão não fornecido.' });
        }

    } catch (error) {
        console.error("End Support Session Error:", error);
        res.status(500).json({ error: 'Erro ao encerrar sessão' });
    }
};
