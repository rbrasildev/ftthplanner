import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getRetentionDashboard = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const metrics = await prisma.userEngagementMetrics.findMany({
            include: {
                user: { select: { id: true, username: true, email: true, active: true } },
                company: { select: { id: true, name: true, status: true, subscriptionExpiresAt: true } }
            }
        });

        const financial = await prisma.userFinancialMetrics.findMany();
        const alerts = await prisma.retentionAlert.findMany({
            where: { resolvedAt: null },
            include: {
                user: { select: { id: true, username: true, email: true } }
            }
        });

        const totalUsers = metrics.length;

        // Active today (logged in today)
        const activeToday = metrics.filter(m => m.lastLoginAt && m.lastLoginAt >= today).length;
        const activeTodayPercent = totalUsers ? (activeToday / totalUsers) * 100 : 0;

        // High risk
        const highRisk = metrics.filter(m => m.churnRiskScore > 60).length;
        const highRiskPercent = totalUsers ? (highRisk / totalUsers) * 100 : 0;

        // Never created a project
        const neverCreatedProject = metrics.filter(m => !m.lastProjectCreatedAt).length;

        // Inactive for 7 days
        const inactive7Days = metrics.filter(m => !m.lastLoginAt || m.lastLoginAt <= sevenDaysAgo).length;

        // Revenue at risk (MRR of high risk users)
        let revenueAtRisk = 0;
        let totalLtv = 0;

        metrics.forEach(m => {
            const f = financial.find(fin => fin.userId === m.userId);
            if (f) {
                if (m.churnRiskScore > 60) {
                    revenueAtRisk += f.monthlyRevenue;
                }
                totalLtv += f.estimatedLTV;
            }
        });

        const averageLTV = totalUsers ? (totalLtv / totalUsers) : 0;

        // Detailed user list for table
        const tableData = metrics.map(m => {
            const f = financial.find(fin => fin.userId === m.userId);
            const userAlerts = alerts.filter(a => a.userId === m.userId);
            return {
                id: m.userId,
                username: m.user.username,
                email: m.user.email,
                company: m.company?.name || '-',
                lastLoginAt: m.lastLoginAt,
                churnRiskScore: m.churnRiskScore,
                estimatedLTV: f?.estimatedLTV || 0,
                monthlyRevenue: f?.monthlyRevenue || 0,
                alerts: userAlerts,
                hasProject: !!m.lastProjectCreatedAt,
                paymentFailed: m.company?.status === 'PAYMENT_FAILED' || m.company?.status === 'SUSPENDED'
            };
        });

        res.json({
            summary: {
                activeTodayPercent,
                highRiskPercent,
                neverCreatedProject,
                inactive7Days,
                revenueAtRisk,
                averageLTV,
                churnForcastNextMonth: highRiskPercent // Simplified: High risk users = projected churn
            },
            alerts,
            users: tableData
        });
    } catch (error) {
        console.error('Error fetching retention dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch retention metrics' });
    }
};
