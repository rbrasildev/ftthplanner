
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';
import { LogOut, LayoutDashboard, Building2, CreditCard, ChevronRight, CheckCircle2, AlertTriangle, Search, Network, Settings, BarChart3, X, Trash2, Users, Shield, Lock, RotateCcw, Eye, Activity, Zap, Server, Clock, Play, Monitor, Mail, Send, Map, UserCheck, HeartPulse, ChevronLeft, ChevronDown, Sun, Moon, Languages, MessageSquare, Receipt, RefreshCw, Calendar, TrendingUp, Wallet, CalendarClock, Palette, Globe, Share2, Image as ImageIcon, FileDown } from 'lucide-react';
import * as saasService from '../../services/saasService';
import api from '../../services/api';
import { isSubscriptionExpired, toBRDateMidnight } from '../../utils/subscriptionUtils';
import { getEffectiveLimits } from '../../utils/limitsUtils';
import { SaasAnalytics } from './SaasAnalytics';
import { SaasGlobalMap } from './SaasGlobalMap';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';
import { SendTemplateModal } from './modals/SendTemplateModal';
import { SaasRetentionIntelligence } from './SaasRetentionIntelligence';
import { SupportAdminPanel } from './SupportAdminPanel';
import { SaasAuditLogs } from './SaasAuditLogs';
import { SaasDashboard } from './SaasDashboard';

interface Company {
    id: string;
    name: string;
    status: string;
    plan?: {
        id: string;
        name: string;
        price: number;
        type?: string; // 'STANDARD' | 'TRIAL' | 'FREE' etc.
        limits: {
            maxProjects?: number;
            maxUsers?: number;
            maxCTOs?: number;
            maxPOPs?: number;
        }
    };
    planId?: string;
    users?: { id: string; username: string; role: string; lastLoginAt?: string; createdAt?: string }[];
    projects?: { id: string; name: string }[];
    _count: { projects: number; users: number; ctos?: number; pops?: number };
    createdAt: string;
    subscriptionExpiresAt?: string;
    customLimits?: {
        maxProjects?: number;
        maxUsers?: number;
        maxCTOs?: number;
        maxPOPs?: number;
    } | null;
    phone?: string;
    logoUrl?: string;
    cnpj?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    businessEmail?: string;
    website?: string;
    paymentMethod?: string;
}

interface Plan {
    id: string;
    name: string;
    price: number;
    limits: {
        maxProjects?: number;
        maxUsers?: number;
        maxCTOs?: number;
        maxPOPs?: number;
    };

    features?: string[];
    isRecommended?: boolean;
    priceYearly?: number;
}

interface User {
    id: string;
    username: string;
    email?: string;
    role: string;
    active: boolean;
    companyId?: string;
    company?: { id: string; name: string };
    createdAt: string;
}

interface SaaSConfig {
    id: string;
    appName: string;
    appLogoUrl: string | null;
    faviconUrl: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
    websiteUrl: string | null;
    appDescription?: string | null;
    appKeywords?: string | null;
    copyrightText?: string | null;
    ctaBgImageUrl?: string | null;
    footerDesc?: string | null;
    heroPreviewUrl?: string | null;
    ogImageUrl?: string | null;
    socialFacebook?: string | null;
    socialInstagram?: string | null;
    socialLinkedin?: string | null;
    socialTwitter?: string | null;
    socialYoutube?: string | null;
}

// --- Custom Limits Editor (per-company override of plan limits) ---
// Hidden by default behind a button. When the admin enables it, shows 4
// inputs (one per limit). Empty input means "fall through to plan default".
// Saving sends only the keys that have a numeric value; empty keys are
// dropped, so the company falls back to the plan limit for those.
const CustomLimitsEditor: React.FC<{
    company: Company;
    onSave: (newLimits: Record<string, number> | null) => Promise<void> | void;
}> = ({ company, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const planLimits = company.plan?.limits || {};
    const initial = company.customLimits || {};
    const [values, setValues] = useState<Record<string, string>>({
        maxProjects: initial.maxProjects?.toString() ?? '',
        maxUsers: initial.maxUsers?.toString() ?? '',
        maxCTOs: initial.maxCTOs?.toString() ?? '',
        maxPOPs: initial.maxPOPs?.toString() ?? '',
    });

    const fields: { key: keyof typeof planLimits; label: string }[] = [
        { key: 'maxProjects', label: 'Projetos' },
        { key: 'maxUsers', label: 'Usuários' },
        { key: 'maxCTOs', label: 'CTOs' },
        { key: 'maxPOPs', label: 'POPs' },
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            // Build the override object: only include keys with a real number
            const overrides: Record<string, number> = {};
            for (const { key } of fields) {
                const raw = values[key as string];
                if (raw !== '' && raw != null) {
                    const n = Number(raw);
                    if (Number.isFinite(n) && n >= 0) {
                        overrides[key as string] = Math.floor(n);
                    }
                }
            }
            // Empty object → null so the row clears all overrides
            await onSave(Object.keys(overrides).length > 0 ? overrides : null);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Remover todos os limites personalizados? A empresa voltará a usar os limites do plano.')) return;
        setSaving(true);
        try {
            await onSave(null);
            setValues({ maxProjects: '', maxUsers: '', maxCTOs: '', maxPOPs: '' });
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/30">
                <button
                    onClick={() => setEditing(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors"
                >
                    <Settings className="w-3.5 h-3.5" />
                    Editar limites personalizados
                </button>
            </div>
        );
    }

    return (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/30 space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">Limites personalizados</h4>
                <p className="text-[10px] text-slate-400">Vazio = usar limite do plano</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {fields.map(({ key, label }) => {
                    const planValue = (planLimits as any)[key];
                    const isUnlimited = planValue && planValue >= 999999;
                    return (
                        <div key={key as string}>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</label>
                            <input
                                type="number"
                                min="0"
                                value={values[key as string]}
                                onChange={(e) => setValues(prev => ({ ...prev, [key as string]: e.target.value }))}
                                placeholder={isUnlimited ? 'Ilimitado' : (planValue?.toString() ?? '—')}
                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#22262e] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                    Cancelar
                </button>
                {company.customLimits && Object.keys(company.customLimits).length > 0 && (
                    <button
                        onClick={handleClearAll}
                        disabled={saving}
                        className="px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
                        title="Remover todos os limites personalizados"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
};

// Maps stored paymentMethod codes to user-friendly PT-BR labels.
// CREDIT_CARD/STRIPE both come from the Stripe flow (legacy invoices may have
// either) — surface them as the same thing to the user.
const formatPaymentMethod = (method: string | null | undefined): string => {
    switch ((method || '').toUpperCase()) {
        case 'PIX': return 'Pix';
        case 'CREDIT_CARD':
        case 'STRIPE': return 'Cartão de Crédito';
        case 'MANUAL': return 'Manual';
        case 'BOLETO': return 'Boleto';
        default: return method || '—';
    }
};

// --- Company Invoices Section (used in company detail panel) ---
const CompanyInvoicesSection: React.FC<{ companyId: string, financial?: { overdueCount: number, overdueTotal: number, paidCount: number, paidTotal: number, lastPayment: string | null } }> = ({ companyId, financial }) => {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [markingPaid, setMarkingPaid] = useState<string | null>(null);

    const handleMarkPaid = async (invoiceId: string) => {
        if (!window.confirm('Confirma a baixa manual desta fatura?')) return;
        setMarkingPaid(invoiceId);
        try {
            const result = await saasService.markInvoicePaid(invoiceId);
            // Refresh the list
            const data = await saasService.getCompanyInvoices(companyId);
            setInvoices(data);
            alert(result.companyReactivated
                ? 'Fatura quitada! Empresa reativada.'
                : `Fatura quitada! Ainda restam ${result.remainingOverdue} fatura(s) em atraso.`);
        } catch (err) {
            console.error('Failed to mark invoice as paid', err);
            alert('Erro ao dar baixa na fatura.');
        } finally {
            setMarkingPaid(null);
        }
    };

    const loadInvoices = async () => {
        if (invoices.length > 0) { setExpanded(!expanded); return; }
        setLoading(true);
        try {
            const data = await saasService.getCompanyInvoices(companyId);
            setInvoices(data);
            setExpanded(true);
        } catch (err) {
            console.error('Failed to load invoices', err);
            alert('Failed to load invoices');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5" />
                    Financeiro
                </h3>
                <button
                    onClick={loadInvoices}
                    className="text-[10px] font-bold text-emerald-500 hover:text-emerald-600 flex items-center gap-1"
                >
                    {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : expanded ? 'Ocultar' : 'Ver faturas'}
                </button>
            </div>

            {/* Quick Summary */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2.5 bg-slate-50 dark:bg-[#151820] rounded-lg border border-slate-100 dark:border-slate-700/30 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Pagos</p>
                    <p className="text-sm font-black text-emerald-600">{financial?.paidCount || 0}</p>
                </div>
                <div className={`p-2.5 rounded-lg border text-center ${financial?.overdueCount ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-[#151820] border-slate-100 dark:border-slate-700/30'}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Em atraso</p>
                    <p className={`text-sm font-black ${financial?.overdueCount ? 'text-red-600' : 'text-slate-400'}`}>{financial?.overdueCount || 0}</p>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-[#151820] rounded-lg border border-slate-100 dark:border-slate-700/30 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Débito</p>
                    <p className={`text-sm font-black ${financial?.overdueTotal ? 'text-red-600' : 'text-slate-400'}`}>
                        {financial?.overdueTotal ? `R$ ${financial.overdueTotal.toFixed(2)}` : '—'}
                    </p>
                </div>
            </div>

            {financial?.lastPayment && (
                <p className="text-[10px] text-slate-400 mb-3">
                    Último pagamento: <span className="font-semibold text-slate-600 dark:text-slate-300">{new Date(financial.lastPayment).toLocaleDateString()}</span>
                </p>
            )}

            {/* Invoice List (expandable) */}
            {expanded && (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    {invoices.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma fatura encontrada</p>
                    ) : invoices.map((inv: any) => {
                        const isOverdue = inv.status === 'OVERDUE';
                        const isPaid = inv.status === 'PAID';
                        const isPending = inv.status === 'PENDING';
                        // Authoritative `paidAt` (set when status flipped to PAID); falls back to
                        // `updatedAt` for legacy rows that pre-date the column.
                        const paidAt = isPaid ? new Date(inv.paidAt || inv.updatedAt || inv.createdAt) : null;
                        // Days late: how many days past the due date the customer is currently
                        const daysLate = isOverdue && inv.expiresAt
                            ? Math.max(0, Math.floor((Date.now() - new Date(inv.expiresAt).getTime()) / (1000 * 60 * 60 * 24)))
                            : 0;
                        return (
                            <div key={inv.id} className={`p-3 rounded-lg border text-xs ${isOverdue ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-[#151820] border-slate-100 dark:border-slate-700/30'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 dark:text-white">{inv.planName}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isPaid ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-red-100 text-red-700' : isPending ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {isPaid ? 'Pago' : isOverdue ? 'Atraso' : isPending ? 'Pendente' : inv.status}
                                        </span>
                                    </div>
                                    <span className={`font-black ${isOverdue ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                        R$ {inv.amount?.toFixed(2)}
                                    </span>
                                </div>

                                {/* Period + payment method */}
                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                    {inv.referenceStart && inv.referenceEnd ? (
                                        <span>Ref: {new Date(inv.referenceStart).toLocaleDateString('pt-BR')} → {new Date(inv.referenceEnd).toLocaleDateString('pt-BR')}</span>
                                    ) : (
                                        <span>Criada: {new Date(inv.createdAt).toLocaleDateString('pt-BR')}</span>
                                    )}
                                    <span>•</span>
                                    <span>{formatPaymentMethod(inv.paymentMethod)}</span>
                                </div>

                                {/* Status-specific second line */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[10px]">
                                        {isPaid && paidAt && (
                                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Pago em {paidAt.toLocaleDateString('pt-BR')} {paidAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                        {isOverdue && inv.expiresAt && (
                                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                                <AlertTriangle className="w-3 h-3" />
                                                Vencida em {new Date(inv.expiresAt).toLocaleDateString('pt-BR')} ({daysLate} dia{daysLate === 1 ? '' : 's'} de atraso)
                                            </span>
                                        )}
                                        {isPending && inv.expiresAt && (
                                            <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                                                <Clock className="w-3 h-3" />
                                                Vence em {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                    </div>
                                    {!isPaid && (
                                        <button
                                            onClick={() => handleMarkPaid(inv.id)}
                                            disabled={markingPaid === inv.id}
                                            className="ml-2 px-2 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors disabled:opacity-50 shrink-0"
                                        >
                                            {markingPaid === inv.id ? '...' : 'Dar baixa'}
                                        </button>
                                    )}
                                </div>
                                {/* Stripe failure detail — only shows when present (i.e. card was declined) */}
                                {inv.failureMessage && !isPaid && (
                                    <div className="mt-1.5 px-2 py-1 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-[10px] text-red-700 dark:text-red-300">
                                        <span className="font-bold">Erro do cartão:</span> {inv.failureMessage}
                                        {inv.failedAt && (
                                            <span className="ml-1 opacity-75">
                                                ({new Date(inv.failedAt).toLocaleDateString('pt-BR')} {new Date(inv.failedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const SaasAdminPage: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeView, setActiveView] = useState<'dashboard' | 'companies' | 'plans' | 'audit' | 'analytics' | 'global_map' | 'users' | 'videos' | 'email' | 'config' | 'retention' | 'support_chat' | 'trash'>(() => {
        return (localStorage.getItem('saasAdminActiveView') as any) || 'dashboard';
    });
    const [plans, setPlans] = useState<any[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [smtpConfig, setSmtpConfig] = useState<any>({});
    const [templates, setTemplates] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [saasConfig, setSaasConfig] = useState<SaaSConfig | null>(null);
    const [deletedProjects, setDeletedProjects] = useState<any[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('saasAdminSidebarCollapsed') === 'true';
    });
    const { toggleTheme } = useTheme();
    const { setLanguage, language } = useLanguage();
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [companyDetailTab, setCompanyDetailTab] = useState<'overview' | 'financial'>('overview');

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [planFilter, setPlanFilter] = useState('ALL');
    type QuickFilter = 'expiring' | 'overdue' | 'inactive' | 'trial' | null;
    const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
    // Paginação client-side. Mais de ~50 empresas vira lista quilométrica sem isso.
    const COMPANY_PAGE_SIZE = 25;
    const [companiesVisible, setCompaniesVisible] = useState(COMPANY_PAGE_SIZE);
    useEffect(() => { setCompaniesVisible(COMPANY_PAGE_SIZE); }, [searchTerm, statusFilter, planFilter, quickFilter]);

    // Contador de conversas de suporte com mensagem pendente (última msg do
    // cliente, não do admin). Polled a cada 30s pra alimentar o badge do menu.
    const [unreadSupportCount, setUnreadSupportCount] = useState(0);
    useEffect(() => {
        let alive = true;
        const compute = async () => {
            try {
                const res = await api.get('/support/chat/conversations');
                if (!alive) return;
                const count = (res.data || []).filter((c: any) =>
                    c.status === 'OPEN' &&
                    c.messages?.[0]?.senderId === c.userId
                ).length;
                setUnreadSupportCount(count);
            } catch { /* silencioso — não bloqueia o admin */ }
        };
        compute();
        const interval = setInterval(compute, 30000);
        return () => { alive = false; clearInterval(interval); };
    }, []);

    type SortColumn = 'name' | 'createdAt' | 'expiry' | 'financial' | 'lastActivity' | 'status';
    const [sortBy, setSortBy] = useState<{ column: SortColumn; direction: 'asc' | 'desc' }>({ column: 'createdAt', direction: 'desc' });

    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState<any>(null);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [templateToSend, setTemplateToSend] = useState<any>(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

    const [isDeletePlanModalOpen, setIsDeletePlanModalOpen] = useState(false);
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

    // Password Reset Modal State
    const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
    const [resetPasswordUserName, setResetPasswordUserName] = useState('');
    const [resetPasswordValue, setResetPasswordValue] = useState('');
    const [resetPasswordError, setResetPasswordError] = useState('');

    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title?: string; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });

    // Generic confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

    // "Cortesia" popover — rendered via portal to escape overflow-hidden ancestors.
    // Tracks anchor rect so the menu can be positioned with `position: fixed`.
    const [trustMenuTarget, setTrustMenuTarget] = useState<{
        id: string;
        name: string;
        top: number;
        right: number;
    } | null>(null);

    useEffect(() => {
        if (!trustMenuTarget) return;
        const close = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('[data-trust-menu]')) setTrustMenuTarget(null);
        };
        const dismiss = () => setTrustMenuTarget(null);
        document.addEventListener('mousedown', close);
        window.addEventListener('scroll', dismiss, true);
        window.addEventListener('resize', dismiss);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('scroll', dismiss, true);
            window.removeEventListener('resize', dismiss);
        };
    }, [trustMenuTarget]);

    const openTrustMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string, name: string) => {
        if (trustMenuTarget?.id === id) {
            setTrustMenuTarget(null);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        setTrustMenuTarget({
            id,
            name,
            top: rect.bottom + 4,
            right: window.innerWidth - rect.right,
        });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void, variant: 'danger' | 'warning' | 'info' = 'danger') => {
        setConfirmDialog({ isOpen: true, title, message, variant, onConfirm });
    };

    const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) => {
        setAlertConfig({ isOpen: true, message, type, title });
    };

    const getUsagePercentage = (current: number, max: number | undefined) => {
        if (!max || max >= 999999) return 0;
        return Math.min(Math.round((current / max) * 100), 100);
    };

    // Formats the audit log `details` object into a human-readable line.
    // When the backend resolves targetId → targetName, we display the name
    // and hide the raw UUID; otherwise falls back to a compact key:value list.
    // Helpers de formatação compartilhados pela tabela de empresas
    // ────────────────────────────────────────────────────────────
    const formatPhone = (raw?: string | null): string => {
        if (!raw) return '';
        const d = raw.replace(/\D/g, '');
        if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
        if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return raw;
    };
    const STATUS_LABEL: Record<string, string> = {
        ACTIVE: 'Ativa', TRIAL: 'Trial', SUSPENDED: 'Suspensa', CANCELLED: 'Cancelada', PAYMENT_FAILED: 'Pgto falhou',
    };
    const statusLabel = (s: string) => STATUS_LABEL[s] || s;

    const formatAuditDetails = (details: any): string => {
        if (!details || typeof details !== 'object') return 'Sem detalhes';
        const parts: string[] = [];
        const targetName = details.targetName;
        const targetType = details.targetType;
        if (targetName) {
            parts.push(targetType ? `→ ${targetName} (${targetType})` : `→ ${targetName}`);
        } else if (targetType) {
            parts.push(`alvo: ${targetType}`);
        }
        if (typeof details.count === 'number') {
            parts.push(`${details.count} ${details.count === 1 ? 'destinatário' : 'destinatários'}`);
        }
        const skip = new Set(['targetName', 'targetId', 'targetType', 'count']);
        for (const [k, v] of Object.entries(details)) {
            if (skip.has(k)) continue;
            if (v === null || v === undefined) continue;
            const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
            if (val.length > 0) parts.push(`${k}: ${val}`);
        }
        return parts.length > 0 ? parts.join(' · ') : 'Sem detalhes';
    };

    // Most-recent login across all users in a company.
    // Used as the engagement signal in the "Última atividade" column.
    const getLastActivity = (company: Company): Date | null => {
        const stamps = (company.users || [])
            .map(u => u.lastLoginAt)
            .filter((s): s is string => !!s)
            .map(s => new Date(s).getTime());
        if (stamps.length === 0) return null;
        return new Date(Math.max(...stamps));
    };

    const filteredCompanies = companies.filter(company => {
        const term = searchTerm.toLowerCase();
        // Busca expandida: nome, id, CNPJ, email business, telefone, e usuário admin
        // (primeira entrada de users). Sem isso, o admin tinha que abrir cada cartão
        // pra cruzar dados pessoais com o registro.
        const matchesSearch = !term ||
            company.name.toLowerCase().includes(term) ||
            company.id.toLowerCase().includes(term) ||
            (company.cnpj || '').toLowerCase().includes(term) ||
            (company.businessEmail || '').toLowerCase().includes(term) ||
            (company.phone || '').toLowerCase().includes(term) ||
            (company.users?.[0]?.username || '').toLowerCase().includes(term);
        const matchesStatus = statusFilter === 'ALL' || company.status === statusFilter;
        const matchesPlan = planFilter === 'ALL' || company.plan?.id === planFilter;

        let matchesQuick = true;
        if (quickFilter === 'expiring') {
            // ACTIVE companies whose subscription expires in the next 7 days (and not already expired)
            if (company.status !== 'ACTIVE' || !company.subscriptionExpiresAt) matchesQuick = false;
            else {
                const days = (new Date(company.subscriptionExpiresAt).getTime() - Date.now()) / 86400000;
                matchesQuick = days >= 0 && days <= 7;
            }
        } else if (quickFilter === 'overdue') {
            matchesQuick = ((company as any)._financial?.overdueCount || 0) > 0;
        } else if (quickFilter === 'inactive') {
            const last = getLastActivity(company);
            matchesQuick = !last || (Date.now() - last.getTime()) > 30 * 86400000;
        } else if (quickFilter === 'trial') {
            matchesQuick = company.status === 'TRIAL' || company.plan?.type === 'TRIAL';
        }

        return matchesSearch && matchesStatus && matchesPlan && matchesQuick;
    });

    // Sort key extractor — values returned must be comparable with < and >.
    // Companies with no value land at the end regardless of asc/desc.
    const getSortValue = (c: Company, col: SortColumn): string | number => {
        switch (col) {
            case 'name': return c.name.toLowerCase();
            case 'createdAt': return c.createdAt ? new Date(c.createdAt).getTime() : 0;
            case 'expiry': return c.subscriptionExpiresAt ? new Date(c.subscriptionExpiresAt).getTime() : Number.POSITIVE_INFINITY;
            case 'financial': return (c as any)._financial?.overdueTotal || 0;
            case 'lastActivity': {
                const d = getLastActivity(c);
                return d ? d.getTime() : 0;
            }
            case 'status': return c.status;
        }
    };

    const sortedCompanies = [...filteredCompanies].sort((a, b) => {
        const av = getSortValue(a, sortBy.column);
        const bv = getSortValue(b, sortBy.column);
        if (av < bv) return sortBy.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortBy.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const toggleSort = (column: SortColumn) => {
        setSortBy(prev => prev.column === column
            ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            : { column, direction: 'asc' });
    };

    // Counts for quick-filter chips. O(n) per render — fine for typical SaaS scale.
    const quickFilterCounts = {
        expiring: companies.filter(c => {
            if (c.status !== 'ACTIVE' || !c.subscriptionExpiresAt) return false;
            const days = (new Date(c.subscriptionExpiresAt).getTime() - Date.now()) / 86400000;
            return days >= 0 && days <= 7;
        }).length,
        overdue: companies.filter(c => ((c as any)._financial?.overdueCount || 0) > 0).length,
        inactive: companies.filter(c => {
            const last = getLastActivity(c);
            return !last || (Date.now() - last.getTime()) > 30 * 86400000;
        }).length,
        trial: companies.filter(c => c.status === 'TRIAL' || c.plan?.type === 'TRIAL').length,
    };

    // Formats a "há Xd / DD/MM" label and assigns a tone reflecting customer
    // engagement — green ≤7d, slate ≤30d, amber ≤90d, red older / never.
    const formatLastActivity = (date: Date | null): { label: string; toneClass: string } => {
        if (!date) return { label: 'Nunca', toneClass: 'text-red-600 dark:text-red-400' };
        const diffMs = Date.now() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffH = Math.floor(diffMs / 3600000);
        const diffD = Math.floor(diffMs / 86400000);

        let label: string;
        if (diffMin < 1) label = 'agora';
        else if (diffMin < 60) label = `há ${diffMin}min`;
        else if (diffH < 24) label = `há ${diffH}h`;
        else if (diffD < 30) label = `há ${diffD}d`;
        else label = date.toLocaleDateString();

        let toneClass: string;
        if (diffD <= 7) toneClass = 'text-emerald-600 dark:text-emerald-400';
        else if (diffD <= 30) toneClass = 'text-slate-600 dark:text-slate-300';
        else if (diffD <= 90) toneClass = 'text-amber-600 dark:text-amber-400';
        else toneClass = 'text-red-600 dark:text-red-400';

        return { label, toneClass };
    };

    const UsageBar = ({ label, current, max, color }: { label: string, current: number, max: number | undefined, color: string }) => {
        const percent = getUsagePercentage(current, max);
        const isUnlimited = !max || max >= 999999;

        return (
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500 uppercase">{label}</span>
                    <span className={percent > 90 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}>
                        {current} / {isUnlimited ? '∞' : max}
                    </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-[#22262e] rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${color}`}
                        style={{ width: `${isUnlimited ? 0 : percent}%` }}
                    />
                </div>
            </div>
        );
    };
    // ... (omitted) ...

    const navSections = [
        {
            label: null, // No label for top section
            items: [
                { id: 'dashboard', label: t('saas_nav_overview'), icon: <LayoutDashboard className="w-5 h-5" /> },
            ]
        },
        {
            label: 'Inteligência',
            items: [
                { id: 'analytics', label: t('saas_nav_analytics'), icon: <BarChart3 className="w-5 h-5" /> },
                { id: 'retention', label: t('saas_nav_retention'), icon: <HeartPulse className="w-5 h-5" /> },
                { id: 'global_map', label: t('saas_nav_global_map'), icon: <Map className="w-5 h-5" /> },
            ]
        },
        {
            label: 'Gestão',
            items: [
                { id: 'companies', label: t('saas_nav_companies'), icon: <Building2 className="w-5 h-5" /> },
                { id: 'users', label: t('saas_nav_users'), icon: <Users className="w-5 h-5" /> },
                { id: 'plans', label: t('saas_nav_plans'), icon: <CreditCard className="w-5 h-5" /> },
            ]
        },
        {
            label: 'Comunicação',
            items: [
                { id: 'videos', label: t('saas_nav_videos'), icon: <Play className="w-5 h-5" /> },
                { id: 'email', label: t('saas_nav_email'), icon: <Mail className="w-5 h-5" /> },
                { id: 'support_chat', label: 'Suporte', icon: <MessageSquare className="w-5 h-5" />, badge: unreadSupportCount },
            ]
        },
        {
            label: 'Sistema',
            items: [
                { id: 'audit', label: t('saas_nav_audit'), icon: <Activity className="w-5 h-5" /> },
                { id: 'config', label: t('saas_nav_config'), icon: <Settings className="w-5 h-5" /> },
                { id: 'trash', label: 'Lixeira', icon: <Trash2 className="w-5 h-5" /> },
            ]
        }
    ];
    // Flat list for header title lookup
    const navItems = navSections.flatMap(s => s.items);
    const [editingPlan, setEditingPlan] = useState<any>(null);

    useEffect(() => {
        localStorage.setItem('saasAdminActiveView', activeView);
        loadData();
    }, [activeView]);

    const loadData = async () => {
        try {
            if (activeView === 'audit') {
                // SaasAuditLogs gerencia o próprio fetch (com paginação e filtros).
                // Pulamos aqui pra não desperdiçar uma chamada.
            } else if (activeView === 'users') {
                const usersData = await saasService.getUsers();
                setUsers(usersData);
            } else if (activeView === 'videos') {
                const videosData = await saasService.getDemoVideos();
                setVideos(videosData);
            } else if (activeView === 'email') {
                const [smtp, temps] = await Promise.all([
                    saasService.getSmtpConfig(),
                    saasService.getEmailTemplates()
                ]);
                setSmtpConfig(smtp);
                setTemplates(temps);
            } else if (activeView === 'config') {
                const config = await saasService.getSaaSConfig();
                setSaasConfig(config);
            } else if (activeView === 'trash') {
                const projects = await saasService.getDeletedProjects();
                setDeletedProjects(projects);
            } else {
                const promises: Promise<any>[] = [
                    saasService.getCompanies(),
                    saasService.getPlans()
                ];

                if (activeView === 'dashboard') {
                    promises.push(saasService.getAuditLogs({ limit: 10 }));
                }

                const results = await Promise.all(promises);
                setCompanies(results[0]);
                setPlans(results[1]);
                if (activeView === 'dashboard' && results[2]) {
                    setAuditLogs(results[2]);
                }
            }

            // Sempre carregar a configuração básica para o logo/nome na sidebar
            if (!saasConfig) {
                const config = await saasService.getSaaSConfig();
                setSaasConfig(config);
            }
        } catch (error) {
            console.error('Failed to load data', error);
            showAlert('Failed to load data. Please refresh the page.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCompanyUpdate = async (id: string, updates: Partial<Company>) => {
        try {
            const updatedCompany = await saasService.updateCompany(id, updates);
            loadData(); // Re-fetch to update UI list

            // If the updated company is the one currently selected, sync the detail view
            if (selectedCompany && selectedCompany.id === id) {
                // We merge carefully to avoid losing _count or other nested data not returned by basic update
                setSelectedCompany(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (error) {
            console.error('Failed to update company', error);
            showAlert('Failed to update company', 'error');
        }
    };

    // Desbloqueio de confiança: reativa a empresa e estende `subscriptionExpiresAt`
    // por N dias. Faturas em aberto permanecem OVERDUE — o cliente continua devendo.
    const handleTrustUnlock = (id: string, name: string, days: number) => {
        setTrustMenuTarget(null);
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + days);
        expiry.setHours(23, 59, 59, 999);
        showConfirm(
            'Desbloqueio de Confiança',
            `Liberar acesso de "${name}" por ${days} dia${days > 1 ? 's' : ''}? Faturas em aberto permanecem pendentes; após esse prazo o sistema suspende novamente se não houver pagamento.`,
            () => handleCompanyUpdate(id, { status: 'ACTIVE', subscriptionExpiresAt: expiry.toISOString() }),
            'info'
        );
    };

    const handleSaaSConfigUpdate = async (updates: Partial<SaaSConfig>) => {
        try {
            await saasService.updateSaaSConfig(updates);
            setSaasConfig(prev => prev ? { ...prev, ...updates } : null);
        } catch (error) {
            console.error('Failed to update SaaS config', error);
            showAlert('Failed to update SaaS config', 'error');
        }
    };

    const handleUserUpdate = async (id: string, updates: any) => {
        try {
            await saasService.updateUser(id, updates);
            showAlert('User updated successfully', 'success');
            loadData();
        } catch (error) {
            console.error(error);
            showAlert('Failed to update user', 'error');
        }
    };

    const handleEntrarSuporte = async (userId: string) => {
        try {
            const res = await saasService.createSupportSession(userId);
            if (res.token) {
                localStorage.setItem('ftth_support_token', res.token);
                // Previne que tente abrir o projeto previamente aberto pelo admin
                localStorage.removeItem('ftth_current_project_id');
                window.location.href = '/';
            }
        } catch (error: any) {
            console.error('Failed to create support session', error);
            showAlert(error.response?.data?.error || 'Erro ao iniciar sessão de suporte', 'error');
        }
    };

    const handleCompanyDelete = (company: Company) => {
        setCompanyToDelete(company);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteCompany = async () => {
        if (!companyToDelete) return;

        try {
            await saasService.deleteCompany(companyToDelete.id);
            setCompanies(prev => prev.filter(c => c.id !== companyToDelete.id));
            loadData();
            showAlert(t('saas_company_deleted_success') || 'Empresa deletada com sucesso!', 'success');
        } catch (error: any) {
            console.error("Delete failed", error);
            const msg = error.response?.data?.details || error.response?.data?.error || 'Failed to delete company';
            showAlert(msg, 'error');
        } finally {
            setIsDeleteModalOpen(false);
            setCompanyToDelete(null);
        }
    };

    const requestDeletePlan = (plan: Plan) => {
        setPlanToDelete(plan);
        setIsDeletePlanModalOpen(true);
    };

    const confirmDeletePlan = async () => {
        if (!planToDelete) return;
        try {
            await saasService.deletePlan(planToDelete.id);
            setPlans(prev => prev.filter(p => p.id !== planToDelete.id));
            loadData();
            showAlert(t('saas_plan_deleted_success'), 'success');
        } catch (error: any) {
            console.error("Delete failed", error);
            const msg = error.response?.data?.details || error.response?.data?.error || 'Failed to delete plan';
            showAlert(msg, 'error');
        } finally {
            setIsDeletePlanModalOpen(false);
            setPlanToDelete(null);
        }
    };

    const handleSavePlan = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const featuresText = formData.get('features') as string;
        const featuresValid = featuresText ? featuresText.split('\n').filter(s => s.trim()) : [];

        const planData = {
            name: formData.get('name'),
            price: parseFloat(formData.get('price') as string),
            type: formData.get('type') || 'STANDARD',
            trialDurationDays: formData.get('trialDurationDays') ? parseInt(formData.get('trialDurationDays') as string) : null,
            features: featuresValid,
            isRecommended: formData.get('isRecommended') === 'on',
            active: formData.get('active') === 'on',
            mercadopagoId: formData.get('mercadopagoId') as string,
            stripeId: formData.get('stripeId') as string,
            backupEnabled: formData.get('backupEnabled') === 'on',
            description: formData.get('description') as string,
            limits: {
                maxProjects: formData.get('maxProjects') ? parseInt(formData.get('maxProjects') as string) : 999999,
                maxUsers: formData.get('maxUsers') ? parseInt(formData.get('maxUsers') as string) : 999999,
                maxCTOs: formData.get('maxCTOs') ? parseInt(formData.get('maxCTOs') as string) : 999999,
                maxPOPs: formData.get('maxPOPs') ? parseInt(formData.get('maxPOPs') as string) : 999999
            }
        };
        try {
            if (editingPlan?.id) {
                await saasService.updatePlan(editingPlan.id, planData);
            } else {
                await saasService.createPlan(planData);
            }
            await loadData();
            setIsPlanModalOpen(false);
            setEditingPlan(null);
            showAlert('Plano salvo com sucesso!', 'success');
        } catch (error) {
            showAlert('Failed to save plan', 'error');
        }
    };

    const handleSaveVideo = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const videoData = {
            title: formData.get('title'),
            description: formData.get('description'),
            url: formData.get('url'),
            icon: formData.get('icon'),
            order: parseInt(formData.get('order') as string) || 0,
            active: formData.get('active') === 'on'
        };

        try {
            if (editingVideo?.id) {
                await saasService.updateDemoVideo(editingVideo.id, videoData);
            } else {
                await saasService.createDemoVideo(videoData);
            }
            await loadData();
            setIsVideoModalOpen(false);
            setEditingVideo(null);
        } catch (error) {
            showAlert('Failed to save video', 'error');
        }
    };

    const handleSaveSmtp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            host: formData.get('host'),
            port: formData.get('port'),
            user: formData.get('user'),
            pass: formData.get('pass'),
            fromEmail: formData.get('fromEmail'),
            fromName: formData.get('fromName'),
            secure: formData.get('secure') === 'on'
        };
        try {
            await saasService.updateSmtpConfig(data);
            showAlert('SMTP settings saved successfully', 'success');
        } catch (error) {
            showAlert('Failed to save SMTP settings', 'error');
        }
    };

    const handleTestSmtp = async () => {
        const form = document.getElementById('smtp-form') as HTMLFormElement;
        const formData = new FormData(form);
        const data = {
            host: formData.get('host'),
            port: formData.get('port'),
            user: formData.get('user'),
            pass: formData.get('pass'),
            fromEmail: formData.get('fromEmail'),
            fromName: formData.get('fromName'),
            secure: formData.get('secure') === 'on'
        };
        try {
            const res = await saasService.testSmtp(data);
            showAlert(res.message, 'success');
        } catch (error: any) {
            showAlert(error.response?.data?.message || 'SMTP test failed', 'error');
        }
    };

    const [runningReminders, setRunningReminders] = useState(false);
    const handleRunBillingReminders = async () => {
        setRunningReminders(true);
        try {
            const res = await saasService.runBillingReminders();
            const s = res.stats || {};
            showAlert(
                `Lembretes processados — vencendo em breve: ${s.soon || 0}, hoje: ${s.today || 0}, em atraso: ${s.overdue || 0}, ignorados: ${s.skipped || 0}, falhas: ${s.failed || 0}`,
                'success'
            );
        } catch (error: any) {
            showAlert(error.response?.data?.error || 'Falha ao processar lembretes de cobrança', 'error');
        } finally {
            setRunningReminders(false);
        }
    };

    const handleSaveTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name'),
            slug: formData.get('slug'),
            subject: formData.get('subject'),
            body: formData.get('body'),
            variables: (formData.get('variables') as string).split(',').map(v => v.trim()).filter(v => v)
        };
        try {
            if (editingTemplate?.id) {
                await saasService.updateEmailTemplate(editingTemplate.id, data);
            } else {
                await saasService.createEmailTemplate(data);
            }
            await loadData();
            setIsTemplateModalOpen(false);
            setEditingTemplate(null);
        } catch (error) {
            showAlert('Failed to save template', 'error');
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        // Confirmation handled by showConfirm caller
        try {
            await saasService.deleteEmailTemplate(id);
            await loadData();
        } catch (error) {
            showAlert('Failed to delete template', 'error');
        }
    };

    const openTemplateModal = (template?: any) => {
        setEditingTemplate(template || null);
        setIsTemplateModalOpen(true);
    };

    const handleOpenSendModal = (template: any) => {
        setTemplateToSend(template);
        setIsSendModalOpen(true);
    };


    const handleDeleteVideo = async (id: string) => {
        try {
            await saasService.deleteDemoVideo(id);
            await loadData();
        } catch (error) {
            showAlert('Failed to delete video', 'error');
        }
    };

    const handleRestoreProject = async (id: string) => {
        try {
            await saasService.restoreProject(id);
            setAlertConfig({
                isOpen: true,
                type: 'success',
                title: 'Sucesso',
                message: 'Projeto restaurado com sucesso!'
            });
            const projects = await saasService.getDeletedProjects();
            setDeletedProjects(projects);
        } catch (error) {
            setAlertConfig({
                isOpen: true,
                type: 'error',
                title: 'Erro',
                message: 'Falha ao restaurar projeto.'
            });
        }
    };

    const handlePermanentDeleteProject = async (id: string) => {
        try {
            await saasService.permanentlyDeleteProject(id);
            setAlertConfig({
                isOpen: true,
                type: 'success',
                title: 'Sucesso',
                message: 'Projeto excluído permanentemente!'
            });
            const projects = await saasService.getDeletedProjects();
            setDeletedProjects(projects);
        } catch (error) {
            setAlertConfig({
                isOpen: true,
                type: 'error',
                title: 'Erro',
                message: 'Falha ao excluir projeto permanentemente.'
            });
        }
    };

    const openVideoModal = (video?: any) => {
        setEditingVideo(video || null);
        setIsVideoModalOpen(true);
    };

    const openPlanModal = (plan?: any) => {
        if (plan) {
            let features = plan.features;
            if (typeof features === 'string') {
                try {
                    features = JSON.parse(features);
                } catch (e) {
                    features = [];
                }
            }
            if (!Array.isArray(features)) features = [];
            setEditingPlan({ ...plan, features });
        } else {
            setEditingPlan({ features: [], isRecommended: false });
        }
        setIsPlanModalOpen(true);
    };

    if (loading && activeView === 'dashboard') return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#1a1d23] text-slate-500">Loading platform data...</div>;

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[#151820] font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Sidebar */}
            <aside className={`bg-white dark:bg-[#1a1d23] border-r border-slate-200 dark:border-slate-700/30 flex flex-col z-20 shadow-xl transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'}`}>
                {/* Collapse Button */}
                <button
                    onClick={() => {
                        const newState = !isCollapsed;
                        setIsCollapsed(newState);
                        localStorage.setItem('saasAdminSidebarCollapsed', String(newState));
                    }}
                    className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-md z-30 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                <div className={`p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/30/50 overflow-hidden ${isCollapsed ? 'justify-center px-4' : ''}`}>
                    <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 ${!saasConfig?.appLogoUrl ? 'bg-emerald-600 shadow-lg shadow-emerald-600/20 text-white' : ''}`}>
                        {saasConfig?.appLogoUrl ? (
                            <img src={saasConfig.appLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <Network className="w-7 h-7" />
                        )}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 transition-opacity duration-300">
                            <h1 className="font-bold text-lg leading-tight truncate">
                                {saasConfig?.appName || 'FTTH Master'}
                            </h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Super Admin</p>
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-1">
                    {navSections.map((section, sIdx) => (
                        <div key={sIdx}>
                            {/* Section Label */}
                            {section.label && !isCollapsed && (
                                <p className="px-4 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
                                    {section.label}
                                </p>
                            )}
                            {section.label && isCollapsed && (
                                <div className="mx-3 my-2 h-px bg-slate-200 dark:bg-[#22262e]" />
                            )}

                            {/* Items */}
                            {section.items.map(item => {
                                const badgeValue = (item as any).badge as number | undefined;
                                const hasBadge = typeof badgeValue === 'number' && badgeValue > 0;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => { setSelectedCompany(null); setActiveView(item.id as any); }}
                                        title={isCollapsed ? item.label : ''}
                                        className={`w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 group relative ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-2.5'} ${activeView === item.id
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                                            }`}
                                    >
                                        <span className={`shrink-0 transition-transform duration-200 relative ${activeView === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                                            {item.icon}
                                            {/* Bolinha vermelha pulsante quando colapsado — sinaliza badge sem texto. */}
                                            {hasBadge && isCollapsed && (
                                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#1a1d23] animate-pulse" />
                                            )}
                                        </span>
                                        {!isCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                                        {!isCollapsed && hasBadge && (
                                            <span className="min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-sm animate-pulse">
                                                {badgeValue > 99 ? '99+' : badgeValue}
                                            </span>
                                        )}
                                        {activeView === item.id && !isCollapsed && !hasBadge && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-slate-700/30">
                    <div className={`flex items-center gap-1 ${isCollapsed ? 'flex-col' : 'justify-between'}`}>
                        <button
                            onClick={toggleTheme}
                            title={t('saas_change_theme') || 'Change Theme'}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        <button
                            onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
                            title={language === 'pt' ? 'English' : 'Português'}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors flex items-center gap-1.5"
                        >
                            <Languages className="w-5 h-5" />
                            {!isCollapsed && <span className="text-[10px] font-bold uppercase">{language === 'pt' ? 'PT' : 'EN'}</span>}
                        </button>

                        <button
                            onClick={onLogout}
                            title="Sign Out"
                            className="p-2.5 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto relative">
                <header className="sticky top-0 z-10 bg-slate-50/80 dark:bg-[#151820]/80 backdrop-blur-md px-8 py-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white capitalize">
                            {navItems.find(i => i.id === activeView)?.label || activeView}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('saas_dashboard_subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsPasswordModalOpen(true)}
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 dark:bg-[#1a1d23] dark:border-slate-700/30 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <Lock className="w-3 h-3" />
                            {t('saas_change_password')}
                        </button>
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('saas_administrator')}</p>
                            <p className="text-xs text-slate-400">super@ftthmaster.com</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold border-2 border-white dark:border-slate-700/30 shadow-sm">
                            S
                        </div>
                    </div>
                </header>

                <div className="px-8 pb-12">
                    {activeView === 'dashboard' && (
                        <SaasDashboard
                            companies={companies}
                            onNavigate={(view, filter) => {
                                setActiveView(view as any);
                                if (filter?.status) setStatusFilter(filter.status);
                                if (filter?.quickFilter) setQuickFilter(filter.quickFilter);
                            }}
                            onSelectCompany={(c) => { setActiveView('companies'); setSelectedCompany(c); setCompanyDetailTab('overview'); }}
                        />
                    )}

                    {activeView === 'companies' && !selectedCompany && (
                        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/30 flex flex-col xl:flex-row xl:items-center gap-3">
                                <div className="relative w-full xl:w-72 shrink-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder={t('saas_search_company')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-xs font-bold py-2 pl-3 pr-8 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                    >
                                        <option value="ALL">{t('saas_all_status')}</option>
                                        <option value="ACTIVE">{t('saas_active')}</option>
                                        <option value="SUSPENDED">{t('saas_suspender')}</option>
                                        <option value="CANCELLED">Cancelado</option>
                                    </select>
                                    <select
                                        value={planFilter}
                                        onChange={(e) => setPlanFilter(e.target.value)}
                                        className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-xs font-bold py-2 pl-3 pr-8 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                    >
                                        <option value="ALL">{t('saas_all_plans')}</option>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="hidden xl:block w-px h-6 bg-slate-200 dark:bg-slate-700/40" />
                                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                                    {([
                                        { key: 'expiring' as const, label: 'Vencendo 7d', icon: CalendarClock, count: quickFilterCounts.expiring, activeClass: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700' },
                                        { key: 'overdue' as const, label: 'Inadimplentes', icon: AlertTriangle, count: quickFilterCounts.overdue, activeClass: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700' },
                                        { key: 'inactive' as const, label: 'Inativos 30+', icon: Moon, count: quickFilterCounts.inactive, activeClass: 'bg-slate-100 text-slate-700 border-slate-400 dark:bg-slate-700/50 dark:text-slate-200 dark:border-slate-500' },
                                        { key: 'trial' as const, label: 'Trial', icon: Zap, count: quickFilterCounts.trial, activeClass: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700' },
                                    ]).map(chip => {
                                        const active = quickFilter === chip.key;
                                        const Icon = chip.icon;
                                        return (
                                            <button
                                                key={chip.key}
                                                onClick={() => setQuickFilter(active ? null : chip.key)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${active ? chip.activeClass : 'bg-white dark:bg-[#1a1d23] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}
                                            >
                                                <Icon className="w-3 h-3" />
                                                {chip.label}
                                                <span className={`min-w-[18px] text-center px-1 py-0.5 rounded-md text-[10px] ${active ? 'bg-white/70 dark:bg-black/30' : 'bg-slate-100 dark:bg-slate-800'}`}>{chip.count}</span>
                                            </button>
                                        );
                                    })}
                                    {quickFilter && (
                                        <button
                                            onClick={() => setQuickFilter(null)}
                                            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 hover:underline px-1.5"
                                        >
                                            Limpar
                                        </button>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 xl:ml-auto flex items-center gap-2">
                                    <span>{t('saas_showing_results', { val: filteredCompanies.length })}</span>
                                    <button
                                        onClick={() => {
                                            // Export do filtro atual em CSV. Aspas duplas escapadas; BOM
                                            // pra Excel detectar UTF-8 e renderizar acentos certo.
                                            const headers = ['Nome', 'CNPJ', 'Email', 'Telefone', 'Plano', 'Status', 'MRR', 'Vencimento', 'Projetos', 'Usuários', 'CTOs'];
                                            const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                                            const rows = sortedCompanies.map(c => [
                                                c.name, c.cnpj || '', c.businessEmail || '', c.phone || '',
                                                c.plan?.name || '', statusLabel(c.status), (c.plan?.price || 0).toFixed(2),
                                                c.subscriptionExpiresAt ? new Date(c.subscriptionExpiresAt).toLocaleDateString('pt-BR') : '',
                                                c._count.projects, c._count.users, c._count.ctos || 0,
                                            ].map(esc).join(','));
                                            const csv = '﻿' + [headers.map(esc).join(','), ...rows].join('\n');
                                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `empresas_${new Date().toISOString().slice(0, 10)}.csv`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold transition-colors"
                                        title="Exportar lista filtrada em CSV"
                                    >
                                        <FileDown className="w-3 h-3" />
                                        CSV
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/50 dark:bg-[#151820]/50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                        <tr>
                                            {(() => {
                                                const SortableTh = ({ column, label, align = 'left' }: { column: SortColumn; label: string; align?: 'left' | 'center' | 'right' }) => {
                                                    const isActive = sortBy.column === column;
                                                    const arrow = isActive ? (sortBy.direction === 'asc' ? '↑' : '↓') : '';
                                                    return (
                                                        <th className={`px-6 py-4 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : ''}`}>
                                                            <button
                                                                onClick={() => toggleSort(column)}
                                                                className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'hover:text-slate-700 dark:hover:text-slate-300'}`}
                                                            >
                                                                {label}
                                                                <span className="text-[10px] w-2.5">{arrow}</span>
                                                            </button>
                                                        </th>
                                                    );
                                                };
                                                return (
                                                    <>
                                                        <SortableTh column="name" label={t('saas_company_name')} />
                                                        <th className="px-6 py-4">{t('saas_current_plan')}</th>
                                                        <SortableTh column="expiry" label="Vencimento" align="center" />
                                                        <SortableTh column="financial" label="Financeiro" align="center" />
                                                        <th className="px-6 py-4 text-center">{t('admin_col_infrastructure')}</th>
                                                        <SortableTh column="lastActivity" label="Última atividade" align="center" />
                                                        <SortableTh column="status" label={t('status')} />
                                                        <th className="px-6 py-4 text-right">{t('actions')}</th>
                                                    </>
                                                );
                                            })()}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {sortedCompanies.slice(0, companiesVisible).map(company => (
                                            <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-slate-900 dark:text-white truncate">{company.name}</div>
                                                        {(() => {
                                                            const email = company.businessEmail || company.users?.[0]?.username || null;
                                                            const phone = company.phone || null;
                                                            if (!email && !phone) {
                                                                return <div className="text-xs text-slate-400 truncate">ID: {company.id.slice(0, 8)}...</div>;
                                                            }
                                                            return (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                                    {email && <span title={email}>{email}</span>}
                                                                    {email && phone && <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>}
                                                                    {phone && <span>{formatPhone(phone)}</span>}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {(() => {
                                                        // Wrapper estilizado: select nativo invisível por cima,
                                                        // visual customizado (badge + chevron). Confirm modal antes
                                                        // de persistir — evita troca de plano por engano.
                                                        const currentPlan = plans.find(p => p.id === company.plan?.id);
                                                        const isPaid = (currentPlan?.price || 0) > 0;
                                                        return (
                                                            <div className="relative inline-block group">
                                                                <select
                                                                    value={company.plan?.id || ''}
                                                                    onChange={(e) => {
                                                                        const newId = e.target.value;
                                                                        if (!newId || newId === company.plan?.id) return;
                                                                        const newPlan = plans.find(p => p.id === newId);
                                                                        showConfirm(
                                                                            'Trocar plano',
                                                                            `Mudar "${company.name}" de "${currentPlan?.name || 'sem plano'}" para "${newPlan?.name || newId}"? Os limites de uso passam a valer imediatamente.`,
                                                                            () => handleCompanyUpdate(company.id, { planId: newId }),
                                                                            'info',
                                                                        );
                                                                    }}
                                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                                    title="Alterar plano"
                                                                >
                                                                    <option value="" disabled>Selecionar plano</option>
                                                                    {plans.map(p => (
                                                                        <option key={p.id} value={p.id}>{p.name}{p.price ? ` — R$ ${p.price.toFixed(2)}` : ''}</option>
                                                                    ))}
                                                                </select>
                                                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition-all
                                                                    ${isPaid
                                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 group-hover:border-emerald-400'
                                                                        : 'bg-slate-50 dark:bg-[#22262e] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 group-hover:border-emerald-400'}`}
                                                                >
                                                                    <CreditCard className="w-3.5 h-3.5 opacity-60" />
                                                                    <span>{currentPlan?.name || 'Selecionar'}</span>
                                                                    <ChevronDown className="w-3 h-3 opacity-60" />
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {(() => {
                                                        const expired = company.subscriptionExpiresAt
                                                            ? isSubscriptionExpired(company.subscriptionExpiresAt)
                                                            : false;
                                                        // Converte ISO → YYYY-MM-DD pro <input type="date"> (que só aceita esse formato).
                                                        const dateValue = company.subscriptionExpiresAt
                                                            ? new Date(company.subscriptionExpiresAt).toISOString().split('T')[0]
                                                            : '';
                                                        return (
                                                            <div className="inline-flex flex-col items-center gap-0.5">
                                                                <input
                                                                    type="date"
                                                                    value={dateValue}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        if (!v || v === dateValue) return;
                                                                        // Persiste como fim do dia local pra evitar shift de fuso
                                                                        // (input retorna meia-noite, ISO em UTC pode "voltar" 1 dia).
                                                                        const local = new Date(`${v}T23:59:59`);
                                                                        const formattedNew = local.toLocaleDateString('pt-BR');
                                                                        const formattedOld = company.subscriptionExpiresAt
                                                                            ? new Date(company.subscriptionExpiresAt).toLocaleDateString('pt-BR')
                                                                            : 'sem vencimento';
                                                                        showConfirm(
                                                                            'Alterar vencimento',
                                                                            `Mudar o vencimento de "${company.name}" de ${formattedOld} para ${formattedNew}?`,
                                                                            () => handleCompanyUpdate(company.id, { subscriptionExpiresAt: local.toISOString() }),
                                                                            'info',
                                                                        );
                                                                    }}
                                                                    className={`bg-white dark:bg-[#151820] border rounded-lg text-xs font-bold py-1.5 px-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 cursor-pointer shadow-sm hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors ${expired ? 'border-red-300 text-red-600 dark:border-red-700' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                                                                    title="Alterar data de vencimento"
                                                                />
                                                                {expired && (
                                                                    <span className="text-[10px] text-red-500 font-semibold">Vencido</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {(() => {
                                                        const fin = (company as any)._financial;
                                                        const mrr = company.plan?.price || 0;
                                                        const mrrLabel = mrr > 0 ? `R$ ${mrr.toFixed(2)}/mês` : 'Grátis';
                                                        const isOverdue = fin?.overdueCount > 0;
                                                        const isPaid = fin?.paidCount > 0;
                                                        return (
                                                            <div className="inline-flex flex-col items-center gap-0.5">
                                                                {isOverdue ? (
                                                                    <>
                                                                        <span className="text-xs font-black text-red-600">R$ {fin.overdueTotal.toFixed(2)}</span>
                                                                        <span className="text-[10px] text-red-500">{fin.overdueCount} {fin.overdueCount === 1 ? 'fatura vencida' : 'faturas vencidas'}</span>
                                                                    </>
                                                                ) : isPaid ? (
                                                                    <span className="text-xs font-bold text-emerald-600">Em dia</span>
                                                                ) : null}
                                                                <span className={`text-[10px] ${isOverdue || isPaid ? 'text-slate-400 dark:text-slate-500 mt-0.5' : 'font-bold text-slate-600 dark:text-slate-300'}`}>
                                                                    {mrrLabel}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {(() => {
                                                        const eff = getEffectiveLimits(company.plan?.limits, company.customLimits);
                                                        return (
                                                            <div className="w-40 space-y-1.5 mx-auto">
                                                                <UsageBar
                                                                    label="Projetos"
                                                                    current={company._count.projects}
                                                                    max={eff.maxProjects}
                                                                    color="bg-emerald-500"
                                                                />
                                                                <UsageBar
                                                                    label="CTOs"
                                                                    current={company._count.ctos || 0}
                                                                    max={eff.maxCTOs}
                                                                    color="bg-blue-500"
                                                                />
                                                                <UsageBar
                                                                    label="Usuários"
                                                                    current={company._count.users || 0}
                                                                    max={eff.maxUsers}
                                                                    color="bg-emerald-500"
                                                                />
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {(() => {
                                                        const last = getLastActivity(company);
                                                        const { label, toneClass } = formatLastActivity(last);
                                                        return (
                                                            <div
                                                                className={`text-xs font-bold ${toneClass}`}
                                                                title={last ? last.toLocaleString() : 'Nenhum login registrado'}
                                                            >
                                                                {label}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${company.status === 'ACTIVE'
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                                        : company.status === 'TRIAL'
                                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                                                        }`}>
                                                        {company.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : company.status === 'TRIAL' ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                        {statusLabel(company.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {company.status === 'ACTIVE' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => showConfirm('Suspender Empresa', `Suspender "${company.name}"? O acesso será bloqueado imediatamente.`, () => handleCompanyUpdate(company.id, { status: 'SUSPENDED' }), 'warning')}
                                                                    title="Suspender"
                                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                                                >
                                                                    <Lock className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => showConfirm('Cancelar Assinatura', `Cancelar a assinatura de "${company.name}"? Não serão geradas novas faturas. O acesso permanece até o fim do período pago.`, () => handleCompanyUpdate(company.id, { status: 'CANCELLED' }), 'warning')}
                                                                    title="Cancelar assinatura"
                                                                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/30 p-2 rounded-lg transition-colors"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => showConfirm('Reativar Empresa', `Reativar "${company.name}"? O acesso será liberado.`, () => handleCompanyUpdate(company.id, { status: 'ACTIVE' }), 'info')}
                                                                    title="Reativar"
                                                                    className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 p-2 rounded-lg transition-colors"
                                                                >
                                                                    <RotateCcw className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    data-trust-menu
                                                                    onClick={(e) => openTrustMenu(e, company.id, company.name)}
                                                                    title="Cortesia — libera por alguns dias mantendo a fatura em aberto"
                                                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 p-2 rounded-lg transition-colors"
                                                                >
                                                                    <Wallet className="w-4 h-4" />
                                                                </button>
                                                                {company.status !== 'CANCELLED' && (
                                                                    <button
                                                                        onClick={() => showConfirm('Cancelar Assinatura', `Cancelar a assinatura de "${company.name}"? Não serão geradas novas faturas.`, () => handleCompanyUpdate(company.id, { status: 'CANCELLED' }), 'warning')}
                                                                        title="Cancelar assinatura"
                                                                        className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/30 p-2 rounded-lg transition-colors"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => { setSelectedCompany(company); setCompanyDetailTab('overview'); }}
                                                            className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 p-2 rounded-lg transition-colors"
                                                            title="Detalhes"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {/* Divider visual antes da ação destrutiva — reduz risco de clique
                                                            errado no Excluir colado nos botões de operação. */}
                                                        <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                                                        <button
                                                            onClick={() => handleCompanyDelete(company)}
                                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                                            title="Excluir empresa"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {sortedCompanies.length > companiesVisible && (
                                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700/30 flex items-center justify-between bg-slate-50/50 dark:bg-[#151820]/50">
                                    <span className="text-xs text-slate-500">Mostrando {companiesVisible} de {sortedCompanies.length}</span>
                                    <button
                                        onClick={() => setCompaniesVisible(c => c + COMPANY_PAGE_SIZE)}
                                        className="px-3 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                                    >
                                        Carregar mais ({Math.min(COMPANY_PAGE_SIZE, sortedCompanies.length - companiesVisible)})
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                    }

                    {
                        activeView === 'plans' && (
                            <div>
                                <div className="flex justify-end mb-6">
                                    <button
                                        onClick={() => openPlanModal()}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                                    >
                                        <CreditCard className="w-4 h-4" />
                                        Create New Plan
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {plans.map(plan => (
                                        <div key={plan.id} className={`bg-white dark:bg-[#1a1d23] rounded-3xl p-8 border hover:shadow-2xl transition-all relative ${plan.isRecommended ? 'border-emerald-500 ring-4 ring-emerald-500/10 scale-105 shadow-xl' : 'border-slate-200 dark:border-slate-700/30'}`}>
                                            {plan.isRecommended && (
                                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                                                    Most Popular
                                                </div>
                                            )}
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                                                    <div className="mt-2 flex items-baseline gap-1">
                                                        <span className="text-4xl font-extrabold text-slate-900 dark:text-white">${plan.price}</span>
                                                        <span className="text-sm font-medium text-slate-500">/month</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => openPlanModal(plan)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors">
                                                        <Settings className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => requestDeletePlan(plan)} title={t('saas_delete_plan')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-4 mb-8">
                                                <div className="p-4 bg-slate-50 dark:bg-[#151820]/50 rounded-2xl space-y-3">
                                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                                        <LayoutDashboard className="w-4 h-4 text-emerald-500" />
                                                        <span className="font-medium text-slate-900 dark:text-white">{(plan.limits?.maxProjects || 0) >= 999999 ? '∞' : plan.limits?.maxProjects || '∞'}</span> Max Projects
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                                        <Users className="w-4 h-4 text-emerald-500" />
                                                        <span className="font-medium text-slate-900 dark:text-white">{(plan.limits?.maxUsers || 0) >= 999999 ? '∞' : plan.limits?.maxUsers || '∞'}</span> Max Users
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                                        <Network className="w-4 h-4 text-blue-500" />
                                                        <span className="font-medium text-slate-900 dark:text-white">{(plan.limits?.maxCTOs || 0) >= 999999 ? '∞' : plan.limits?.maxCTOs || '∞'}</span> CTOs & POPs
                                                    </div>
                                                </div>

                                                {/* Features List */}
                                                {/* Features List */}
                                                {(() => {
                                                    let featuresList = plan.features;
                                                    if (typeof featuresList === 'string') {
                                                        try {
                                                            featuresList = JSON.parse(featuresList);
                                                        } catch (e) {
                                                            featuresList = [];
                                                        }
                                                    }

                                                    if (!Array.isArray(featuresList)) featuresList = [];

                                                    if (featuresList.length > 0) {
                                                        return (
                                                            <div className="space-y-2">
                                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Included Features:</p>
                                                                {featuresList.map((feature: string, idx: number) => (
                                                                    <div key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                                        <span>{feature}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {
                        activeView === 'audit' && <SaasAuditLogs />
                    }

                    {activeView === 'analytics' && <SaasAnalytics companies={companies} />}

                    {activeView === 'retention' && <SaasRetentionIntelligence />}

                    {activeView === 'global_map' && (
                        <div className="h-[calc(100vh-160px)] w-full">
                            <SaasGlobalMap />
                        </div>
                    )}

                    {
                        activeView === 'users' && (
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/30 flex justify-between items-center">
                                    <h3 className="font-bold text-lg">{t('saas_users_title')}</h3>
                                    <div className="text-sm text-slate-500">
                                        {t('saas_total')}: <span className="font-bold text-slate-900 dark:text-white">{users.length}</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50/50 dark:bg-[#151820]/50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">{t('user') || 'User'}</th>
                                                <th className="px-6 py-4">{t('company') || 'Company'}</th>
                                                <th className="px-6 py-4">{t('role')}</th>
                                                <th className="px-6 py-4">{t('admin_col_created')}</th>
                                                <th className="px-6 py-4">{t('admin_col_last_access')}</th>
                                                <th className="px-6 py-4">{t('status')}</th>
                                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {users.map(user => (
                                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.role === 'OWNER' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                                }`}>
                                                                {user.username.slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-slate-900 dark:text-white">{user.username}</div>
                                                                <div className="text-xs text-slate-500">{user.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.company ? (
                                                            <div className="text-slate-700 dark:text-slate-300 font-medium text-xs bg-slate-100 dark:bg-[#22262e] px-2 py-1 rounded inline-block">
                                                                {user.company.name}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic">{t('saas_no_company')}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <select
                                                            value={user.role}
                                                            onChange={(e) => handleUserUpdate(user.id, { role: e.target.value })}
                                                            className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700 text-xs rounded py-1 px-2"
                                                            disabled={user.role === 'SUPER_ADMIN'}
                                                        >
                                                            <option value="OWNER">{t('saas_role_owner')}</option>
                                                            <option value="ADMIN">{t('saas_role_admin')}</option>
                                                            <option value="EDITOR">{t('saas_role_editor')}</option>
                                                            <option value="VIEWER">{t('saas_role_viewer')}</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs text-slate-600 dark:text-slate-400">
                                                            {new Date(user.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                                            {user.lastLoginAt ? (
                                                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(user.lastLoginAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">{t('admin_never')}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.active
                                                            ? 'bg-emerald-50 text-emerald-600'
                                                            : 'bg-red-50 text-red-600'
                                                            }`}>
                                                            {user.active ? 'Active' : 'Blocked'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setResetPasswordUserId(user.id);
                                                                setResetPasswordUserName(user.username);
                                                                setResetPasswordValue('');
                                                                setResetPasswordError('');
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                            title="Reset Password"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                        {user.active ? (
                                                            <button
                                                                onClick={() => handleUserUpdate(user.id, { active: false })}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                title="Block Access"
                                                            >
                                                                <Lock className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleUserUpdate(user.id, { active: true })}
                                                                className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                title="Unblock"
                                                            >
                                                                <Shield className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleEntrarSuporte(user.id)}
                                                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                            title="Acessar Modo Suporte"
                                                        >
                                                            <UserCheck className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    }

                    {activeView === 'videos' && (
                        <div className="space-y-6">
                            <div className="flex justify-end">
                                <button
                                    onClick={() => openVideoModal()}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    {t('saas_add_video')}
                                </button>
                            </div>

                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50/50 dark:bg-[#151820]/50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">{t('saas_video')}</th>
                                            <th className="px-6 py-4">{t('saas_video_order')}</th>
                                            <th className="px-6 py-4">{t('saas_video_status')}</th>
                                            <th className="px-6 py-4 text-right">{t('saas_video_actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {videos.map(video => (
                                            <tr key={video.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-100 dark:bg-[#22262e] rounded-lg">
                                                            <Monitor className="w-5 h-5 text-emerald-500" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold">{video.title}</div>
                                                            <div className="text-xs text-slate-500 truncate max-w-xs">{video.url}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">{video.order}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${video.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                        {video.active ? t('saas_active') : t('saas_inactive')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => openVideoModal(video)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => showConfirm('Excluir Vídeo', `Deseja excluir o vídeo "${video.title}"?`, () => handleDeleteVideo(video.id))} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeView === 'email' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* SMTP Config */}
                                <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                                            <Server className="w-5 h-5" />
                                        </div>
                                        <h2 className="text-lg font-bold">{t('saas_smtp_title')}</h2>
                                    </div>

                                    <form id="smtp-form" onSubmit={handleSaveSmtp} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('saas_smtp_host')}</label>
                                                <input name="host" defaultValue={smtpConfig?.host} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-sm" placeholder="smtp.example.com" required />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('saas_smtp_port')}</label>
                                                <input name="port" type="number" defaultValue={smtpConfig?.port} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-sm" placeholder="587" required />
                                            </div>
                                            <div className="flex items-end pb-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" name="secure" defaultChecked={smtpConfig?.secure} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                                                    <span className="text-sm font-medium">{t('saas_smtp_secure')}</span>
                                                </label>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('saas_smtp_user')}</label>
                                                <input name="user" defaultValue={smtpConfig?.user} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-sm" placeholder="user@example.com" required />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('saas_password')}</label>
                                                <input name="pass" type="password" defaultValue={smtpConfig?.pass} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-sm" placeholder="••••••••" required />
                                            </div>
                                            <div className="col-span-2 border-t border-slate-100 dark:border-slate-700/30 pt-4 mt-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('saas_smtp_from')}</label>
                                                <input name="fromEmail" defaultValue={smtpConfig?.fromEmail} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-sm" placeholder="noreply@ftthplanner.com" required />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('saas_smtp_from_name')}</label>
                                                <input name="fromName" defaultValue={smtpConfig?.fromName} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-sm" placeholder="FTTH Planner Pro" required />
                                            </div>
                                        </div>
                                        <div className="flex gap-3 pt-4">
                                            <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all">
                                                {t('saas_save_settings')}
                                            </button>
                                            <button type="button" onClick={handleTestSmtp} className="px-4 py-2 bg-slate-100 dark:bg-[#22262e] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold text-sm transition-all">
                                                {t('saas_test_connection')}
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* Email Templates */}
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                                                    <Mail className="w-5 h-5" />
                                                </div>
                                                <h2 className="text-lg font-bold">{t('saas_email_templates')}</h2>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleRunBillingReminders}
                                                    disabled={runningReminders}
                                                    title="Disparar lembretes de cobrança agora (mesma lógica do cron diário 08:00)"
                                                    className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <CalendarClock className="w-4 h-4" />
                                                    {runningReminders ? 'Processando...' : 'Disparar Cobranças'}
                                                </button>
                                                <button onClick={() => openTemplateModal()} className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
                                                    <Zap className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {templates.map(template => (
                                                <div key={template.id} className="p-4 bg-slate-50 dark:bg-[#151820] rounded-xl border border-slate-100 dark:border-slate-700/30 flex items-center justify-between group">
                                                    <div>
                                                        <div className="font-bold text-sm">{template.name}</div>
                                                        <div className="text-xs text-slate-500 font-mono">{template.slug}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleOpenSendModal(template)}
                                                            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                                                            title="Disparar e-mail"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => openTemplateModal(template)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => showConfirm('Excluir Template', `Deseja excluir o template "${template.name}"?`, () => handleDeleteTemplate(template.id))} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                </div>
                                            ))}
                                            {templates.length === 0 && (
                                                <div className="text-center py-8 text-slate-400 text-sm italic">
                                                    No templates created yet.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Help Box */}
                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 text-amber-600 mb-2">
                                            <AlertTriangle className="w-5 h-5" />
                                            <h3 className="font-bold text-sm">Template Variables</h3>
                                        </div>
                                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed mb-2">
                                            Use <code>{"{{variable_name}}"}</code> in the subject or body to inject dynamic content.
                                        </p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono text-amber-800 dark:text-amber-500">
                                            <div>Global: app_name, app_logo, app_url</div>
                                            <div>User: username, login_url</div>
                                            <div>Company: company_name, company_logo, company_url</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'support_chat' && (
                        <div className="space-y-6">
                            <SupportAdminPanel />
                        </div>
                    )}

                    {activeView === 'config' && (
                        <div className="space-y-6 max-w-5xl">
                            {/* Hero header — gradient banner instead of plain card */}
                            <div className="bg-gradient-to-br from-emerald-600 via-violet-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                                <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                                <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
                                <div className="relative flex items-center gap-4">
                                    <div className="p-3 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
                                        <Shield className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">{t('saas_config_title')}</h2>
                                        <p className="text-sm text-emerald-100/90 mt-0.5">{t('saas_config_subtitle')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Branding Section */}
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center gap-3">
                                    <div className="p-2 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-lg">
                                        <Palette className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('saas_config_branding')}</h3>
                                        <p className="text-xs text-slate-500">Identidade visual e nome da plataforma</p>
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_app_name')}</label>
                                        <input
                                            defaultValue={saasConfig?.appName}
                                            onBlur={(e) => handleSaaSConfigUpdate({ appName: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            placeholder="Ex: FTTH Planner Pro"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_website')}</label>
                                        <input
                                            defaultValue={saasConfig?.websiteUrl || ''}
                                            onBlur={(e) => handleSaaSConfigUpdate({ websiteUrl: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            placeholder="https://suaplataforma.com"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_logo')}</label>
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-[#151820] rounded-xl border border-slate-200 dark:border-slate-700/30">
                                            <div className="w-20 h-20 bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                                {saasConfig?.appLogoUrl ? (
                                                    <img src={saasConfig.appLogoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <ImageIcon className="w-8 h-8 text-slate-300" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-slate-500 mb-2">PNG, JPEG, SVG ou WebP · máximo 2MB</p>
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const maxSize = 2 * 1024 * 1024; // 2MB
                                                            const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
                                                            if (file.size > maxSize) {
                                                                showAlert('File size exceeds 2MB limit.', 'error');
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            if (!allowedTypes.includes(file.type)) {
                                                                showAlert('Invalid file type. Only PNG, JPEG, SVG and WebP are allowed.', 'error');
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            const reader = new FileReader();
                                                            reader.onloadend = async () => {
                                                                const base64 = reader.result as string;
                                                                try {
                                                                    const result = await saasService.uploadSaaSLogo(base64);
                                                                    if (result.success) {
                                                                        setSaasConfig(prev => prev ? { ...prev, appLogoUrl: result.logoUrl } : null);
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Failed to upload SaaS logo:', err);
                                                                    showAlert('Failed to upload logo.', 'error');
                                                                }
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                    className="text-xs w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Support Section */}
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                        <HeartPulse className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('saas_config_support')}</h3>
                                        <p className="text-xs text-slate-500">Canais de contato exibidos para os clientes</p>
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_support_email')}</label>
                                        <input
                                            defaultValue={saasConfig?.supportEmail || ''}
                                            onBlur={(e) => handleSaaSConfigUpdate({ supportEmail: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            placeholder="suporte@suaplataforma.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_support_phone')}</label>
                                        <input
                                            defaultValue={saasConfig?.supportPhone || ''}
                                            onBlur={(e) => handleSaaSConfigUpdate({ supportPhone: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            placeholder="+55 (00) 00000-0000"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SEO Section */}
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                        <Search className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('saas_config_seo')}</h3>
                                        <p className="text-xs text-slate-500">Como sua plataforma aparece no Google e redes sociais</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_seo_desc')}</label>
                                        <textarea
                                            defaultValue={saasConfig?.appDescription || ''}
                                            onBlur={(e) => handleSaaSConfigUpdate({ appDescription: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all h-20 resize-none"
                                            placeholder="Planeje redes FTTH com facilidade..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_seo_keywords')}</label>
                                        <input
                                            defaultValue={saasConfig?.appKeywords || ''}
                                            onBlur={(e) => handleSaaSConfigUpdate({ appKeywords: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            placeholder="ftth, projetos, fibra óptica, telecall"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_seo_image')}</label>
                                        <input
                                            defaultValue={saasConfig?.ogImageUrl || ''}
                                            onBlur={(e) => handleSaaSConfigUpdate({ ogImageUrl: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            placeholder="https://seusite.com.br/banner-compartilhamento.jpg"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Social Media Section */}
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center gap-3">
                                    <div className="p-2 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-lg">
                                        <Share2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('saas_config_social')}</h3>
                                        <p className="text-xs text-slate-500">Links das redes sociais oficiais</p>
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {['Facebook', 'Twitter', 'Instagram', 'Linkedin', 'Youtube'].map((social) => (
                                        <div key={social}>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{social} URL</label>
                                            <input
                                                defaultValue={(saasConfig as any)?.[`social${social}`] || ''}
                                                onBlur={(e) => handleSaaSConfigUpdate({ [`social${social}`]: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                placeholder={`https://${social.toLowerCase()}.com/perfil`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Content & Layout Section */}
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center gap-3">
                                    <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
                                        <Monitor className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('saas_config_landing')}</h3>
                                        <p className="text-xs text-slate-500">Imagens e conteúdo da landing page pública</p>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('saas_config_hero')}</label>
                                        <input
                                            defaultValue={saasConfig?.heroPreviewUrl || ''}
                                            onBlur={(e) => handleSaaSConfigUpdate({ heroPreviewUrl: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                            placeholder="/dashboard-preview.png"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'trash' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Lixeira de Projetos</h2>
                                    <p className="text-sm text-slate-500">Gerencie projetos deletados (Soft-delete). Projetos aqui não contam para o limite do plano.</p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50/50 dark:bg-[#151820]/50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Nome do Projeto</th>
                                                <th className="px-6 py-4">Empresa</th>
                                                <th className="px-6 py-4">Usuário</th>
                                                <th className="px-6 py-4">Deletado em</th>
                                                <th className="px-6 py-4 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {deletedProjects.map(project => (
                                                <tr key={project.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900 dark:text-white">{project.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">ID: {project.id}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                        {project.company?.name || '---'}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                        {project.user?.username || '---'}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 text-xs">
                                                        {project.deletedAt ? new Date(project.deletedAt).toLocaleString() : '---'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => showConfirm('Restaurar Projeto', `Deseja restaurar o projeto "${project.name}"?`, () => handleRestoreProject(project.id), 'info')}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-100 dark:border-emerald-800"
                                                                title="Restaurar Projeto"
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                                Restaurar
                                                            </button>
                                                            <button
                                                                onClick={() => showConfirm('Excluir Permanentemente', `AVISO IRREVERSÍVEL: Todos os dados do projeto "${project.name}" (CTOs, Clientes, Cabos) serão excluídos. Confirma?`, () => handlePermanentDeleteProject(project.id))}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-100 dark:border-red-800"
                                                                title="Excluir Permanentemente"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Excluir Permanente
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {deletedProjects.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                                        Nenhum projeto na lixeira.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {isPlanModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden flex flex-col max-h-[90vh]">
                            <form onSubmit={handleSavePlan} className="flex flex-col h-full overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {editingPlan ? t('saas_plan_edit') : t('saas_plan_create')}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsPlanModalOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('saas_plan_name')}</label>
                                        <input
                                            name="name"
                                            defaultValue={editingPlan?.name}
                                            required
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            placeholder="e.g. Pro, Enterprise"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('saas_plan_price_monthly')}</label>
                                        <input
                                            name="price"
                                            type="number"
                                            step="0.01"
                                            defaultValue={editingPlan?.price}
                                            required
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan Type</label>
                                            <select
                                                name="type"
                                                defaultValue={editingPlan?.type || 'STANDARD'}
                                                onChange={(e) => {
                                                    const trialInput = document.getElementById('trialDurationInput');
                                                    if (trialInput) {
                                                        if (e.target.value === 'TRIAL') {
                                                            trialInput.classList.remove('hidden');
                                                        } else {
                                                            trialInput.classList.add('hidden');
                                                        }
                                                    }
                                                }}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            >
                                                <option value="STANDARD">Standard (Paid)</option>
                                                <option value="TRIAL">Trial (Free/Time Limited)</option>
                                                <option value="ENTERPRISE">Enterprise (Custom)</option>
                                            </select>
                                        </div>
                                        <div id="trialDurationInput" className={editingPlan?.type === 'TRIAL' ? '' : 'hidden'}>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trial Duration (Days)</label>
                                            <input
                                                name="trialDurationDays"
                                                type="number"
                                                defaultValue={editingPlan?.trialDurationDays || 7}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mercado Pago Plan ID</label>
                                            <input
                                                name="mercadopagoId"
                                                defaultValue={editingPlan?.mercadopagoId || ''}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                                                placeholder="e.g. 2c938084..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stripe Price ID</label>
                                            <input
                                                name="stripeId"
                                                defaultValue={editingPlan?.stripeId || ''}
                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                                                placeholder="e.g. price_1..."
                                            />
                                        </div>
                                    </div>


                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (Internal)</label>
                                        <textarea
                                            name="description"
                                            rows={2}
                                            defaultValue={editingPlan?.description || ''}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            placeholder="Plan description..."
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                name="active"
                                                defaultChecked={editingPlan?.active ?? true}
                                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active (Visible to users)</span>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                name="backupEnabled"
                                                defaultChecked={editingPlan?.backupEnabled}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('saas_plan_backup_enabled')}</span>
                                                <span className="text-[10px] text-slate-500">{t('saas_plan_backup_enabled_desc')}</span>
                                            </div>
                                        </label>
                                    </div>



                                    <div className="border-t border-slate-100 dark:border-slate-700/30 pt-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Resource Limits (Leave empty for Unlimited)</h4>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max Projects</label>
                                                <input
                                                    name="maxProjects"
                                                    type="number"
                                                    defaultValue={editingPlan?.limits?.maxProjects ?? ''}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max Users</label>
                                                <input
                                                    name="maxUsers"
                                                    type="number"
                                                    defaultValue={editingPlan?.limits?.maxUsers ?? ''}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max CTOs</label>
                                                <input
                                                    name="maxCTOs"
                                                    type="number"
                                                    defaultValue={editingPlan?.limits?.maxCTOs ?? ''}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Max POPs</label>
                                                <input
                                                    name="maxPOPs"
                                                    type="number"
                                                    defaultValue={editingPlan?.limits?.maxPOPs ?? ''}
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700/30">
                                            <div>
                                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        name="isRecommended"
                                                        defaultChecked={editingPlan?.isRecommended}
                                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mark as Recommended Plan (Highlighted)</span>
                                                </label>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Features List (one per line)</label>
                                                <textarea
                                                    name="features"
                                                    rows={4}
                                                    placeholder="24/7 Support&#10;Daily Backups&#10;Advanced Analytics"
                                                    defaultValue={editingPlan?.features?.join('\n')}
                                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 dark:bg-[#151820] border-t border-slate-100 dark:border-slate-700/30 flex justify-end gap-3 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setIsPlanModalOpen(false)}
                                        className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition-all"
                                    >
                                        Save Plan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div >
                )
                }

                {
                    isVideoModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden flex flex-col">
                                <form onSubmit={handleSaveVideo}>
                                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                            {editingVideo ? 'Edit Video' : 'Add New Video'}
                                        </h3>
                                        <button type="button" onClick={() => setIsVideoModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Title</label>
                                            <input name="title" defaultValue={editingVideo?.title} required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Description</label>
                                            <textarea name="description" defaultValue={editingVideo?.description} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Embed URL (YouTube/Vimeo)</label>
                                            <input name="url" defaultValue={editingVideo?.url} required placeholder="https://www.youtube.com/embed/..." className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg font-mono text-xs" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Icon Name (Lucide)</label>
                                                <input name="icon" defaultValue={editingVideo?.icon || 'Monitor'} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Order</label>
                                                <input name="order" type="number" defaultValue={editingVideo?.order || 0} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg" />
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" name="active" defaultChecked={editingVideo?.active ?? true} className="w-4 h-4 rounded" />
                                            <span className="text-sm">Active</span>
                                        </label>
                                    </div>
                                    <div className="px-6 py-4 bg-slate-50 dark:bg-[#151820] border-t border-slate-100 dark:border-slate-700/30 flex justify-end gap-3">
                                        <button type="button" onClick={() => setIsVideoModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
                                        <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg">Save Video</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }
                {/* Company Detail Page (full-width inline view) — wrapped in
                    px-8 to match the rest of the activeView blocks (this sits
                    outside the main content wrapper because it replaced the
                    fixed-position drawer that didn't need padding). */}
                {
                    activeView === 'companies' && selectedCompany && (
                        <div className="px-8 pb-12 space-y-6">
                            {/* Page header — back button, identity, status, quick actions */}
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm p-5">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <button
                                            onClick={() => setSelectedCompany(null)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                                            title="Voltar para a lista"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 flex items-center justify-center overflow-hidden shrink-0">
                                            {selectedCompany.logoUrl ? (
                                                <img src={selectedCompany.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                            ) : (
                                                <Building2 className="w-6 h-6 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{selectedCompany.name}</h2>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${selectedCompany.status === 'ACTIVE'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : selectedCompany.status === 'TRIAL'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {selectedCompany.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">
                                                {selectedCompany.plan?.name || t('saas_no_plan')} · ID: {selectedCompany.id}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {selectedCompany.status === 'ACTIVE' ? (
                                            <>
                                                <button
                                                    onClick={() => showConfirm('Suspender Empresa', `Suspender "${selectedCompany.name}"? O acesso será bloqueado imediatamente.`, () => handleCompanyUpdate(selectedCompany.id, { status: 'SUSPENDED' }), 'warning')}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-lg text-xs font-bold border border-red-100 dark:border-red-900/50 hover:bg-red-100 transition-colors"
                                                >
                                                    <Lock className="w-3.5 h-3.5" />
                                                    {t('saas_suspend')}
                                                </button>
                                                <button
                                                    onClick={() => showConfirm('Cancelar Assinatura', `Cancelar a assinatura de "${selectedCompany.name}"? Não serão geradas novas faturas. O acesso permanece até o fim do período pago.`, () => handleCompanyUpdate(selectedCompany.id, { status: 'CANCELLED' }), 'warning')}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-[#22262e] text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                    Cancelar
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => showConfirm('Reativar Empresa', `Reativar "${selectedCompany.name}"? O acesso será liberado.`, () => handleCompanyUpdate(selectedCompany.id, { status: 'ACTIVE' }), 'info')}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 transition-colors"
                                                >
                                                    <Shield className="w-3.5 h-3.5" />
                                                    {t('saas_activate')}
                                                </button>
                                                <button
                                                    data-trust-menu
                                                    onClick={(e) => openTrustMenu(e, selectedCompany.id, selectedCompany.name)}
                                                    title="Desbloqueio de confiança — libera por alguns dias mantendo a fatura em aberto"
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 text-amber-600 rounded-lg text-xs font-bold border border-amber-100 dark:border-amber-900/50 hover:bg-amber-100 transition-colors"
                                                >
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Cortesia
                                                    <ChevronRight className={`w-3 h-3 transition-transform ${trustMenuTarget?.id === selectedCompany.id ? 'rotate-90' : ''}`} />
                                                </button>
                                                {selectedCompany.status !== 'CANCELLED' && (
                                                    <button
                                                        onClick={() => showConfirm('Cancelar Assinatura', `Cancelar a assinatura de "${selectedCompany.name}"? Não serão geradas novas faturas.`, () => handleCompanyUpdate(selectedCompany.id, { status: 'CANCELLED' }), 'warning')}
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-[#22262e] text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        Cancelar
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleCompanyDelete(selectedCompany)}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-[#22262e] text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            {t('saas_delete')}
                                        </button>
                                    </div>
                                </div>

                                {/* Read-only institutional info — these fields are managed by the customer
                                    in their own company settings; admin only views them here. */}
                                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CNPJ</p>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedCompany.cnpj || '—'}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Telefone</p>
                                        {selectedCompany.phone ? (() => {
                                            // WhatsApp expects digits only (with country code). Strip any
                                            // formatting (spaces, dashes, parens, +) from the stored phone.
                                            const digits = selectedCompany.phone.replace(/\D/g, '');
                                            // Pre-filled welcome message sent when admin opens the chat
                                            // right after a customer signs up. Uses the company name so
                                            // it's personalized without extra clicks.
                                            const welcomeMessage = `Olá! 👋 Aqui é da equipe FTTH Planner.\n\nSeja muito bem-vindo(a)! Vimos que a *${selectedCompany.name}* acabou de criar uma conta na nossa plataforma e estamos passando para confirmar seu cadastro e tirar qualquer dúvida que você possa ter sobre o sistema.\n\nQualquer coisa que precisar (configuração inicial, planos, suporte técnico), é só responder por aqui. Estamos à disposição! 🚀`;
                                            const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(welcomeMessage)}`;
                                            return (
                                                <a
                                                    href={waUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                                    title="Abrir conversa no WhatsApp com mensagem de boas-vindas"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    {selectedCompany.phone}
                                                </a>
                                            );
                                        })() : (
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">—</p>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail</p>
                                        {selectedCompany.businessEmail ? (
                                            <a
                                                href={`mailto:${selectedCompany.businessEmail}`}
                                                className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline truncate block"
                                                title={selectedCompany.businessEmail}
                                            >
                                                {selectedCompany.businessEmail}
                                            </a>
                                        ) : (
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">—</p>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Website</p>
                                        {selectedCompany.website ? (
                                            <a
                                                href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline truncate block"
                                                title={selectedCompany.website}
                                            >
                                                {selectedCompany.website}
                                            </a>
                                        ) : (
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">—</p>
                                        )}
                                    </div>
                                    <div className="sm:col-span-2 lg:col-span-4 min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Endereço</p>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            {[selectedCompany.address, selectedCompany.city, selectedCompany.state, selectedCompany.zipCode].filter(Boolean).join(' · ') || '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Unified card — tabs + body share a single wrapper so the
                                tab strip visually owns the content area instead of floating
                                above a stack of separate cards. */}
                            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                {/* Tabs — Visão Geral / Financeiro */}
                                <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700/30 px-3">
                                    <button
                                        onClick={() => setCompanyDetailTab('overview')}
                                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${companyDetailTab === 'overview'
                                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        <LayoutDashboard className="w-4 h-4" />
                                        Visão Geral
                                    </button>
                                    <button
                                        onClick={() => setCompanyDetailTab('financial')}
                                        className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${companyDetailTab === 'financial'
                                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        <Wallet className="w-4 h-4" />
                                        Financeiro
                                        {((selectedCompany as any)._financial?.overdueCount || 0) > 0 && (
                                            <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                                {(selectedCompany as any)._financial.overdueCount}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {/* Tab content — single column, full width.
                                    Institutional info is read-only in the header above; the customer
                                    edits it from their own company settings. */}
                                <div className="p-6 divide-y divide-slate-100 dark:divide-slate-700/30 [&>*+*]:pt-6 [&>*+*]:mt-6">
                                {companyDetailTab === 'overview' && (() => {
                                    const eff = getEffectiveLimits(selectedCompany.plan?.limits, selectedCompany.customLimits);
                                    const hasOverrides = !!selectedCompany.customLimits && Object.keys(selectedCompany.customLimits).length > 0;
                                    return (
                                <>
                                    {/* Saúde e uso */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            {t('saas_health_usage')}
                                            {hasOverrides && (
                                                <span className="px-1.5 py-0.5 text-[9px] font-black rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                                    LIMITES PERSONALIZADOS
                                                </span>
                                            )}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-4">
                                            <div>
                                                <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">{t('saas_plan_info')}</p>
                                                <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedCompany.plan?.name || t('saas_no_plan')}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Status</p>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${selectedCompany.status === 'ACTIVE'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : selectedCompany.status === 'TRIAL'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {selectedCompany.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/30 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-slate-400 text-[10px] uppercase font-bold">{t('saas_expires_at')}</p>
                                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        {selectedCompany.subscriptionExpiresAt
                                                            ? new Date(selectedCompany.subscriptionExpiresAt).toLocaleDateString()
                                                            : t('saas_no_expiration')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 text-[10px] uppercase font-bold">{t('saas_company_phone')}</p>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        {selectedCompany.phone || t('saas_na')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 mt-4">
                                            <UsageBar
                                                label="Projects"
                                                current={selectedCompany._count.projects}
                                                max={eff.maxProjects}
                                                color="bg-emerald-500"
                                            />
                                            <UsageBar
                                                label="Users"
                                                current={selectedCompany._count.users}
                                                max={eff.maxUsers}
                                                color="bg-emerald-500"
                                            />
                                            <UsageBar
                                                label="Infrastructure (CTOs)"
                                                current={selectedCompany._count.ctos || 0}
                                                max={eff.maxCTOs}
                                                color="bg-blue-500"
                                            />
                                        </div>

                                        {/* Custom limits editor — leave empty to inherit plan default */}
                                        <CustomLimitsEditor
                                            company={selectedCompany}
                                            onSave={(newLimits) => handleCompanyUpdate(selectedCompany.id, { customLimits: newLimits })}
                                        />
                                    </div>
                                    </>
                                    );
                                })()}

                                    {companyDetailTab === 'financial' && (
                                    <>
                                    {/* Visão Financeira — payment cycle, LTV, MRR, dates */}
                                    {(() => {
                                        const fin = (selectedCompany as any)._financial || {};
                                        const expiresAt = selectedCompany.subscriptionExpiresAt ? new Date(selectedCompany.subscriptionExpiresAt) : null;
                                        const createdAt = new Date(selectedCompany.createdAt);
                                        const now = new Date();
                                        // Day comparison anchored to São Paulo time — UTC midnight would put a
                                        // customer with vencimento "07/05" (BRT) into "today" until ~21h BRT
                                        // of 08/05, leaving them ~24h "active" past their actual due date.
                                        const startToday = toBRDateMidnight(now);

                                        // Days until / since expiration (date-only)
                                        let daysDiff: number | null = null;
                                        if (expiresAt) {
                                            const expDay = toBRDateMidnight(expiresAt);
                                            daysDiff = Math.round((expDay.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));
                                        }
                                        const isExpired = daysDiff !== null && daysDiff < 0;

                                        // Days as customer
                                        const daysAsCustomer = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

                                        // Payment day of month (extracted from due date in BR locale —
                                        // getUTCDate would be off by one when the timestamp is late evening BRT).
                                        const paymentDay = expiresAt ? toBRDateMidnight(expiresAt).getUTCDate() : null;

                                        // Owner last login
                                        const owner = selectedCompany.users?.find((u: any) => u.role === 'OWNER');
                                        const lastLogin = (owner as any)?.lastLoginAt ? new Date((owner as any).lastLoginAt) : null;

                                        // Payment method label
                                        const pmLabel = formatPaymentMethod(selectedCompany.paymentMethod || 'PIX');

                                        const fmtDate = (d: Date | null) => d ? d.toLocaleDateString('pt-BR') : '—';
                                        const fmtMoney = (v: number | undefined) => v != null ? `R$ ${v.toFixed(2)}` : '—';

                                        return (
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <Wallet className="w-3.5 h-3.5" />
                                                    Visão Financeira
                                                </h3>

                                                {/* Top KPIs: LTV, MRR, Pagamentos */}
                                                <div className="grid grid-cols-3 gap-2 mb-4">
                                                    <div className="p-2.5 bg-white dark:bg-[#1a1d23] rounded-lg border border-slate-100 dark:border-slate-700/30">
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                                                            <TrendingUp className="w-3 h-3" /> LTV
                                                        </div>
                                                        <p className="text-sm font-black text-emerald-600">{fmtMoney(fin.paidTotal)}</p>
                                                    </div>
                                                    <div className="p-2.5 bg-white dark:bg-[#1a1d23] rounded-lg border border-slate-100 dark:border-slate-700/30">
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                                                            <Activity className="w-3 h-3" /> MRR
                                                        </div>
                                                        <p className="text-sm font-black text-emerald-600">{fmtMoney(selectedCompany.plan?.price)}</p>
                                                    </div>
                                                    <div className="p-2.5 bg-white dark:bg-[#1a1d23] rounded-lg border border-slate-100 dark:border-slate-700/30">
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                                                            <CheckCircle2 className="w-3 h-3" /> Pagos
                                                        </div>
                                                        <p className="text-sm font-black text-slate-900 dark:text-white">{fin.paidCount || 0}</p>
                                                    </div>
                                                </div>

                                                {/* Detalhes em duas colunas */}
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                                                    <div>
                                                        <div className="flex items-center gap-1 text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                                                            <Calendar className="w-3 h-3" /> Cliente desde
                                                        </div>
                                                        <p className="font-bold text-slate-700 dark:text-slate-200">{fmtDate(createdAt)}</p>
                                                        <p className="text-[10px] text-slate-400">{daysAsCustomer} dias</p>
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center gap-1 text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                                                            <CreditCard className="w-3 h-3" /> Forma de pagamento
                                                        </div>
                                                        <p className="font-bold text-slate-700 dark:text-slate-200">{pmLabel}</p>
                                                        {paymentDay && (
                                                            <p className="text-[10px] text-slate-400">Todo dia {paymentDay}</p>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center gap-1 text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                                                            <CalendarClock className="w-3 h-3" /> Próximo vencimento
                                                        </div>
                                                        <p className={`font-bold ${isExpired ? 'text-red-600' : 'text-slate-700 dark:text-slate-200'}`}>
                                                            {fmtDate(expiresAt)}
                                                        </p>
                                                        {daysDiff !== null && (
                                                            <p className={`text-[10px] font-semibold ${isExpired ? 'text-red-500' : daysDiff <= 5 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                                {isExpired
                                                                    ? `${Math.abs(daysDiff)} dia(s) em atraso`
                                                                    : daysDiff === 0
                                                                        ? 'Vence hoje'
                                                                        : `Em ${daysDiff} dia(s)`}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center gap-1 text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                                                            <CheckCircle2 className="w-3 h-3" /> Último pagamento
                                                        </div>
                                                        <p className="font-bold text-slate-700 dark:text-slate-200">
                                                            {fin.lastPayment ? fmtDate(new Date(fin.lastPayment)) : '—'}
                                                        </p>
                                                        {fin.lastPayment && (
                                                            <p className="text-[10px] text-slate-400">
                                                                {Math.floor((now.getTime() - new Date(fin.lastPayment).getTime()) / (1000 * 60 * 60 * 24))} dia(s) atrás
                                                            </p>
                                                        )}
                                                    </div>

                                                    {fin.overdueCount > 0 && (
                                                        <div className="col-span-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                                                            <div className="flex items-center gap-1 text-red-500 text-[10px] uppercase font-bold mb-0.5">
                                                                <AlertTriangle className="w-3 h-3" /> Inadimplência
                                                            </div>
                                                            <p className="font-black text-red-600">
                                                                {fmtMoney(fin.overdueTotal)} <span className="font-normal text-[10px]">em {fin.overdueCount} fatura(s)</span>
                                                            </p>
                                                        </div>
                                                    )}

                                                    {lastLogin && (
                                                        <div className="col-span-2">
                                                            <div className="flex items-center gap-1 text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                                                                <Clock className="w-3 h-3" /> Último acesso (Owner)
                                                            </div>
                                                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                                                {lastLogin.toLocaleDateString('pt-BR')} {lastLogin.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    </>
                                    )}

                                    {companyDetailTab === 'overview' && (
                                    <>
                                    {/* Users + Projects side-by-side */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Users List */}
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                {t('saas_team_members')} <span className="bg-slate-100 dark:bg-[#22262e] px-2 py-0.5 rounded-full text-[10px]">{selectedCompany.users?.length || 0}</span>
                                            </h3>
                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                                {selectedCompany.users?.map(u => (
                                                    <div key={u.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#151820] border border-slate-100 dark:border-slate-700/30 rounded-lg">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${u.role === 'OWNER' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                {u.username.slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{u.username}</p>
                                                                <p className="text-xs text-slate-400 uppercase">{u.role}</p>
                                                            </div>
                                                        </div>
                                                        {['OWNER', 'ADMIN'].includes(u.role) && (
                                                            <button
                                                                onClick={() => handleEntrarSuporte(u.id)}
                                                                className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0"
                                                                title={t('saas_support_mode') || 'Acessar Modo Suporte'}
                                                            >
                                                                <UserCheck className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!selectedCompany.users || selectedCompany.users.length === 0) && (
                                                    <p className="text-sm text-slate-400 italic">{t('saas_no_users_found')}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Projects List */}
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                {t('saas_projects')} <span className="bg-slate-100 dark:bg-[#22262e] px-2 py-0.5 rounded-full text-[10px]">{selectedCompany.projects?.length || 0}</span>
                                            </h3>
                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                                {selectedCompany.projects?.map(p => (
                                                    <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#151820] border border-slate-100 dark:border-slate-700/30 rounded-lg hover:border-emerald-300 transition-colors">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded shrink-0">
                                                                <Network className="w-4 h-4" />
                                                            </div>
                                                            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{p.name}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!selectedCompany.projects || selectedCompany.projects.length === 0) && (
                                                    <p className="text-sm text-slate-400 italic">{t('saas_no_projects_found')}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    </>
                                    )}

                                {companyDetailTab === 'financial' && (
                                <>
                                    {/* Financial history */}
                                    <div>
                                        <CompanyInvoicesSection companyId={selectedCompany.id} financial={(selectedCompany as any)._financial} />
                                    </div>
                                </>
                                )}
                                </div>
                            </div>
                        </div>
                    )
                }


                <ChangePasswordModal
                    isOpen={isPasswordModalOpen}
                    onClose={() => setIsPasswordModalOpen(false)}
                />
            </main >

            {/* Generic Confirmation Dialog */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700/30 p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className={`p-3 rounded-full ${confirmDialog.variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : confirmDialog.variant === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{confirmDialog.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{confirmDialog.message}</p>
                            <div className="flex gap-3 w-full pt-2">
                                <button
                                    onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                                    className="flex-1 py-2.5 bg-slate-100 dark:bg-[#22262e] text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        confirmDialog.onConfirm();
                                        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                    }}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${confirmDialog.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : confirmDialog.variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {
                isDeleteModalOpen && companyToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden transform transition-all scale-100 p-8">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full mb-2">
                                    <AlertTriangle className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('saas_delete_company_q')}</h3>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    <p>{t('saas_delete_company_warn_1')} <span className="font-bold text-slate-800 dark:text-slate-200">{companyToDelete.name}</span>.</p>
                                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl text-left border border-red-100 dark:border-red-900/50">
                                        <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">{t('saas_delete_company_warn_2')}</p>
                                        <ul className="space-y-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                                            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-500 rounded-full"></div> {t('saas_projects')}</li>
                                            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-500 rounded-full"></div> {companyToDelete._count.users} {t('saas_delete_company_warn_3')}</li>
                                            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-500 rounded-full"></div> {t('saas_delete_company_warn_4')}</li>
                                            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-red-500 rounded-full"></div> {t('saas_nav_audit')}</li>
                                        </ul>
                                    </div>
                                    <p className="mt-4 text-xs text-slate-400">{t('saas_delete_company_warn_6')}</p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-[#22262e] text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {t('saas_cancel')}
                                </button>
                                <button
                                    onClick={confirmDeleteCompany}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {t('saas_confirm_delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isTemplateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-[#1a1d23] rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden flex flex-col max-h-[90vh]">
                            <form onSubmit={handleSaveTemplate} className="flex flex-col h-full overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex justify-between items-center">
                                    <h3 className="text-lg font-bold">
                                        {editingTemplate ? t('saas_template_edit') : t('saas_template_create')}
                                    </h3>
                                    <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('saas_template_name')}</label>
                                            <input name="name" defaultValue={editingTemplate?.name} required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg" placeholder="Welcome Email" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('saas_template_slug')}</label>
                                            <input name="slug" defaultValue={editingTemplate?.slug} required disabled={!!editingTemplate} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg disabled:opacity-50" placeholder="welcome-email" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('saas_template_subject')}</label>
                                        <input name="subject" defaultValue={editingTemplate?.subject} required className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg" placeholder="Welcome to FTTH Planner, {{username}}!" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('saas_template_vars')}</label>
                                        <input name="variables" defaultValue={Array.isArray(editingTemplate?.variables) ? editingTemplate.variables.join(', ') : ''} className="w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg" placeholder="p.ex: username, app_name, app_logo, company_name" />
                                    </div>
                                    <div className="flex-1 flex flex-col min-h-[300px]">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('saas_template_body')}</label>
                                        <textarea name="body" defaultValue={editingTemplate?.body} required className="flex-1 w-full px-3 py-2 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg font-mono text-xs resize-none" placeholder="<h1>Olá {{username}}!</h1>..." />
                                    </div>
                                </div>
                                <div className="p-6 border-t border-slate-100 dark:border-slate-700/30 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">{t('saas_cancel')}</button>
                                    <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20">{t('saas_template_save')}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {
                isSendModalOpen && templateToSend && (
                    <SendTemplateModal
                        isOpen={isSendModalOpen}
                        template={templateToSend}
                        onClose={() => {
                            setIsSendModalOpen(false);
                            setTemplateToSend(null);
                        }}
                    />
                )
            }
            {
                isDeletePlanModalOpen && planToDelete && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden transform transition-all scale-100 p-8">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full mb-2">
                                    <AlertTriangle className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('saas_delete_plan')}</h3>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    <p>{t('saas_confirm_delete_plan')}</p>
                                    <p className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-200">{planToDelete.name}</p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setIsDeletePlanModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-[#22262e] text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    {t('saas_cancel')}
                                </button>
                                <button
                                    onClick={confirmDeletePlan}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {t('saas_delete_plan')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                resetPasswordUserId && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden transform transition-all scale-100 p-6">
                            <div className="flex flex-col space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                                        <RotateCcw className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reset Password</h3>
                                        <p className="text-xs text-slate-400">{resetPasswordUserName}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">New Password</label>
                                    <input
                                        type="password"
                                        value={resetPasswordValue}
                                        onChange={(e) => {
                                            setResetPasswordValue(e.target.value);
                                            setResetPasswordError('');
                                        }}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                        placeholder="Min. 6 characters"
                                        autoFocus
                                    />
                                    {resetPasswordError && (
                                        <p className="text-xs text-red-500 mt-1">{resetPasswordError}</p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => {
                                        setResetPasswordUserId(null);
                                        setResetPasswordValue('');
                                        setResetPasswordError('');
                                    }}
                                    className="flex-1 py-2.5 bg-slate-100 dark:bg-[#22262e] text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        if (resetPasswordValue.length < 6) {
                                            setResetPasswordError('Password must be at least 6 characters');
                                            return;
                                        }
                                        await handleUserUpdate(resetPasswordUserId!, { password: resetPasswordValue });
                                        setResetPasswordUserId(null);
                                        setResetPasswordValue('');
                                        setResetPasswordError('');
                                    }}
                                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                                >
                                    Reset Password
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                alertConfig.isOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden transform transition-all scale-100 p-6">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className={`p-4 rounded-full mb-2 ${alertConfig.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : alertConfig.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'}`}>
                                    {alertConfig.type === 'error' ? <AlertTriangle className="w-8 h-8" /> : alertConfig.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <Shield className="w-8 h-8" />}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{alertConfig.title || (alertConfig.type === 'error' ? 'Erro' : alertConfig.type === 'success' ? 'Sucesso' : 'Aviso')}</h3>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    <p>{alertConfig.message}</p>
                                </div>
                            </div>
                            <div className="mt-8">
                                <button
                                    onClick={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                                    className="w-full py-3 bg-slate-100 dark:bg-[#22262e] text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {trustMenuTarget && createPortal(
                <div
                    data-trust-menu
                    style={{
                        position: 'fixed',
                        top: trustMenuTarget.top,
                        right: trustMenuTarget.right,
                        zIndex: 9999,
                    }}
                    className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[160px]"
                >
                    {[1, 3, 5, 7].map(days => (
                        <button
                            key={days}
                            onClick={() => handleTrustUnlock(trustMenuTarget.id, trustMenuTarget.name, days)}
                            className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                            Liberar por {days} {days === 1 ? 'dia' : 'dias'}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div >
    );
};
