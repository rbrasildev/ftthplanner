import React, { useState, useEffect, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useLanguage } from '../../LanguageContext';
import { AlertTriangle, TrendingUp, Users, HeartPulse, ShieldAlert, DollarSign, Bell, Mail, Search, EyeOff, Activity, Clock, ArrowUpDown, ChevronDown, Copy, Loader2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import * as saasService from '../../services/saasService';

interface Alert {
    id: string;
    userId: string;
    type: string;
    severity: string;
    status: string;
    message: string;
    createdAt: string;
    user: { id: string; username: string; email: string };
}

interface UserRetentionData {
    id: string;
    username: string;
    email: string;
    company: string;
    lastLoginAt: string | null;
    churnRiskScore: number;
    estimatedLTV: number;
    monthlyRevenue: number;
    alerts: Alert[];
    hasProject: boolean;
    paymentFailed: boolean;
}

interface RetentionDashboardResponse {
    summary: {
        activeTodayPercent: number;
        highRiskPercent: number;
        neverCreatedProject: number;
        inactive7Days: number;
        revenueAtRisk: number;
        averageLTV: number;
        churnForcastNextMonth: number;
    };
    alerts: Alert[];
    users: UserRetentionData[];
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const PAGE_SIZE = 20;

const ALERT_TYPE_LABEL: Record<string, string> = {
    PAYMENT_FAILED: 'Pagamento',
    INACTIVE_USER: 'Inatividade',
    NO_PROJECT: 'Sem projeto',
    LOW_USAGE: 'Baixo uso',
    APPROACHING_LIMIT: 'Próximo do limite',
    SUBSCRIPTION_EXPIRING: 'Assinatura vencendo',
    HIGH_CHURN_RISK: 'Alto risco churn',
};
const labelAlertType = (t: string) => ALERT_TYPE_LABEL[t] || t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

type SortKey = 'risk' | 'mrr' | 'lastLogin' | 'username';

export const SaasRetentionIntelligence: React.FC = () => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [data, setData] = useState<RetentionDashboardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterRisk, setFilterRisk] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'LOW'>('ALL');
    const [filterNoProjects, setFilterNoProjects] = useState(false);
    const [filterPaymentFailed, setFilterPaymentFailed] = useState(false);

    const [sortKey, setSortKey] = useState<SortKey>('risk');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await saasService.getRetentionDashboard();
            setData(response);
        } catch (error) {
            console.error('Failed to load retention data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshData = async () => {
        try {
            setRefreshing(true);
            await saasService.processRetentionData();
            await loadData();
        } catch (error) {
            console.error('Failed to process retention data manually', error);
            alert(t('error_processing_retention') || 'Erro ao processar as métricas de retenção. Verifique o console.');
        } finally {
            setRefreshing(false);
        }
    };

    const copyEmail = (email: string) => {
        navigator.clipboard.writeText(email);
        setCopiedEmail(email);
        setTimeout(() => setCopiedEmail(null), 1500);
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir(key === 'username' ? 'asc' : 'desc');
        }
        setVisibleCount(PAGE_SIZE);
    };

    // ── Filter + sort ──────────────────────────────────────────────────────
    const filteredUsers = useMemo(() => {
        if (!data) return [];
        return data.users.filter(user => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = !term ||
                user.username?.toLowerCase().includes(term) ||
                user.company?.toLowerCase().includes(term) ||
                user.email?.toLowerCase().includes(term);

            let matchesRisk = true;
            if (filterRisk === 'CRITICAL') matchesRisk = user.churnRiskScore >= 80;
            else if (filterRisk === 'HIGH') matchesRisk = user.churnRiskScore >= 60 && user.churnRiskScore < 80;
            else if (filterRisk === 'LOW') matchesRisk = user.churnRiskScore < 40;

            const matchesNoProj = filterNoProjects ? !user.hasProject : true;
            const matchesPayment = filterPaymentFailed ? user.paymentFailed : true;

            return matchesSearch && matchesRisk && matchesNoProj && matchesPayment;
        }).sort((a, b) => {
            const dir = sortDir === 'asc' ? 1 : -1;
            switch (sortKey) {
                case 'risk': return (a.churnRiskScore - b.churnRiskScore) * dir;
                case 'mrr': return (a.monthlyRevenue - b.monthlyRevenue) * dir;
                case 'lastLogin': {
                    const at = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
                    const bt = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
                    return (at - bt) * dir;
                }
                case 'username': return a.username.localeCompare(b.username) * dir;
            }
        });
    }, [data, searchTerm, filterRisk, filterNoProjects, filterPaymentFailed, sortKey, sortDir]);

    // ── Risk distribution chart ────────────────────────────────────────────
    const riskDistribution = useMemo(() => {
        if (!data) return { labels: [], series: [] };
        const buckets = { Crítico: 0, Alto: 0, Médio: 0, Baixo: 0 };
        data.users.forEach(u => {
            if (u.churnRiskScore >= 80) buckets['Crítico']++;
            else if (u.churnRiskScore >= 60) buckets['Alto']++;
            else if (u.churnRiskScore >= 40) buckets['Médio']++;
            else buckets['Baixo']++;
        });
        const entries = Object.entries(buckets).filter(([, v]) => v > 0);
        return { labels: entries.map(([k]) => k), series: entries.map(([, v]) => v) };
    }, [data]);

    // ── MRR at risk by bucket ──────────────────────────────────────────────
    const mrrAtRiskByBucket = useMemo(() => {
        if (!data) return { categories: [], series: [] as number[] };
        const buckets = { Crítico: 0, Alto: 0, Médio: 0 };
        data.users.forEach(u => {
            if (u.churnRiskScore >= 80) buckets['Crítico'] += u.monthlyRevenue;
            else if (u.churnRiskScore >= 60) buckets['Alto'] += u.monthlyRevenue;
            else if (u.churnRiskScore >= 40) buckets['Médio'] += u.monthlyRevenue;
        });
        return {
            categories: Object.keys(buckets),
            series: Object.values(buckets).map(v => Number(v.toFixed(2))),
        };
    }, [data]);

    if (loading || !data) {
        return <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
            <HeartPulse className="w-12 h-12 text-slate-200 animate-pulse mb-4" />
            <p>{t('retention_loading') || 'Carregando dados de retenção…'}</p>
        </div>;
    }

    const { summary, alerts } = data;
    const visibleUsers = filteredUsers.slice(0, visibleCount);
    const hasMore = filteredUsers.length > visibleCount;

    const baseChartOptions: Partial<ApexOptions> = {
        chart: {
            fontFamily: 'inherit',
            foreColor: isDark ? '#94a3b8' : '#64748b',
            toolbar: { show: false },
        },
        tooltip: { theme: isDark ? 'dark' : 'light' },
        legend: {
            fontSize: '11px',
            labels: { colors: isDark ? '#cbd5e1' : '#475569' },
            markers: { strokeWidth: 0 },
        },
    };

    const riskDonutOptions: ApexOptions = {
        ...baseChartOptions,
        chart: { ...baseChartOptions.chart, type: 'donut' },
        labels: riskDistribution.labels,
        colors: ['#ef4444', '#f59e0b', '#eab308', '#10b981'],
        stroke: { width: 2, colors: [isDark ? '#1a1d23' : '#fff'] },
        dataLabels: { enabled: false },
        legend: { ...baseChartOptions.legend, position: 'bottom' },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        value: { fontSize: '22px', fontWeight: 700, color: isDark ? '#fff' : '#0f172a' },
                        total: {
                            show: true, label: 'usuários',
                            fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b',
                            formatter: () => String(data.users.length),
                        },
                    },
                },
            },
        },
        tooltip: { ...baseChartOptions.tooltip, y: { formatter: (v) => `${v} usuário${v === 1 ? '' : 's'}` } },
    };

    const mrrBarOptions: ApexOptions = {
        ...baseChartOptions,
        chart: { ...baseChartOptions.chart, type: 'bar' },
        colors: ['#ef4444', '#f59e0b', '#eab308'],
        plotOptions: {
            bar: {
                horizontal: false, distributed: true, columnWidth: '50%', borderRadius: 6,
                dataLabels: { position: 'top' },
            },
        },
        dataLabels: {
            enabled: true,
            formatter: (v) => fmtBRL(Number(v)),
            offsetY: -22,
            style: { fontSize: '11px', fontWeight: 700, colors: [isDark ? '#cbd5e1' : '#334155'] },
        },
        xaxis: { categories: mrrAtRiskByBucket.categories, labels: { style: { fontSize: '11px' } } },
        yaxis: { labels: { formatter: (v) => fmtBRL(v), style: { fontSize: '10px' } } },
        legend: { show: false },
        tooltip: { ...baseChartOptions.tooltip, y: { formatter: (v) => fmtBRL(v) } },
        grid: { borderColor: isDark ? '#334155' : '#e2e8f0', strokeDashArray: 3 },
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <HeartPulse className="w-6 h-6 text-rose-500" />
                        {t('retention_title') || 'Inteligência de retenção'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('retention_subtitle') || 'Identifique usuários em risco e tome ação antes do churn.'}
                    </p>
                </div>
                <button
                    onClick={handleRefreshData}
                    disabled={refreshing}
                    className="px-4 py-2 bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                    {t('retention_refresh_data') || 'Recalcular'}
                </button>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg shadow-emerald-500/20 text-white">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-white/20 rounded-xl">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-extrabold">{summary.activeTodayPercent.toFixed(1)}%</h3>
                    <p className="text-emerald-100 mt-1 text-sm font-medium">{t('retention_active_today') || 'Ativos hoje'}</p>
                </div>

                <Kpi
                    icon={<ShieldAlert className="w-5 h-5" />}
                    iconBg="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                    badge={summary.churnForcastNextMonth > 0 ? { text: `${summary.churnForcastNextMonth.toFixed(0)} churn previsto`, tone: 'rose' } : undefined}
                    value={`${summary.highRiskPercent.toFixed(1)}%`}
                    label={t('retention_high_risk_churn') || 'Alto risco de churn'}
                />

                <Kpi
                    icon={<TrendingUp className="w-5 h-5" />}
                    iconBg="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                    badge={{ text: 'LTV médio', tone: 'slate' }}
                    value={fmtBRL(summary.averageLTV)}
                    label={t('retention_value_over_time') || 'Valor estimado por cliente'}
                />

                <Kpi
                    icon={<DollarSign className="w-5 h-5" />}
                    iconBg="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                    accent="border-l-4 border-l-red-500"
                    value={fmtBRL(summary.revenueAtRisk)}
                    label={t('retention_revenue_at_risk') || 'Receita em risco'}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Distribuição de risco" subtitle="Usuários por faixa de score">
                    {riskDistribution.series.length > 0 ? (
                        <ReactApexChart options={riskDonutOptions} series={riskDistribution.series} type="donut" height={260} />
                    ) : <EmptyChart />}
                </ChartCard>
                <ChartCard title="MRR em risco por faixa" subtitle="Quanto está em jogo em cada nível">
                    {mrrAtRiskByBucket.series.some(v => v > 0) ? (
                        <ReactApexChart options={mrrBarOptions} series={[{ name: 'MRR', data: mrrAtRiskByBucket.series }]} type="bar" height={260} />
                    ) : <EmptyChart />}
                </ChartCard>
                <InfoCard>
                    <InfoRow icon={<EyeOff className="w-5 h-5 text-amber-500" />} value={summary.neverCreatedProject} label={t('retention_never_created_project') || 'Nunca criaram projeto'} />
                    <InfoRow icon={<Clock className="w-5 h-5 text-amber-500" />} value={summary.inactive7Days} label={t('retention_inactive_7_days') || 'Inativos há 7+ dias'} />
                    <InfoRow icon={<AlertTriangle className="w-5 h-5 text-rose-500" />} value={alerts.length} label="Alertas abertos" />
                    <InfoRow icon={<Users className="w-5 h-5 text-emerald-500" />} value={data.users.length} label="Total de usuários" />
                </InfoCard>
            </div>

            {/* Detailed Table & Alerts Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Users Table */}
                <div className="lg:col-span-3 bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/30">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Users className="w-5 h-5 text-emerald-500" />
                                {t('retention_table_title') || 'Usuários monitorados'}
                                <span className="text-xs font-medium text-slate-400 ml-1">({filteredUsers.length})</span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder={t('retention_search_placeholder') || 'Buscar usuário, empresa, email…'}
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setVisibleCount(PAGE_SIZE); }}
                                        className="pl-9 pr-4 py-2 bg-[#f9fafb] dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 w-full md:w-64"
                                    />
                                </div>
                                <select
                                    className="px-3 py-2 bg-[#f9fafb] dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl text-sm font-medium"
                                    value={filterRisk}
                                    onChange={e => { setFilterRisk(e.target.value as any); setVisibleCount(PAGE_SIZE); }}
                                >
                                    <option value="ALL">{t('retention_filter_risk_all') || 'Todos os riscos'}</option>
                                    <option value="CRITICAL">{t('retention_filter_risk_critical') || 'Crítico (≥80)'}</option>
                                    <option value="HIGH">{t('retention_filter_risk_high') || 'Alto (60–79)'}</option>
                                    <option value="LOW">{t('retention_filter_risk_low') || 'Baixo (<40)'}</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded text-emerald-600" checked={filterNoProjects} onChange={e => { setFilterNoProjects(e.target.checked); setVisibleCount(PAGE_SIZE); }} />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('retention_filter_no_projects') || 'Sem projetos'}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded text-red-600" checked={filterPaymentFailed} onChange={e => { setFilterPaymentFailed(e.target.checked); setVisibleCount(PAGE_SIZE); }} />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('retention_filter_payment_failed') || 'Falha de pagamento'}</span>
                            </label>
                        </div>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-[#f9fafb]/50 dark:bg-[#151820]/50 text-slate-500 font-semibold uppercase text-xs tracking-wider sticky top-0 backdrop-blur z-10">
                                <tr>
                                    <SortableTh sortKey="username" current={sortKey} dir={sortDir} onToggle={toggleSort}>{t('retention_th_client') || 'Cliente'}</SortableTh>
                                    <SortableTh sortKey="risk" current={sortKey} dir={sortDir} onToggle={toggleSort}>{t('retention_th_risk') || 'Risco'}</SortableTh>
                                    <SortableTh sortKey="mrr" current={sortKey} dir={sortDir} onToggle={toggleSort}>{t('retention_th_mrr_ltv') || 'MRR / LTV'}</SortableTh>
                                    <SortableTh sortKey="lastLogin" current={sortKey} dir={sortDir} onToggle={toggleSort}>{t('retention_th_last_access') || 'Último acesso'}</SortableTh>
                                    <th className="px-4 py-3">{t('retention_th_status_alerts') || 'Status / Alertas'}</th>
                                    <th className="px-4 py-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {visibleUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{user.username}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-[180px]">{user.company}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex justify-center items-center text-xs font-bold shadow-sm ${user.churnRiskScore >= 80 ? 'bg-rose-100 text-rose-700' : user.churnRiskScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {Math.round(user.churnRiskScore)}
                                                </div>
                                                <div className="w-20 bg-slate-100 dark:bg-[#22262e] h-1.5 rounded-full overflow-hidden hidden sm:block">
                                                    <div
                                                        className={`h-full ${user.churnRiskScore >= 80 ? 'bg-rose-500' : user.churnRiskScore >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${user.churnRiskScore}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtBRL(user.monthlyRevenue)}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">LTV: {fmtBRL(user.estimatedLTV)}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.lastLoginAt ? (
                                                <div className="text-xs">
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium block">{new Date(user.lastLoginAt).toLocaleDateString('pt-BR')}</span>
                                                    <span className="text-slate-500 text-[10px]">
                                                        {t('retention_days_ago', { val: Math.floor((Date.now() - new Date(user.lastLoginAt).getTime()) / 86400000) }) || `há ${Math.floor((Date.now() - new Date(user.lastLoginAt).getTime()) / 86400000)} dias`}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">{t('retention_never_accessed') || 'Nunca acessou'}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {!user.hasProject && (
                                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-[#22262e] text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded" title="Não tem projetos">Sem projeto</span>
                                                )}
                                                {user.paymentFailed && (
                                                    <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded" title="Pagamento falhou">Falha pgto</span>
                                                )}
                                                {user.alerts.length > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded flex items-center gap-1" title={`${user.alerts.length} alerta(s) ativo(s)`}>
                                                        <Bell className="w-3 h-3" /> {user.alerts.length}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button
                                                    onClick={() => copyEmail(user.email)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                    title={copiedEmail === user.email ? 'Copiado!' : 'Copiar email'}
                                                >
                                                    {copiedEmail === user.email ? <span className="text-[10px] font-bold text-emerald-600">OK</span> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                                <a
                                                    href={`mailto:${user.email}`}
                                                    className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-500 hover:text-emerald-700 transition-colors"
                                                    title={`Enviar email para ${user.email}`}
                                                >
                                                    <Mail className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                            <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            <p className="text-sm">{t('retention_no_users_found') || 'Nenhum usuário corresponde aos filtros.'}</p>
                                            {(searchTerm || filterRisk !== 'ALL' || filterNoProjects || filterPaymentFailed) && (
                                                <button
                                                    onClick={() => { setSearchTerm(''); setFilterRisk('ALL'); setFilterNoProjects(false); setFilterPaymentFailed(false); }}
                                                    className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                                                >Limpar filtros</button>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {hasMore && (
                        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700/30 flex items-center justify-between bg-[#f9fafb]/50 dark:bg-[#151820]/50">
                            <span className="text-xs text-slate-500">Mostrando {visibleUsers.length} de {filteredUsers.length}</span>
                            <button
                                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                className="px-3 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                            >
                                <ChevronDown className="w-3.5 h-3.5" /> Carregar mais
                            </button>
                        </div>
                    )}
                </div>

                {/* Active Alerts Feed */}
                <div className="lg:col-span-1 bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm p-6 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Bell className="w-5 h-5 text-emerald-500" />
                            {t('retention_alerts_title') || 'Alertas ativos'}
                        </h3>
                        <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{alerts.length}</span>
                    </div>
                    <div className="overflow-y-auto max-h-[500px] pr-2 space-y-3">
                        {alerts.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">{t('retention_no_recent_events') || 'Sem alertas no momento.'}</div>
                        ) : alerts.map(alert => (
                            <div key={alert.id} className={`p-3 rounded-xl border ${alert.severity === 'CRITICAL' ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${alert.severity === 'CRITICAL' ? 'bg-rose-200/50 text-rose-700' : 'bg-amber-200/50 text-amber-700'}`}>
                                        {labelAlertType(alert.type)}
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                        {new Date(alert.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight mb-2">{alert.message}</p>
                                <div className="flex items-center gap-2 text-xs">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-[#22262e] flex items-center justify-center font-bold text-[8px] text-slate-600">
                                        {alert.user?.username?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-slate-600 dark:text-slate-400 font-medium truncate">{alert.user?.username}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Sub-components ─────────────────────────────────────────────────────────

const Kpi: React.FC<{
    icon: React.ReactNode;
    iconBg: string;
    badge?: { text: string; tone: 'rose' | 'slate' };
    accent?: string;
    value: string;
    label: string;
}> = ({ icon, iconBg, badge, accent, value, label }) => {
    const badgeTone = badge?.tone === 'rose'
        ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
        : 'bg-slate-100 dark:bg-[#22262e] text-slate-600 dark:text-slate-400';
    return (
        <div className={`bg-white dark:bg-[#1a1d23] p-5 rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm ${accent || ''}`}>
            <div className="flex justify-between items-start mb-3">
                <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
                {badge && <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${badgeTone}`}>{badge.text}</span>}
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{label}</p>
        </div>
    );
};

const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="bg-white dark:bg-[#1a1d23] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm">
        <div className="mb-3">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {children}
    </div>
);

const EmptyChart: React.FC = () => (
    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem dados ainda</div>
);

const InfoCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-white dark:bg-[#1a1d23] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm">
        <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-3">Snapshot</h3>
        <div className="space-y-3">{children}</div>
    </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; value: number; label: string }> = ({ icon, value, label }) => (
    <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-50 dark:bg-[#22262e] rounded-lg shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{value.toLocaleString('pt-BR')}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{label}</p>
        </div>
    </div>
);

const SortableTh: React.FC<{
    sortKey: SortKey;
    current: SortKey;
    dir: 'asc' | 'desc';
    onToggle: (k: SortKey) => void;
    children: React.ReactNode;
}> = ({ sortKey, current, dir, onToggle, children }) => {
    const active = current === sortKey;
    return (
        <th className="px-4 py-3">
            <button
                onClick={() => onToggle(sortKey)}
                className={`flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
            >
                {children}
                <ArrowUpDown className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
                {active && <span className="text-[9px] ml-0.5">{dir === 'asc' ? '↑' : '↓'}</span>}
            </button>
        </th>
    );
};
