import { PrismaClient, RetentionAutomationRule } from '@prisma/client';

const prisma = new PrismaClient();

export const executeAutomations = async () => {
    try {
        const rules = await prisma.retentionAutomationRule.findMany({
            where: { active: true }
        });

        if (rules.length === 0) return;

        for (const rule of rules) {
            const eligibleUsers = await findEligibleUsersForTrigger(rule.triggerType);

            for (const userId of eligibleUsers) {
                // Find if this specific rule was sent in the last 48 hours for this user
                // Or if ANY retention rule was sent (to avoid spam)
                const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

                const recentLog = await prisma.retentionMessageLog.findFirst({
                    where: {
                        userId,
                        sentAt: { gte: fortyEightHoursAgo }
                    }
                });

                if (recentLog) {
                    continue; // skip as we already sent a message recently
                }

                // Send the message
                await dispatchMessage(userId, rule);
            }
        }
    } catch (error) {
        console.error('Error executing retention automations:', error);
    }
};

const findEligibleUsersForTrigger = async (triggerType: string): Promise<string[]> => {
    // If the trigger type matches an alert type (e.g., no_login_3_days, payment_failed)
    const alerts = await prisma.retentionAlert.findMany({
        where: {
            type: triggerType,
            resolvedAt: null
        },
        select: { userId: true }
    });

    return alerts.map(a => a.userId);
};

const dispatchMessage = async (userId: string, rule: RetentionAutomationRule) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || (!user.email && rule.channel === 'email')) return;

        // TODO: Send via appropriate channel (Email or Whatsapp)
        // Here we simulate the dispatch
        console.log(`[Retention Automation] Sending ${rule.channel} to ${user.email || user.username}: Trigger = ${rule.triggerType}`);

        // Log the message
        await prisma.retentionMessageLog.create({
            data: {
                userId,
                ruleId: rule.id,
                channel: rule.channel,
                status: 'sent',
            }
        });
    } catch (error) {
        console.error(`Failed to dispatch message to user ${userId}:`, error);
    }
};
