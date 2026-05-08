import { prisma } from '../lib/prisma';
import { sendEmail } from './emailService';
import { buildBillingVars } from './billingEmailVars';
import { startOfTodayBR } from '../lib/subscriptionUtils';
import logger from '../lib/logger';

const ELIGIBLE_ROLES = ['OWNER', 'ADMIN'];

const addDays = (d: Date, days: number) => {
    const result = new Date(d);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
};

type Recipient = {
    email: string;
    username: string;
    companyId: string | null;
    company: { name: string; logoUrl: string | null } | null;
};

const getRecipients = async (companyId: string): Promise<Recipient[]> => {
    return prisma.user.findMany({
        where: {
            companyId,
            active: true,
            deletedAt: null,
            email: { not: '' },
            role: { in: ELIGIBLE_ROLES as any }
        },
        select: {
            email: true,
            username: true,
            companyId: true,
            company: { select: { name: true, logoUrl: true } }
        }
    });
};

const wasSentSince = async (slug: string, targetId: string, sinceDate: Date): Promise<boolean> => {
    const log = await prisma.emailLog.findFirst({
        where: {
            templateSlug: slug,
            targetId,
            status: 'SENT',
            sentAt: { gte: sinceDate }
        }
    });
    return !!log;
};

const sendAndLog = async (
    slug: string,
    recipient: Recipient,
    targetType: 'COMPANY' | 'INVOICE',
    targetId: string
) => {
    const baseUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://ftthplanner.com.br').replace(/\/$/, '');
    const billingVars = await buildBillingVars(slug, recipient.companyId);
    try {
        await sendEmail(slug, recipient.email, {
            username: recipient.username,
            company_name: recipient.company?.name || '',
            company_logo: recipient.company?.logoUrl || '',
            login_url: baseUrl,
            app_url: baseUrl,
            ...billingVars
        });
        await prisma.emailLog.create({
            data: {
                templateSlug: slug,
                targetType,
                targetId,
                recipientEmail: recipient.email,
                status: 'SENT'
            }
        });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`[BillingReminder] Failed to send ${slug} to ${recipient.email}: ${errorMessage}`);
        await prisma.emailLog.create({
            data: {
                templateSlug: slug,
                targetType,
                targetId,
                recipientEmail: recipient.email,
                status: 'FAILED',
                errorMessage
            }
        }).catch(() => undefined);
    }
};

export const processBillingReminders = async () => {
    const config = await prisma.saaSConfig.findUnique({ where: { id: 'global' } });

    if (config && config.billingReminderEnabled === false) {
        logger.info('[BillingReminder] Disabled via SaaSConfig. Skipping.');
        return;
    }

    const daysBefore = config?.billingReminderDaysBefore ?? 5;
    const overdueIntervalDays = config?.billingOverdueIntervalDays ?? 3;

    const startToday = startOfTodayBR();
    const tomorrow = addDays(startToday, 1);
    const rangeStart = addDays(startToday, Math.max(1, daysBefore - 2));
    const rangeEnd = addDays(startToday, daysBefore + 2);

    const stats = { soon: 0, today: 0, overdue: 0, skipped: 0, failed: 0 };

    // 1. Subscription expiring soon (idempotent within the renewal cycle)
    try {
        const companies = await prisma.company.findMany({
            where: {
                status: 'ACTIVE',
                paymentMethod: { not: 'CREDIT_CARD' },
                subscriptionExpiresAt: { gte: rangeStart, lte: rangeEnd },
                plan: { price: { gt: 0 }, type: { not: 'TRIAL' } }
            },
            include: { plan: true }
        });

        for (const company of companies) {
            try {
                if (!company.subscriptionExpiresAt) continue;
                const cycleStart = addDays(company.subscriptionExpiresAt, -30);
                if (await wasSentSince('subscription-expiring-soon', company.id, cycleStart)) {
                    stats.skipped++;
                    continue;
                }
                const recipients = await getRecipients(company.id);
                if (recipients.length === 0) {
                    stats.skipped++;
                    continue;
                }
                for (const r of recipients) {
                    await sendAndLog('subscription-expiring-soon', r, 'COMPANY', company.id);
                }
                stats.soon++;
            } catch (e) {
                logger.error(`[BillingReminder] Error on company ${company.id} (soon): ${(e as Error).message}`);
                stats.failed++;
            }
        }
    } catch (e) {
        logger.error(`[BillingReminder] Failed to query expiring-soon: ${(e as Error).message}`);
    }

    // 2. Subscription expiring today
    try {
        const companies = await prisma.company.findMany({
            where: {
                status: 'ACTIVE',
                paymentMethod: { not: 'CREDIT_CARD' },
                subscriptionExpiresAt: { gte: startToday, lt: tomorrow },
                plan: { price: { gt: 0 }, type: { not: 'TRIAL' } }
            },
            include: { plan: true }
        });

        for (const company of companies) {
            try {
                if (!company.subscriptionExpiresAt) continue;
                const cycleStart = addDays(company.subscriptionExpiresAt, -30);
                if (await wasSentSince('subscription-expiring-today', company.id, cycleStart)) {
                    stats.skipped++;
                    continue;
                }
                const recipients = await getRecipients(company.id);
                if (recipients.length === 0) {
                    stats.skipped++;
                    continue;
                }
                for (const r of recipients) {
                    await sendAndLog('subscription-expiring-today', r, 'COMPANY', company.id);
                }
                stats.today++;
            } catch (e) {
                logger.error(`[BillingReminder] Error on company ${company.id} (today): ${(e as Error).message}`);
                stats.failed++;
            }
        }
    } catch (e) {
        logger.error(`[BillingReminder] Failed to query expiring-today: ${(e as Error).message}`);
    }

    // 3. Invoice overdue (configurable cadence per invoice)
    try {
        const cadenceCutoff = addDays(new Date(), -overdueIntervalDays);
        const invoices = await prisma.invoice.findMany({
            where: {
                status: 'OVERDUE',
                company: {
                    paymentMethod: { not: 'CREDIT_CARD' },
                    status: { not: 'CANCELLED' }
                }
            },
            include: { company: true }
        });

        for (const invoice of invoices) {
            try {
                if (await wasSentSince('invoice-overdue', invoice.id, cadenceCutoff)) {
                    stats.skipped++;
                    continue;
                }
                const recipients = await getRecipients(invoice.companyId);
                if (recipients.length === 0) {
                    stats.skipped++;
                    continue;
                }
                for (const r of recipients) {
                    await sendAndLog('invoice-overdue', r, 'INVOICE', invoice.id);
                }
                stats.overdue++;
            } catch (e) {
                logger.error(`[BillingReminder] Error on invoice ${invoice.id}: ${(e as Error).message}`);
                stats.failed++;
            }
        }
    } catch (e) {
        logger.error(`[BillingReminder] Failed to query overdue invoices: ${(e as Error).message}`);
    }

    logger.info(
        `[BillingReminder] Done. soon=${stats.soon} today=${stats.today} overdue=${stats.overdue} skipped=${stats.skipped} failed=${stats.failed}`
    );

    return stats;
};
