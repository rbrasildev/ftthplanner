import React, { useEffect, useMemo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { Building2, CheckCircle2, Play, AlertTriangle, TrendingUp, TrendingDown, Minus, Activity, Calendar, DollarSign, ChevronRight, Loader2, Plus, Pencil, Trash2, LogIn, LogOut, Lock, CreditCard } from 'lucide-react';
import * as saasService from '../../services/saasService';
import { useTheme } from '../../ThemeContext';

interface Props {
    companies: any[];
    onNavigate: (view: string, filter?: { status?: string; quickFilter?: 'expiring' | 'overdue' | 'inactive' | 'trial' }) => void;
    onSelectCompany?: (company: any) => void;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const monthOf = (d: string) => d?.slice(0, 7);

// Reaproveitado do SaasAuditLogs — manter sincronizado.
const ACTION_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    CREATE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: <Plus className="w-3 h-3" />, label: 'Criou' },
    UPDATE: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: <Pencil className="w-3 h-3" />, label: 'Atualizou' },
    DELETE: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', icon: <Trash2 className="w-3 h-3" />, label: 'Excluiu' },
    LOGIN: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: <LogIn className="w-3 h-3" />, label: 'Entrou' },
    LOGOUT: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: <LogOut className="w-3 h-3" />, label: 'Saiu' },
    PASSWORD: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: <Lock className="w-3 h-3" />, label: 'Mudou senha' },
};
const verbOf = (action: string): keyof typeof ACTION_STYLE | null => {
    const u = action.toUpperCase();
    if (u.startsWith('CREATE') || u.endsWith('_CREATED')) return 'CREATE';
    if (u.startsWith('UPDATE') || u.endsWith('_UPDATED')) return 'UPDATE';
    if (u.startsWith('DELETE') || u.endsWith('_DELETED')) return 'DELETE';
    if (u.includes('LOGIN')) return 'LOGIN';
    if (u.includes('LOGOUT')) return 'LOGOUT';
    if (u.includes('PASSWORD')) return 'PASSWORD';
    return null;
};

const ENTITY_LABEL: Record<string, string> = {
    Company: 'Empresa', User: 'Usuário', Project: 'Projeto', Plan: 'Plano', SYSTEM: 'Sistema',
};
const entityLabel = (e: string) => ENTITY_LABEL[e] || e;

const isTrial = (c: any) => c.plan?.type === 'TRIAL' || c.plan?.name?.toLowerCase().includes('trial') || c.plan?.name?.toLowerCase().includes('teste');
const isFree = (c: any) => !c.plan?.price || c.plan.price <= 0 || c.plan?.name?.toLowerCase().includes('grátis') || c.plan?.name?.toLowerCase().includes('free');

export const SaasDashboard: React.FC<Props> = ({ companies, onNavigate, onSelectCompany }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [activity, setActivity] = useState<any[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(true);
    const [recentPayments, setRecentPayments] = useState<saasService.RecentPayment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    // Filtro de data pontual — quando setado, busca pagamentos daquele dia e
    // desliga o auto-refresh (não faz sentido refresh de datas passadas).
    const [paymentsDate, setPaymentsDate] = useState<string>('');
    // Aba ativa do card consolidado (Vencimentos / Inadimplentes / Atividade).
    const [dashTab, setDashTab] = useState<'expiring' | 'overdue' | 'activity'>('expiring');

    // Refresh do activity feed a cada 60s.
    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const logs = await saasService.getAuditLogs({ limit: 15 });
                if (alive) setActivity(logs || []);
            } catch (e) { /* silent */ }
            finally { if (alive) setLoadingActivity(false); }
        };
        load();
        const interval = setInterval(load, 60000);
        return () => { alive = false; clearInterval(interval); };
    }, []);

    // Refresh dos últimos pagamentos: auto a cada 30s SE não houver filtro
    // de data; com filtro, apenas uma busca (data histórica não muda sozinha).
    useEffect(() => {
        let alive = true;
        setLoadingPayments(true);
        const load = async () => {
            try {
                let opts: { limit?: number; from?: string; to?: string } = { limit: 10 };
                if (paymentsDate) {
                    const d = new Date(paymentsDate + 'T00:00:00');
                    const dEnd = new Date(paymentsDate + 'T23:59:59.999');
                    opts = { limit: 500, from: d.toISOString(), to: dEnd.toISOString() };
                }
                const payments = await saasService.getRecentPayments(opts);
                if (alive) setRecentPayments(payments || []);
            } catch (e) { /* silent */ }
            finally { if (alive) setLoadingPayments(false); }
        };
        load();
        if (paymentsDate) return () => { alive = false; };
        const interval = setInterval(load, 30000);
        return () => { alive = false; clearInterval(interval); };
    }, [paymentsDate]);

    // ── KPIs com comparação MoM ────────────────────────────────────────────
    const kpis = useMemo(() => {
        const payingSubs = companies.filter(c => c.status === 'ACTIVE' && !isTrial(c) && !isFree(c));
        const trials = companies.filter(c => isTrial(c) || c.status === 'TRIAL');
        const suspended = companies.filter(c => c.status === 'SUSPENDED');
        const active = companies.filter(c => c.status === 'ACTIVE');
        const cancelled = companies.filter(c => c.status === 'CANCELLED');
        // Suspensos pagantes (não-trial, não-grátis) ainda são assinantes —
        // só estão inadimplentes. Contam pra base e pra MRR contratado.
        const overdueSubs = suspended.filter(c => !isTrial(c) && !isFree(c));
        const allSubs = [...payingSubs, ...overdueSubs];
        const mrrReceived = payingSubs.reduce((acc, c) => acc + (c.plan?.price || 0), 0);
        const mrrContracted = allSubs.reduce((acc, c) => acc + (c.plan?.price || 0), 0);
        const mrr = mrrContracted;
        const totalOverdue = companies.reduce((acc, c) => acc + (c._financial?.overdueTotal || 0), 0);
        const totalProjects = companies.reduce((acc, c) => acc + (c._count?.projects || 0), 0);
        const totalCTOs = companies.reduce((acc, c) => acc + (c._count?.ctos || 0), 0);
        const totalUsers = companies.reduce((acc, c) => acc + (c._count?.users || 0), 0);

        // MoM: novas empresas neste mês vs mês anterior
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const newThisMonth = companies.filter(c => monthOf(c.createdAt) === thisMonth).length;
        const newLastMonth = companies.filter(c => monthOf(c.createdAt) === lastMonth).length;
        const newDelta = newLastMonth === 0 ? (newThisMonth > 0 ? 100 : 0) : ((newThisMonth - newLastMonth) / newLastMonth) * 100;

        // MRR MoM aproximado: assume que empresas criadas no mês anterior já contribuíam.
        // Como não temos histórico de plan changes, comparamos contagem de pagantes ativos.
        const payingNewThisMonth = payingSubs.filter(c => monthOf(c.createdAt) === thisMonth).length;
        const payingMRRDelta = payingSubs.length === 0 ? 0 : (payingNewThisMonth / payingSubs.length) * 100;

        // Próximos vencimentos (próximos 7 dias)
        const expiringSoon = companies.filter(c => {
            if (c.status !== 'ACTIVE' || !c.subscriptionExpiresAt) return false;
            const days = (new Date(c.subscriptionExpiresAt).getTime() - Date.now()) / 86400000;
            return days >= 0 && days <= 7;
        }).sort((a, b) =>
            new Date(a.subscriptionExpiresAt).getTime() - new Date(b.subscriptionExpiresAt).getTime()
        );

        // Inadimplentes
        const overdue = companies.filter(c => (c._financial?.overdueCount || 0) > 0)
            .sort((a, b) => (b._financial?.overdueTotal || 0) - (a._financial?.overdueTotal || 0));

        return {
            payingSubs, overdueSubs, allSubs, trials, suspended, active, cancelled,
            mrr, mrrReceived, mrrContracted, totalOverdue, totalProjects, totalCTOs, totalUsers,
            newThisMonth, newDelta, payingMRRDelta,
            expiringSoon, overdue,
        };
    }, [companies]);

    // ── Sparkline de crescimento (últimos 6 meses) ─────────────────────────
    const growthSeries = useMemo(() => {
        const map = new Map<string, number>();
        companies.forEach(c => {
            const k = monthOf(c.createdAt);
            if (k) map.set(k, (map.get(k) || 0) + 1);
        });
        const now = new Date();
        const series: { x: string; y: number }[] = [];
        let acc = 0;
        // Pega últimos 6 meses (inclui mês atual). Acumulado de empresas no fim de cada mês.
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthlyNew = map.get(k) || 0;
            // Calcula acumulado contando todas empresas criadas antes ou no fim deste mês
            const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();
            acc = companies.filter(c => new Date(c.createdAt).getTime() <= endOfMonth).length;
            series.push({ x: d.toLocaleDateString('pt-BR', { month: 'short' }), y: acc });
        }
        return series;
    }, [companies]);

    const sparklineOptions: ApexOptions = {
        chart: { type: 'area', sparkline: { enabled: true }, toolbar: { show: false }, animations: { enabled: true } },
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
        colors: ['#10b981'],
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            x: { show: true },
            y: { formatter: (v) => `${v} empresas` },
        },
    };

    return (
        <div className="space-y-6">
            {/* Stats Grid — KPI cards clicáveis */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KpiCard
                    icon={<Building2 className="w-5 h-5" />}
                    iconBg="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    label="Total"
                    value={companies.length}
                    sub={kpis.newThisMonth > 0 ? `+${kpis.newThisMonth} este mês` : 'Nenhuma este mês'}
                    delta={kpis.newDelta}
                    onClick={() => onNavigate('companies')}
                />
                <KpiCard
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    iconBg="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                    label="Assinantes"
                    value={kpis.allSubs.length}
                    valueClass="text-emerald-600"
                    sub={kpis.overdueSubs.length > 0
                        ? `${kpis.payingSubs.length} em dia • ${kpis.overdueSubs.length} inadimplente${kpis.overdueSubs.length === 1 ? '' : 's'}`
                        : 'Todos em dia'}
                    onClick={() => onNavigate('companies')}
                />
                <KpiCard
                    icon={<Play className="w-5 h-5" />}
                    iconBg="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400"
                    label="Em Trial"
                    value={kpis.trials.length}
                    valueClass="text-violet-600"
                    sub="Testando a plataforma"
                    onClick={() => onNavigate('companies', { quickFilter: 'trial' })}
                />
                <KpiCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    iconBg="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                    label="MRR"
                    value={fmtBRL(kpis.mrrContracted)}
                    valueClass="text-emerald-600 text-2xl"
                    sub={kpis.overdueSubs.length > 0
                        ? `${fmtBRL(kpis.mrrReceived)} recebido`
                        : `${kpis.payingSubs.length} ${kpis.payingSubs.length === 1 ? 'pagante' : 'pagantes'}`}
                    delta={kpis.payingMRRDelta}
                />
                <KpiCard
                    icon={<AlertTriangle className="w-5 h-5" />}
                    iconBg={kpis.suspended.length > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}
                    label="Suspensos"
                    value={kpis.suspended.length}
                    valueClass={kpis.suspended.length > 0 ? 'text-red-600' : 'text-slate-400'}
                    sub={kpis.totalOverdue > 0 ? `${fmtBRL(kpis.totalOverdue)} em atraso` : 'Nenhuma inadimplência'}
                    subClass={kpis.totalOverdue > 0 ? 'text-red-500 font-semibold' : 'text-slate-500'}
                    onClick={() => onNavigate('companies', { status: 'SUSPENDED' })}
                />
            </div>

            {/* Linha 2 — Crescimento + Snapshot infra */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Crescimento</p>
                            <p className="text-xs text-slate-400">Empresas acumuladas — últimos 6 meses</p>
                        </div>
                        <button
                            onClick={() => onNavigate('analytics')}
                            className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold inline-flex items-center gap-0.5"
                        >
                            Ver tudo <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    {growthSeries.length > 0 ? (
                        <ReactApexChart options={sparklineOptions} series={[{ name: 'Empresas', data: growthSeries }]} type="area" height={90} />
                    ) : (
                        <div className="h-[90px] flex items-center justify-center text-xs text-slate-400">Sem dados</div>
                    )}
                </div>

                <MiniStatCard label="Projetos" value={kpis.totalProjects.toLocaleString('pt-BR')} icon={<Activity className="w-4 h-4" />} accent="emerald" />
                <MiniStatCard label="Infraestrutura" value={(kpis.totalCTOs).toLocaleString('pt-BR')} sub={`${kpis.totalUsers.toLocaleString('pt-BR')} usuários no total`} icon={<Building2 className="w-4 h-4" />} accent="blue" />
            </div>

            {/* Pagamentos recentes — feed em tempo real (30s) ou filtrado por data */}
            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/30 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-emerald-500" />
                            <h3 className="font-bold text-sm">Pagamentos recentes</h3>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {paymentsDate
                                ? `${recentPayments.length} ${recentPayments.length === 1 ? 'pagamento' : 'pagamentos'} em ${new Date(paymentsDate + 'T00:00:00').toLocaleDateString('pt-BR')} · Total ${fmtBRL(recentPayments.reduce((a, p) => a + p.amount, 0))}`
                                : 'Últimos 10 · Atualiza a cada 30s'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={paymentsDate}
                            onChange={e => setPaymentsDate(e.target.value)}
                            max={new Date().toISOString().slice(0, 10)}
                            className="bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            aria-label="Filtrar pagamentos por data"
                        />
                        {paymentsDate && (
                            <button
                                onClick={() => setPaymentsDate('')}
                                className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                                title="Voltar pros últimos pagamentos"
                            >
                                Limpar
                            </button>
                        )}
                    </div>
                </div>
                {loadingPayments ? (
                    <div className="p-6 flex items-center justify-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : recentPayments.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">Nenhum pagamento recente</div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {recentPayments.map(p => {
                            const paidAt = new Date(p.paidAt);
                            const now = new Date();
                            const isToday = paidAt.toDateString() === now.toDateString();
                            const timeStr = isToday
                                ? paidAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                : paidAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                            const methodLabel = p.paymentMethod === 'CREDIT_CARD' ? 'Cartão' : p.paymentMethod === 'MANUAL' ? 'Manual' : 'PIX';
                            const methodColor = p.paymentMethod === 'CREDIT_CARD'
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                                : p.paymentMethod === 'MANUAL'
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        const c = companies.find(c => c.id === p.company.id);
                                        if (c) onSelectCompany?.(c);
                                    }}
                                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-left"
                                >
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{p.company.name}</span>
                                            {isToday && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 shrink-0">HOJE</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                            <span>{p.plan?.name || '—'}</span>
                                            <span>·</span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${methodColor}`}>{methodLabel}</span>
                                            <span>·</span>
                                            <span>{timeStr}</span>
                                        </div>
                                    </div>
                                    <div className="text-sm font-extrabold text-emerald-600 shrink-0">{fmtBRL(p.amount)}</div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Card consolidado — Vencimentos / Inadimplentes / Atividade em abas */}
            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 dark:border-slate-700/30 flex items-center overflow-x-auto">
                    {([
                        { id: 'expiring', label: 'Próximos vencimentos', icon: <Calendar className="w-3.5 h-3.5" />, count: kpis.expiringSoon.length, color: 'text-amber-500' },
                        { id: 'overdue', label: 'Inadimplentes', icon: <DollarSign className="w-3.5 h-3.5" />, count: kpis.overdue.length, color: 'text-rose-500' },
                        { id: 'activity', label: 'Atividade', icon: <Activity className="w-3.5 h-3.5" />, count: activity.length, color: 'text-emerald-500' },
                    ] as const).map(tab => {
                        const active = dashTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setDashTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${
                                    active
                                        ? 'border-emerald-500 text-slate-900 dark:text-white'
                                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                <span className={active ? tab.color : ''}>{tab.icon}</span>
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                                        active
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>{tab.count}</span>
                                )}
                            </button>
                        );
                    })}
                    <div className="flex-1" />
                    {dashTab === 'activity' && (
                        <button
                            onClick={() => onNavigate('audit')}
                            className="text-[11px] text-emerald-600 hover:text-emerald-500 font-bold uppercase tracking-wider px-4 shrink-0"
                        >
                            Ver tudo
                        </button>
                    )}
                    {dashTab === 'expiring' && kpis.expiringSoon.length > 6 && (
                        <button
                            onClick={() => onNavigate('companies', { quickFilter: 'expiring' })}
                            className="text-[11px] text-emerald-600 hover:text-emerald-500 font-bold uppercase tracking-wider px-4 shrink-0"
                        >
                            Ver tudo
                        </button>
                    )}
                    {dashTab === 'overdue' && kpis.overdue.length > 6 && (
                        <button
                            onClick={() => onNavigate('companies', { quickFilter: 'overdue' })}
                            className="text-[11px] text-emerald-600 hover:text-emerald-500 font-bold uppercase tracking-wider px-4 shrink-0"
                        >
                            Ver tudo
                        </button>
                    )}
                </div>

                <div className="max-h-[360px] overflow-y-auto">
                    {dashTab === 'expiring' && (
                        kpis.expiringSoon.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">Nenhuma assinatura vence em breve</div>
                        ) : (
                            <div className="p-2">
                                {kpis.expiringSoon.slice(0, 20).map(c => {
                                    const days = Math.ceil((new Date(c.subscriptionExpiresAt).getTime() - Date.now()) / 86400000);
                                    const urgent = days <= 2;
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => onSelectCompany?.(c)}
                                            className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg text-left transition-colors"
                                        >
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate flex-1">{c.name}</span>
                                            <span className={`text-[10px] font-bold ml-2 shrink-0 px-1.5 py-0.5 rounded ${urgent ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                                                {days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `${days} dias`}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {dashTab === 'overdue' && (
                        kpis.overdue.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">Sem inadimplência 🎉</div>
                        ) : (
                            <div className="p-2">
                                {kpis.overdue.slice(0, 20).map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => onSelectCompany?.(c)}
                                        className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg text-left transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{c.name}</div>
                                            <div className="text-[10px] text-slate-400">{c._financial?.overdueCount} {c._financial?.overdueCount === 1 ? 'fatura' : 'faturas'}</div>
                                        </div>
                                        <span className="text-xs font-extrabold text-rose-600 ml-2 shrink-0">{fmtBRL(c._financial?.overdueTotal || 0)}</span>
                                    </button>
                                ))}
                            </div>
                        )
                    )}

                    {dashTab === 'activity' && (
                        loadingActivity ? (
                            <div className="p-6 flex items-center justify-center text-slate-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                        ) : activity.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">Sem atividade recente</div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {activity.map((log, idx) => {
                                    const v = verbOf(log.action);
                                    const style = v ? ACTION_STYLE[v] : null;
                                    return (
                                        <div key={log.id || idx} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex gap-2 items-start">
                                            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${style?.bg || 'bg-slate-100 dark:bg-slate-800'} ${style?.text || 'text-slate-600'}`}>
                                                {style?.icon || <Activity className="w-3 h-3" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs leading-tight">
                                                    <span className="font-bold text-slate-900 dark:text-white">{log.user?.username || 'Sistema'}</span>
                                                    <span className="text-slate-500"> {style?.label?.toLowerCase() || 'fez'} </span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{entityLabel(log.entity)}</span>
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    {new Date(log.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Sub-components ────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string | number;
    valueClass?: string;
    sub?: string;
    subClass?: string;
    delta?: number;
    onClick?: () => void;
}> = ({ icon, iconBg, label, value, valueClass = 'text-slate-900 dark:text-white', sub, subClass = 'text-slate-500', delta, onClick }) => {
    const clickable = !!onClick;
    return (
        <div
            onClick={onClick}
            className={`bg-white dark:bg-[#1a1d23] p-5 rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm transition-all ${clickable ? 'cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700' : ''}`}
        >
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
                <span className="text-xs font-bold text-slate-400 uppercase">{label}</span>
                {typeof delta === 'number' && delta !== 0 && (
                    <span className={`ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {fmtPct(delta)}
                    </span>
                )}
                {typeof delta === 'number' && delta === 0 && (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                        <Minus className="w-3 h-3" />
                    </span>
                )}
            </div>
            <h3 className={`text-3xl font-extrabold ${valueClass}`}>{value}</h3>
            {sub && <p className={`text-xs mt-1 ${subClass}`}>{sub}</p>}
        </div>
    );
};

const MiniStatCard: React.FC<{
    label: string;
    value: string;
    sub?: string;
    icon: React.ReactNode;
    accent: 'emerald' | 'blue' | 'amber';
}> = ({ label, value, sub, icon, accent }) => {
    const accentMap: Record<string, string> = {
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
    };
    return (
        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${accentMap[accent]}`}>{icon}</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
    );
};

const ListCard: React.FC<{
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    items: any[];
    emptyText: string;
    renderItem: (item: any) => React.ReactNode;
    onSeeAll?: () => void;
}> = ({ title, subtitle, icon, items, emptyText, renderItem, onSeeAll }) => (
    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/30">
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="font-bold text-sm">{title}</h3>
                {items.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400 ml-auto">{items.length}</span>
                )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex-1 p-2 overflow-y-auto max-h-[280px]">
            {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">{emptyText}</div>
            ) : (
                <div className="space-y-0.5">{items.map(renderItem)}</div>
            )}
        </div>
        {onSeeAll && (
            <button onClick={onSeeAll} className="px-5 py-2 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 border-t border-slate-200 dark:border-slate-700/30 inline-flex items-center justify-center gap-0.5">
                Ver todas <ChevronRight className="w-3 h-3" />
            </button>
        )}
    </div>
);
