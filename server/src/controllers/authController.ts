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
    const { username, email, password, companyName, planName } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine Initial Plan
        let initialPlanName = 'Plano Ilimitado'; // Default to Trial of Unlimited
        if (planName && typeof planName === 'string') {
            initialPlanName = planName;
        }

        let selectedPlan = await getPlanByName(initialPlanName);
        if (!selectedPlan) {
            console.warn(`Plan ${initialPlanName} not found, falling back to Unlimited`);
            selectedPlan = await getPlanByName('Plano Ilimitado');
        }

        // Calculate Expiration
        let expiresAt: Date | null = null;

        // If it's NOT the Free plan, it's a Trial (with expiration)
        if (selectedPlan?.name !== 'Plano Grátis') {
            // User requested to use trial_duration_days from DB
            const trialDays = selectedPlan?.trialDurationDays || 7;
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + trialDays);
        }
        // If it IS Free plan, expiresAt remains null (permanent)

        // Transaction to ensure User and Company are created together
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    username,
                    email,
                    passwordHash: hashedPassword,
                    role: 'OWNER'
                },
            });

            const company = await tx.company.create({
                data: {
                    name: companyName || `${username}'s Company`,
                    users: { connect: { id: user.id } },
                    planId: selectedPlan?.id,
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
        res.status(400).json({ error: 'Username or Email already exists or invalid data' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { email },
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
                // if (user.company.status === 'SUSPENDED' && user.role !== 'SUPER_ADMIN') {
                //     return res.status(403).json({ error: 'Company subscription is suspended' });
                // }

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
        if (!userId) {
            console.log("[getMe] No userId in request");
            return res.sendStatus(401);
        }

        console.log(`[getMe] Fetching user ${userId}...`);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                company: {
                    include: { plan: true }
                }
            }
        });

        if (!user) {
            console.log("[getMe] User not found in DB");
            return res.sendStatus(404);
        }

        console.log(`[getMe] User found: ${user.username}. Checking expiration...`);

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
                        console.log("[getMe] Downgraded to Free Plan.");
                    } else {
                        console.warn("[getMe] Free Plan not found!");
                    }
                }
            }
        }

        console.log("[getMe] Checking Plan Type logic...");
        // -------------------------------------
        // (Stripe Trial logic removed)

        console.log("[getMe] Sending response.");
        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                companyId: user.companyId,
                role: user.role,
                company: user.company
            }
        });

    } catch (e: any) {
        console.error("[getMe] CRITIAL ERROR:", e);
        res.status(500).json({ error: 'Failed to fetch user profile', details: e.message });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { currentPassword, newPassword } = req.body;

        if (!userId) return res.sendStatus(401);
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Missing defined parameters' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update password' });
    }
};
