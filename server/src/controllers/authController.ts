import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

import { cloneTemplatesToCompany } from '../services/templateService';
import { sendEmail } from '../services/emailService';


// Helper to get Plans
async function getPlanByName(name: string) {
    return prisma.plan.findFirst({ where: { name } });
}

export const register = async (req: Request, res: Response) => {
    const { username, email, password, companyName, planName, phone, source } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine Initial Plan
        let initialPlanName = 'Plano Trial'; // Default to 7-day Trial
        if (planName && typeof planName === 'string') {
            initialPlanName = planName;
        }

        let selectedPlan = await getPlanByName(initialPlanName);
        if (!selectedPlan) {
            console.warn(`Plan ${initialPlanName} not found, falling back to Trial`);
            selectedPlan = await getPlanByName('Plano Trial');
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
                    role: 'OWNER',
                    source: source || null
                } as any,
            });

            const company = await tx.company.create({
                data: {
                    name: companyName || `${username}'s Company`,
                    users: { connect: { id: user.id } },
                    planId: selectedPlan?.id,
                    subscriptionExpiresAt: expiresAt,
                    status: 'ACTIVE',
                    phone: phone || null
                } as any
            });

            const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: { companyId: company.id }
            });

            return { user: updatedUser, company };
        });

        // Clone default templates to the new company
        await cloneTemplatesToCompany(result.company.id, prisma);

        // Send Welcome Email (Fail silently to not break registration)
        console.log(`[Registration] Triggering welcome email for ${email} with slug welcome-email`);
        sendEmail('welcome-email', email, {
            username: username,
            company_name: result.company.name,
            login_url: process.env.FRONTEND_URL || 'https://ftthplanner.com.br'
        }).then(info => console.log(`[Registration] Welcome email sent successfully to ${email}. MessageId: ${info?.messageId || 'N/A'}`))
            .catch(err => console.error(`[Registration] Welcome email failed for ${email}:`, err));

        // Send Admin Notification (Fail silently)
        console.log(`[Registration] Fetching SaaS config for admin notification...`);
        prisma.saaSConfig.findUnique({ where: { id: 'global' } }).then(saasConfig => {
            if (saasConfig?.supportEmail) {
                console.log(`[Registration] Admin support email found: ${saasConfig.supportEmail}. Triggering notification...`);
                sendEmail('admin-new-client-notification', saasConfig.supportEmail, {
                    username: username,
                    company: result.company.name,
                    email: email,
                    phone: phone || 'N/A',
                    plan: selectedPlan?.name || 'Trial',
                    source: source || 'Direct'
                }).then(info => console.log(`[Registration] Admin notification sent successfully to ${saasConfig.supportEmail}. MessageId: ${info?.messageId || 'N/A'}`))
                    .catch(err => console.error(`[Registration] Admin notification failed for ${saasConfig.supportEmail}:`, err));
            } else {
                console.warn(`[Registration] No support email configured in SaaSConfig. Admin notification skipped.`);
            }
        }).catch(err => console.error('[Registration] Failed to fetch SaaS config for admin notification:', err));


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
                    console.log(`Subscription/Trial for ${user.company.name} expired. Blocking access.`);
                    // We don't downgrade anymore to ensure the trial remains expired and blocked
                }
            }

            // Update Last Login
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() }
            });

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
                console.log(`[getMe] Subscription/Trial for ${user.company.name} expired. Blocking access.`);
                // Downgrade removed for consistency
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

export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // We return 200 even if user doesn't exist for security (don't reveal registered emails)
            return res.json({ message: 'Se este e-mail estiver cadastrado, você receberá um link de recuperação.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date();
        expires.setHours(expires.getHours() + 1); // 1 hour expiration

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: token,
                resetTokenExpires: expires
            }
        });

        const resetUrl = `${process.env.FRONTEND_URL || 'https://ftthplanner.com.br'}/reset-password?token=${token}`;

        console.log(`[ForgotPassword] Sending reset email to ${email}`);

        await sendEmail('password-reset', email, {
            username: user.username,
            reset_url: resetUrl,
            company_name: 'FTTH Planner'
        });

        res.json({ message: 'Se este e-mail estiver cadastrado, você receberá um link de recuperação.' });
    } catch (error) {
        console.error('[ForgotPassword] Error:', error);
        res.status(500).json({ error: 'Erro ao processar recuperação de senha' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body;
    try {
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token inválido ou expirado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashedPassword,
                resetToken: null,
                resetTokenExpires: null
            }
        });

        res.json({ message: 'Senha atualizada com sucesso!' });
    } catch (error) {
        console.error('[ResetPassword] Error:', error);
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
};

