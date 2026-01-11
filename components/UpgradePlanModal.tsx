import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Check, X, Star, Zap, Shield, Globe } from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    price: string;
    features: string[];
    highlight?: boolean;
    icon: React.FC<any>;
}

interface UpgradePlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlanName?: string;
    limitDetails?: string;
}

// Icon mapping helper
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

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({ isOpen, onClose, currentPlanName, limitDetails }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const fetchPlans = async () => {
                try {
                    setLoading(true);
                    // Use public endpoint or authenticated one based on needs. 
                    // Since this is inside the app, user is technically logged in, but 'api' instance handles auth.
                    // Let's use the public one to be safe/fast or the secure one if we have it?
                    // The previous code used /saas/plans (authenticated). Let's stick to that if it works, or fallback to public.
                    // Actually, let's use the new /public/plans which returns the clean view data we need.
                    // But 'api' helper usually adds /api prefix? checking view_file of components/UpgradePlanModal.tsx line 2 imports 'api'.
                    // Assuming api helper works for both.

                    const response = await api.get('/saas/public/plans');
                    const dbPlans = response.data;

                    const formattedPlans: Plan[] = dbPlans.map((p: any, idx: number) => ({
                        id: p.id,
                        name: p.name,
                        price: p.price > 0 ? `R$ ${p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês` : 'Grátis',
                        features: p.features || [], // Use raw features from DB
                        highlight: p.isRecommended,
                        icon: getPlanIcon(idx, p.name),
                        limits: p.limits // Store limits to display "Infinite" logic if we want to augment features
                    }));

                    // Optional: Augment features list with limits if they are missing from text features?
                    // For now, let's trust the 'features' array from DB as requested ("direto do banco").
                    // But the user liked the "Unlimited" display.
                    // Let's PREPEND the limits to the features list for clarity, formatted nicely.

                    const enrichedPlans = formattedPlans.map(p => {
                        const limits = (p as any).limits;
                        if (limits) {
                            const limitFeatures = [];
                            // Projects
                            limitFeatures.push(limits.maxProjects >= 999999 ? 'Projetos Ilimitados' : `${limits.maxProjects} Projetos`);
                            // Users
                            limitFeatures.push(limits.maxUsers >= 999999 ? 'Usuários Ilimitados' : `${limits.maxUsers} Usuários`);
                            // CTOs
                            limitFeatures.push(limits.maxCTOs >= 999999 ? 'CTOs Ilimitados' : `${limits.maxCTOs} CTOs`);

                            // Combine with DB features, avoiding duplicates if meaningful? 
                            // Simple approach: Prepend limits, then show DB features.
                            return { ...p, features: [...limitFeatures, ...p.features] };
                        }
                        return p;
                    });

                    setPlans(enrichedPlans);
                } catch (error) {
                    console.error("Failed to fetch plan prices", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchPlans();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-8 text-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-6 ring-4 ring-red-50 dark:ring-red-900/10">
                        <Zap className="w-8 h-8" />
                    </div>

                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                        {limitDetails ? "Limite Atingido!" : "Faça um Upgrade"}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        {limitDetails || "Você atingiu os limites do seu plano atual."} <br />
                        Escolha um plano ideal para continuar expandindo sua rede.
                    </p>

                    {/* Simple Toggle for visual effect (functionality mocked) */}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {plans.map((plan) => {
                            const isCurrent = currentPlanName === plan.name;
                            return (
                                <div
                                    key={plan.id}
                                    className={`relative bg-white dark:bg-slate-900 rounded-xl p-6 border transition-all duration-300 flex flex-col
                                        ${plan.highlight
                                            ? 'border-sky-500 ring-4 ring-sky-500/10 shadow-xl scale-105 z-10'
                                            : 'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-lg'
                                        }
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
                                                {plan.price.split('/')[0]}
                                            </span>
                                            {plan.price.includes('/') && (
                                                <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">
                                                    /{plan.price.split('/')[1]}
                                                </span>
                                            )}
                                        </div>
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
                                        onClick={() => {
                                            // WhatsApp link with pre-filled message
                                            const msg = `Olá! Gostaria de fazer o upgrade para o ${plan.name}.`;
                                            window.open(`https://wa.me/5591992094467?text=${encodeURIComponent(msg)}`, '_blank');
                                        }}
                                        disabled={isCurrent}
                                        className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all
                                            ${isCurrent
                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                                : plan.highlight
                                                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/20 hover:-translate-y-0.5'
                                                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200'
                                            }
                                        `}
                                    >
                                        {isCurrent ? 'Plano Atual' : 'Escolher Plano'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Precisa de um plano personalizado? <button className="text-sky-600 dark:text-sky-400 font-bold hover:underline">Entre em contato</button>
                    </p>
                </div>
            </div>
        </div>
    );
};
