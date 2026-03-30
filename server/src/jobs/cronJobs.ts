import cron from 'node-cron';
import { processRetentionMetrics } from '../services/retentionService';
import { executeAutomations } from '../services/automationService';
import { prisma } from '../lib/prisma';
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

    // Run daily at 03:00 AM for SGP Synchronization
    cron.schedule('0 3 * * *', async () => {
        console.log('[Cron] Running daily SGP synchronization...');
        await SgpService.runDailySync();
        console.log('[Cron] SGP daily sync completed.');
    });

    // Run every hour to check for expired invoices and subscriptions
    cron.schedule('0 * * * *', async () => {
        console.log('[Cron] Checking for expired Pix invoices and subscriptions...');

        try {
            const now = new Date();

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
                    subscriptionExpiresAt: { lt: now }
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
            const overdueCompanies = await prisma.company.findMany({
                where: {
                    status: 'SUSPENDED',
                    subscriptionExpiresAt: { lt: now },
                    planId: { not: null }
                },
                include: { plan: true }
            });

            for (const company of overdueCompanies) {
                if (!company.plan || company.plan.price <= 0 || !company.subscriptionExpiresAt) continue;

                // Calculate which months are missing invoices
                let periodStart = new Date(company.subscriptionExpiresAt);
                // Go back one month to get the start of the unpaid period
                const cycleAnchor = new Date(periodStart);
                cycleAnchor.setMonth(cycleAnchor.getMonth() - 1);

                // Generate invoices for each unpaid month up to now
                while (periodStart <= now) {
                    const periodEnd = new Date(periodStart);
                    periodEnd.setMonth(periodEnd.getMonth() + 1);

                    // Check if an invoice already exists for this period
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
                                expiresAt: periodEnd, // Due by end of period
                                referenceStart: periodStart,
                                referenceEnd: periodEnd
                            }
                        });
                        console.log(`[Cron] Created OVERDUE invoice for ${company.name} (${company.id}): ${periodStart.toISOString()} → ${periodEnd.toISOString()}`);
                    }

                    periodStart = periodEnd;
                }
            }

        } catch (error) {
            console.error('[Cron Error] Failed to process expirations:', error);
        }
    });
};
