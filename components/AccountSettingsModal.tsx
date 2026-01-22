import React, { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../LanguageContext';
import { X, CreditCard, Calendar, Shield, User, RefreshCw, Zap } from 'lucide-react';

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onManagePlan: () => void;
    userData: {
        username: string;
        email?: string;
        plan: string;
        planType: string;
        expiresAt: string | null;
        companyId: string;
    };
    hasActiveSubscription?: boolean;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ isOpen, onClose, onManagePlan, userData, hasActiveSubscription }) => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    // Derived State
    const isTrial = userData.planType === 'TRIAL';
    const isFree = userData.plan === 'Plano Grátis' || userData.plan.includes('Free');
    const hasExpiration = !!userData.expiresAt;

    // Auto Renewal Logic (Simplified based on available props)
    // If it has an expiration date and it's NOT a trial, it might be canceled (expiring) or active (renewing).
    // Ideally we would pass a specific 'cancelAtPeriodEnd' flag. 
    // For now, if it's paid and has expiration, we assume it renews unless we detect it's "Expiring soon" visually (but we don't have the flag here).
    // Let's assume auto-renewal is YES for paid plans unless explicitly shown otherwise, or just show "Stripe" details.

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-sky-500" />
                        Minha Conta
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">

                    {/* User Info Block */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-300">
                            {userData.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{userData.username}</h3>
                            <p className="text-slate-500 text-sm">ID: {userData.companyId}</p>
                        </div>
                    </div>

                    {/* Details List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Plano Atual</span>
                            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {isFree ? <span className="text-slate-500">Grátis</span> : <span className="text-sky-500">{userData.plan}</span>}
                            </span>
                        </div>

                        <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Ciclo de Cobrança</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                {isFree ? '-' : 'Mensal'} {/* Hardcoded for now, can be passed if yearly */}
                            </span>
                        </div>

                        <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Vencimento / Renovação</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                {userData.expiresAt
                                    ? new Date(userData.expiresAt).toLocaleDateString()
                                    : 'Vitalício / Indefinido'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                            <CreditCard className="w-4 h-4 text-slate-400" />
                            <span>Manual</span>
                        </div>

                        <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Status</span>
                            <span className={`font-bold px-2 py-1 rounded-full text-xs ${isTrial ? 'bg-amber-100 text-amber-700' : isFree ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {isTrial ? 'Período de Teste' : isFree ? 'Gratuito' : 'Ativo'}
                            </span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-6 space-y-3">
                        <button
                            onClick={onManagePlan}
                            className="w-full py-3 px-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 group"
                        >
                            <CreditCard className="w-5 h-5 text-slate-400 group-hover:text-sky-500 transition-colors" />
                            {t('upgrade_plan') || 'Fazer Upgrade / Trocar Plano'}
                        </button>

                        {!isFree && !isTrial && hasActiveSubscription && (
                            <button
                                onClick={async () => {
                                    if (!confirm('Tem certeza que deseja cancelar sua assinatura? Sua conta retornará ao plano Grátis no final do período.')) return;
                                    try {
                                        setLoading(true);
                                        await api.post('/payments/cancel_subscription');
                                        alert('Assinatura cancelada com sucesso.');
                                        window.location.reload();
                                    } catch (error) {
                                        console.error('Failed to cancel subscription', error);
                                        alert('Erro ao cancelar assinatura. Tente novamente ou contate o suporte.');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="w-full py-2 px-4 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                            >
                                {loading ? 'Processando...' : 'Cancelar Assinatura'}
                            </button>
                        )}

                        <p className="text-center text-xs text-slate-400">
                            {t('upgrade_disclaimer') || 'Você será redirecionado para as opções de planos.'}
                        </p>
                    </div>



                </div>
            </div>
        </div>
    );
};
