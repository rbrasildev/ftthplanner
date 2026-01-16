import { logAudit } from './auditController';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
import { AuthRequest } from '../middleware/auth';
import { StripeService } from '../services/billing/stripeService';

// --- PLANS ---
export const getPlans = async (req: AuthRequest, res: Response) => {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { price: 'asc' }
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch plans',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// Public Plans Access (No Auth)
export const getPublicPlans = async (req: Request, res: Response) => {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { price: 'asc' },
            select: {
                id: true,
                name: true,
                price: true,
                priceYearly: true,
                type: true,
                features: true,
                limits: true,
                isRecommended: true,
                stripePriceId: true,
                stripePriceIdYearly: true
            }
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch public plans',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// Get Global Map Data (Projects & Companies)
export const getGlobalMapData = async (req: AuthRequest, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            select: {
                id: true,
                name: true,
                centerLat: true,
                centerLng: true,
                createdAt: true,
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        const formatted = projects.map(p => ({
            ...p,
            createdAt: p.createdAt.getTime()
        }));
        res.json(formatted);
    } catch (error) {
        console.error('Error fetching map data:', error);
        res.status(500).json({
            error: 'Failed to fetch map data',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const createPlan = async (req: AuthRequest, res: Response) => {
    try {
        const { name, price, priceYearly, type, trialDurationDays, limits, features, isRecommended, stripePriceId, stripePriceIdYearly } = req.body;
        const plan = await prisma.plan.create({
            data: { name, price, priceYearly, type, trialDurationDays, limits, features, isRecommended, stripePriceId, stripePriceIdYearly }
        });

        // Audit Log
        if (req.user?.id) {
            await logAudit(req.user.id, 'CREATE_PLAN', 'Plan', plan.id, { name, price, type }, req.ip);
        }

        res.status(201).json(plan);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create plan',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updatePlan = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, priceYearly, type, trialDurationDays, limits, features, isRecommended, stripePriceId, stripePriceIdYearly } = req.body;
        const plan = await prisma.plan.update({
            where: { id },
            data: { name, price, priceYearly, type, trialDurationDays, limits, features, isRecommended, stripePriceId, stripePriceIdYearly }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'UPDATE_PLAN', 'Plan', plan.id, { name, price }, req.ip);
        }

        res.json(plan);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to update plan',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// --- COMPANIES ---
export const getCompanies = async (req: AuthRequest, res: Response) => {
    try {
        const companies = await prisma.company.findMany({
            include: {
                plan: true,
                users: {
                    select: { id: true, username: true, role: true }
                },
                _count: {
                    select: { projects: true, users: true, ctos: true, pops: true }
                },
                projects: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(companies);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch companies',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateCompanyStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, planId, billingMode } = req.body;

        const data: any = {};
        if (status) data.status = status;
        if (planId) data.planId = planId;
        if (billingMode) data.billingMode = billingMode;

        // --- NEW LOGIC: RENEW EXPIRATION ON MANUAL ACTIVATION/PLAN CHANGE/MODE CHANGE ---
        // If we are activating, changing a plan manually, or switching to MANUAL billing,
        // we give the user a long expiration to prevent the auto-downgrade logic.
        if (status === 'ACTIVE' || planId || billingMode === 'MANUAL') {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            data.subscriptionExpiresAt = nextYear;
            console.log(`[saasController] Manually renewing expiration for company ${id} until ${nextYear.toISOString()} (Billing Mode: ${billingMode || 'Unchanged'})`);
        }

        // If suspending, try to cancel Stripe subscription
        if (status === 'SUSPENDED') {
            try {
                await StripeService.cancelSubscription(id);
            } catch (e) {
                console.warn("Failed to cancel stripe subscription during suspension:", e);
                // Proceed with local suspension anyway
            }
        }

        const company = await prisma.company.update({
            where: { id },
            data
        });
        console.log(`[saasController] ✅ Company ${id} updated successfully:`, { billingMode: (company as any).billingMode });
        res.json(company);
    } catch (error: any) {
        console.error("Critical Update Company Error:", {
            id: req.params.id,
            errorMessage: error?.message,
            errorStack: error?.stack,
            prismaCode: error?.code
        });
        res.status(500).json({
            error: 'Failed to update company',
            details: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code
        });
    }
};

export const deleteCompany = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Prevent deleting the user's own company (safety check)
        if (req.user?.companyId === id) {
            return res.status(400).json({ error: 'Cannot delete your own company while logged in.' });
        }

        // 0. PRE-CLEANUP: Delete Subscription (FK Constraint)
        await prisma.subscription.deleteMany({ where: { companyId: id } });

        // 1. Delete Projects (Manual Cascade)
        // Note: Project elements (Cables, CTOs, etc.) usually cascade from Project if configured,
        // but to be safe we rely on Prisma's relation capabilities or manual if needed.
        // Assuming Project -> User has Cascade, but Project -> Company might not.
        await prisma.project.deleteMany({ where: { companyId: id } });

        // 2. Delete Catalog Items (Manual Cascade for all types)
        await prisma.catalogCable.deleteMany({ where: { companyId: id } });
        await prisma.catalogSplitter.deleteMany({ where: { companyId: id } });
        await prisma.catalogBox.deleteMany({ where: { companyId: id } });
        await prisma.catalogPole.deleteMany({ where: { companyId: id } });
        await prisma.catalogFusion.deleteMany({ where: { companyId: id } });
        await prisma.catalogOLT.deleteMany({ where: { companyId: id } });

        // 3. Delete Audit Logs (FK Constraint for Users and Company)
        await prisma.auditLog.deleteMany({ where: { companyId: id } });
        await prisma.auditLog.deleteMany({ where: { user: { companyId: id } } });

        // 4. Delete Users
        await prisma.user.deleteMany({ where: { companyId: id } });

        // 4. Delete Company
        const company = await prisma.company.delete({
            where: { id }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'DELETE_COMPANY', 'Company', id, { name: company.name }, req.ip);
        }

        res.json({ message: 'Company and all associated data deleted successfully' });
    } catch (error) {
        console.error("Delete company error:", error);
        res.status(500).json({
            error: 'Failed to delete company',
            details: error instanceof Error ? error.message : String(error)
        });

    }
};

// --- USERS MANAGEMENT (SUPER ADMIN) ---
export const getGlobalUsers = async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            include: {
                company: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Sanitize
        const sanitized = users.map(u => {
            const { passwordHash, ...rest } = u;
            return rest;
        });

        res.json(sanitized);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch users',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateGlobalUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { role, active, password } = req.body;

        const data: any = {};
        if (role) data.role = role;
        if (typeof active === 'boolean') data.active = active;
        if (password && password.length >= 6) {
            data.passwordHash = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            include: { company: true }
        });

        if (req.user?.id) {
            // Log the action
            const action = password ? 'UPDATE_USER_RESET_PASSWORD' : 'UPDATE_USER_ADMIN';
            await logAudit(req.user.id, action, 'User', id, { role, active, company: user.company?.name }, req.ip);
        }

        const { passwordHash, ...rest } = user;
        res.json(rest);
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({
            error: 'Failed to update user',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};
