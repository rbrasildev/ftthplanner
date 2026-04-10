import cron from 'node-cron';
import { processRetentionMetrics } from '../services/retentionService';
import { executeAutomations } from '../services/automationService';
import { prisma } from '../lib/prisma';
import { startOfTodayUTC } from '../lib/subscriptionUtils';
import { SgpService } from '../integrations/sgp/sgp.service';

export const initCronJobs = () => {
    // Run daily at 02:00 AM for retention
    cron.schedule('0 2 * * *', async () => {
        console.log('[Cron] Running daily retention metrics processing...');
        await processRetentionMetrics();

        console.log('[Cron] Executing retention automations...');
        await executeAutomations();

        console.log('[Cron] Daily retention tasks completed.');
    });

    // Incremental sync every 10 minutes — only fetches records changed since last sync
    cron.schedule('*/10 * * * *', async () => {
        console.log('[Cron] Running incremental SGP synchronization...');
        await SgpService.runIncrementalSync();
        console.log('[Cron] Incremental SGP sync completed.');
    });

    // Full sync daily at 03:00 AM — complete reconciliation of all records
    cron.schedule('0 3 * * *', async () => {
        console.log('[Cron] Running full daily SGP synchronization...');
        await SgpService.runDailySync();
        console.log('[Cron] Full SGP daily sync completed.');
    });

    // Run every hour to check for expired invoices and subscriptions
    cron.schedule('0 * * * *', async () => {
        console.log('[Cron] Checking for expired Pix invoices and subscriptions...');

        try {
            const now = new Date();
            // Start-of-today (UTC) — used for date-only comparisons against
            // `subscriptionExpiresAt` so a customer is only suspended AFTER
            // their due date has fully passed, not on the day itself.
            const startToday = startOfTodayUTC();

            // 1. Expire PENDING Pix Invoices
            const expiredInvoices = await prisma.invoice.updateMany({
                where: {
                    status: 'PENDING',
                    expiresAt: { lt: now }
                },
                data: {
                    status: 'EXPIRED'
                }
            });

            if (expiredInvoices.count > 0) {
                console.log(`[Cron] Expired ${expiredInvoices.count} pending invoices.`);
            }

            // 2. Suspend Companies with expired subscriptions (ACTIVE or CANCELLED)
            const suspendedCompanies = await prisma.company.updateMany({
                where: {
                    status: { in: ['ACTIVE', 'CANCELLED'] },
                    subscriptionExpiresAt: { lt: startToday }
                },
                data: {
                    status: 'SUSPENDED'
                }
            });

            if (suspendedCompanies.count > 0) {
                console.log(`[Cron] Suspended ${suspendedCompanies.count} companies due to expired subscriptions.`);
            }

            // 3. Generate OVERDUE invoices for each unpaid month
            // Finds SUSPENDED companies whose subscriptionExpiresAt is in the past,
            // and creates an invoice for each month that has passed without payment.
            // Safety: MAX 3 invoices per company per cron run to prevent data bloat
            // if a company has been suspended for a very long time.
            const MAX_OVERDUE_PER_RUN = 3;

            const overdueCompanies = await prisma.company.findMany({
                where: {
                    status: 'SUSPENDED',
                    subscriptionExpiresAt: { lt: startToday },
                    planId: { not: null }
                },
                include: { plan: true }
            });

            for (const company of overdueCompanies) {
                if (!company.plan || company.plan.price <= 0 || !company.subscriptionExpiresAt) continue;

                let periodStart = new Date(company.subscriptionExpiresAt);
                let generated = 0;

                while (periodStart <= now && generated < MAX_OVERDUE_PER_RUN) {
                    const periodEnd = new Date(periodStart);
                    periodEnd.setMonth(periodEnd.getMonth() + 1);

                    // Check if an invoice already exists for this period (idempotent)
                    const existingInvoice = await prisma.invoice.findFirst({
                        where: {
                            companyId: company.id,
                            referenceStart: periodStart,
                            referenceEnd: periodEnd
                        }
                    });

                    if (!existingInvoice) {
                        await prisma.invoice.create({
                            data: {
                                companyId: company.id,
                                planId: company.planId!,
                                amount: company.plan.price,
                                status: 'OVERDUE',
                                paymentMethod: company.paymentMethod || 'PIX',
                                expiresAt: periodEnd,
                                referenceStart: periodStart,
                                referenceEnd: periodEnd
                            }
                        });
                        generated++;
                        console.log(`[Cron] Created OVERDUE invoice for ${company.name} (${company.id}): ${periodStart.toISOString()} → ${periodEnd.toISOString()}`);
                    }

                    periodStart = periodEnd;
                }

                if (generated >= MAX_OVERDUE_PER_RUN) {
                    console.log(`[Cron] Hit max overdue limit (${MAX_OVERDUE_PER_RUN}) for ${company.name}. Remaining months will be generated next run.`);
                }
            }

        } catch (error) {
            console.error('[Cron Error] Failed to process expirations:', error);
        }
    });
};
