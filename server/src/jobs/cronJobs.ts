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

            // 2. Suspend Companies with expired subscriptions
            const suspendedCompanies = await prisma.company.updateMany({
                where: {
                    status: 'ACTIVE',
                    subscriptionExpiresAt: { lt: now }
                },
                data: {
                    status: 'SUSPENDED'
                }
            });

            if (suspendedCompanies.count > 0) {
                console.log(`[Cron] Suspended ${suspendedCompanies.count} companies due to expired subscriptions.`);
            }

        } catch (error) {
            console.error('[Cron Error] Failed to process expirations:', error);
        }
    });
};
