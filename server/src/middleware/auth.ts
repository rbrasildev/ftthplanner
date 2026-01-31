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
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
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
