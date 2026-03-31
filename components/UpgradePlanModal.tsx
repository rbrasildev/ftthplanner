import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Check, X, Star, Zap, Shield, Globe, Crown, Sparkles, Receipt } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { UpgradePaymentForm } from './UpgradePaymentForm';

interface Plan {
    id: string;
    name: string;
    price: string;
    priceRaw: number;
    priceYearlyRaw?: number;
    features: string[];
    highlight?: boolean;
    icon: React.FC<any>;
}

interface UpgradePlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlanName?: string;
    currentPlanId?: string;
    currentPlanPrice?: number;
    companyStatus?: string;
    limitDetails?: string;
    limitTitle?: string;
    renewOnly?: boolean;
}

const getPlanIcon = (index: number, name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('grátis') || lower.includes('free')) return Globe;
    if (lower.includes('start') || lower.includes('básico') || lower.includes('basic')) return Zap;
    if (lower.includes('inter') || lower.includes('medio')) return Star;
    if (lower.includes('ilimitado') || lower.includes('unlimited') || lower.includes('pro')) return Crown;
    const icons = [Globe, Zap, Star, Shield];
    return icons[index % icons.length];
};

export const UpgradePlanModal: React.FC<UpgradePlanModalProps & { companyId?: string, email?: string }> = ({ isOpen, onClose, currentPlanName, currentPlanId, currentPlanPrice, companyStatus, limitDetails, limitTitle, companyId, email, renewOnly }) => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlanForBilling, setSelectedPlanForBilling] = useState<Plan | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [overdueInfo, setOverdueInfo] = useState<{ count: number, total: number, invoices: any[] }>({ count: 0, total: 0, invoices: [] });
    const { t } = useLanguage();

    // renewOnly mode: skip plan selection entirely, go straight to payment with current plan
    useEffect(() => {
        if (!isOpen || !renewOnly) return;

        const resolveRenewPlan = async () => {
            // 1. Fetch overdue invoices
            try {
                const invRes = await api.get('/payments/invoices');
                const allInvoices = invRes.data || [];
                const overdue = allInvoices.filter((inv: any) => inv.status === 'OVERDUE');
                if (overdue.length > 0) {
                    const total = overdue.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
                    setOverdueInfo({ count: overdue.length, total, invoices: overdue });
                }
            } catch (err) {
                console.error('Failed to fetch overdue invoices', err);
            }

            // 2. Resolve plan and price
            if (currentPlanId && currentPlanName && currentPlanPrice && currentPlanPrice > 0) {
                setSelectedPlanForBilling({
                    id: currentPlanId,
                    name: currentPlanName,
                    priceRaw: currentPlanPrice,
                    price: `R$ ${currentPlanPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    features: [],
                    icon: Zap
                });
                setLoading(false);
                return;
            }

            // Price is 0 or missing (trial/free plan expired) — fetch plans and pick current or recommended
            try {
                const response = await api.get('/saas/public/plans');
                const dbPlans = response.data;

                const match = currentPlanId
                    ? dbPlans.find((p: any) => p.id === currentPlanId && p.price > 0)
                    : null;
                const fallback = match || dbPlans.find((p: any) => p.price > 0 && p.isRecommended) || dbPlans.find((p: any) => p.price > 0);

                if (fallback) {
                    setSelectedPlanForBilling({
                        id: fallback.id,
                        name: fallback.name,
                        priceRaw: fallback.price,
                        price: `R$ ${fallback.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                        features: [],
                        icon: Zap
                    });
                }
            } catch (err) {
                console.error('Failed to resolve renew plan', err);
            }
            setLoading(false);
        };

        resolveRenewPlan();
    }, [isOpen, renewOnly, currentPlanId, currentPlanName, currentPlanPrice]);

    useEffect(() => {
        if (isOpen && !renewOnly) { // Skip fetch when renewOnly
            const fetchPlans = async () => {
                try {
                    setLoading(true);
                    const response = await api.get('/saas/public/plans');
                    const dbPlans = response.data;

                    const formattedPlans: Plan[] = dbPlans.map((p: any, idx: number) => {
                        let features = p.features || [];
                        if (typeof features === 'string') {
                            try { features = JSON.parse(features); } catch { features = []; }
                        }
                        return {
                            id: p.id,
                            name: p.name,
                            priceRaw: p.price,
                            priceYearlyRaw: p.priceYearly,
                            price: p.price > 0 ? `R$ ${p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Grátis',
                            features: Array.isArray(features) ? features.map((f: string) => t(f)) : [],
                            highlight: p.isRecommended,
                            icon: getPlanIcon(idx, p.name),
                            limits: p.limits
                        };
                    });

                    const enrichedPlans = formattedPlans.map(p => {
                        const limits = (p as any).limits;
                        if (limits) {
                            const limitFeatures = [];
                            if (limits.maxProjects) limitFeatures.push(limits.maxProjects >= 999999 ? t('feature_projects_unlimited') : t('feature_projects', { count: limits.maxProjects }));
                            if (limits.maxUsers) limitFeatures.push(limits.maxUsers >= 999999 ? t('feature_users_unlimited') : t('feature_users', { count: limits.maxUsers }));
                            if (limits.maxCTOs) limitFeatures.push(limits.maxCTOs >= 999999 ? t('feature_ctos_unlimited') : t('feature_ctos', { count: limits.maxCTOs }));
                            return { ...p, features: [...limitFeatures, ...p.features] };
                        }
                        return p;
                    }).filter(p => !p.name.toLowerCase().includes('trial') && !p.name.toLowerCase().includes('teste'));

                    setPlans(enrichedPlans);
                } catch (error) {
                    console.error("Failed to fetch plan prices", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchPlans();
        }
    }, [isOpen, renewOnly, t]);

    const handleSelectPlan = (plan: Plan) => {
        if (plan.priceRaw === 0) { onClose(); return; }
        if (!companyId) { alert('Erro: ID da empresa não encontrado. Faça login novamente.'); return; }
        setSelectedPlanForBilling(plan);
    };

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedPlanForBilling(null);
            setIsSuccess(false);
            setLoading(true);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-2 sm:p-4">
            <div className="bg-white dark:bg-[#151820] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] rounded-2xl border border-slate-200 dark:border-slate-700/30">

                {/* Header */}
                <div className="relative shrink-0 border-b border-slate-100 dark:border-slate-700/30">
                    {/* Close Button */}
                    {!isSuccess && (
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors z-20"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    {/* Back Button */}
                    {selectedPlanForBilling && !isSuccess && (
                        <button
                            onClick={() => renewOnly ? onClose() : setSelectedPlanForBilling(null)}
                            className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors z-20 text-sm font-medium"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                            {t('back_btn')}
                        </button>
                    )}

                    {!selectedPlanForBilling && !isSuccess && (
                        <div className="pt-8 pb-6 px-6 text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
                                <Sparkles className="w-3.5 h-3.5" />
                                {limitDetails ? t('limit_reached') : t('manage_subscription')}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1.5">
                                {limitTitle || (limitDetails ? t('upgrade_now') : (t('choose_plan')))}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto">
                                {limitDetails || (t('upgrade_disclaimer'))}
                            </p>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-6 flex flex-col items-center">
                    {isSuccess ? (
                        /* Success State */
                        <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-500">
                            <div className="mb-6 relative">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 relative z-10">
                                    <Check className="w-10 h-10 text-white stroke-[3px]" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('success_title')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">{t('success_desc')}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {t('access_platform')}
                            </button>
                        </div>
                    ) : selectedPlanForBilling ? (
                        /* Payment Form */
                        <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="w-full max-w-3xl">
                                {/* Overdue Debt Summary (shown above payment form when renewing with outstanding debt) */}
                                {overdueInfo.count > 0 && (
                                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800 rounded-xl">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                                                <Receipt className="w-5 h-5 text-red-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-red-700 dark:text-red-400">
                                                    {overdueInfo.count} {overdueInfo.count === 1 ? 'fatura em atraso' : 'faturas em atraso'}
                                                </p>
                                                <div className="mt-2 space-y-1">
                                                    {overdueInfo.invoices.map((inv: any) => (
                                                        <div key={inv.id} className="flex items-center justify-between text-xs text-red-600 dark:text-red-400">
                                                            <span>
                                                                {inv.referenceStart && inv.referenceEnd
                                                                    ? `${new Date(inv.referenceStart).toLocaleDateString()} → ${new Date(inv.referenceEnd).toLocaleDateString()}`
                                                                    : new Date(inv.createdAt).toLocaleDateString()}
                                                            </span>
                                                            <span className="font-bold">R$ {inv.amount?.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800 flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-red-600">Débito total</span>
                                                    <span className="text-lg font-black text-red-700 dark:text-red-400">R$ {overdueInfo.total.toFixed(2)}</span>
                                                </div>
                                                <p className="text-[10px] text-red-500 mt-1">
                                                    O pagamento abaixo quitará a fatura mais antiga. Repita para quitar as demais.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <UpgradePaymentForm
                                    plan={selectedPlanForBilling}
                                    email={email}
                                    onSuccess={() => setIsSuccess(true)}
                                    onCancel={() => renewOnly ? onClose() : setSelectedPlanForBilling(null)}
                                />
                            </div>
                        </div>
                    ) : loading ? (
                        /* Loading */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full max-w-5xl mx-auto">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700/30 p-6 animate-pulse">
                                    <div className="h-10 w-10 bg-slate-200 dark:bg-[#22262e] rounded-lg mb-4" />
                                    <div className="h-5 w-24 bg-slate-200 dark:bg-[#22262e] rounded mb-2" />
                                    <div className="h-8 w-32 bg-slate-200 dark:bg-[#22262e] rounded mb-6" />
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(j => <div key={j} className="h-4 bg-slate-100 dark:bg-[#22262e]/50 rounded w-full" />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Plan Cards */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full max-w-5xl mx-auto">
                            {plans.map((plan) => {
                                const isExpiredOrCancelled = companyStatus === 'SUSPENDED' || companyStatus === 'CANCELLED';
                                const isCurrent = !isExpiredOrCancelled && ((currentPlanId && currentPlanId === plan.id) || (currentPlanName && currentPlanName.trim().toLowerCase() === plan.name.trim().toLowerCase()));
                                const isFree = plan.priceRaw === 0;
                                const PlanIcon = plan.icon;

                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative rounded-xl border p-5 flex flex-col transition-all duration-200
                                            ${plan.highlight
                                                ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                                                : isCurrent
                                                    ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1a1d23]/50'
                                                    : 'border-slate-200 dark:border-slate-700/30 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                                            }
                                        `}
                                    >
                                        {/* Recommended Badge */}
                                        {plan.highlight && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                                                    <Sparkles className="w-3 h-3" />
                                                    {t('recommended_plan')}
                                                </span>
                                            </div>
                                        )}

                                        {/* Current Plan Badge */}
                                        {isCurrent && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-700 dark:bg-slate-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                                                    {t('plan_current')}
                                                </span>
                                            </div>
                                        )}

                                        {/* Plan Icon + Name */}
                                        <div className="mt-2 mb-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3
                                                ${plan.highlight
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-slate-100 dark:bg-[#22262e] text-slate-500 dark:text-slate-400'
                                                }`}>
                                                <PlanIcon className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                                        </div>

                                        {/* Price */}
                                        <div className="mb-5 pb-5 border-b border-slate-100 dark:border-slate-700/30">
                                            {isFree ? (
                                                <div className="flex items-baseline">
                                                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t('free')}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-sm font-medium text-slate-400">R$</span>
                                                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                                        {plan.priceRaw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-sm text-slate-400 font-medium">/{t('month_short')}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Features */}
                                        <ul className="space-y-2.5 mb-6 flex-1">
                                            {plan.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start gap-2.5 text-[13px] text-slate-600 dark:text-slate-300">
                                                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} />
                                                    <span className="leading-snug">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* CTA Button */}
                                        <button
                                            onClick={() => handleSelectPlan(plan)}
                                            disabled={isCurrent}
                                            className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-200
                                                ${isCurrent
                                                    ? 'bg-slate-100 dark:bg-[#22262e] text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                    : isFree
                                                        ? 'bg-white dark:bg-[#22262e] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                        : plan.highlight
                                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                                                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 hover:-translate-y-0.5 active:translate-y-0'
                                                }
                                            `}
                                        >
                                            {isCurrent
                                                ? (t('plan_current'))
                                                : isFree
                                                    ? (t('select_plan'))
                                                    : (t('subscribe_now'))
                                            }
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
