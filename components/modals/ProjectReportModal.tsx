import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, FileText, Cable, Download, Info, Users, Box, Building2, UtilityPole, TrendingUp, MapPin, Printer, FileSpreadsheet, ChevronDown, ClipboardList } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { NetworkState, Customer, CTOStatus, PoleStatus, CableStatus, CustomerStatus } from '../../types';
import { calculateNetworkReport, StatusBreakdown } from '../../utils/reportUtils';

interface ProjectReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    network: NetworkState;
    projectName: string;
    customers?: Customer[];
}

const CTO_STATUS_LABEL: Record<CTOStatus, string> = {
    PLANNED: 'Planejado',
    NOT_DEPLOYED: 'Não implantado',
    DEPLOYED: 'Implantado',
    CERTIFIED: 'Certificado',
};
const CTO_STATUS_TONE: Record<CTOStatus, 'amber' | 'rose' | 'emerald' | 'sky'> = {
    PLANNED: 'amber',
    NOT_DEPLOYED: 'rose',
    DEPLOYED: 'emerald',
    CERTIFIED: 'sky',
};
const POLE_STATUS_LABEL: Record<PoleStatus, string> = {
    PLANNED: 'Planejado',
    ANALYSING: 'Em análise',
    LICENSED: 'Licenciado',
};
const POLE_STATUS_TONE: Record<PoleStatus, 'amber' | 'sky' | 'emerald'> = {
    PLANNED: 'amber',
    ANALYSING: 'sky',
    LICENSED: 'emerald',
};
const CABLE_STATUS_LABEL: Record<CableStatus, string> = {
    NOT_DEPLOYED: 'Não implantado',
    DEPLOYED: 'Implantado',
};
const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
    ACTIVE: 'Ativo',
    SUSPENDED: 'Suspenso',
    INACTIVE: 'Inativo',
    CANCELLED: 'Cancelado',
    PLANNED: 'Planejado',
};
const CUSTOMER_STATUS_TONE: Record<CustomerStatus, 'emerald' | 'slate' | 'amber' | 'rose'> = {
    ACTIVE: 'emerald',
    SUSPENDED: 'amber',
    INACTIVE: 'amber', // visualmente próximo do #BFAA0F — sem custom tone aqui
    CANCELLED: 'slate',
    PLANNED: 'amber',
};

type Tone = 'emerald' | 'amber' | 'rose' | 'sky' | 'slate' | 'indigo';

const TONE_CLASSES: Record<Tone, { dot: string; pill: string; text: string }> = {
    emerald: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', text: 'text-emerald-600' },
    amber: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', text: 'text-amber-600' },
    rose: { dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', text: 'text-rose-600' },
    sky: { dot: 'bg-sky-500', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', text: 'text-sky-600' },
    slate: { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', text: 'text-slate-500' },
    indigo: { dot: 'bg-indigo-500', pill: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', text: 'text-indigo-600' },
};

export const ProjectReportModal: React.FC<ProjectReportModalProps> = ({ isOpen, onClose, network, projectName, customers = [] }) => {
    const { t } = useLanguage();
    const report = useMemo(() => calculateNetworkReport(network, customers), [network, customers]);
    const [exportOpen, setExportOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);
    const snapshotDate = useMemo(() => new Date(), [isOpen]);

    useEffect(() => {
        if (!exportOpen) return;
        const onClick = (e: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [exportOpen]);

    if (!isOpen) return null;

    const handleExportCSV = () => {
        setExportOpen(false);
        const lines: string[] = [];
        lines.push('Categoria,Status,Quantidade');
        const dumpBreakdown = <T extends string>(label: string, bd: StatusBreakdown<T>, labelMap: Record<T, string>) => {
            for (const status of Object.keys(bd.byStatus) as T[]) {
                lines.push(`${label},${labelMap[status]},${bd.byStatus[status]}`);
            }
            lines.push(`${label},TOTAL,${bd.total}`);
        };
        dumpBreakdown('CTO', report.ctos, CTO_STATUS_LABEL);
        dumpBreakdown('CEO', report.ceos, CTO_STATUS_LABEL);
        dumpBreakdown('POP', report.pops, CTO_STATUS_LABEL);
        dumpBreakdown('Poste', report.poles, POLE_STATUS_LABEL);
        dumpBreakdown('Cabo', report.cables, CABLE_STATUS_LABEL);
        dumpBreakdown('Cliente', report.customers, CUSTOMER_STATUS_LABEL);
        lines.push('');
        lines.push('Cabo (Fibras),Quantidade,Total (m),Implantado (m),Planejado (m)');
        report.cableStats.forEach(s => {
            lines.push(`${s.fiberCount}FO,${s.count},${s.totalMeters.toFixed(1)},${s.deployedMeters.toFixed(1)},${s.plannedMeters.toFixed(1)}`);
        });
        lines.push('');
        lines.push(`Drops,${report.dropCount}`);
        lines.push(`Drops (metros),${report.dropMeters.toFixed(1)}`);
        lines.push(`Cabos implantados (m),${report.totalDeploymentMeters.toFixed(1)}`);
        lines.push(`Cabos planejados (m),${report.totalPlannedMeters.toFixed(1)}`);
        lines.push(`Taxa de implantação,${report.deploymentRate.toFixed(1)}%`);

        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `relatorio_${projectName || 'projeto'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        setExportOpen(false);
        document.body.classList.add('printing-report');
        const cleanup = () => {
            document.body.classList.remove('printing-report');
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        setTimeout(() => window.print(), 50);
    };

    const totalInfra = report.ctoCount + report.ceoCount + report.popCount + report.poleCount;
    const isEmpty = totalInfra === 0 && report.customerCount === 0 && report.cableCount === 0;

    const formattedDate = snapshotDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedTime = snapshotDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
        <>
            <style>{`
                @media print {
                    body.printing-report > *:not(#report-print-root) { display: none !important; }
                    #report-print-root { position: static !important; background: white !important; padding: 0 !important; }
                    #report-print-root .print-hide { display: none !important; }
                    #report-print-root .print-card { background: white !important; border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
                    #report-print-root .print-bg-light { background: #f8fafc !important; }
                    #report-print-root, #report-print-root * { color: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #report-print-root .print-page-break { page-break-before: always; }
                    @page { size: A4; margin: 1.5cm; }
                }
            `}</style>
            <div id="report-print-root" className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white dark:bg-[#151820] w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/30 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 print-card">
                    {/* Header — snapshot identity */}
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-[#1a1d23]/50 print-bg-light">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                <ClipboardList className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                                        Snapshot do Projeto
                                    </h2>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 shrink-0 print-hide">
                                        Exportável
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                    {projectName} · gerado em {formattedDate}, {formattedTime}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 shrink-0 print-hide"
                            aria-label="Fechar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Methodology ribbon — discreet, at top so user reads BEFORE the metrics */}
                    <div className="px-6 py-2.5 bg-slate-50/30 dark:bg-[#1a1d23]/30 border-b border-slate-100 dark:border-slate-700/30 flex items-center gap-2 print-hide">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                            Métricas calculadas por distância geodésica incluindo reservas técnicas. Valores reais variam conforme topografia.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {isEmpty ? (
                            <EmptyReportState onClose={onClose} />
                        ) : (
                            <>
                                {/* KPIs principais */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <KPI
                                        icon={<MapPin className="w-4 h-4" />}
                                        label="Infraestrutura"
                                        value={totalInfra}
                                        sub={`${report.ctoCount} CTO · ${report.ceoCount} CEO · ${report.popCount} POP · ${report.poleCount} Postes`}
                                        tone="indigo"
                                    />
                                    <KPI
                                        icon={<Users className="w-4 h-4" />}
                                        label="Clientes"
                                        value={report.customerCount}
                                        sub={`${report.dropCount} drops conectados`}
                                        tone="emerald"
                                    />
                                    <KPI
                                        icon={<Cable className="w-4 h-4" />}
                                        label="Cabos"
                                        value={report.cableCount}
                                        sub={`${(report.totalDeploymentMeters + report.totalPlannedMeters).toFixed(0)}m totais`}
                                        tone="sky"
                                    />
                                    <KPI
                                        icon={<TrendingUp className="w-4 h-4" />}
                                        label="Taxa de implantação"
                                        value={`${report.deploymentRate.toFixed(0)}%`}
                                        sub={`${report.deployedCtoRate.toFixed(0)}% das CTOs ativas`}
                                        tone={report.deploymentRate >= 70 ? 'emerald' : report.deploymentRate >= 40 ? 'amber' : 'rose'}
                                    />
                                </div>

                                {/* CTOs / CEOs / POPs / Poles — breakdown por status */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <BreakdownCard
                                        icon={<Box className="w-4 h-4" />}
                                        title="CTOs"
                                        total={report.ctos.total}
                                        breakdown={report.ctos}
                                        labelMap={CTO_STATUS_LABEL}
                                        toneMap={CTO_STATUS_TONE}
                                    />
                                    <BreakdownCard
                                        icon={<Box className="w-4 h-4" />}
                                        title="CEOs"
                                        total={report.ceos.total}
                                        breakdown={report.ceos}
                                        labelMap={CTO_STATUS_LABEL}
                                        toneMap={CTO_STATUS_TONE}
                                    />
                                    <BreakdownCard
                                        icon={<Building2 className="w-4 h-4" />}
                                        title="POPs"
                                        total={report.pops.total}
                                        breakdown={report.pops}
                                        labelMap={CTO_STATUS_LABEL}
                                        toneMap={CTO_STATUS_TONE}
                                    />
                                    <BreakdownCard
                                        icon={<UtilityPole className="w-4 h-4" />}
                                        title="Postes"
                                        total={report.poles.total}
                                        breakdown={report.poles}
                                        labelMap={POLE_STATUS_LABEL}
                                        toneMap={POLE_STATUS_TONE}
                                    />
                                </div>

                                {/* Cabos por bitola */}
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <Cable className="w-4 h-4 text-slate-400" />
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                            Cabos por bitola
                                        </h3>
                                    </div>

                                    {report.cableStats.length > 0 ? (
                                        <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700/30 print-card">
                                            <table className="w-full text-left border-collapse text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-[#1a1d23]/50 print-bg-light">
                                                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bitola</th>
                                                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Qtd</th>
                                                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Implantado</th>
                                                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Planejado</th>
                                                        <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {report.cableStats.map((stat) => (
                                                        <tr key={stat.fiberCount} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                            <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">{stat.fiberCount}FO</td>
                                                            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 text-center">{stat.count}</td>
                                                            <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 text-right tabular-nums">{stat.deployedMeters.toFixed(0)}m</td>
                                                            <td className="px-4 py-2.5 text-amber-600 dark:text-amber-400 text-right tabular-nums">{stat.plannedMeters.toFixed(0)}m</td>
                                                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white text-right tabular-nums">{stat.totalMeters.toFixed(0)}m</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-slate-50 dark:bg-[#1a1d23]/50 font-bold print-bg-light">
                                                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">Total</td>
                                                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 text-center">{report.cableCount}</td>
                                                        <td className="px-4 py-2.5 text-emerald-700 dark:text-emerald-300 text-right tabular-nums">{report.totalDeploymentMeters.toFixed(0)}m</td>
                                                        <td className="px-4 py-2.5 text-amber-700 dark:text-amber-300 text-right tabular-nums">{report.totalPlannedMeters.toFixed(0)}m</td>
                                                        <td className="px-4 py-2.5 text-slate-900 dark:text-white text-right tabular-nums">{(report.totalDeploymentMeters + report.totalPlannedMeters).toFixed(0)}m</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 dark:bg-[#1a1d23]/30 rounded-2xl p-6 text-center">
                                            <p className="text-sm text-slate-500">Sem cabos cadastrados</p>
                                        </div>
                                    )}
                                </section>

                                {/* Clientes & Drops */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <BreakdownCard
                                        icon={<Users className="w-4 h-4" />}
                                        title="Clientes por status"
                                        total={report.customers.total}
                                        breakdown={report.customers}
                                        labelMap={CUSTOMER_STATUS_LABEL}
                                        toneMap={CUSTOMER_STATUS_TONE}
                                    />
                                    <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-[#1a1d23]/30 space-y-3 print-card">
                                        <div className="flex items-center gap-2">
                                            <Cable className="w-4 h-4 text-slate-400" />
                                            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Drops</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <SimpleStat label="Conectados" value={report.dropCount} />
                                            <SimpleStat label="Metros totais" value={`${report.dropMeters.toFixed(0)}m`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Print-only footer for audit trail */}
                                <div className="hidden print:block pt-4 border-t border-slate-200 text-[10px] text-slate-500">
                                    Snapshot gerado em {formattedDate} às {formattedTime} · FTTHPlanner
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer — primary action: export */}
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-[#1a1d23]/50 flex justify-end gap-2 print-hide">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            {t('done') || 'Fechar'}
                        </button>
                        {!isEmpty && (
                            <div className="relative" ref={exportRef}>
                                <button
                                    onClick={() => setExportOpen(o => !o)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-colors active:scale-[0.98]"
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar relatório
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {exportOpen && (
                                    <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                        <button
                                            onClick={handleExportCSV}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                            <div className="min-w-0">
                                                <div className="font-bold">Planilha (CSV)</div>
                                                <div className="text-[10px] text-slate-400">Abrir no Excel</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={handlePrint}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left border-t border-slate-100 dark:border-slate-800"
                                        >
                                            <Printer className="w-4 h-4 text-sky-500" />
                                            <div className="min-w-0">
                                                <div className="font-bold">Imprimir / PDF</div>
                                                <div className="text-[10px] text-slate-400">Layout otimizado A4</div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// --- COMPONENTES ---

const KPI: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; tone: Tone }> = ({ icon, label, value, sub, tone }) => {
    const c = TONE_CLASSES[tone];
    return (
        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700/30 bg-white dark:bg-[#1a1d23]/30 flex flex-col gap-1 print-card">
            <div className={`flex items-center gap-1.5 ${c.text}`}>
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{value}</div>
            {sub && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">{sub}</p>}
        </div>
    );
};

interface BreakdownCardProps<T extends string> {
    icon: React.ReactNode;
    title: string;
    total: number;
    breakdown: StatusBreakdown<T>;
    labelMap: Record<T, string>;
    toneMap: Record<T, Tone>;
}

function BreakdownCard<T extends string>({ icon, title, total, breakdown, labelMap, toneMap }: BreakdownCardProps<T>) {
    const statuses = Object.keys(breakdown.byStatus) as T[];

    return (
        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-[#1a1d23]/30 print-card">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 dark:text-slate-500">{icon}</span>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h3>
                </div>
                <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{total}</span>
            </div>

            {total === 0 ? (
                <p className="text-[11px] text-slate-400 italic text-center py-2">Nenhum cadastrado</p>
            ) : (
                <>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3">
                        {statuses.map(s => {
                            const count = breakdown.byStatus[s];
                            if (count === 0) return null;
                            const pct = (count / total) * 100;
                            const tone = TONE_CLASSES[toneMap[s]];
                            return <div key={s} className={tone.dot} style={{ width: `${pct}%` }} title={`${labelMap[s]}: ${count}`} />;
                        })}
                    </div>
                    <div className="space-y-1.5">
                        {statuses.map(s => {
                            const count = breakdown.byStatus[s];
                            const pct = total > 0 ? (count / total) * 100 : 0;
                            const tone = TONE_CLASSES[toneMap[s]];
                            return (
                                <div key={s} className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-2 h-2 rounded-full ${tone.dot} shrink-0`} />
                                        <span className="text-slate-600 dark:text-slate-300 truncate">{labelMap[s]}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] text-slate-400 tabular-nums">{pct.toFixed(0)}%</span>
                                        <span className="font-bold text-slate-900 dark:text-white tabular-nums w-8 text-right">{count}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

const SimpleStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-white dark:bg-[#1a1d23]/50 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700/30">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">{value}</p>
    </div>
);

const EmptyReportState: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#22262e] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
            <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Sem dados para o relatório
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-5">
            Adicione CTOs, postes, cabos ou clientes no mapa para gerar o snapshot do projeto.
        </p>
        <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-colors"
        >
            <MapPin className="w-4 h-4" />
            Ir para o mapa
        </button>
    </div>
);
