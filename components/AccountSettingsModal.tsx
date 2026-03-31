import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../LanguageContext';
import { X, CreditCard, Calendar, Shield, User, RefreshCw, Zap, Receipt, Copy, ScanLine } from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState<'details' | 'invoices'>('details');
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [selectedInvoiceForPix, setSelectedInvoiceForPix] = useState<any | null>(null);

    useEffect(() => {
        if (isOpen && activeTab === 'invoices') {
            fetchInvoices();
        }
    }, [isOpen, activeTab]);

    const fetchInvoices = async () => {
        setLoadingInvoices(true);
        try {
            const res = await api.get('/payments/invoices');
            setInvoices(res.data);
        } catch (error) {
            console.error('Failed to fetch invoices', error);
        } finally {
            setLoadingInvoices(false);
        }
    };

    const handleCopyPix = (code: string) => {
        navigator.clipboard.writeText(code);
        alert('Código Pix copiado!');
    };

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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#151820] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700/30">

                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700/30 flex items-center justify-between bg-slate-50 dark:bg-[#1a1d23]/50">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-emerald-500" />
                        Minha Conta
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-700/30 px-6 pt-2 bg-slate-50 dark:bg-[#1a1d23]/50">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Detalhes da Assinatura
                    </button>
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'invoices' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Histórico de Faturas
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">

                    {activeTab === 'details' ? (
                        <>
                            {/* User Info Block */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-[#22262e] flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-300">
                                    {userData.username.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{userData.username}</h3>
                                    <p className="text-slate-500 text-sm">ID: {userData.companyId}</p>
                                </div>
                            </div>

                            {/* Details List */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700/30">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">Plano Atual</span>
                                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        {isFree ? <span className="text-slate-500">Grátis</span> : <span className="text-emerald-500">{userData.plan}</span>}
                                    </span>
                                </div>


                                <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700/30">
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

                                <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700/30">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">Status</span>
                                    <span className={`font-bold px-2 py-1 rounded-full text-xs ${userData.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : isTrial ? 'bg-amber-100 text-amber-700' : isFree ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {userData.status === 'CANCELLED' ? 'Cancelado' : isTrial ? 'Período de Teste' : isFree ? 'Gratuito' : 'Ativo'}
                                    </span>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="pt-6 space-y-3">
                                <button
                                    onClick={onManagePlan}
                                    className="w-full py-3 px-4 bg-white dark:bg-[#1a1d23] border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 group"
                                >
                                    <CreditCard className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                    {t('upgrade_plan') || 'Fazer Upgrade / Trocar Plano'}
                                </button>

                                {!isFree && !isTrial && userData.status !== 'CANCELLED' && (
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Tem certeza que deseja cancelar sua assinatura ativa? Você manterá o acesso até o fim do período já pago.')) return;
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
                                        className="w-full py-3 px-4 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-red-200 dark:border-red-900/30 flex items-center justify-center gap-2"
                                    >
                                        <X className="w-4 h-4" />
                                        {loading ? 'Processando...' : 'Cancelar Assinatura Atual'}
                                    </button>
                                )}

                                <p className="text-center text-xs text-slate-400">
                                    {t('upgrade_disclaimer') || 'Você será redirecionado para as opções de planos.'}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            {loadingInvoices ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                    <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                                    <span>Carregando histórico...</span>
                                </div>
                            ) : invoices.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-slate-50 dark:bg-[#1a1d23]/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/30">
                                    <Receipt className="w-10 h-10 text-slate-300 mb-3" />
                                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">Nenhuma fatura encontrada</h4>
                                    <p className="text-xs text-slate-400 mt-1">Seu histórico de pagamentos aparecerá aqui.</p>
                                </div>
                            ) : (
                                <>
                                {/* Overdue Summary */}
                                {(() => {
                                    const overdueInvoices = invoices.filter((inv: any) => inv.status === 'OVERDUE');
                                    if (overdueInvoices.length === 0) return null;
                                    const totalDebt = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
                                    return (
                                        <div className="p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800 rounded-xl mb-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                                                        {overdueInvoices.length} {overdueInvoices.length === 1 ? 'fatura em atraso' : 'faturas em atraso'}
                                                    </p>
                                                    <p className="text-xs text-red-500 mt-0.5">
                                                        Regularize para reativar sua conta
                                                    </p>
                                                </div>
                                                <span className="text-2xl font-black text-red-700 dark:text-red-400">
                                                    R$ {totalDebt.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="space-y-3">
                                    {invoices.map((inv) => {
                                        const isOverdue = inv.status === 'OVERDUE';
                                        const isPending = inv.status === 'PENDING';
                                        const isPaid = inv.status === 'PAID';
                                        const hasReference = inv.referenceStart && inv.referenceEnd;

                                        return (
                                        <div key={inv.id} className={`p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isOverdue ? 'bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800' : 'bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30'}`}>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-900 dark:text-white text-sm">{inv.planName}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        isPaid ? 'bg-emerald-100 text-emerald-700' :
                                                        isOverdue ? 'bg-red-100 text-red-700' :
                                                        isPending ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {isPaid ? 'Pago' : isOverdue ? 'Em atraso' : isPending ? 'Pendente' : 'Expirado'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                                                    {hasReference ? (
                                                        <span className={isOverdue ? 'font-semibold text-red-600' : ''}>
                                                            Ref: {new Date(inv.referenceStart).toLocaleDateString()} → {new Date(inv.referenceEnd).toLocaleDateString()}
                                                        </span>
                                                    ) : (
                                                        <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                                                    )}
                                                    <span>•</span>
                                                    <span className="capitalize">{inv.paymentMethod.replace('_', ' ').toLowerCase()}</span>
                                                    {inv.paymentMethod === 'PIX' && isPending && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-amber-600">Expira em: {new Date(inv.expiresAt).toLocaleTimeString()}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                                                <span className={`font-black text-lg ${isOverdue ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>R$ {inv.amount?.toFixed(2)}</span>

                                                {inv.paymentMethod === 'PIX' && isPending && (
                                                    <button
                                                        onClick={() => setSelectedInvoiceForPix(inv)}
                                                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg"
                                                    >
                                                        <ScanLine className="w-3.5 h-3.5" />
                                                        Pagar Pix
                                                    </button>
                                                )}
                                                {isOverdue && (
                                                    <button
                                                        onClick={onManagePlan}
                                                        className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        <CreditCard className="w-3.5 h-3.5" />
                                                        Pagar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                                </>
                            )}

                            {selectedInvoiceForPix && (
                                <div className="mt-6 p-6 bg-slate-50 dark:bg-[#1a1d23] rounded-2xl border border-emerald-100 dark:border-slate-700/30 animate-in slide-in-from-bottom-2">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-bold text-slate-900 dark:text-white">Pagamento Pix Pendente</h4>
                                        <button onClick={() => setSelectedInvoiceForPix(null)} className="text-slate-400 hover:text-slate-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-white p-2 rounded-xl border-4 border-emerald-50 mb-4">
                                            <img src={`data:image/png;base64,${selectedInvoiceForPix.qrCodeBase64}`} alt="QR Code Pix" className="w-32 h-32 object-contain" />
                                        </div>
                                        <div className="w-full flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={selectedInvoiceForPix.qrCode}
                                                className="flex-1 px-3 py-2 bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-xs font-mono text-slate-500 truncate"
                                            />
                                            <button
                                                onClick={() => handleCopyPix(selectedInvoiceForPix.qrCode)}
                                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                                            >
                                                <Copy className="w-4 h-4" /> Copiar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
