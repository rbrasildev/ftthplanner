import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useLanguage } from '../LanguageContext';
import { UpgradePaymentForm } from './UpgradePaymentForm';
import {
    ArrowLeft, User, CreditCard, Receipt, X,
    Calendar, ShieldCheck, AlertTriangle, CheckCircle2,
    RefreshCw, Copy, ScanLine, ChevronRight,
    Zap, Star, Globe, Crown, Sparkles, Check, Info,
    Wallet
} from 'lucide-react';

type ViewKey = 'overview' | 'invoices' | 'plans' | 'payment';
type InvoiceFilter = 'all' | 'overdue' | 'pending' | 'paid';

interface PaymentContext {
    plan: { id: string; name: string; priceRaw: number; features?: string[] };
    invoice?: any;
}

interface BillingPageProps {
    onBack: () => void;
    showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
    userData: {
        username: string;
        email?: string;
        plan: string;
        planType: string;
        planId?: string;
        planPrice?: number;
        expiresAt: string | null;
        companyId: string;
        companyStatus?: string;
    };
}

const CANCEL_REASONS = [
    { id: 'too_expensive', label: 'Está muito caro' },
    { id: 'missing_features', label: 'Faltam recursos que preciso' },
    { id: 'switching', label: 'Vou usar outra ferramenta' },
    { id: 'temp_pause', label: 'Só preciso pausar por enquanto' },
    { id: 'not_using', label: 'Não estou usando' },
    { id: 'other', label: 'Outro motivo' }
] as const;

const getPlanIcon = (name: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('grátis') || lower.includes('free')) return Globe;
    if (lower.includes('start') || lower.includes('básico') || lower.includes('basic')) return Zap;
    if (lower.includes('inter') || lower.includes('medio')) return Star;
    if (lower.includes('ilimitado') || lower.includes('unlimited') || lower.includes('pro')) return Crown;
    return Zap;
};

const daysBetween = (a: Date, b: Date): number =>
    Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

const formatDate = (value: string | Date | null | undefined): string => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatPeriod = (inv: any): string => {
    if (inv.referenceStart && inv.referenceEnd) {
        return `${formatDate(inv.referenceStart)} → ${formatDate(inv.referenceEnd)}`;
    }
    return formatDate(inv.createdAt);
};

const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'R$ 0,00';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const BillingPage: React.FC<BillingPageProps> = ({ onBack, userData, showToast }) => {
    const { t } = useLanguage();
    const [activeView, setActiveView] = useState<ViewKey>('overview');
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [plans, setPlans] = useState<any[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [paymentContext, setPaymentContext] = useState<PaymentContext | null>(null);
    const [pixPopover, setPixPopover] = useState<any | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState<string | null>(null);
    const [cancelDetail, setCancelDetail] = useState('');
    const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [localToast, setLocalToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

    // Fallback toaster pra quando showToast não foi passado
    const notify = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
        if (showToast) {
            showToast(msg, type);
        } else {
            setLocalToast({ msg, type });
            setTimeout(() => setLocalToast(null), 4000);
        }
    };

    // Fetch invoices when needed
    useEffect(() => {
        if (activeView === 'overview' || activeView === 'invoices') {
            fetchInvoices();
        }
    }, [activeView]);

    // Fetch plans when needed
    useEffect(() => {
        if (activeView === 'plans') {
            fetchPlans();
        }
    }, [activeView]);

    const fetchInvoices = async () => {
        setLoadingInvoices(true);
        try {
            const res = await api.get('/payments/invoices');
            setInvoices(res.data || []);
        } catch (err) {
            console.error('Failed to fetch invoices', err);
        } finally {
            setLoadingInvoices(false);
        }
    };

    const fetchPlans = async () => {
        setLoadingPlans(true);
        try {
            const res = await api.get('/saas/public/plans');
            const raw = res.data || [];
            const formatted = raw
                .map((p: any, idx: number) => ({
                    id: p.id,
                    name: p.name,
                    priceRaw: p.price,
                    price: p.price > 0 ? formatCurrency(p.price) : 'Grátis',
                    features: Array.isArray(p.features) ? p.features : (() => {
                        try { return typeof p.features === 'string' ? JSON.parse(p.features) : []; } catch { return []; }
                    })(),
                    highlight: p.isRecommended,
                    icon: getPlanIcon(p.name),
                    limits: p.limits
                }))
                .filter((p: any) => !p.name.toLowerCase().includes('trial') && !p.name.toLowerCase().includes('teste'));
            setPlans(formatted);
        } catch (err) {
            console.error('Failed to fetch plans', err);
        } finally {
            setLoadingPlans(false);
        }
    };

    const overdueInvoices = useMemo(
        () => invoices
            .filter((inv: any) => inv.status === 'OVERDUE')
            .sort((a: any, b: any) => new Date(a.referenceStart || a.createdAt).getTime() - new Date(b.referenceStart || b.createdAt).getTime()),
        [invoices]
    );

    const overdueTotal = useMemo(
        () => overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0),
        [overdueInvoices]
    );

    const filteredInvoices = useMemo(() => {
        const sorted = [...invoices].sort((a: any, b: any) =>
            new Date(b.referenceStart || b.createdAt).getTime() - new Date(a.referenceStart || a.createdAt).getTime()
        );
        if (invoiceFilter === 'all') return sorted;
        if (invoiceFilter === 'overdue') return sorted.filter((i: any) => i.status === 'OVERDUE');
        if (invoiceFilter === 'pending') return sorted.filter((i: any) => i.status === 'PENDING');
        if (invoiceFilter === 'paid') return sorted.filter((i: any) => i.status === 'PAID');
        return sorted;
    }, [invoices, invoiceFilter]);

    const isFree = userData.plan === 'Plano Grátis' || userData.plan?.toLowerCase?.().includes('free');
    const isTrial = userData.planType === 'TRIAL';
    const isCancelled = userData.companyStatus === 'CANCELLED';
    const isSuspended = userData.companyStatus === 'SUSPENDED';
    const hasExpired = userData.expiresAt ? new Date(userData.expiresAt).getTime() < Date.now() : false;

    const daysUntilRenewal = useMemo(() => {
        if (!userData.expiresAt) return null;
        return daysBetween(new Date(userData.expiresAt), new Date());
    }, [userData.expiresAt]);

    const openPayInvoice = (inv: any) => {
        if (!userData.planId || !userData.planPrice) {
            notify('Dados do plano indisponíveis. Recarregue a página.', 'error');
            return;
        }
        setPaymentContext({
            plan: {
                id: userData.planId,
                name: userData.plan,
                priceRaw: userData.planPrice
            },
            invoice: inv
        });
        setActiveView('payment');
    };

    const openUpgradePlan = (plan: any) => {
        if (plan.priceRaw === 0) { onBack(); return; }
        setPaymentContext({
            plan: {
                id: plan.id,
                name: plan.name,
                priceRaw: plan.priceRaw,
                features: plan.features
            }
        });
        setActiveView('payment');
    };

    const handlePaymentSuccess = () => {
        setPaymentSuccess(true);
        notify('Pagamento confirmado! Atualizando sua conta…', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 2200);
    };

    const handleCancelSubscription = async () => {
        setCancelling(true);
        try {
            await api.post('/payments/cancel_subscription', {
                reason: cancelReason || undefined,
                detail: cancelDetail.trim() || undefined,
            });
            setConfirmCancel(false);
            setCancelReason(null);
            setCancelDetail('');
            notify('Assinatura cancelada. Você mantém acesso até o fim do período pago.', 'success');
            setTimeout(() => window.location.reload(), 1800);
        } catch (err) {
            notify('Erro ao cancelar assinatura. Tente novamente ou contate o suporte.', 'error');
        } finally {
            setCancelling(false);
        }
    };

    if (paymentSuccess) {
        return (
            <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0e1014] flex flex-col items-center justify-center animate-in fade-in duration-300">
                <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 relative z-10">
                        <Check className="w-10 h-10 text-white stroke-[3px]" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Pagamento confirmado!</h2>
                <p className="text-slate-500 text-sm">Atualizando sua conta...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100000] bg-slate-50 dark:bg-[#0e1014] overflow-auto animate-in fade-in duration-200">
            {/* Top Bar */}
            <div className="sticky top-0 z-20 bg-white dark:bg-[#1a1d23] border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar ao Dashboard
                    </button>
                    <div className="text-xs text-slate-400">
                        {userData.email || userData.username}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Minha Conta</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie sua assinatura, faturas e forma de pagamento.</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
                    {/* Sidebar Nav */}
                    <nav className="lg:w-60 flex-shrink-0">
                        <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                            <SidebarItem icon={User} label="Visão geral" active={activeView === 'overview'} onClick={() => setActiveView('overview')} />
                            <SidebarItem
                                icon={Receipt}
                                label="Faturas"
                                active={activeView === 'invoices'}
                                onClick={() => setActiveView('invoices')}
                                badge={overdueInvoices.length > 0 ? overdueInvoices.length : undefined}
                                badgeTone="danger"
                            />
                            <SidebarItem icon={CreditCard} label="Trocar plano" active={activeView === 'plans'} onClick={() => setActiveView('plans')} />
                        </ul>

                        {!isFree && !isTrial && !isCancelled && (
                            <div className="hidden lg:block mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    onClick={() => setConfirmCancel(true)}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                >
                                    Cancelar assinatura
                                </button>
                            </div>
                        )}
                    </nav>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        {activeView === 'overview' && (
                            <OverviewView
                                userData={userData}
                                invoices={invoices}
                                overdueInvoices={overdueInvoices}
                                overdueTotal={overdueTotal}
                                isFree={isFree}
                                isTrial={isTrial}
                                isCancelled={isCancelled}
                                isSuspended={isSuspended}
                                hasExpired={hasExpired}
                                daysUntilRenewal={daysUntilRenewal}
                                onNavigate={setActiveView}
                                onPayInvoice={openPayInvoice}
                            />
                        )}

                        {activeView === 'invoices' && (
                            <InvoicesView
                                invoices={filteredInvoices}
                                totalInvoices={invoices.length}
                                loading={loadingInvoices}
                                filter={invoiceFilter}
                                onFilterChange={setInvoiceFilter}
                                onRefresh={fetchInvoices}
                                onPayInvoice={openPayInvoice}
                                onShowPix={setPixPopover}
                                overdueCount={overdueInvoices.length}
                            />
                        )}

                        {activeView === 'plans' && (
                            <PlansView
                                plans={plans}
                                loading={loadingPlans}
                                currentPlanId={userData.planId}
                                currentPlanName={userData.plan}
                                companyStatus={userData.companyStatus}
                                onSelectPlan={openUpgradePlan}
                            />
                        )}

                        {activeView === 'payment' && paymentContext && (
                            <PaymentView
                                plan={paymentContext.plan}
                                invoice={paymentContext.invoice}
                                remainingAfter={paymentContext.invoice ? {
                                    count: overdueInvoices.length - 1,
                                    total: overdueTotal - (paymentContext.invoice.amount || 0)
                                } : null}
                                email={userData.email}
                                onSuccess={handlePaymentSuccess}
                                onCancel={() => { setPaymentContext(null); setActiveView(paymentContext.invoice ? 'invoices' : 'plans'); }}
                            />
                        )}
                    </main>
                </div>
            </div>

            {/* PIX popover for pending invoices with existing QR */}
            {pixPopover && (
                <PixPopover invoice={pixPopover} onClose={() => setPixPopover(null)} />
            )}

            {/* Cancel confirmation modal — with reason picker for retention */}
            {confirmCancel && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Cancelar assinatura?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                            Você mantém acesso até <span className="font-bold text-slate-700 dark:text-slate-200">{formatDate(userData.expiresAt)}</span>. Depois disso, a conta é suspensa e dados podem ser arquivados após 90 dias.
                        </p>

                        <div className="mb-5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                O que motivou a saída?
                            </label>
                            <div className="space-y-1.5">
                                {CANCEL_REASONS.map(r => (
                                    <label
                                        key={r.id}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${cancelReason === r.id
                                            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-500/50'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="cancel-reason"
                                            checked={cancelReason === r.id}
                                            onChange={() => setCancelReason(r.id)}
                                            className="accent-emerald-500"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-200">{r.label}</span>
                                    </label>
                                ))}
                            </div>

                            {cancelReason && (
                                <textarea
                                    value={cancelDetail}
                                    onChange={(e) => setCancelDetail(e.target.value)}
                                    rows={2}
                                    maxLength={300}
                                    placeholder="Quer detalhar? (opcional)"
                                    className="mt-3 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#22262e] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                                />
                            )}
                        </div>

                        {cancelReason === 'temp_pause' && (
                            <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 flex gap-2.5">
                                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                    Para pausar sem perder o cadastro, considere fazer downgrade para o Plano Grátis. Você mantém os dados e pode voltar quando quiser.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => { setConfirmCancel(false); setCancelReason(null); setCancelDetail(''); }}
                                disabled={cancelling}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 disabled:opacity-50"
                            >
                                Manter assinatura
                            </button>
                            <button
                                onClick={handleCancelSubscription}
                                disabled={cancelling || !cancelReason}
                                title={!cancelReason ? 'Selecione um motivo' : undefined}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Local toaster (used when no global showToast was passed) */}
            {localToast && (
                <div className="fixed bottom-6 right-6 z-[99999] animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl max-w-sm ${localToast.type === 'success' ? 'bg-emerald-600 text-white' :
                        localToast.type === 'error' ? 'bg-red-600 text-white' :
                            'bg-slate-900 text-white'
                        }`}>
                        {localToast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> :
                            localToast.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> :
                                <Info className="w-5 h-5 shrink-0 mt-0.5" />}
                        <p className="text-sm font-medium leading-snug">{localToast.msg}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// PIX popover with inline copy feedback (no more alert)
const PixPopover: React.FC<{ invoice: any; onClose: () => void }> = ({ invoice, onClose }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(invoice.qrCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard pode falhar em contexto não-secure */
        }
    };
    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">QR Code Pix</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Fatura pendente — escaneie para pagar</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X className="w-4 h-4 text-slate-500" />
                    </button>
                </div>
                <div className="flex flex-col items-center">
                    <div className="bg-white p-3 rounded-xl border-4 border-emerald-50 mb-4">
                        <img src={`data:image/png;base64,${invoice.qrCodeBase64}`} alt="QR Code Pix" className="w-40 h-40 object-contain" />
                    </div>
                    <button
                        onClick={handleCopy}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors ${copied
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
                            }`}
                    >
                        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado!' : 'Copiar Copia e Cola'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// -------------------- SIDEBAR ITEM --------------------
const SidebarItem: React.FC<{
    icon: React.FC<any>;
    label: string;
    active: boolean;
    onClick: () => void;
    badge?: number;
    badgeTone?: 'danger' | 'neutral';
}> = ({ icon: Icon, label, active, onClick, badge, badgeTone = 'neutral' }) => (
    <li>
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${active
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
        >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${badgeTone === 'danger' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                    {badge}
                </span>
            )}
        </button>
    </li>
);

// -------------------- OVERVIEW VIEW --------------------
interface OverviewViewProps {
    userData: BillingPageProps['userData'];
    invoices: any[];
    overdueInvoices: any[];
    overdueTotal: number;
    isFree: boolean;
    isTrial: boolean;
    isCancelled: boolean;
    isSuspended: boolean;
    hasExpired: boolean;
    daysUntilRenewal: number | null;
    onNavigate: (view: ViewKey) => void;
    onPayInvoice: (inv: any) => void;
}

const OverviewView: React.FC<OverviewViewProps> = ({
    userData, overdueInvoices, overdueTotal, isFree, isTrial, isCancelled, isSuspended, hasExpired, daysUntilRenewal, onNavigate, onPayInvoice
}) => {
    const statusLabel = isCancelled ? 'Cancelada' : isSuspended ? 'Suspensa' : isTrial ? 'Período de teste' : isFree ? 'Gratuito' : hasExpired ? 'Expirada' : 'Ativa';
    const statusTone = isCancelled || isSuspended || hasExpired ? 'red' : isTrial ? 'amber' : isFree ? 'slate' : 'emerald';

    return (
        <div className="space-y-6">
            {/* Overdue alert — top priority */}
            {overdueInvoices.length > 0 && (
                <div className="rounded-2xl border-2 border-red-200 dark:border-red-800/60 bg-red-50/70 dark:bg-red-950/30 overflow-hidden">
                    <div className="p-5 sm:p-6 flex items-start gap-4">
                        <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-red-700 dark:text-red-400">
                                {overdueInvoices.length === 1 ? 'Você tem 1 fatura em atraso' : `Você tem ${overdueInvoices.length} faturas em atraso`}
                            </h3>
                            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-0.5">
                                Débito total: <span className="font-bold">{formatCurrency(overdueTotal)}</span>. Regularize para manter o acesso.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <button
                                    onClick={() => onPayInvoice(overdueInvoices[0])}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Pagar fatura mais antiga ({formatCurrency(overdueInvoices[0].amount)})
                                </button>
                                <button
                                    onClick={() => onNavigate('invoices')}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-400 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                    Ver todas as faturas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Plan card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a1d23] overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Plano atual</p>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{userData.plan}</h2>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusTone === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' :
                            statusTone === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' :
                                statusTone === 'slate' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusTone === 'red' ? 'bg-red-500' : statusTone === 'amber' ? 'bg-amber-500' : statusTone === 'slate' ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                            {statusLabel}
                        </span>
                    </div>
                </div>

                <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                    {userData.planPrice !== undefined && userData.planPrice > 0 && (
                        <div className="px-5 sm:px-6 py-3.5 flex items-center justify-between">
                            <dt className="text-sm text-slate-500 dark:text-slate-400">Mensalidade</dt>
                            <dd className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(userData.planPrice)}</dd>
                        </div>
                    )}
                    <div className="px-5 sm:px-6 py-3.5 flex items-center justify-between">
                        <dt className="text-sm text-slate-500 dark:text-slate-400">
                            {isCancelled ? 'Acesso até' : isTrial ? 'Trial expira em' : 'Próxima cobrança'}
                        </dt>
                        <dd className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatDate(userData.expiresAt)}
                            {daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 7 && (
                                <span className="ml-2 text-xs font-semibold text-amber-600">
                                    em {daysUntilRenewal} {daysUntilRenewal === 1 ? 'dia' : 'dias'}
                                </span>
                            )}
                        </dd>
                    </div>
                    <div className="px-5 sm:px-6 py-3.5 flex items-center justify-between">
                        <dt className="text-sm text-slate-500 dark:text-slate-400">ID da empresa</dt>
                        <dd className="text-xs font-mono text-slate-600 dark:text-slate-400">{userData.companyId}</dd>
                    </div>
                </dl>

                <div className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-[#1a1d23] border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                    <button
                        onClick={() => onNavigate('plans')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                    >
                        <Sparkles className="w-4 h-4" />
                        {isFree || isTrial ? 'Fazer upgrade' : 'Trocar de plano'}
                    </button>
                    <button
                        onClick={() => onNavigate('invoices')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold"
                    >
                        <Receipt className="w-4 h-4" />
                        Ver faturas
                    </button>
                </div>
            </div>

            {/* Security badge */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-slate-900 dark:text-white">Pagamento seguro.</span> Processado pela Stripe e Mercado Pago (PCI DSS Nível 1). Nunca armazenamos dados do seu cartão.
                </div>
            </div>
        </div>
    );
};

// -------------------- INVOICES VIEW --------------------
interface InvoicesViewProps {
    invoices: any[];
    totalInvoices: number;
    loading: boolean;
    filter: InvoiceFilter;
    onFilterChange: (f: InvoiceFilter) => void;
    onRefresh: () => void;
    onPayInvoice: (inv: any) => void;
    onShowPix: (inv: any) => void;
    overdueCount: number;
}

const InvoicesView: React.FC<InvoicesViewProps> = ({ invoices, totalInvoices, loading, filter, onFilterChange, onRefresh, onPayInvoice, onShowPix, overdueCount }) => {
    const filters: { key: InvoiceFilter; label: string; count?: number }[] = [
        { key: 'all', label: 'Todas', count: totalInvoices },
        { key: 'overdue', label: 'Em atraso', count: overdueCount },
        { key: 'pending', label: 'Pendentes' },
        { key: 'paid', label: 'Pagas' }
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Histórico de faturas</h2>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Filter pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {filters.map(f => (
                    <button
                        key={f.key}
                        onClick={() => onFilterChange(f.key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filter === f.key
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        {f.label}
                        {f.count !== undefined && f.count > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                {f.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="py-16 flex flex-col items-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mb-2" />
                    <span className="text-sm">Carregando histórico…</span>
                </div>
            ) : invoices.length === 0 ? (
                <div className="py-16 flex flex-col items-center text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/60">
                    <Receipt className="w-10 h-10 text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">Nenhuma fatura encontrada</h4>
                    <p className="text-xs text-slate-400 mt-1">
                        {filter === 'all' ? 'Seu histórico aparecerá aqui.' : 'Nenhuma fatura nesse filtro.'}
                    </p>
                </div>
            ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#1a1d23]">
                    {invoices.map((inv) => (
                        <InvoiceRow
                            key={inv.id}
                            invoice={inv}
                            onPay={onPayInvoice}
                            onShowPix={onShowPix}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// -------------------- INVOICE ROW --------------------
const InvoiceRow: React.FC<{ invoice: any; onPay: (inv: any) => void; onShowPix: (inv: any) => void }> = ({ invoice, onPay, onShowPix }) => {
    const status = invoice.status as string;
    const isOverdue = status === 'OVERDUE';
    const isPending = status === 'PENDING';
    const isPaid = status === 'PAID';
    const isExpired = status === 'EXPIRED';

    const statusConfig = {
        PAID: { label: 'Paga', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
        OVERDUE: { label: 'Em atraso', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
        PENDING: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
        EXPIRED: { label: 'Expirada', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
        CANCELLED: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
    } as const;
    const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.EXPIRED;

    return (
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{invoice.planName || 'Assinatura'}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`}>
                        {cfg.label}
                    </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                    <span>{formatPeriod(invoice)}</span>
                    {invoice.paymentMethod && (
                        <>
                            <span>·</span>
                            <span className="capitalize">{String(invoice.paymentMethod).replace('_', ' ').toLowerCase()}</span>
                        </>
                    )}
                    {invoice.paidAt && isPaid && (
                        <>
                            <span>·</span>
                            <span>pago em {formatDate(invoice.paidAt)}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 sm:min-w-[200px]">
                <span className={`font-black text-lg ${isOverdue ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                    {formatCurrency(invoice.amount)}
                </span>
                <div className="flex gap-2">
                    {invoice.paymentMethod === 'PIX' && isPending && invoice.qrCodeBase64 && (
                        <button
                            onClick={() => onShowPix(invoice)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                        >
                            <ScanLine className="w-3.5 h-3.5" />
                            Ver QR
                        </button>
                    )}
                    {isOverdue && (
                        <button
                            onClick={() => onPay(invoice)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                        >
                            <CreditCard className="w-3.5 h-3.5" />
                            Pagar
                        </button>
                    )}
                    {isPending && !(invoice.paymentMethod === 'PIX' && invoice.qrCodeBase64) && (
                        <button
                            onClick={() => onPay(invoice)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                        >
                            <CreditCard className="w-3.5 h-3.5" />
                            Pagar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// -------------------- PLANS VIEW --------------------
interface PlansViewProps {
    plans: any[];
    loading: boolean;
    currentPlanId?: string;
    currentPlanName?: string;
    companyStatus?: string;
    onSelectPlan: (plan: any) => void;
}

const PlansView: React.FC<PlansViewProps> = ({ plans, loading, currentPlanId, currentPlanName, companyStatus, onSelectPlan }) => {
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-700/30 p-6 animate-pulse bg-white dark:bg-[#1a1d23]">
                        <div className="h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-lg mb-4" />
                        <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
                        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-6" />
                        <div className="space-y-3">
                            {[1, 2, 3].map(j => <div key={j} className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-full" />)}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Capitalize name if it comes in ALL CAPS from the backend — keeps visual consistency
    const normalizeName = (name: string): string => {
        if (!name) return '';
        const allCaps = name === name.toUpperCase() && /[A-Z]/.test(name);
        if (!allCaps) return name;
        return name
            .toLowerCase()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    };

    // Cap grid at 3 columns — with 4+ plans, creates balanced rows (3+1, 3+2) instead of orphans
    const gridCols = plans.length === 1
        ? 'grid-cols-1 max-w-sm'
        : plans.length === 2
            ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Escolha seu plano</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Faça upgrade, troque ou reative sua assinatura. Cobrança mensal recorrente.</p>
            </div>

            <div className={`grid gap-5 pt-3 ${gridCols}`}>
                {plans.map((plan: any) => {
                    const isExpiredOrCancelled = companyStatus === 'SUSPENDED' || companyStatus === 'CANCELLED';
                    const isCurrent = !isExpiredOrCancelled && ((currentPlanId && currentPlanId === plan.id) || (currentPlanName && currentPlanName.trim().toLowerCase() === plan.name.trim().toLowerCase()));
                    const isFree = plan.priceRaw === 0;
                    const PlanIcon = plan.icon;
                    const displayName = normalizeName(plan.name);
                    const features = (plan.features || []).filter((f: string) => f && f.trim().length > 0);

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-2xl border flex flex-col bg-white dark:bg-[#1a1d23] transition-all ${plan.highlight
                                ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                                : isCurrent
                                    ? 'border-slate-300 dark:border-slate-600 ring-1 ring-slate-300/50 dark:ring-slate-600/30'
                                    : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                        >
                            {/* Top ribbon — single badge at top, never overlaps icon */}
                            {(plan.highlight || isCurrent) && (
                                <div className={`px-4 py-1.5 rounded-t-2xl text-center text-[10px] font-bold uppercase tracking-wider ${plan.highlight
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-700 dark:bg-slate-600 text-white'
                                    }`}>
                                    {plan.highlight ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> Recomendado
                                        </span>
                                    ) : (
                                        'Plano atual'
                                    )}
                                </div>
                            )}

                            <div className="p-5 flex flex-col flex-1">
                                {/* Header: icon + name */}
                                <div className="mb-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${plan.highlight ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                        <PlanIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{displayName}</h3>
                                </div>

                                {/* Price */}
                                <div className="mb-5 pb-5 border-b border-slate-100 dark:border-slate-800">
                                    {isFree ? (
                                        <span className="text-3xl font-extrabold text-slate-900 dark:text-white">Grátis</span>
                                    ) : (
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-medium text-slate-400">R$</span>
                                            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                                                {plan.priceRaw.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-sm text-slate-400 font-medium">/mês</span>
                                        </div>
                                    )}
                                </div>

                                {/* Features — always present to keep card heights consistent */}
                                <ul className="space-y-2.5 mb-6 flex-1 min-h-[8rem]">
                                    {features.length > 0 ? features.map((feature: string, idx: number) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-[13px] text-slate-600 dark:text-slate-300">
                                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} />
                                            <span className="leading-snug">{feature}</span>
                                        </li>
                                    )) : (
                                        <li className="text-[13px] text-slate-400 italic">Recursos básicos inclusos</li>
                                    )}
                                </ul>

                                {/* CTA */}
                                {isCurrent ? (
                                    <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                            Sua assinatura
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => onSelectPlan(plan)}
                                        className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all ${isFree
                                            ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                            : plan.highlight
                                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                                                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
                                            }`}
                                    >
                                        {isFree ? 'Selecionar' : 'Assinar agora'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// -------------------- PAYMENT VIEW --------------------
interface PaymentViewProps {
    plan: { id: string; name: string; priceRaw: number; features?: string[] };
    invoice?: any;
    remainingAfter?: { count: number; total: number } | null;
    email?: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const PaymentView: React.FC<PaymentViewProps> = ({ plan, invoice, remainingAfter, email, onSuccess, onCancel }) => {
    return (
        <div className="space-y-4">
            <button
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar
            </button>

            {invoice && (
                <div className="rounded-2xl border-2 border-red-200 dark:border-red-800/60 bg-red-50/60 dark:bg-red-950/30 p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                        <p className="font-bold text-red-700 dark:text-red-400">Pagando fatura em atraso</p>
                        <p className="text-xs text-red-600/80 dark:text-red-400/80">
                            Período {formatPeriod(invoice)} · {formatCurrency(invoice.amount)}
                        </p>
                    </div>
                </div>
            )}

            <UpgradePaymentForm
                plan={plan}
                email={email}
                selectedInvoice={invoice ? { id: invoice.id, amount: invoice.amount, referenceStart: invoice.referenceStart, referenceEnd: invoice.referenceEnd, createdAt: invoice.createdAt } : null}
                remainingAfter={remainingAfter}
                onSuccess={onSuccess}
                onCancel={onCancel}
            />
        </div>
    );
};
