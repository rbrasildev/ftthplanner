import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        companyId: string;
        role: string;
        adminId?: string;
        supportSessionId?: string;
    };
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    // Tenta ler do header primeiro (prioridade para Modo Suporte), depois do cookie
    const token = (req.headers['authorization']?.split(' ')[1]) || req.cookies?.auth_token;
    
    if (token == null) {
        console.log(`[Auth] No token found in cookies or headers`);
        return res.sendStatus(401);
    }

    if (!process.env.JWT_SECRET) {
        console.error("[Auth] CRITICAL: JWT_SECRET is missing in environment variables!");
        return res.sendStatus(500);
    }

    jwt.verify(token, process.env.JWT_SECRET as string, async (err: any, user: any) => {
        if (err) {
            console.error(`[Auth] Token verification failed: ${err.message}`);
            return res.sendStatus(403);
        }

        // Check if this token is still the active session
        // Skip check for support mode tokens — they use a separate token
        if (user.role !== 'support') {
            try {
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { activeSessionToken: true }
                });
                if (dbUser?.activeSessionToken && dbUser.activeSessionToken !== token) {
                    console.log(`[Auth] Session revoked for user: ${user?.username || 'unknown'}`);
                    return res.status(401).json({ error: 'SESSION_REVOKED', message: 'Sua sessão foi encerrada por outro login.' });
                }
            } catch {
                // DB check failed — allow request to proceed
            }
        }

        console.log(`[Auth] Token verified for user: ${user?.username || 'unknown'}`);
        (req as AuthRequest).user = user;
        next();
    });
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    if (user?.role !== 'SUPER_ADMIN') {
        return res.sendStatus(403);
    }
    next();
};

export const requireAdminOrOwner = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    if (user?.role !== 'ADMIN' && user?.role !== 'OWNER' && user?.role !== 'SUPER_ADMIN' && user?.role !== 'support') {
        return res.sendStatus(403);
    }
    next();
};
