import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Check, X, Star, Zap, Shield, Globe } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface Plan {
    id: string;
    stripePriceId?: string;
    stripePriceIdYearly?: string;
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

import { BillingModal } from './Billing/BillingModal';

export const UpgradePlanModal: React.FC<UpgradePlanModalProps & { companyId?: string, email?: string }> = ({ isOpen, onClose, currentPlanName, currentPlanId, limitDetails, companyId, email }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true); // Ensure loading is initialized properly
    const [selectedPlanForBilling, setSelectedPlanForBilling] = useState<Plan | null>(null);
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
                            stripePriceId: p.stripePriceId || p.id,
                            stripePriceIdYearly: p.stripePriceIdYearly,
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

        // Validation: If yearly selected but no yearly price exists
        if (billingCycle === 'yearly' && !plan.stripePriceIdYearly) {
            alert('O plano anual ainda não está disponível para esta opção.');
            return;
        }

        setSelectedPlanForBilling(plan);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="p-8 text-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 relative">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 ring-4 
                            ${limitDetails
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-red-50 dark:ring-red-900/10'
                                : 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 ring-sky-50 dark:ring-sky-900/10'}`}>
                            {limitDetails ? <Shield className="w-8 h-8" /> : <Star className="w-8 h-8" />}
                        </div>

                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                            {limitDetails ? "Limite Atingido!" : (currentPlanName && !currentPlanName.toLowerCase().includes('grátis') ? "Gerenciar Assinatura" : "Faça um Upgrade")}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                            {limitDetails
                                ? <>{limitDetails} <br /> Escolha um plano ideal para continuar expandindo.</>
                                : "Confira as opções disponíveis e escolha o plano ideal para o seu crescimento."
                            }
                        </p>

                        {/* Toggle */}
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Mensal</span>
                            <button
                                onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
                                className="w-14 h-7 bg-slate-200 dark:bg-slate-700 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
                            >
                                <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${billingCycle === 'yearly' ? 'translate-x-7' : ''}`} />
                            </button>
                            <span className={`text-sm font-bold ${billingCycle === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                Anual <span className="text-green-500 text-xs ml-1">-20% OFF</span>
                            </span>
                        </div>
                    </div>

                    {/* Plans Grid */}
                    <div className="p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950">
                        <div className="flex flex-wrap justify-center gap-6">
                            {plans.map((plan) => {
                                const isCurrent = (currentPlanId && currentPlanId === plan.id) || (currentPlanName && currentPlanName.trim().toLowerCase() === plan.name.trim().toLowerCase());

                                // Calculate display price
                                let displayPrice = plan.price; // Default monthly
                                let priceSubtext = '/mês';

                                if (billingCycle === 'yearly' && plan.priceYearlyRaw) {
                                    // Yearly display
                                    const yearlyTotal = plan.priceYearlyRaw;
                                    // Show equivalent monthly price for comparison? Or just yearly full price?
                                    // "R$ X/ano" is clearer for billing.
                                    displayPrice = `R$ ${yearlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                    priceSubtext = '/ano';
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
                                                ? 'border-sky-500 ring-4 ring-sky-500/10 shadow-xl scale-105 z-10'
                                                : 'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-lg'
                                            }
                                            ${(billingCycle === 'yearly' && !plan.priceYearlyRaw && plan.priceRaw > 0) ? 'opacity-50 grayscale' : ''}
                                        `}
                                    >
                                        {plan.highlight && (
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-sky-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                                Recomendado
                                            </div>
                                        )}

                                        <div className="mb-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${plan.highlight ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                                {plan.icon ? <plan.icon className="w-6 h-6" /> : <Star className="w-6 h-6" />}
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                                            <div className="mt-2 flex items-baseline">
                                                <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                                    {displayPrice === 'Grátis' ? 'Grátis' : displayPrice.replace('/mês', '').replace('R$ ', '')}
                                                </span>
                                                {displayPrice !== 'Grátis' && (
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">
                                                        {priceSubtext}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Show savings if yearly */}
                                            {billingCycle === 'yearly' && plan.priceYearlyRaw && plan.priceRaw > 0 && (
                                                <div className="text-xs text-green-600 font-bold mt-1">
                                                    Economize R$ {(plan.priceRaw * 12 - plan.priceYearlyRaw).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/ano
                                                </div>
                                            )}
                                        </div>

                                        <ul className="space-y-3 mb-8 flex-1">
                                            {plan.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-sky-500' : 'text-slate-400'}`} />
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
                                                        ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/20 hover:-translate-y-0.5'
                                                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                                                }
                                            `}
                                        >
                                            {isCurrent ? 'Plano Atual' : (billingCycle === 'yearly' && !plan.priceYearlyRaw && plan.priceRaw > 0) ? 'Indisponível Anual' : 'Assinar Agora'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                            Pagamento seguro via Stripe. Mudanças entram em vigor imediatamente.
                        </p>

                    </div>
                </div>
            </div>

            {selectedPlanForBilling && companyId && (
                <BillingModal
                    isOpen={!!selectedPlanForBilling}
                    onClose={() => setSelectedPlanForBilling(null)}
                    planId={(billingCycle === 'yearly' && selectedPlanForBilling.stripePriceIdYearly)
                        ? selectedPlanForBilling.stripePriceIdYearly
                        : (selectedPlanForBilling.stripePriceId || selectedPlanForBilling.id)
                    }
                    companyId={companyId}
                    planName={`${selectedPlanForBilling.name} (${billingCycle === 'yearly' ? 'Anual' : 'Mensal'})`}
                    price={
                        billingCycle === 'yearly' && selectedPlanForBilling.priceYearlyRaw
                            ? selectedPlanForBilling.priceYearlyRaw
                            : selectedPlanForBilling.priceRaw
                    }
                    billingEmail={email || ''}
                />
            )}
        </>
    );
};
