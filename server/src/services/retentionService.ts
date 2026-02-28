import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const calculateChurnRisk = (
    daysSinceLogin: number,
    daysSinceProjectCreated: number | null,
    projectsCount: number,
    planDaysRemaining: number | null,
    paymentFailed: boolean
): number => {
    let risk = 0;

    if (daysSinceLogin > 14) risk += 40;
    else if (daysSinceLogin > 7) risk += 20;

    if (projectsCount === 0) risk += 30;

    if (planDaysRemaining !== null && planDaysRemaining <= 3 && planDaysRemaining >= 0) {
        risk += 25;
    }

    if (paymentFailed) risk += 50;

    return Math.min(risk, 100);
};

export const processRetentionMetrics = async () => {
    try {
        const users = await prisma.user.findMany({
            include: {
                projects: true,
                company: {
                    include: {
                        plan: true
                    }
                }
            }
        });

        const now = new Date();

        for (const user of users) {
            const lastLoginAt = user.lastLoginAt;
            const daysSinceLogin = lastLoginAt
                ? Math.floor((now.getTime() - lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
                : 30; // assume 30 if never logged in

            const projectsCount = user.projects.length;
            const lastProject = user.projects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
            const daysSinceProjectCreated = lastProject
                ? Math.floor((now.getTime() - lastProject.createdAt.getTime()) / (1000 * 60 * 60 * 24))
                : null;

            const company = user.company;
            let planDaysRemaining: number | null = null;
            let paymentFailed = false;

            if (company) {
                if (company.subscriptionExpiresAt) {
                    planDaysRemaining = Math.floor((company.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                }
                if (company.status === 'PAYMENT_FAILED' || company.status === 'SUSPENDED') {
                    paymentFailed = true;
                }
            }

            const churnRiskScore = calculateChurnRisk(
                daysSinceLogin,
                daysSinceProjectCreated,
                projectsCount,
                planDaysRemaining,
                paymentFailed
            );

            // Create or update UserEngagementMetrics
            await prisma.userEngagementMetrics.upsert({
                where: { userId: user.id },
                update: {
                    lastLoginAt,
                    lastProjectCreatedAt: lastProject ? lastProject.createdAt : null,
                    churnRiskScore,
                    updatedAt: new Date()
                },
                create: {
                    userId: user.id,
                    companyId: user.companyId,
                    lastLoginAt,
                    lastProjectCreatedAt: lastProject ? lastProject.createdAt : null,
                    churnRiskScore,
                }
            });

            // LTV Calculation
            if (company && company.plan) {
                const ticketMensal = company.plan.price || 0;
                const tempoMedioVidaMeses = 12; // Example static average lifespan
                const estimatedLTV = ticketMensal * tempoMedioVidaMeses;

                await prisma.userFinancialMetrics.upsert({
                    where: { userId: user.id },
                    update: {
                        monthlyRevenue: ticketMensal,
                        estimatedLTV,
                        updatedAt: new Date()
                    },
                    create: {
                        userId: user.id,
                        companyId: user.companyId,
                        monthlyRevenue: ticketMensal,
                        estimatedLTV,
                    }
                });
            }

            // Generate retention alerts based on conditions
            await evaluateAlerts(user.id, user.companyId, daysSinceLogin, projectsCount, planDaysRemaining, paymentFailed);
        }
    } catch (error) {
        console.error('Error processing retention metrics:', error);
    }
};

const evaluateAlerts = async (
    userId: string,
    companyId: string | null,
    daysSinceLogin: number,
    projectsCount: number,
    planDaysRemaining: number | null,
    paymentFailed: boolean
) => {
    const evaluateAndCreateAlert = async (type: string, severity: string, condition: boolean) => {
        if (condition) {
            const existing = await prisma.retentionAlert.findFirst({
                where: { userId, type, resolvedAt: null }
            });
            if (!existing) {
                await prisma.retentionAlert.create({
                    data: { userId, companyId, type, severity }
                });
            }
        } else {
            // Resolve alert if condition no longer met
            await prisma.retentionAlert.updateMany({
                where: { userId, type, resolvedAt: null },
                data: { resolvedAt: new Date() }
            });
        }
    };

    await evaluateAndCreateAlert('no_login_3_days', 'medium', daysSinceLogin >= 3);
    await evaluateAndCreateAlert('no_project_7_days', 'medium', daysSinceLogin >= 7 && projectsCount === 0);
    await evaluateAndCreateAlert('plan_expiring_soon', 'high', planDaysRemaining !== null && planDaysRemaining <= 3 && planDaysRemaining >= 0);
    await evaluateAndCreateAlert('payment_failed', 'high', paymentFailed);
};
