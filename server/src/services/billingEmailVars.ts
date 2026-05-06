import { prisma } from '../lib/prisma';

export const BILLING_TEMPLATE_SLUGS = [
    'subscription-expiring-soon',
    'subscription-expiring-today',
    'invoice-overdue'
] as const;

export type BillingTemplateSlug = typeof BILLING_TEMPLATE_SLUGS[number];

export const isBillingTemplateSlug = (slug: string): slug is BillingTemplateSlug =>
    (BILLING_TEMPLATE_SLUGS as readonly string[]).includes(slug);

const formatDateBR = (d: Date | null | undefined): string => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
};

const formatBRL = (n: number | null | undefined): string => {
    if (n === null || n === undefined) return '-';
    return n.toFixed(2).replace('.', ',');
};

const daysBetween = (from: Date, to: Date) =>
    Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

export const buildBillingVars = async (
    slug: string,
    companyId: string | null
): Promise<Record<string, string>> => {
    if (!isBillingTemplateSlug(slug) || !companyId) return {};

    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { plan: true }
    });
    if (!company) return {};

    const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://ftthplanner.com.br').replace(/\/$/, '');

    const vars: Record<string, string> = {
        plan_name: company.plan?.name || '-',
        amount: formatBRL(company.plan?.price),
        pay_url: appUrl
    };

    if (slug === 'invoice-overdue') {
        const invoice = await prisma.invoice.findFirst({
            where: { companyId, status: 'OVERDUE' },
            orderBy: { expiresAt: 'desc' }
        });
        if (invoice) {
            vars.amount = formatBRL(invoice.amount);
            vars.expires_at = formatDateBR(invoice.expiresAt);
            vars.days_overdue = String(Math.max(0, daysBetween(invoice.expiresAt, new Date())));
        } else {
            vars.expires_at = '-';
            vars.days_overdue = '-';
        }
    } else {
        vars.expires_at = formatDateBR(company.subscriptionExpiresAt);
        if (slug === 'subscription-expiring-soon') {
            if (company.subscriptionExpiresAt) {
                vars.days_left = String(Math.max(0, daysBetween(new Date(), company.subscriptionExpiresAt)));
            } else {
                vars.days_left = '-';
            }
        }
    }

    return vars;
};
