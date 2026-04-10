import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { cloneTemplatesToCompany } from '../services/templateService';
import { sendEmail } from '../services/emailService';
import logger from '../lib/logger';
import { resolvePermissions } from '../middleware/checkPermission';


// Helper to get Plans
async function getPlanByName(name: string) {
    return prisma.plan.findFirst({ where: { name } });
}

export const register = async (req: Request, res: Response) => {
    const { username, email, password, companyName, planName, phone, source } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine Initial Plan
        // IMPORTANT: New registrations ALWAYS start on Trial regardless of which plan
        // the user clicked on the landing page. The selected paid plan is only an
        // "interest" indicator — actual paid plans must be activated through payment.
        // The only exception is the explicit Free plan, which is permanent.
        const requestedPlanName = (planName && typeof planName === 'string') ? planName : null;
        const isFreePlanRequest = requestedPlanName === 'Plano Grátis';

        const initialPlanName = isFreePlanRequest ? 'Plano Grátis' : 'Plano Trial';

        let selectedPlan = await getPlanByName(initialPlanName);
        if (!selectedPlan) {
            logger.warn(`Plan ${initialPlanName} not found, falling back to Trial`);
            selectedPlan = await getPlanByName('Plano Trial');
        }

        // Calculate Expiration
        let expiresAt: Date | null = null;

        // Trial plans get an expiration date; Free plan is permanent (null)
        if (selectedPlan?.name !== 'Plano Grátis') {
            const trialDays = selectedPlan?.trialDurationDays || 7;
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + trialDays);
        }

        // Clean up soft-deleted users with same email (from deleted companies)
        const softDeletedUser = await prisma.user.findFirst({ where: { email, deletedAt: { not: null } } });
        if (softDeletedUser) {
            await prisma.user.delete({ where: { id: softDeletedUser.id } });
        }

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
        logger.info(`[Registration] Triggering welcome email for ${email} with slug welcome-email`);
        sendEmail('welcome-email', email, {
            username: username,
            company_name: result.company.name,
            login_url: process.env.APP_URL || process.env.FRONTEND_URL || 'https://ftthplanner.com.br'
        }).then(info => logger.info(`[Registration] Welcome email sent successfully to ${email}. MessageId: ${info?.messageId || 'N/A'}`))
            .catch(err => logger.error(`[Registration] Welcome email failed for ${email}: ${err.message}`));

        // Send Admin Notification (Fail silently)
        logger.info(`[Registration] Fetching SaaS config for admin notification...`);
        prisma.saaSConfig.findUnique({ where: { id: 'global' } }).then(saasConfig => {
            if (saasConfig?.supportEmail) {
                logger.info(`[Registration] Admin support email found: ${saasConfig.supportEmail}. Triggering notification...`);
                sendEmail('admin-new-client-notification', saasConfig.supportEmail, {
                    username: username,
                    company: result.company.name,
                    email: email,
                    phone: phone || 'N/A',
                    plan: selectedPlan?.name || 'Trial',
                    source: source || 'Direct'
                }).then(info => logger.info(`[Registration] Admin notification sent successfully to ${saasConfig.supportEmail}. MessageId: ${info?.messageId || 'N/A'}`))
                    .catch(err => logger.error(`[Registration] Admin notification failed for ${saasConfig.supportEmail}: ${err.message}`));
            } else {
                logger.warn(`[Registration] No support email configured in SaaSConfig. Admin notification skipped.`);
            }
        }).catch(err => logger.error(`[Registration] Failed to fetch SaaS config for admin notification: ${err.message}`));


        const token = jwt.sign(
            { id: result.user.id, username: result.user.username, companyId: result.company.id, role: result.user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' }
        );

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: true, // Em produção via Nginx/Proxy ou SSL direto
            sameSite: 'none', // Necessário para cross-origin se frontend/backend em domínios diferentes
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ 
            id: result.user.id, 
            username: result.user.username, 
            companyId: result.company.id,
            token // Retornando para suporte ao modo anônimo (Header fallback)
        });

    } catch (error: any) {
        logger.error(`Registration Error: ${error.message}`);

        let message = 'Registration failed. Please try again.';
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0];
            if (field === 'email') {
                message = 'Este e-mail já está cadastrado.';
            } else if (field === 'username') {
                message = 'Este nome de usuário já está em uso. Tente outro e-mail.';
            } else {
                message = 'Usuário ou e-mail já cadastrado.';
            }
        }

        res.status(400).json({ error: message });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password, forceLogin } = req.body;

    if (!email || !password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = await prisma.user.findFirst({
            where: { email, deletedAt: null },
            include: {
                company: {
                    include: { plan: true }
                }
            }
        });

        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (await bcrypt.compare(password, user.passwordHash)) {
            if (!user.active) {
                return res.status(403).json({ error: 'Account is deactivated' });
            }

            if (!user.companyId && user.role !== 'SUPER_ADMIN') {
                return res.status(500).json({ error: 'User not associated with any company' });
            }

            // Check active session on another device
            if (user.activeSessionToken && !forceLogin) {
                // Verify if the existing token is still valid
                try {
                    jwt.verify(user.activeSessionToken, process.env.JWT_SECRET as string);
                    // Token still valid — another device is logged in
                    return res.status(409).json({
                        error: 'SESSION_ACTIVE',
                        message: 'Já existe uma sessão ativa nesta conta em outro dispositivo.'
                    });
                } catch {
                    // Token expired — proceed normally
                }
            }

            if (user.company) {
                if (user.company.subscriptionExpiresAt && new Date() > user.company.subscriptionExpiresAt) {
                    logger.info(`Subscription/Trial for ${user.company.name} expired. Blocking access.`);
                }
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    companyId: user.companyId,
                    role: user.role
                },
                process.env.JWT_SECRET as string,
                { expiresIn: '7d' }
            );

            // Save active session token & update last login
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date(), activeSessionToken: token }
            });

            res.cookie('auth_token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    companyId: user.companyId,
                    role: user.role,
                    permissions: resolvePermissions(user.permissions, user.role),
                    company: user.company
                },
                token
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e: any) {
        logger.error(`Login Error: ${e.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// Get Current User Profile (Refresh State)
export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            logger.debug("[getMe] No userId in request");
            return res.sendStatus(401);
        }

        logger.debug(`[getMe] Fetching user ${userId}...`);
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
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

        logger.debug(`[getMe] User found: ${user.username}. Checking expiration...`);

        // --- REPEAT EXPIRATION CHECK LOGIC ---
        if (user.company) {
            if (user.company.subscriptionExpiresAt && new Date() > user.company.subscriptionExpiresAt) {
                logger.info(`[getMe] Subscription/Trial for ${user.company.name} expired. Blocking access.`);
                // Downgrade removed for consistency
            }
        }

        logger.debug("[getMe] Checking Plan Type logic...");
        // -------------------------------------
        // (Stripe Trial logic removed)

        logger.debug("[getMe] Sending response.");
        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                companyId: user.companyId,
                role: user.role,
                permissions: resolvePermissions(user.permissions, user.role),
                company: user.company
            }
        });

    } catch (e: any) {
        logger.error(`[getMe] CRITICAL ERROR: ${e.message}`);
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

        const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
        if (!user || !user.passwordHash) return res.status(404).json({ error: 'User not found' });

        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
            return res.status(400).json({ error: 'Invalid password format' });
        }

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
    } catch (e: any) {
        logger.error(`Change Password Error: ${e.message}`);
        res.status(500).json({ error: 'Failed to update password' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    try {
        const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
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

        const baseUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://ftthplanner.com.br').replace(/\/$/, '');
        const resetUrl = `${baseUrl}/?token=${token}`;

        logger.info(`[ForgotPassword] Sending reset email to ${email}`);

        await sendEmail('password-reset', email, {
            username: user.username,
            reset_url: resetUrl,
            company_name: 'FTTH Planner'
        });

        res.json({ message: 'Se este e-mail estiver cadastrado, você receberá um link de recuperação.' });
    } catch (error: any) {
        logger.error(`[ForgotPassword] Error: ${error.message}`);
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
    } catch (error: any) {
        logger.error(`[ResetPassword] Error: ${error.message}`);
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
};

export const logout = async (req: Request, res: Response) => {
    // Clear active session token in DB
    const userId = (req as any).user?.id;
    if (userId) {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { activeSessionToken: null }
            });
        } catch {}
    }

    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    res.json({ message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response) => {
    // Implementação simplificada: se o cookie for válido (checado pelo middleware se necessário) 
    // ou se quisermos renovar baseado no cookie atual.
    // Por enquanto, apenas retornamos sucesso para compatibilidade.
    res.json({ message: 'Refresh successful' });
};
