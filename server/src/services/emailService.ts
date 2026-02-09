import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const sendEmail = async (templateSlug: string, to: string, variables: Record<string, string>) => {
    try {
        console.log(`[EmailService] Starting sendEmail to ${to} for template ${templateSlug}`);
        const smtpConfig = await prisma.smtpConfig.findUnique({
            where: { id: 'global' }
        });

        if (!smtpConfig) {
            throw new Error('Configuração SMTP não encontrada');
        }

        const template = await prisma.emailTemplate.findUnique({
            where: { slug: templateSlug }
        });

        if (!template) {
            throw new Error(`Template de email ${templateSlug} não encontrado`);
        }

        let host = smtpConfig.host;
        if (host && host.endsWith('.')) {
            host = host.slice(0, -1);
        }

        const transporter = nodemailer.createTransport({
            host: host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        let renderedBody = template.body;
        let renderedSubject = template.subject;

        const baseUrl = (process.env.FRONTEND_URL || 'https://ftthplanner.com.br').replace(/\/$/, '');

        const formatUrl = (url: string | null) => {
            if (!url) return '';
            if (url.startsWith('http')) return url;
            if (url.startsWith('data:')) return url;
            const cleanPath = url.startsWith('/') ? url : `/${url}`;
            return `${baseUrl}${cleanPath}`;
        };

        // Get SaaS Global Config
        const saasConfig = await prisma.saaSConfig.findUnique({
            where: { id: 'global' }
        });

        // Prepare FINAL variables object to avoid reference issues
        const finalVars: Record<string, string> = { ...variables };

        finalVars.app_name = finalVars.app_name || saasConfig?.appName || 'FTTH Planner';
        finalVars.app_logo = formatUrl(finalVars.app_logo || saasConfig?.appLogoUrl || '/logo.png');
        finalVars.app_url = finalVars.app_url || saasConfig?.websiteUrl || baseUrl;

        // Auto-inject company branding if missing
        if (!finalVars.company_logo || !finalVars.company_name) {
            const userWithCompany = await prisma.user.findUnique({
                where: { email: to },
                include: { company: true }
            });

            if (userWithCompany?.company) {
                const company = userWithCompany.company;
                finalVars.company_name = finalVars.company_name || company.name || '';
                finalVars.company_logo = formatUrl(finalVars.company_logo || company.logoUrl);
                finalVars.company_phone = finalVars.company_phone || company.phone || '';
                finalVars.company_address = finalVars.company_address || company.address || '';
                finalVars.company_url = finalVars.company_url || company.website || '';
            }
        } else {
            finalVars.company_logo = formatUrl(finalVars.company_logo);
        }

        // Normalize ALL keys to lowercase for case-insensitive replacement
        const normalizedVars: Record<string, string> = {};
        Object.entries(finalVars).forEach(([key, val]) => {
            normalizedVars[key.toLowerCase()] = val || '';
        });

        console.log('[EmailService] Final variables for substitution:', Object.keys(normalizedVars));

        const replaceTags = (text: string) => {
            if (!text) return '';
            // Match {{tag}} or {{ tag }} case-insensitive
            return text.replace(/\{\{\s*([\w_-]+)\s*\}\}/gi, (match, tag) => {
                const tagLower = tag.toLowerCase().replace(/-/g, '_'); // support both app-logo and app_logo
                if (normalizedVars[tagLower] !== undefined) {
                    return normalizedVars[tagLower];
                }
                console.warn(`[EmailService] Warning: Tag {{${tag}}} not found in variables.`);
                return match;
            });
        };

        renderedBody = replaceTags(renderedBody);
        renderedSubject = replaceTags(renderedSubject);

        const textBody = renderedBody.replace(/<[^>]*>?/gm, '').trim();
        const fingerprint = `<div style="display:none !important; font-size:1px; color:transparent; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">[ref:${Date.now()}-${Math.random().toString(36).substring(7)}]</div>`;
        const htmlBody = renderedBody + fingerprint;

        const info = await transporter.sendMail({
            from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
            to,
            subject: renderedSubject,
            text: textBody,
            html: htmlBody
        });

        console.log(`[EmailService] Email sent successfully to ${to}`);
        return info;
    } catch (error) {
        console.error('[EmailService] Fatal sending error:', error);
        throw error;
    }
};

export const testSmtpConnection = async (config: any) => {
    const transporter = nodemailer.createTransport({
        host: (config.host || '').replace(/\/$/, ''),
        port: parseInt(config.port),
        secure: !!config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await transporter.verify();
        return true;
    } catch (error) {
        console.error('SMTP testing error:', error);
        throw error;
    }
};
