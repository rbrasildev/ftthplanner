import React, { useEffect, useMemo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { LayoutDashboard, FolderOpen, ChevronDown, Users, Cable, Box, CheckCircle2, AlertTriangle, MapPin, Activity, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Project, Customer, CTOStatus, CableStatus, CustomerStatus } from '../types';
import { calculateNetworkReport } from '../utils/reportUtils';
import * as customerService from '../services/customerService';
import * as projectService from '../services/projectService';
import { useTheme } from '../ThemeContext';

interface DashboardProps {
    projects: Project[];
    currentProjectId?: string;
    onOpenProject?: (id: string) => void;
}

// Paleta única usada em TODOS os charts — consistência semântica.
const PALETTE = {
    emerald: '#10b981',  // implantado / ativo / sucesso
    amber: '#f59e0b',    // planejado / aviso
    rose: '#f43f5e',     // não implantado / problema
    sky: '#0ea5e9',      // certificado / info
    indigo: '#6366f1',   // neutro / total
    slate: '#94a3b8',    // inativo
};

const STATUS_COLOR: Record<CTOStatus, string> = {
    PLANNED: PALETTE.amber,
    NOT_DEPLOYED: PALETTE.rose,
    DEPLOYED: PALETTE.emerald,
    CERTIFIED: PALETTE.sky,
};
const STATUS_LABEL: Record<CTOStatus, string> = {
    PLANNED: 'Planejado',
    NOT_DEPLOYED: 'Não implantado',
    DEPLOYED: 'Implantado',
    CERTIFIED: 'Certificado',
};

const daysAgo = (d: Date | string | number) => {
    const date = new Date(d);
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
};

const buildSparkline = (counts: number[]): ApexOptions => ({
    chart: { type: 'line', sparkline: { enabled: true }, animations: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    tooltip: { enabled: false },
    series: [{ data: counts }] as any,
});

export const Dashboard: React.FC<DashboardProps> = ({ projects, currentProjectId, onOpenProject }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [selectedId, setSelectedId] = useState<string>(currentProjectId || projects[0]?.id || '');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [fullProject, setFullProject] = useState<Project | null>(null);
    const [loadingProject, setLoadingProject] = useState(false);

    const summary = projects.find(p => p.id === selectedId) || projects[0];

    useEffect(() => {
        if (!projects.find(p => p.id === selectedId) && projects[0]) {
            setSelectedId(projects[0].id);
        }
    }, [projects, selectedId]);

    useEffect(() => {
        if (!summary) { setFullProject(null); return; }
        let cancelled = false;
        setLoadingProject(true);
        setFullProject(null);
        projectService.getProject(summary.id)
            .then(p => { if (!cancelled) setFullProject(p); })
            .catch(err => console.warn('[Dashboard] Failed to load project', err))
            .finally(() => { if (!cancelled) setLoadingProject(false); });
        return () => { cancelled = true; };
    }, [summary?.id]);

    useEffect(() => {
        if (!summary) { setCustomers([]); return; }
        let cancelled = false;
        setLoadingCustomers(true);
        customerService.getCustomers({ projectId: summary.id, limit: 5000 })
            .then(data => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : (data as any).data || [];
                setCustomers(list);
            })
            .catch(err => console.warn('[Dashboard] Failed to load customers', err))
            .finally(() => { if (!cancelled) setLoadingCustomers(false); });
        return () => { cancelled = true; };
    }, [summary?.id]);

    const project = fullProject || summary;
    const report = useMemo(
        () => project?.network ? calculateNetworkReport(project.network, customers) : null,
        [project, customers]
    );

    // --- Métricas derivadas ---
    const customerMetrics = useMemo(() => {
        if (customers.length === 0) {
            return { active: 0, suspended: 0, last30: 0, last7: 0, growthPct: 0, churnPct: 0 };
        }
        const active = customers.filter(c => c.status === 'ACTIVE').length;
        const suspended = customers.filter(c => c.status === 'SUSPENDED' || c.status === 'INACTIVE').length;
        const last30 = customers.filter(c => daysAgo(c.createdAt) <= 30).length;
        const last7 = customers.filter(c => daysAgo(c.createdAt) <= 7).length;
        const growthPct = customers.length > 0 ? (last30 / customers.length) * 100 : 0;
        const churnPct = customers.length > 0 ? (suspended / customers.length) * 100 : 0;
        return { active, suspended, last30, last7, growthPct, churnPct };
    }, [customers]);

    // Série diária dos últimos 30 dias (cumulativo) — base pra área + sparklines
    const customerGrowthSeries = useMemo(() => {
        const days = 30;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dailyAdds = new Array(days).fill(0);
        const labels: string[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i));
            labels.push(d.toISOString().slice(0, 10));
        }
        const baseTotal = customers.filter(c => daysAgo(c.createdAt) > days).length;
        customers.forEach(c => {
            const age = daysAgo(c.createdAt);
            if (age >= 0 && age < days) {
                const idx = days - 1 - age;
                dailyAdds[idx]++;
            }
        });
        // Cumulativo
        const cumulative: number[] = [];
        let acc = baseTotal;
        dailyAdds.forEach(n => { acc += n; cumulative.push(acc); });
        return { labels, cumulative, dailyAdds };
    }, [customers]);

    // Sparklines pros KPIs (últimos 30 dias, ratio relativo)
    const sparklines = useMemo(() => {
        const cust = customerGrowthSeries.cumulative;
        const flat = Array(30).fill(report?.cableCount ?? 0);
        return {
            infra: flat.map((_, i) => (report?.ctos?.total ?? 0) + i * 0), // sem timeline real → flat
            customers: cust,
            cables: flat,
            deployment: flat.map(() => report?.deploymentRate ?? 0),
        };
    }, [customerGrowthSeries, report]);

    const alerts = useMemo(() => {
        if (!project?.network) return [] as { severity: 'high' | 'med' | 'low'; label: string; count: number }[];
        const ctos = project.network.ctos || [];
        const cables = project.network.cables || [];
        const items: { severity: 'high' | 'med' | 'low'; label: string; count: number }[] = [];

        const ctosNaoImplantadas = ctos.filter(c => c.status === 'NOT_DEPLOYED').length;
        const cabosNaoImplantados = cables.filter(c => c.status === 'NOT_DEPLOYED').length;
        const ctosPlanejadas = ctos.filter(c => c.status === 'PLANNED').length;
        const ctosVazias = ctos.filter(c => (c as any).clientCount === 0 || !c.connections || c.connections.length === 0).length;
        const customersOrfaos = customers.filter(c => !c.ctoId).length;

        if (ctosNaoImplantadas > 0) items.push({ severity: 'high', label: 'CTOs não implantadas', count: ctosNaoImplantadas });
        if (customersOrfaos > 0) items.push({ severity: 'high', label: 'Clientes sem CTO atribuída', count: customersOrfaos });
        if (cabosNaoImplantados > 0) items.push({ severity: 'med', label: 'Cabos não implantados', count: cabosNaoImplantados });
        if (ctosVazias > 0) items.push({ severity: 'med', label: 'CTOs sem conexões', count: ctosVazias });
        if (ctosPlanejadas > 0) items.push({ severity: 'low', label: 'CTOs em planejamento', count: ctosPlanejadas });

        return items.sort((a, b) => b.count - a.count);
    }, [project, customers]);

    const recentCustomers = useMemo(() => {
        return [...customers]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 6);
    }, [customers]);

    if (projects.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
                <LayoutDashboard className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Sem projetos</h2>
                <p className="text-sm text-slate-500">Crie um projeto em "Meus Projetos" pra começar.</p>
            </div>
        );
    }

    if (!project || loadingProject || !report) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                <span className="text-sm">Carregando projeto...</span>
            </div>
        );
    }

    const labelColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.2)';

    // --- 1. Radial gauge: % implantação ---
    const gaugeOptions: ApexOptions = {
        chart: { type: 'radialBar', sparkline: { enabled: true }, animations: { enabled: true, speed: 500 } },
        colors: [report.deploymentRate >= 70 ? PALETTE.emerald : report.deploymentRate >= 40 ? PALETTE.amber : PALETTE.rose],
        plotOptions: {
            radialBar: {
                hollow: { size: '65%' },
                track: { background: isDark ? '#1e293b' : '#e2e8f0', strokeWidth: '100%' },
                dataLabels: {
                    name: { offsetY: -10, color: labelColor, fontSize: '12px', fontWeight: 600 },
                    value: { offsetY: 5, color: isDark ? '#fff' : '#0f172a', fontSize: '28px', fontWeight: 800, formatter: v => `${Math.round(Number(v))}%` },
                },
            },
        },
        labels: ['Implantação'],
    };

    // --- 2. Stacked column: infra por status ---
    const infraCategories = ['CTOs', 'CEOs', 'POPs', 'Postes'];
    const statusKeys: CTOStatus[] = ['DEPLOYED', 'CERTIFIED', 'PLANNED', 'NOT_DEPLOYED'];
    const infraSeries = statusKeys.map(s => ({
        name: STATUS_LABEL[s],
        data: [
            report.ctos.byStatus[s] ?? 0,
            report.ceos.byStatus[s] ?? 0,
            report.pops.byStatus[s] ?? 0,
            s === 'CERTIFIED' || s === 'NOT_DEPLOYED' ? 0 : (report.poles.byStatus as any)[s === 'DEPLOYED' ? 'LICENSED' : 'PLANNED'] ?? 0,
        ],
    }));
    const infraOptions: ApexOptions = {
        chart: { type: 'bar', stacked: true, toolbar: { show: false }, fontFamily: 'inherit' },
        colors: statusKeys.map(s => STATUS_COLOR[s]),
        plotOptions: { bar: { columnWidth: '50%', borderRadius: 4, borderRadiusApplication: 'end', borderRadiusWhenStacked: 'last' } },
        dataLabels: { enabled: false },
        xaxis: { categories: infraCategories, labels: { style: { colors: labelColor, fontSize: '11px', fontWeight: 600 } }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { style: { colors: labelColor, fontSize: '10px' } } },
        grid: { borderColor: gridColor, strokeDashArray: 4 },
        legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', labels: { colors: labelColor }, markers: { strokeWidth: 0 } as any },
        tooltip: { theme: isDark ? 'dark' : 'light' },
    };

    // --- 3. Area chart: crescimento clientes ---
    const growthOptions: ApexOptions = {
        chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
        colors: [PALETTE.emerald],
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 90, 100] } },
        dataLabels: { enabled: false },
        xaxis: {
            type: 'datetime', categories: customerGrowthSeries.labels,
            labels: { style: { colors: labelColor, fontSize: '10px' }, format: 'dd MMM' },
            axisBorder: { show: false }, axisTicks: { show: false },
        },
        yaxis: { labels: { style: { colors: labelColor, fontSize: '10px' }, formatter: v => `${v}` } },
        grid: { borderColor: gridColor, strokeDashArray: 4, padding: { left: 0, right: 0 } },
        tooltip: { theme: isDark ? 'dark' : 'light', x: { format: 'dd MMM yyyy' } },
    };

    // --- 4. Donut: cabos por status (metros) ---
    const cableDonutOptions: ApexOptions = {
        chart: { type: 'donut', fontFamily: 'inherit' },
        colors: [PALETTE.emerald, PALETTE.rose],
        labels: ['Implantado', 'Não implantado'],
        legend: { position: 'bottom', fontSize: '11px', labels: { colors: labelColor }, markers: { strokeWidth: 0 } as any },
        dataLabels: { enabled: false },
        stroke: { width: 2, colors: [isDark ? '#1a1d23' : '#fff'] },
        plotOptions: {
            pie: {
                donut: {
                    size: '72%',
                    labels: {
                        show: true,
                        name: { fontSize: '11px', color: labelColor, offsetY: 18 },
                        value: { fontSize: '20px', fontWeight: 800, color: isDark ? '#fff' : '#0f172a', offsetY: -12, formatter: v => `${Math.round(Number(v))}m` },
                        total: { show: true, label: 'Total', fontSize: '11px', color: labelColor, fontWeight: 600, formatter: () => `${Math.round(report.totalDeploymentMeters + report.totalPlannedMeters)}m` },
                    },
                },
            },
        },
        tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => `${Math.round(v)}m` } },
    };

    // --- 5. Donut: clientes por status ---
    const customerStatusKeys = (Object.keys(report.customers.byStatus) as CustomerStatus[]).filter(k => report.customers.byStatus[k] > 0);
    const customerColorMap: Record<CustomerStatus, string> = { ACTIVE: PALETTE.emerald, INACTIVE: PALETTE.slate, PLANNED: PALETTE.amber, SUSPENDED: PALETTE.rose };
    const customerLabelMap: Record<CustomerStatus, string> = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', PLANNED: 'Planejado', SUSPENDED: 'Suspenso' };
    const customerDonutOptions: ApexOptions = {
        chart: { type: 'donut', fontFamily: 'inherit' },
        colors: customerStatusKeys.map(k => customerColorMap[k]),
        labels: customerStatusKeys.map(k => customerLabelMap[k]),
        legend: { position: 'bottom', fontSize: '11px', labels: { colors: labelColor }, markers: { strokeWidth: 0 } as any },
        dataLabels: { enabled: false },
        stroke: { width: 2, colors: [isDark ? '#1a1d23' : '#fff'] },
        plotOptions: {
            pie: {
                donut: {
                    size: '72%',
                    labels: {
                        show: true,
                        name: { fontSize: '11px', color: labelColor, offsetY: 18 },
                        value: { fontSize: '20px', fontWeight: 800, color: isDark ? '#fff' : '#0f172a', offsetY: -12 },
                        total: { show: true, label: 'Total', fontSize: '11px', color: labelColor, fontWeight: 600, formatter: () => `${report.customers.total}` },
                    },
                },
            },
        },
        tooltip: { theme: isDark ? 'dark' : 'light' },
    };

    // --- 6. Horizontal bar: alertas ---
    const alertOptions: ApexOptions = {
        chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: '60%', distributed: true } },
        colors: alerts.map(a => a.severity === 'high' ? PALETTE.rose : a.severity === 'med' ? PALETTE.amber : PALETTE.slate),
        dataLabels: { enabled: true, textAnchor: 'start', offsetX: 4, style: { colors: ['#fff'], fontSize: '11px', fontWeight: 700 } },
        xaxis: { categories: alerts.map(a => a.label), labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { style: { colors: labelColor, fontSize: '11px' }, maxWidth: 250 } },
        grid: { show: false },
        legend: { show: false },
        tooltip: { theme: isDark ? 'dark' : 'light' },
    };

    return (
        <div className="max-w-7xl mx-auto space-y-5 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <LayoutDashboard className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                        Dashboard
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Indicadores em tempo real do projeto selecionado.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setPickerOpen(o => !o)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700/40 bg-white dark:bg-[#1a1d23] hover:border-emerald-500 transition-colors min-w-[240px]"
                        >
                            <FolderOpen className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex-1 text-left truncate">{project.name}</span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {pickerOpen && (
                            <div className="absolute right-0 top-full mt-2 w-full bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/40 rounded-xl shadow-xl z-20 max-h-72 overflow-y-auto">
                                {projects.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setSelectedId(p.id); setPickerOpen(false); }}
                                        className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700/40 ${p.id === selectedId ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {onOpenProject && (
                        <button
                            onClick={() => onOpenProject(project.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shrink-0"
                        >
                            <MapPin className="w-4 h-4" />
                            Abrir
                        </button>
                    )}
                </div>
            </div>

            {/* Linha 1 — KPIs com sparklines */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard
                    icon={<MapPin className="w-4 h-4" />}
                    label="Infraestrutura"
                    value={report.ctoCount + report.ceoCount + report.popCount + report.poleCount}
                    sub={`${report.ctoCount} CTOs · ${report.popCount} POPs`}
                    tone="indigo"
                    spark={null}
                />
                <KPICard
                    icon={<Users className="w-4 h-4" />}
                    label="Clientes"
                    value={customers.length}
                    sub={`${customerMetrics.last30} novos (30d)`}
                    tone="emerald"
                    spark={sparklines.customers}
                    sparkColor={PALETTE.emerald}
                    deltaPct={customerMetrics.growthPct}
                    loading={loadingCustomers}
                />
                <KPICard
                    icon={<Cable className="w-4 h-4" />}
                    label="Cabos"
                    value={`${((report.totalDeploymentMeters + report.totalPlannedMeters) / 1000).toFixed(1)}km`}
                    sub={`${report.cableCount} cabos cadastrados`}
                    tone="sky"
                    spark={null}
                />
                <KPICard
                    icon={<TrendingUp className="w-4 h-4" />}
                    label="Implantação"
                    value={`${Math.round(report.deploymentRate)}%`}
                    sub={`${report.deployedCtoRate.toFixed(0)}% das CTOs ativas`}
                    tone={report.deploymentRate >= 70 ? 'emerald' : report.deploymentRate >= 40 ? 'amber' : 'rose'}
                    spark={null}
                />
            </div>

            {/* Linha 2 — Gauge + Stacked column */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Widget icon={<TrendingUp className="w-4 h-4" />} title="Taxa de implantação" className="lg:col-span-1">
                    <div className="-mt-2 -mb-2">
                        <ReactApexChart options={gaugeOptions} series={[Math.round(report.deploymentRate)]} type="radialBar" height={260} />
                    </div>
                    <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                        {Math.round(report.totalDeploymentMeters)}m implantados de {Math.round(report.totalDeploymentMeters + report.totalPlannedMeters)}m
                    </p>
                </Widget>

                <Widget icon={<Box className="w-4 h-4" />} title="Infraestrutura por status" className="lg:col-span-2">
                    <ReactApexChart options={infraOptions} series={infraSeries} type="bar" height={280} />
                </Widget>
            </div>

            {/* Linha 3 — Área de crescimento (full width) */}
            <Widget icon={<TrendingUp className="w-4 h-4" />} title="Crescimento de clientes (últimos 30 dias)">
                {customers.length === 0 ? (
                    <EmptyHint text="Sem clientes ainda" />
                ) : (
                    <ReactApexChart
                        options={growthOptions}
                        series={[{ name: 'Clientes (cumulativo)', data: customerGrowthSeries.cumulative }]}
                        type="area"
                        height={220}
                    />
                )}
            </Widget>

            {/* Linha 4 — 2 donuts + atividade recente */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Widget icon={<Cable className="w-4 h-4" />} title="Cabos (metragem)">
                    {report.cables.total === 0 ? (
                        <EmptyHint text="Sem cabos" />
                    ) : (
                        <ReactApexChart
                            options={cableDonutOptions}
                            series={[Math.round(report.totalDeploymentMeters), Math.round(report.totalPlannedMeters)]}
                            type="donut"
                            height={260}
                        />
                    )}
                </Widget>

                <Widget icon={<Users className="w-4 h-4" />} title="Clientes por status">
                    {customers.length === 0 ? (
                        <EmptyHint text="Sem clientes" />
                    ) : (
                        <ReactApexChart
                            options={customerDonutOptions}
                            series={customerStatusKeys.map(k => report.customers.byStatus[k])}
                            type="donut"
                            height={260}
                        />
                    )}
                </Widget>

                <Widget icon={<Activity className="w-4 h-4" />} title="Atividade recente">
                    {recentCustomers.length === 0 ? (
                        <EmptyHint text="Sem atividade recente" />
                    ) : (
                        <ul className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                            {recentCustomers.map(c => {
                                const days = daysAgo(c.createdAt);
                                return (
                                    <li key={c.id} className="flex items-center gap-2 text-xs pb-2 border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-700 dark:text-slate-200 font-semibold truncate">
                                                {c.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400 truncate">Novo cliente</p>
                                        </div>
                                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                            {days === 0 ? 'hoje' : days === 1 ? '1 dia' : `${days}d`}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Widget>
            </div>

            {/* Linha 5 — Alertas */}
            <Widget icon={<AlertTriangle className="w-4 h-4" />} title="Alertas e pendências">
                {alerts.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-emerald-600 dark:text-emerald-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Sem pendências — projeto em dia.
                    </div>
                ) : (
                    <ReactApexChart
                        options={alertOptions}
                        series={[{ name: 'Itens', data: alerts.map(a => a.count) }]}
                        type="bar"
                        height={Math.max(180, alerts.length * 48)}
                    />
                )}
            </Widget>
        </div>
    );
};

// --- Componentes auxiliares ---

const KPICard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    tone: 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo';
    spark: number[] | null;
    sparkColor?: string;
    deltaPct?: number;
    loading?: boolean;
}> = ({ icon, label, value, sub, tone, spark, sparkColor, deltaPct, loading }) => {
    const toneText = {
        emerald: 'text-emerald-600',
        amber: 'text-amber-600',
        rose: 'text-rose-600',
        sky: 'text-sky-600',
        indigo: 'text-indigo-600',
    }[tone];

    return (
        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700/30 bg-white dark:bg-[#1a1d23]/30 relative overflow-hidden">
            <div className={`flex items-center gap-1.5 ${toneText}`}>
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
                <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : value}
                </div>
                {typeof deltaPct === 'number' && !loading && (
                    <span className={`text-[11px] font-bold flex items-center gap-0.5 ${deltaPct >= 5 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {deltaPct >= 5 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {deltaPct.toFixed(0)}%
                    </span>
                )}
            </div>
            {sub && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">{sub}</p>}
            {spark && spark.length > 0 && (
                <div className="mt-2 -mx-4 -mb-4 opacity-60">
                    <ReactApexChart
                        options={{ ...buildSparkline(spark), colors: [sparkColor || '#10b981'] }}
                        series={[{ data: spark }]}
                        type="line"
                        height={42}
                    />
                </div>
            )}
        </div>
    );
};

const Widget: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }> = ({ icon, title, children, className = '' }) => (
    <div className={`p-4 rounded-2xl border border-slate-100 dark:border-slate-700/30 bg-white dark:bg-[#1a1d23]/30 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-400">{icon}</span>
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h3>
        </div>
        {children}
    </div>
);

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
    <p className="text-xs text-slate-400 italic text-center py-8">{text}</p>
);
