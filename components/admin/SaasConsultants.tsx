import React, { useEffect, useMemo, useState } from 'react';
import {
    UserPlus, Copy, Check, Loader2, X, Edit2, Trash2, Power, ExternalLink,
    Users as UsersIcon, TrendingUp, DollarSign, Eye, AlertCircle
} from 'lucide-react';
import {
    listConsultants, createConsultant, updateConsultant, deleteConsultant,
    getConsultantStats
} from '../../services/saasService';
import { useLanguage } from '../../LanguageContext';

interface Consultant {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    code: string;
    commissionPct: number | null;
    notes: string | null;
    active: boolean;
    createdAt: string;
    _count?: { companies: number; visits: number };
}

interface ConsultantStats {
    consultant: Consultant;
    metrics: {
        visits: number;
        signups: number;
        paying: number;
        conversionRate: number;
        paidConversionRate: number;
        revenue: number;
        estimatedCommission: number;
    };
    companies: Array<{
        id: string;
        name: string;
        status: string;
        planName: string | null;
        planPrice: number;
        ownerName: string | null;
        ownerEmail: string | null;
        referredAt: string | null;
        subscriptionExpiresAt: string | null;
        revenue: number;
        isPaying: boolean;
    }>;
}

const fmtMoney = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const fmtDate = (s: string | null) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return '—'; }
};

const getReferralLink = (code: string) => {
    const base = window.location.origin;
    return `${base}/?ref=${code}`;
};

export const SaasConsultants: React.FC = () => {
    const { t } = useLanguage();
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Consultant | null>(null);
    const [creating, setCreating] = useState(false);
    const [statsFor, setStatsFor] = useState<string | null>(null);
    const [statsData, setStatsData] = useState<ConsultantStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    const loadConsultants = async () => {
        setLoading(true);
        try {
            const data = await listConsultants();
            setConsultants(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadConsultants(); }, []);

    const openStats = async (id: string) => {
        setStatsFor(id);
        setStatsLoading(true);
        setStatsData(null);
        try {
            const data = await getConsultantStats(id);
            setStatsData(data);
        } catch (e) {
            console.error(e);
        } finally {
            setStatsLoading(false);
        }
    };

    const copyLink = async (code: string) => {
        try {
            await navigator.clipboard.writeText(getReferralLink(code));
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        } catch {
            // sem clipboard API — fallback futuro se precisar
        }
    };

    const handleToggleActive = async (c: Consultant) => {
        try {
            await updateConsultant(c.id, { active: !c.active });
            loadConsultants();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (c: Consultant) => {
        const msg = `Excluir consultor "${c.name}"?\n\n` +
            `As empresas indicadas mantêm o histórico mas perdem a atribuição.\n` +
            `Visitas registradas serão apagadas.`;
        if (!window.confirm(msg)) return;
        try {
            await deleteConsultant(c.id);
            loadConsultants();
        } catch (e) {
            console.error(e);
        }
    };

    const visibleConsultants = useMemo(
        () => consultants.filter(c => showInactive || c.active),
        [consultants, showInactive]
    );

    const totals = useMemo(() => {
        return consultants.reduce((acc, c) => ({
            consultants: acc.consultants + (c.active ? 1 : 0),
            signups: acc.signups + (c._count?.companies || 0),
            visits: acc.visits + (c._count?.visits || 0),
        }), { consultants: 0, signups: 0, visits: 0 });
    }, [consultants]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('consultants_title') || 'Consultores'}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('consultants_desc') || 'Gere links de indicação e acompanhe os clientes trazidos por cada consultor.'}
                    </p>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition"
                >
                    <UserPlus className="w-4 h-4" />
                    {t('consultants_new') || 'Novo consultor'}
                </button>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('consultants_total_active') || 'Consultores ativos'}
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{totals.consultants}</div>
                </div>
                <div className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('consultants_total_signups') || 'Cadastros atribuídos'}
                    </div>
                    <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{totals.signups}</div>
                </div>
                <div className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('consultants_total_visits') || 'Visitas ao link'}
                    </div>
                    <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{totals.visits}</div>
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowInactive(v => !v)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                        showInactive
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            : 'bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                >
                    {showInactive ? (t('consultants_showing_all') || 'Mostrando inativos') : (t('consultants_show_inactive') || 'Mostrar inativos')}
                </button>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
                </div>
            ) : visibleConsultants.length === 0 ? (
                <div className="bg-white dark:bg-[#22262e] border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
                    <UsersIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {t('consultants_empty_title') || 'Nenhum consultor cadastrado'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        {t('consultants_empty_desc') || 'Crie um consultor pra gerar um link de indicação e começar a rastrear clientes.'}
                    </p>
                    <button
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition"
                    >
                        <UserPlus className="w-4 h-4" /> {t('consultants_new') || 'Novo consultor'}
                    </button>
                </div>
            ) : (
                <div className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-[#1a1d23] border-b border-slate-200 dark:border-slate-700">
                            <tr className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <th className="px-4 py-3">Consultor</th>
                                <th className="px-4 py-3">Código / Link</th>
                                <th className="px-4 py-3 text-center">Visitas</th>
                                <th className="px-4 py-3 text-center">Cadastros</th>
                                <th className="px-4 py-3 text-center">% Comissão</th>
                                <th className="px-4 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {visibleConsultants.map(c => (
                                <tr key={c.id} className={`text-sm ${!c.active ? 'opacity-60' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                                        {c.email && <div className="text-xs text-slate-500 dark:text-slate-400">{c.email}</div>}
                                        {!c.active && (
                                            <span className="inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500">
                                                Inativo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400">
                                                {c.code}
                                            </code>
                                            <button
                                                onClick={() => copyLink(c.code)}
                                                className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition"
                                                title="Copiar link completo"
                                            >
                                                {copiedCode === c.code ? (
                                                    <><Check className="w-3.5 h-3.5" /> Copiado</>
                                                ) : (
                                                    <><Copy className="w-3.5 h-3.5" /> Copiar link</>
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300 font-mono">
                                        {c._count?.visits ?? 0}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                        {c._count?.companies ?? 0}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 font-mono">
                                        {(c.commissionPct ?? 0).toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => openStats(c.id)}
                                                title="Ver estatísticas"
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setEditing(c)}
                                                title="Editar"
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleToggleActive(c)}
                                                title={c.active ? 'Desativar' : 'Reativar'}
                                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition"
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c)}
                                                title="Excluir"
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
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
            )}

            {/* Create/Edit modal */}
            {(creating || editing) && (
                <ConsultantFormModal
                    consultant={editing}
                    onClose={() => { setCreating(false); setEditing(null); }}
                    onSaved={() => { setCreating(false); setEditing(null); loadConsultants(); }}
                />
            )}

            {/* Stats modal */}
            {statsFor && (
                <StatsModal
                    loading={statsLoading}
                    data={statsData}
                    onClose={() => { setStatsFor(null); setStatsData(null); }}
                />
            )}
        </div>
    );
};

// --- Form Modal ---

interface FormModalProps {
    consultant: Consultant | null;
    onClose: () => void;
    onSaved: () => void;
}

const ConsultantFormModal: React.FC<FormModalProps> = ({ consultant, onClose, onSaved }) => {
    const isEdit = !!consultant;
    const [name, setName] = useState(consultant?.name || '');
    const [email, setEmail] = useState(consultant?.email || '');
    const [phone, setPhone] = useState(consultant?.phone || '');
    const [commissionPct, setCommissionPct] = useState(consultant?.commissionPct ?? 10);
    const [notes, setNotes] = useState(consultant?.notes || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Nome obrigatório');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                name: name.trim(),
                email: email.trim() || undefined,
                phone: phone.trim() || undefined,
                commissionPct: Number(commissionPct) || 0,
                notes: notes.trim() || undefined,
            };
            if (isEdit && consultant) {
                await updateConsultant(consultant.id, payload);
            } else {
                await createConsultant(payload);
            }
            onSaved();
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                        {isEdit ? 'Editar consultor' : 'Novo consultor'}
                    </h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={submit} className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Nome *
                        </label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-[#22262e] rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                E-mail
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-[#22262e] rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Telefone
                            </label>
                            <input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-[#22262e] rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Comissão (%)
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={commissionPct}
                            onChange={e => setCommissionPct(Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-[#22262e] rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-mono"
                        />
                        <div className="text-[10px] text-slate-400 mt-1">
                            Usado para estimar comissão sobre receita gerada (cálculo no painel de estatísticas).
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Observações
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-[#22262e] rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
                        />
                    </div>
                    {!isEdit && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                            ℹ️ Um código único de 6 caracteres será gerado automaticamente. Após criado, o código não pode ser alterado (evita quebrar links já distribuídos).
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isEdit ? 'Salvar' : 'Criar consultor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Stats Modal ---

interface StatsModalProps {
    loading: boolean;
    data: ConsultantStats | null;
    onClose: () => void;
}

const StatsModal: React.FC<StatsModalProps> = ({ loading, data, onClose }) => {
    return (
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                            {data?.consultant?.name || 'Estatísticas'}
                        </h3>
                        {data?.consultant && (
                            <div className="flex items-center gap-2 mt-0.5">
                                <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400">
                                    {data.consultant.code}
                                </code>
                                {data.consultant.email && (
                                    <span className="text-xs text-slate-500">{data.consultant.email}</span>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-6">
                    {loading || !data ? (
                        <div className="flex items-center justify-center py-16 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando estatísticas…
                        </div>
                    ) : (
                        <>
                            {/* Metrics */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <MetricCard icon={<Eye className="w-4 h-4" />} label="Visitas" value={data.metrics.visits.toString()} color="indigo" />
                                <MetricCard icon={<UsersIcon className="w-4 h-4" />} label="Cadastros" value={data.metrics.signups.toString()} color="emerald" sub={`Conv.: ${fmtPct(data.metrics.conversionRate)}`} />
                                <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Pagantes" value={data.metrics.paying.toString()} color="amber" sub={`Conv.: ${fmtPct(data.metrics.paidConversionRate)}`} />
                                <MetricCard icon={<DollarSign className="w-4 h-4" />} label="Receita gerada" value={fmtMoney(data.metrics.revenue)} color="emerald" sub={`Com.: ${fmtMoney(data.metrics.estimatedCommission)}`} />
                            </div>

                            {/* Companies table */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Clientes atribuídos ({data.companies.length})
                                </h4>
                                {data.companies.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                                        Nenhuma empresa ainda. Compartilhe o link!
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 dark:bg-[#1a1d23] border-b border-slate-200 dark:border-slate-700">
                                                <tr className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    <th className="px-3 py-2">Empresa</th>
                                                    <th className="px-3 py-2">Responsável</th>
                                                    <th className="px-3 py-2">Plano</th>
                                                    <th className="px-3 py-2 text-center">Status</th>
                                                    <th className="px-3 py-2 text-right">Receita</th>
                                                    <th className="px-3 py-2">Indicado em</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {data.companies.map(c => (
                                                    <tr key={c.id} className="text-sm">
                                                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{c.name}</td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                                            {c.ownerName || '—'}
                                                            {c.ownerEmail && <div className="text-[10px] text-slate-400">{c.ownerEmail}</div>}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                                            {c.planName || '—'}
                                                            {c.planPrice > 0 && <div className="text-[10px] text-slate-400">{fmtMoney(c.planPrice)}/mês</div>}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                c.status === 'ACTIVE'
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                            }`}>
                                                                {c.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-200">
                                                            {fmtMoney(c.revenue)}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs">
                                                            {fmtDate(c.referredAt)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Link compartilhável (footer) */}
                            {data.consultant && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl p-4">
                                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                                        Link de indicação
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-xs font-mono px-3 py-2 bg-white dark:bg-[#22262e] border border-emerald-200 dark:border-emerald-900/30 rounded-lg text-slate-700 dark:text-slate-200 truncate">
                                            {getReferralLink(data.consultant.code)}
                                        </code>
                                        <button
                                            onClick={() => navigator.clipboard?.writeText(getReferralLink(data.consultant.code))}
                                            className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition"
                                            title="Copiar link"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <a
                                            href={getReferralLink(data.consultant.code)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition"
                                            title="Abrir em nova aba"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; color: 'emerald' | 'indigo' | 'amber' | 'red' }> = ({ icon, label, value, sub, color }) => {
    const colorMap: Record<string, string> = {
        emerald: 'text-emerald-600 dark:text-emerald-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
        amber: 'text-amber-600 dark:text-amber-400',
        red: 'text-red-600 dark:text-red-400',
    };
    return (
        <div className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${colorMap[color]}`}>
                {icon} {label}
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">{value}</div>
            {sub && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
        </div>
    );
};
