import nodemailer from 'nodemailer';
import { Request, Response } from 'express';

import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { testSmtpConnection, sendEmail } from '../services/emailService';

const prisma = new PrismaClient();

// SMTP Config
export const getSmtpConfig = async (req: AuthRequest, res: Response) => {
    try {
        const config = await prisma.smtpConfig.findUnique({
            where: { id: 'global' }
        });
        res.json(config || {});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch SMTP config' });
    }
};

export const updateSmtpConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { host, port, user, pass, secure, fromEmail, fromName } = req.body;
        const config = await prisma.smtpConfig.upsert({
            where: { id: 'global' },
            update: { host, port: parseInt(port), user, pass, secure: !!secure, fromEmail, fromName },
            create: { id: 'global', host, port: parseInt(port), user, pass, secure: !!secure, fromEmail, fromName }
        });
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update SMTP config' });
    }
};

export const testSmtp = async (req: AuthRequest, res: Response) => {
    try {
        const config = { ...req.body };
        if (config.host && config.host.endsWith('.')) {
            config.host = config.host.slice(0, -1);
        }

        await testSmtpConnection(config);

        // Also try to send a real test email to verify everything
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: parseInt(config.port),
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass
            },
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: config.user,
            subject: 'Teste de Configuração SMTP - FTTH Planner',
            text: 'Se você recebeu este e-mail, sua configuração de SMTP está 100% correta!'
        });


        res.json({ success: true, message: 'Conexão e e-mail de teste enviados com sucesso!' });
    } catch (error) {
        console.error('SMTP test error:', error);
        res.status(400).json({
            success: false,
            message: 'Falha no teste de SMTP',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};


// Email Templates
export const getEmailTemplates = async (req: AuthRequest, res: Response) => {
    try {
        const templates = await prisma.emailTemplate.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

export const createEmailTemplate = async (req: AuthRequest, res: Response) => {
    try {
        const { slug, name, subject, body, variables } = req.body;
        const template = await prisma.emailTemplate.create({
            data: { slug, name, subject, body, variables: variables || [] }
        });
        res.json(template);
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
};


export const updateEmailTemplate = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    console.log(`[EmailController] Updating template ${id}`, req.body);
    try {
        const { name, subject, body, variables, slug } = req.body;

        // Build data object dynamically with only valid fields
        const updateData: any = {};
        if (name) updateData.name = name;
        if (subject) updateData.subject = subject;
        if (body) updateData.body = body;
        if (slug) updateData.slug = slug;
        if (variables && Array.isArray(variables)) updateData.variables = variables;

        console.log('[EmailController] Calculated updateData:', updateData);

        if (Object.keys(updateData).length === 0) {
            console.warn('[EmailController] No valid fields provided for update');
            return res.status(400).json({ error: 'Nenhum dado válido fornecido para atualização' });
        }

        const template = await prisma.emailTemplate.update({
            where: { id },
            data: updateData
        });
        console.log('[EmailController] Template updated successfully:', template.id);
        res.json(template);
    } catch (error: any) {
        console.error('[EmailController] Update template error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Slug já está em uso por outro template' });
        }
        res.status(500).json({
            error: 'Failed to update template',
            details: error.message || 'Error updating record in database'
        });
    }
};




export const deleteEmailTemplate = async (req: AuthRequest, res: Response) => {
    try {
        await prisma.emailTemplate.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete template' });
    }
};

export const sendTemplate = async (req: AuthRequest, res: Response) => {
    const { templateId, targetType, targetId } = req.body;

    try {
        const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
        if (!template) return res.status(404).json({ error: 'Template not found' });

        let users: any[] = [];

        if (targetType === 'ALL') {
            users = await prisma.user.findMany({
                where: { active: true, email: { not: '' } },
                select: { email: true, username: true, company: { select: { name: true } } }
            });
        } else if (targetType === 'COMPANY') {
            if (!targetId) return res.status(400).json({ error: 'targetId is required for COMPANY target' });
            users = await prisma.user.findMany({
                where: { companyId: targetId, active: true, email: { not: '' } },
                select: { email: true, username: true, company: { select: { name: true } } }
            });
        } else if (targetType === 'USER') {
            if (!targetId) return res.status(400).json({ error: 'targetId is required for USER target' });
            const user = await prisma.user.findUnique({
                where: { id: targetId },
                select: { email: true, username: true, company: { select: { name: true } } }
            });
            if (user && user.email) users = [user];
        } else {
            return res.status(400).json({ error: 'Invalid targetType' });
        }

        if (users.length === 0) {
            return res.status(400).json({ error: 'No recipients found for the selected target' });
        }

        const loginUrl = process.env.FRONTEND_URL || 'https://ftthplanner.com.br';

        // Send emails
        const sendPromises = users.map(user =>
            sendEmail(template.slug, user.email, {
                username: user.username,
                company_name: user.company?.name || '',
                login_url: loginUrl
            }).catch((err: Error) => console.error(`Failed to send targeted email to ${user.email}:`, err))
        );

        res.json({
            success: true,
            message: `Disparo iniciado para ${users.length} destinatários`,
            recipientCount: users.length
        });

        // Optional: Audit log the event
        if (req.user?.id) {
            const { logAudit } = require('./auditController');
            await logAudit(req.user.id, 'SEND_EMAIL_TEMPLATE', 'EmailTemplate', templateId, { targetType, targetId, count: users.length }, req.ip);
        }

    } catch (error) {
        console.error('Send template failed:', error);
        res.status(500).json({ error: 'Failed to send template' });
    }
};
