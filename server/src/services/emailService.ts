import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const sendEmail = async (templateSlug: string, to: string, variables: Record<string, string>) => {
    try {
        const smtpConfig = await prisma.smtpConfig.findUnique({
            where: { id: 'global' }
        });

        if (!smtpConfig) {
            throw new Error('SMTP configuration not found');
        }

        const template = await prisma.emailTemplate.findUnique({
            where: { slug: templateSlug }
        });

        if (!template) {
            throw new Error(`Email template ${templateSlug} not found`);
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
                // Do not fail on invalid certs
                rejectUnauthorized: false
            }
        });



        let renderedBody = template.body;
        let renderedSubject = template.subject;

        // Replace variables with support for {{key}} and {{ key }}
        Object.entries(variables).forEach(([key, value]) => {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Just in case
            const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g');
            const safeValue = value || '';
            renderedBody = renderedBody.replace(regex, safeValue);
            renderedSubject = renderedSubject.replace(regex, safeValue);
        });


        const info = await transporter.sendMail({
            from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
            to,
            subject: renderedSubject,
            html: renderedBody
        });

        return info;
    } catch (error) {
        console.error('Email sending error:', error);
        throw error;
    }
};

export const testSmtpConnection = async (config: any) => {
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
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
