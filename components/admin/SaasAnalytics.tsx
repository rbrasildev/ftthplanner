import React, { useEffect, useState, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import * as saasService from '../../services/saasService';
import { useTheme } from '../../ThemeContext';

// Emerald primário + tons distintos pros donuts e categorias.
const PALETTE = ['#10b981', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export const SaasAnalytics: React.FC<{ companies?: any[] }> = ({ companies = [] }) => {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    useEffect(() => {
        const load = async () => {
            try {
                const data = await saasService.getGlobalMapData();
                setProjects(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ── KPIs ────────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const isTrial = (c: any) => c.plan?.type === 'TRIAL' || c.plan?.name?.toLowerCase().includes('trial') || c.plan?.name?.toLowerCase().includes('teste');
        const isFree = (c: any) => !c.plan?.price || c.plan.price <= 0 || c.plan?.name?.toLowerCase().includes('grátis') || c.plan?.name?.toLowerCase().includes('free');

        const paying = companies.filter(c => c.status === 'ACTIVE' && !isTrial(c) && !isFree(c));
        const trials = companies.filter(c => isTrial(c) || c.status === 'TRIAL');
        const suspended = companies.filter(c => c.status === 'SUSPENDED');
        const cancelled = companies.filter(c => c.status === 'CANCELLED');
        const active = companies.filter(c => c.status === 'ACTIVE');

        const mrr = paying.reduce((acc, c) => acc + (c.plan?.price || 0), 0);
        const totalCTOs = companies.reduce((acc, c) => acc + (c._count?.ctos || 0), 0);
        const totalPOPs = companies.reduce((acc, c) => acc + (c._count?.pops || 0), 0);
        const totalUsers = companies.reduce((acc, c) => acc + (c._count?.users || 0), 0);
        const totalProjects = companies.reduce((acc, c) => acc + (c._count?.projects || 0), 0);

        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthOf = (d: string) => d?.slice(0, 7);
        const thisMonthCount = companies.filter(c => monthOf(c.createdAt) === thisMonth).length;
        const lastMonthCount = companies.filter(c => monthOf(c.createdAt) === lastMonth).length;
        const momDelta = lastMonthCount === 0
            ? (thisMonthCount > 0 ? 100 : 0)
            : ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100;

        const expiringSoon = companies.filter(c => {
            if (c.status !== 'ACTIVE' || !c.subscriptionExpiresAt) return false;
            const days = (new Date(c.subscriptionExpiresAt).getTime() - Date.now()) / 86400000;
            return days >= 0 && days <= 7;
        });

        return { paying, trials, suspended, cancelled, active, mrr, totalCTOs, totalPOPs, totalUsers, totalProjects, thisMonthCount, momDelta, expiringSoon };
    }, [companies]);

    // ── Theme base options compartilhado por todos os charts ───────────────
    const baseOptions: Partial<ApexOptions> = useMemo(() => ({
        chart: {
            fontFamily: 'inherit',
            foreColor: isDark ? '#94a3b8' : '#64748b',
            toolbar: { show: false },
            animations: { enabled: true, speed: 400 },
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            style: { fontSize: '12px' },
        },
        grid: {
            borderColor: isDark ? '#334155' : '#e2e8f0',
            strokeDashArray: 3,
        },
        legend: {
            fontSize: '11px',
            labels: { colors: isDark ? '#cbd5e1' : '#475569' },
            markers: { strokeWidth: 0 },
            itemMargin: { horizontal: 6, vertical: 2 },
        },
    }), [isDark]);

    // ── Plans donut ─────────────────────────────────────────────────────────
    const planChart = useMemo(() => {
        const map = new Map<string, number>();
        companies.forEach(c => {
            const k = c.plan?.name || 'Sem plano';
            map.set(k, (map.get(k) || 0) + 1);
        });
        const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        const labels = entries.map(([k]) => k);
        const series = entries.map(([, v]) => v);
        return { labels, series, total: series.reduce((a, b) => a + b, 0) };
    }, [companies]);

    // ── Status donut ────────────────────────────────────────────────────────
    const statusChart = useMemo(() => {
        const entries = [
            { label: 'Ativas', value: kpis.active.length },
            { label: 'Trial', value: kpis.trials.length },
            { label: 'Suspensas', value: kpis.suspended.length },
            { label: 'Canceladas', value: kpis.cancelled.length },
        ].filter(d => d.value > 0);
        return {
            labels: entries.map(d => d.label),
            series: entries.map(d => d.value),
        };
    }, [kpis]);

    // ── Top 5 infra bar ─────────────────────────────────────────────────────
    const topChart = useMemo(() => {
        const top = [...companies]
            .map(c => ({ name: c.name, infra: (c._count?.ctos || 0) + (c._count?.pops || 0) }))
            .filter(d => d.infra > 0)
            .sort((a, b) => b.infra - a.infra)
            .slice(0, 5);
        return {
            categories: top.map(t => t.name),
            data: top.map(t => t.infra),
        };
    }, [companies]);

    // ── Growth line ────────────────────────────────────────────────────────
    const growthChart = useMemo(() => {
        const monthOf = (d: string) => d?.slice(0, 7);
        const map = new Map<string, number>();
        companies.forEach(c => {
            const k = monthOf(c.createdAt);
            if (k) map.set(k, (map.get(k) || 0) + 1);
        });
        const months = Array.from(map.keys()).sort();
        if (months.length === 0) return { categories: [] as string[], cumulative: [] as number[], monthly: [] as number[] };

        const start = new Date(months[0] + '-01');
        const end = new Date(months[months.length - 1] + '-01');
        const cats: string[] = [];
        const monthlyArr: number[] = [];
        const cumulativeArr: number[] = [];
        let acc = 0;
        for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const v = map.get(key) || 0;
            acc += v;
            cats.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
            monthlyArr.push(v);
            cumulativeArr.push(acc);
        }
        return { categories: cats, cumulative: cumulativeArr, monthly: monthlyArr };
    }, [companies]);

    if (loading) return <div className="h-64 flex items-center justify-center text-slate-400">Carregando dados...</div>;

    const trendArrow = kpis.momDelta > 0 ? '↑' : kpis.momDelta < 0 ? '↓' : '→';
    const trendClass = kpis.momDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : kpis.momDelta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500';

    // ─── chart options ──────────────────────────────────────────────────────
    const donutBaseOptions = (labels: string[], total: number, centerLabel: string): ApexOptions => ({
        ...baseOptions,
        chart: { ...baseOptions.chart, type: 'donut' },
        labels,
        colors: PALETTE,
        stroke: { width: 2, colors: [isDark ? '#1a1d23' : '#fff'] },
        dataLabels: { enabled: false },
        legend: { ...baseOptions.legend, position: 'bottom' },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: { show: true, fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', offsetY: 14 },
                        value: { show: true, fontSize: '24px', fontWeight: 700, color: isDark ? '#fff' : '#0f172a', offsetY: -10 },
                        total: { show: true, label: centerLabel, fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', formatter: () => String(total) },
                    },
                },
            },
        },
        tooltip: { ...baseOptions.tooltip, y: { formatter: (v) => `${v} empresa${v === 1 ? '' : 's'}` } },
    });

    const barOptions: ApexOptions = {
        ...baseOptions,
        chart: { ...baseOptions.chart, type: 'bar' },
        colors: ['#10b981'],
        plotOptions: {
            bar: { horizontal: true, borderRadius: 4, barHeight: '70%', dataLabels: { position: 'top' } },
        },
        dataLabels: {
            enabled: true,
            offsetX: 30,
            style: { colors: [isDark ? '#cbd5e1' : '#334155'], fontSize: '11px', fontWeight: 700 },
        },
        xaxis: { categories: topChart.categories, labels: { style: { fontSize: '10px' } } },
        yaxis: { labels: { style: { fontSize: '11px' } } },
        tooltip: { ...baseOptions.tooltip, y: { formatter: (v) => `${v} elementos` } },
    };

    const growthOptions: ApexOptions = {
        ...baseOptions,
        chart: { ...baseOptions.chart, type: 'area', stacked: false, zoom: { enabled: false } },
        colors: ['#10b981', '#10b981'],
        stroke: { curve: 'smooth', width: [3, 0] },
        fill: {
            type: ['gradient', 'solid'],
            gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 100] },
            opacity: [0.35, 0.7],
        },
        dataLabels: { enabled: false },
        xaxis: { categories: growthChart.categories, labels: { style: { fontSize: '10px' } } },
        yaxis: [
            { title: { text: 'Acumulado', style: { fontSize: '10px', fontWeight: 600 } }, labels: { style: { fontSize: '10px' } } },
            { opposite: true, title: { text: 'No mês', style: { fontSize: '10px', fontWeight: 600 } }, labels: { style: { fontSize: '10px' } } },
        ],
        legend: { ...baseOptions.legend, position: 'top', horizontalAlign: 'right' },
        markers: { size: [4, 0], strokeWidth: 0 },
    };

    return (
        <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="col-span-2 md:col-span-3 lg:col-span-2 bg-gradient-to-br from-emerald-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">MRR</p>
                    <h3 className="text-3xl font-extrabold">{fmtBRL(kpis.mrr)}</h3>
                    <p className="text-xs text-emerald-100 mt-1">{kpis.paying.length} {kpis.paying.length === 1 ? 'pagante' : 'pagantes'}</p>
                </div>

                <Kpi label="Empresas ativas" value={kpis.active.length} sub={`${companies.length} total`} accent="emerald" />
                <Kpi label="Em trial" value={kpis.trials.length} sub="convertem em até 30 dias" accent="amber" />
                <Kpi label="Suspensas" value={kpis.suspended.length} sub={kpis.expiringSoon.length > 0 ? `${kpis.expiringSoon.length} expiram em 7d` : 'Sem alertas'} accent={kpis.suspended.length > 0 ? 'rose' : 'slate'} />
                <Kpi label="Novas no mês" value={kpis.thisMonthCount} sub={<span className={trendClass}>{trendArrow} {fmtPct(kpis.momDelta)} vs mês anterior</span>} accent="emerald" />
            </div>

            {/* Charts Row 1 — donuts + bar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard title="Distribuição por plano" subtitle="Quantas empresas em cada plano">
                    {planChart.total > 0 ? (
                        <ReactApexChart options={donutBaseOptions(planChart.labels, planChart.total, 'empresas')} series={planChart.series} type="donut" height={280} />
                    ) : <Empty />}
                </ChartCard>
                <ChartCard title="Status das empresas" subtitle="Distribuição por status atual">
                    {statusChart.series.length > 0 ? (
                        <ReactApexChart options={donutBaseOptions(statusChart.labels, statusChart.series.reduce((a, b) => a + b, 0), 'total')} series={statusChart.series} type="donut" height={280} />
                    ) : <Empty />}
                </ChartCard>
                <ChartCard title="Top 5 — infraestrutura" subtitle="Empresas com mais CTOs + POPs">
                    {topChart.data.length > 0 ? (
                        <ReactApexChart options={barOptions} series={[{ name: 'Infraestrutura', data: topChart.data }]} type="bar" height={280} />
                    ) : <Empty />}
                </ChartCard>
            </div>

            {/* Charts Row 2 — growth */}
            <div className="grid grid-cols-1 gap-6">
                <ChartCard title="Crescimento de empresas" subtitle="Acumulado e novas por mês">
                    {growthChart.categories.length > 0 ? (
                        <ReactApexChart
                            options={growthOptions}
                            series={[
                                { name: 'Acumulado', type: 'area', data: growthChart.cumulative },
                                { name: 'Novas no mês', type: 'column', data: growthChart.monthly },
                            ]}
                            height={320}
                        />
                    ) : <Empty />}
                </ChartCard>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat label="Total de CTOs" value={kpis.totalCTOs.toLocaleString('pt-BR')} />
                <MiniStat label="Total de POPs" value={kpis.totalPOPs.toLocaleString('pt-BR')} />
                <MiniStat label="Usuários" value={kpis.totalUsers.toLocaleString('pt-BR')} />
                <MiniStat label="Projetos" value={kpis.totalProjects.toLocaleString('pt-BR')} />
            </div>
        </div>
    );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const Kpi: React.FC<{ label: string; value: number | string; sub?: React.ReactNode; accent?: 'emerald' | 'amber' | 'rose' | 'slate' }> = ({ label, value, sub, accent = 'slate' }) => {
    const accentMap: Record<string, string> = {
        emerald: 'text-emerald-600 dark:text-emerald-400',
        amber: 'text-amber-600 dark:text-amber-400',
        rose: 'text-rose-600 dark:text-rose-400',
        slate: 'text-slate-900 dark:text-white',
    };
    return (
        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl p-5 border border-slate-200 dark:border-slate-700/30 shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>
            <h3 className={`text-2xl font-extrabold ${accentMap[accent]}`}>{value}</h3>
            {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{sub}</div>}
        </div>
    );
};

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-white dark:bg-[#1a1d23] rounded-xl p-4 border border-slate-200 dark:border-slate-700/30">
        <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
    </div>
);

const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="bg-white dark:bg-[#1a1d23] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm">
        <div className="mb-3">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {children}
    </div>
);

const Empty: React.FC = () => (
    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
);
