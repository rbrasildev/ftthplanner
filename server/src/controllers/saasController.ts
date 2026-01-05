import { logAudit } from './auditController';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { AuthRequest } from '../middleware/auth';

// --- PLANS ---
export const getPlans = async (req: AuthRequest, res: Response) => {
    try {
        console.log("GET /api/saas/plans called by user:", req.user?.id);
        const plans = await prisma.plan.findMany({
            orderBy: { price: 'asc' }
        });
        console.log("Plans found:", plans.length);
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch plans' });
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
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        res.json(projects);
    } catch (error) {
        console.error('Error fetching map data:', error);
        res.status(500).json({ error: 'Failed to fetch map data' });
    }
};

export const createPlan = async (req: AuthRequest, res: Response) => {
    try {
        const { name, price, limits } = req.body;
        const plan = await prisma.plan.create({
            data: { name, price, limits }
        });

        // Audit Log
        if (req.user?.id) {
            await logAudit(req.user.id, 'CREATE_PLAN', 'Plan', plan.id, { name, price }, req.ip);
        }

        res.status(201).json(plan);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create plan' });
    }
};

export const updatePlan = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, limits } = req.body;
        const plan = await prisma.plan.update({
            where: { id },
            data: { name, price, limits }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'UPDATE_PLAN', 'Plan', plan.id, { name, price }, req.ip);
        }

        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update plan' });
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
                    select: { projects: true, users: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(companies);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};

export const updateCompanyStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, planId } = req.body;

        const data: any = {};
        if (status) data.status = status;
        if (planId) data.planId = planId;

        const company = await prisma.company.update({
            where: { id },
            data
        });
        res.json(company);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update company' });
    }
};
