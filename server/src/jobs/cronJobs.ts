import cron from 'node-cron';
import { processRetentionMetrics } from '../services/retentionService';
import { executeAutomations } from '../services/automationService';

export const initCronJobs = () => {
    // Run daily at 02:00 AM
    cron.schedule('0 2 * * *', async () => {
        console.log('[Cron] Running daily retention metrics processing...');
        await processRetentionMetrics();

        console.log('[Cron] Executing retention automations...');
        await executeAutomations();

        console.log('[Cron] Daily retention tasks completed.');
    });
};
