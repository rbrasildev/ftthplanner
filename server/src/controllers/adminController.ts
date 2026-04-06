import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import bcrypt from 'bcryptjs';
import { ROLE_DEFAULT_PERMISSIONS, ALL_PERMISSIONS, Permission } from '../shared/permissions';
import { resolvePermissions } from '../middleware/checkPermission';

// Get Users (in same company)
export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(400).json({ error: 'User not associated with a company' });

        const users = await prisma.user.findMany({
            where: { companyId, deletedAt: null },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                permissions: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Resolve effective permissions for each user
        const usersWithPermissions = users.map(u => ({
            ...u,
            permissions: resolvePermissions(u.permissions, u.role),
        }));

        res.json(usersWithPermissions);
    } catch (error: any) {
        logger.error(`Error fetching users: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Create User
export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        const { username, email, password, role, permissions } = req.body;
        const companyId = req.user?.companyId;

        if (!companyId) return res.status(400).json({ error: 'User not associated with a company' });

        // Use email as fallback for username if not provided, or vice-versa
        const finalEmail = email;
        const finalUsername = username || email.split('@')[0];

        if (!finalEmail || !password) return res.status(400).json({ error: 'Email and password are required' });

        // Basic validation
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        // Check if email or username exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: finalUsername },
                    { email: finalEmail }
                ],
                deletedAt: null
            }
        });
        if (existingUser) return res.status(400).json({ error: 'Username or Email already taken' });

        const passwordHash = await bcrypt.hash(password, 10);

        // Check Plan Limits
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                plan: true,
                _count: { select: { users: true } }
            }
        });

        if (!company) return res.status(404).json({ error: 'Company not found' });

        if (company.plan?.limits) {
            const limits = company.plan.limits as any;
            if (limits.maxUsers && company._count.users >= limits.maxUsers) {
                return res.status(403).json({
                    error: 'User limit reached for your plan',
                    details: `Max users: ${limits.maxUsers}`
                });
            }
        }

        // Validate and set permissions
        const userRole = role || 'MEMBER';
        let userPermissions: string[] = ROLE_DEFAULT_PERMISSIONS[userRole] || [];
        if (Array.isArray(permissions)) {
            // Filter to only valid permissions
            userPermissions = permissions.filter((p: string) => (ALL_PERMISSIONS as readonly string[]).includes(p));
        }

        const newUser = await prisma.user.create({
            data: {
                username: finalUsername,
                email: finalEmail,
                passwordHash,
                role: userRole,
                permissions: userPermissions,
                companyId
            }
        });

        res.status(201).json({
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            permissions: resolvePermissions(newUser.permissions, newUser.role),
            createdAt: newUser.createdAt
        });

    } catch (error: any) {
        logger.error(`Error creating user: ${error.message}`);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

// Update User (Password or Role)
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { password, role, permissions } = req.body;
        const companyId = req.user?.companyId;

        if (!companyId) return res.status(400).json({ error: 'User not associated with a company' });

        // Ensure user belongs to same company
        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser || targetUser.companyId !== companyId) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updateData: any = {};
        if (role) updateData.role = role;
        if (password) {
            if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        // Handle permissions update
        if (Array.isArray(permissions)) {
            updateData.permissions = permissions.filter((p: string) => (ALL_PERMISSIONS as readonly string[]).includes(p));
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, username: true, email: true, role: true, permissions: true, createdAt: true }
        });

        res.json({
            ...updatedUser,
            permissions: resolvePermissions(updatedUser.permissions, updatedUser.role),
        });

    } catch (error: any) {
        logger.error(`Error updating user: ${error.message}`);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// Delete User
export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId;
        const currentUserId = req.user?.id;

        if (id === currentUserId) return res.status(400).json({ error: 'Cannot delete yourself' });

        // Ensure user belongs to same company
        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser || targetUser.companyId !== companyId) {
            return res.status(404).json({ error: 'User not found' });
        }

        await prisma.user.update({ 
            where: { id },
            data: { deletedAt: new Date(), active: false }
        });

        res.json({ message: 'User deleted successfully' });

    } catch (error: any) {
        logger.error(`Error deleting user: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
