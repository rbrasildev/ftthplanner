import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        companyId: string;
        role: string;
    };
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    console.log(`[Auth] Header present: ${!!authHeader}`);
    const token = authHeader && authHeader.split(' ')[1];
    console.log(`[Auth] Token received: '${token}'`);

    if (token == null) return res.sendStatus(401);

    if (!process.env.JWT_SECRET) {
        console.error("[Auth] CRITICAL: JWT_SECRET is missing in environment variables!");
        return res.sendStatus(500);
    }

    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
        if (err) {
            console.error(`[Auth] Token verification failed: ${err.message}`);
            return res.sendStatus(403);
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
    if (user?.role !== 'ADMIN' && user?.role !== 'OWNER' && user?.role !== 'SUPER_ADMIN') {
        return res.sendStatus(403);
    }
    next();
};
