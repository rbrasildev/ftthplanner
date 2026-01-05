import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Get Users (in same company)
export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(400).json({ error: 'User not associated with a company' });

        const users = await prisma.user.findMany({
            where: { companyId },
            select: {
                id: true,
                username: true,
                role: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Create User
export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        const { username, password, role } = req.body;
        const companyId = req.user?.companyId;

        if (!companyId) return res.status(400).json({ error: 'User not associated with a company' });
        if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

        // Basic validation
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        // Check if username exists
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) return res.status(400).json({ error: 'Username already taken' });

        const passwordHash = await bcrypt.hash(password, 10);

        // Check Plan Limits
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                plan: true,
                _count: { select: { users: true } }
            }
        });

        if (company?.plan?.limits) {
            const limits = company.plan.limits as any;
            if (limits.maxUsers && company._count.users >= limits.maxUsers) {
                return res.status(403).json({
                    error: 'User limit reached for your plan',
                    details: `Max users: ${limits.maxUsers}`
                });
            }
        }

        const newUser = await prisma.user.create({
            data: {
                username,
                passwordHash,
                role: role || 'MEMBER',
                companyId
            }
        });

        res.status(201).json({
            id: newUser.id,
            username: newUser.username,
            role: newUser.role,
            createdAt: newUser.createdAt
        });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

// Update User (Password or Role)
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { password, role } = req.body;
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

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, username: true, role: true, createdAt: true }
        });

        res.json(updatedUser);

    } catch (error) {
        console.error('Error updating user:', error);
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

        await prisma.user.delete({ where: { id } });

        res.json({ message: 'User deleted successfully' });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
