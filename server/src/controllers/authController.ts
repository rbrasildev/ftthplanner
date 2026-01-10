import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

import { cloneTemplatesToCompany } from '../services/templateService';

// Helper to get Plans
async function getPlanByName(name: string) {
    return prisma.plan.findFirst({ where: { name } });
}

export const register = async (req: Request, res: Response) => {
    const { username, password, companyName } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Fetch Unlimited Plan for Trial
        let trialPlan = await getPlanByName('Plano Ilimitado');
        if (!trialPlan) {
            // Fallback or handle error. For now, we proceed.
            console.warn("Unlimited plan not found for trial");
        }

        const trialDays = 15;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + trialDays);

        // Transaction to ensure User and Company are created together
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    username,
                    passwordHash: hashedPassword,
                    role: 'OWNER'
                },
            });

            const company = await tx.company.create({
                data: {
                    name: companyName || `${username}'s Company`,
                    users: { connect: { id: user.id } },
                    planId: trialPlan?.id,
                    subscriptionExpiresAt: expiresAt,
                    status: 'ACTIVE'
                }
            });

            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: { companyId: company.id }
            });

            return { user: updatedUser, company };
        });

        // Clone default templates to the new company
        await cloneTemplatesToCompany(result.company.id);

        res.json({ id: result.user.id, username: result.user.username, companyId: result.company.id });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: 'Username already exists or invalid data' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                company: {
                    include: { plan: true }
                }
            }
        });

        if (user && (await bcrypt.compare(password, user.passwordHash))) {
            if (!user.active) {
                return res.status(403).json({ error: 'Account is deactivated' });
            }

            if (!user.companyId && user.role !== 'SUPER_ADMIN') {
                return res.status(500).json({ error: 'User not associated with any company' });
            }



            if (user.company) {
                if (user.company.status === 'SUSPENDED' && user.role !== 'SUPER_ADMIN') {
                    return res.status(403).json({ error: 'Company subscription is suspended' });
                }

                // CHECK TRIAL / SUBSCRIPTION EXPIRATION
                if (user.company.subscriptionExpiresAt && new Date() > user.company.subscriptionExpiresAt) {
                    // Expired! Downgrade if not already Free
                    if (user.company.plan?.name !== 'Plano Grátis') {
                        console.log(`Subscription/Trial for ${user.company.name} expired. Downgrading to Free.`);

                        const freePlan = await getPlanByName('Plano Grátis');
                        if (freePlan) {
                            await prisma.company.update({
                                where: { id: user.company.id },
                                data: {
                                    planId: freePlan.id,
                                    subscriptionExpiresAt: null // Clear expiration, Free is forever
                                }
                            });
                            // Update local user object to reflect change immediately in response
                            user.company.plan = freePlan;
                            user.company.planId = freePlan.id;
                            user.company.subscriptionExpiresAt = null;
                        }
                    }
                }
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    companyId: user.companyId,
                    role: user.role
                },
                process.env.JWT_SECRET as string
            );
            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    companyId: user.companyId,
                    role: user.role,
                    company: user.company // Return full company info (with plan)
                }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// Get Current User Profile (Refresh State)
export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.sendStatus(401);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                company: {
                    include: { plan: true }
                }
            }
        });

        if (!user) return res.sendStatus(404);

        // --- REPEAT EXPIRATION CHECK LOGIC ---
        if (user.company) {
            if (user.company.subscriptionExpiresAt && new Date() > user.company.subscriptionExpiresAt) {
                if (user.company.plan?.name !== 'Plano Grátis') {
                    console.log(`[getMe] Subscription/Trial for ${user.company.name} expired. Downgrading to Free.`);
                    const freePlan = await getPlanByName('Plano Grátis');
                    if (freePlan) {
                        await prisma.company.update({
                            where: { id: user.company.id },
                            data: {
                                planId: freePlan.id,
                                subscriptionExpiresAt: null
                            }
                        });
                        user.company.plan = freePlan;
                        user.company.planId = freePlan.id;
                        user.company.subscriptionExpiresAt = null;
                    }
                }
            }
        }
        // -------------------------------------

        res.json({
            user: {
                id: user.id,
                username: user.username,
                companyId: user.companyId,
                role: user.role,
                company: user.company
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
};
