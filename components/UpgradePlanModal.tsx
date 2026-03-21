import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Check, X, Star, Zap, Shield, Globe } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { UpgradePaymentForm } from './UpgradePaymentForm';

interface Plan {
    id: string;
    name: string;
    price: string; // Formatted monthly price
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
    currentPlanId?: string; // NEW
    limitDetails?: string;
    limitTitle?: string;
}

// Icon mapping helper (unchanged)
const getPlanIcon = (index: number, name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('grátis') || lower.includes('free')) return Globe;
    if (lower.includes('básico') || lower.includes('basic')) return Zap;
    if (lower.includes('inter') || lower.includes('medio')) return Star;
    if (lower.includes('ilimitado') || lower.includes('unlimited') || lower.includes('pro')) return Shield;

    // Fallback by index
    const icons = [Globe, Zap, Star, Shield];
    return icons[index % icons.length];
};



export const UpgradePlanModal: React.FC<UpgradePlanModalProps & { companyId?: string, email?: string }> = ({ isOpen, onClose, currentPlanName, currentPlanId, limitDetails, limitTitle, companyId, email }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true); // Ensure loading is initialized properly
    const [selectedPlanForBilling, setSelectedPlanForBilling] = useState<Plan | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        if (isOpen) {
            const fetchPlans = async () => {
                try {
                    setLoading(true);
                    const response = await api.get('/saas/public/plans');
                    const dbPlans = response.data;

                    const formattedPlans: Plan[] = dbPlans.map((p: any, idx: number) => {
                        let features = p.features || [];
                        if (typeof features === 'string') {
                            try {
                                features = JSON.parse(features);
                            } catch (e) {
                                features = [];
                            }
                        }
                        return {
                            id: p.id,
                            name: p.name,
                            priceRaw: p.price,
                            priceYearlyRaw: p.priceYearly,
                            price: p.price > 0 ? `R$ ${p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês` : 'Grátis',
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
                    })
                        // Filter out Trial plans from Upgrade options
                        .filter(p => !p.name.toLowerCase().includes('trial') && !p.name.toLowerCase().includes('teste'));

                    setPlans(enrichedPlans);
                } catch (error) {
                    console.error("Failed to fetch plan prices", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchPlans();
        }
    }, [isOpen, t]);

    const handleSelectPlan = (plan: Plan) => {
        if (plan.price === 'Grátis' && billingCycle === 'monthly') {
            onClose();
            return;
        }
        // Force Monthly if Free plan has no yearly option (usually Free is just Free, no cycle)
        if (plan.name.toLowerCase().includes('grátis')) {
            onClose();
            return;
        }

        if (!companyId) {
            alert('Erro: ID da empresa não encontrado. Faça login novamente.');
            return;
        }

        if (billingCycle === 'yearly' && !plan.priceYearlyRaw) {
            alert('O plano anual ainda não está disponível para esta opção.');
            return;
        }

        setSelectedPlanForBilling(plan);
    };



    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 animate-in fade-in duration-300 p-0 sm:p-4">
                <div className="bg-white dark:bg-slate-900 shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col h-full sm:h-auto sm:min-h-[90vh] sm:max-h-[95vh] sm:rounded-2xl">

                    <div className={`${(selectedPlanForBilling || isSuccess) ? 'p-6 sm:p-6' : 'p-8 sm:p-8'} text-center bg-white dark:bg-slate-900 shrink-0 relative transition-all`}>
                        {!isSuccess && (
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors z-20"
                                aria-label={t('close_btn')}
                            >
                                <X className="w-6 h-6" />
                            </button>
                        )}

                        {/* Back Button (Only when in Payment Mode) */}
                        {selectedPlanForBilling && !isSuccess && (
                            <button
                                onClick={() => setSelectedPlanForBilling(null)}
                                className="absolute top-6 left-4 flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 hover:text-emerald-700 dark:hover:text-white transition-colors z-20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                <span className="text-sm font-bold">{t('back_btn')}</span>
                            </button>
                        )}

                        {!selectedPlanForBilling && !isSuccess && (
                            <>
                                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 ring-4 
                                    ${limitDetails
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-red-50 dark:ring-red-900/10'
                                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 ring-emerald-50 dark:ring-emerald-900/10'}`}>
                                    {limitDetails ? <Shield className="w-8 h-8" /> : <Star className="w-8 h-8" />}
                                </div>

                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3">
                                    {limitTitle ? limitTitle : (limitDetails ? t('limit_reached') : (currentPlanName && !currentPlanName.toLowerCase().includes('grátis') ? t('manage_subscription') : t('upgrade_now')))}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed px-4">
                                    {limitDetails
                                        ? <>{limitDetails} <br /> {t('upgrade_desc')}</>
                                        : t('upgrade_disclaimer')
                                    }
                                </p>
                            </>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="pt-4 sm:pt-9 overflow-y-auto bg-white dark:bg-slate-900 flex-1 relative px-4 sm:px-0">
                        {isSuccess ? (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 text-center animate-in fade-in zoom-in duration-500">
                                <div className="mb-8 relative">
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping duration-1000"></div>
                                    <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/40 relative z-10">
                                        <Check className="w-12 h-12 text-white stroke-[3px]" />
                                    </div>
                                </div>
                                <h3 className="text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">{t('success_title')}</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mx-auto mb-10 leading-relaxed">
                                    {t('success_desc')}
                                </p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-2xl shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] text-lg uppercase tracking-wider"
                                >
                                    {t('access_platform')}
                                </button>

                                <div className="mt-12 opacity-30">
                                    <Zap className="w-6 h-6 text-emerald-500 animate-bounce" />
                                </div>
                            </div>
                        ) : selectedPlanForBilling ? (
                            <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="w-full max-w-3xl">
                                    <UpgradePaymentForm
                                        plan={selectedPlanForBilling}
                                        email={email}
                                        onSuccess={() => {
                                            setIsSuccess(true);
                                        }}
                                        onCancel={() => setSelectedPlanForBilling(null)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap justify-center gap-6">
                                {plans.map((plan) => {
                                    const isCurrent = (currentPlanId && currentPlanId === plan.id) || (currentPlanName && currentPlanName.trim().toLowerCase() === plan.name.trim().toLowerCase());

                                    // Calculate display price
                                    let displayPrice = plan.price; // Default monthly
                                    let priceSubtext = t('per_month');

                                    if (billingCycle === 'yearly' && plan.priceYearlyRaw) {
                                        // Yearly display
                                        const yearlyTotal = plan.priceYearlyRaw;
                                        displayPrice = `R$ ${yearlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                        priceSubtext = t('per_year');
                                    } else if (billingCycle === 'yearly' && !plan.priceYearlyRaw && plan.priceRaw > 0) {
                                        // Plan doesn't have yearly option
                                        displayPrice = 'N/A';
                                        priceSubtext = '';
                                    }

                                    return (
                                        <div
                                            key={plan.id}
                                            className={`relative bg-white dark:bg-slate-900 rounded-xl p-6 border transition-all duration-300 flex flex-col w-full max-w-[300px]
                                            ${plan.highlight
                                                    ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-xl scale-105 z-10'
                                                    : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg'
                                                }
                                            ${(billingCycle === 'yearly' && !plan.priceYearlyRaw && plan.priceRaw > 0) ? 'opacity-50 grayscale' : ''}
                                        `}
                                        >
                                            {plan.highlight && (
                                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                                    {t('recommended_plan')}
                                                </div>
                                            )}

                                            <div className="mb-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${plan.highlight ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                                    {plan.icon ? <plan.icon className="w-6 h-6" /> : <Star className="w-6 h-6" />}
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                                                <div className="mt-2 flex items-baseline">
                                                    <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                                        {displayPrice === 'Grátis' ? t('free') : displayPrice.replace('/mês', '').replace('R$ ', '')}
                                                    </span>
                                                    {displayPrice !== 'Grátis' && (
                                                        <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">
                                                            {priceSubtext}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <ul className="space-y-3 mb-8 flex-1">
                                                {plan.features.map((feature, idx) => (
                                                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                        <span className="leading-snug">{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>

                                            <button
                                                onClick={() => handleSelectPlan(plan)}
                                                disabled={isCurrent || (billingCycle === 'yearly' && !plan.priceYearlyRaw && plan.priceRaw > 0)}
                                                className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all
                                                ${isCurrent
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                                        : plan.highlight
                                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 hover:-translate-y-0.5'
                                                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                                                    }
                                            `}
                                            >
                                                {isCurrent ? t('plan_current') : (billingCycle === 'yearly' && !plan.priceYearlyRaw && plan.priceRaw > 0) ? t('yearly_unavailable') : t('subscribe_now')}
                                            </button>

                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </>
    );
};
