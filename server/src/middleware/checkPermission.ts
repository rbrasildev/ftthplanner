import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';
import { Permission, ROLE_DEFAULT_PERMISSIONS } from '../shared/permissions';

/**
 * Middleware that checks if the authenticated user has one of the required permissions.
 * Permissions come from user.permissions JSON field in the database.
 * If the user has no custom permissions set (empty array), role defaults are used.
 *
 * OWNER and SUPER_ADMIN always bypass permission checks.
 */
export const checkPermission = (...requiredPermissions: Permission[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { role } = req.user;

        // OWNER and SUPER_ADMIN always have full access
        if (role === 'OWNER' || role === 'SUPER_ADMIN') {
            return next();
        }

        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true, role: true }
            });

            if (!dbUser) {
                return res.status(401).json({ error: 'User not found' });
            }

            const userPermissions = resolvePermissions(dbUser.permissions, dbUser.role);

            const hasAccess = requiredPermissions.some(p => userPermissions.includes(p));

            if (!hasAccess) {
                return res.status(403).json({
                    error: 'Permissão insuficiente',
                    required: requiredPermissions
                });
            }

            next();
        } catch {
            return res.status(500).json({ error: 'Failed to verify permissions' });
        }
    };
};

/**
 * Helper to resolve a user's effective permissions.
 * If the user has custom permissions set, use those.
 * Otherwise, fall back to role defaults.
 */
export function resolvePermissions(userPermissions: unknown, role: string): string[] {
    if (Array.isArray(userPermissions) && userPermissions.length > 0) {
        return userPermissions as string[];
    }
    return ROLE_DEFAULT_PERMISSIONS[role] || [];
}
