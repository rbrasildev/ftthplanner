import React, { useMemo } from 'react';
import { X, FileText, LayoutList, Cable, ClipboardCheck, Download, Info } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { NetworkState } from '../../types';
import { calculateNetworkReport } from '../../utils/reportUtils';

interface ProjectReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    network: NetworkState;
    projectName: string;
}

export const ProjectReportModal: React.FC<ProjectReportModalProps> = ({ isOpen, onClose, network, projectName }) => {
    const { t } = useLanguage();

    const report = useMemo(() => calculateNetworkReport(network), [network]);

    if (!isOpen) return null;

    const handleExportCSV = () => {
        let csv = `Item,Quantity\n`;
        csv += `${t('report_total_ctos')},${report.ctoCount}\n`;
        csv += `${t('report_total_ceos')},${report.ceoCount}\n`;
        csv += `${t('report_total_pops')},${report.popCount}\n`;
        csv += `${t('report_total_poles')},${report.poleCount}\n`;
        csv += `\n${t('report_cable_type')},${t('report_qty')},${t('report_total_meters')}\n`;
        report.cableStats.forEach(stat => {
            csv += `${stat.fiberCount}FO,${stat.count},${stat.totalMeters.toFixed(2)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `report_${projectName || 'project'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-950 w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                {t('report_title')}
                            </h2>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {projectName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* Metrics Dashboard */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <MetricCard
                            icon={<LayoutList className="w-4 h-4" />}
                            label={t('report_infrastructure')}
                            value={report.ctoCount + report.ceoCount + report.popCount + report.poleCount}
                            color="blue"
                        />
                        <MetricCard
                            icon={<Cable className="w-4 h-4" />}
                            label={t('report_total_meters_active')}
                            value={`${report.totalDeploymentMeters.toFixed(0)}m`}
                            color="emerald"
                        />
                        <MetricCard
                            icon={<ClipboardCheck className="w-4 h-4" />}
                            label={t('report_total_meters_planned')}
                            value={`${report.totalPlannedMeters.toFixed(0)}m`}
                            color="amber"
                        />
                    </div>

                    {/* Infrastructure Table */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <LayoutList className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                {t('report_infrastructure')}
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <ReportRow label={t('report_total_ctos')} value={report.ctoCount} />
                            <ReportRow label={t('report_total_ceos')} value={report.ceoCount} />
                            <ReportRow label={t('report_total_pops')} value={report.popCount} />
                            <ReportRow label={t('report_total_poles')} value={report.poleCount} />
                        </div>
                    </section>

                    {/* Cables Table */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <Cable className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                {t('report_cables')}
                            </h3>
                        </div>

                        {report.cableStats.length > 0 ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900/50">
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('report_cable_type')}</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">{t('report_qty')}</th>
                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">{t('report_total_meters')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {report.cableStats.map((stat) => (
                                            <tr key={stat.fiberCount} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                                <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    {stat.fiberCount}FO
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 text-center">
                                                    {stat.count}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white text-right">
                                                    {stat.totalMeters.toFixed(1)}m
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-6 text-center">
                                <p className="text-sm text-slate-500">{t('report_no_data')}</p>
                            </div>
                        )}
                    </section>

                    {/* Info Alert */}
                    <div className="p-4 bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 rounded-2xl flex gap-3">
                        <Info className="w-5 h-5 text-sky-500 flex-shrink-0" />
                        <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400 leading-relaxed">
                            {t('report_estimated')}: Os valores de metragem são baseados na distância geográfica (geodésica) entre os pontos e incluem as reservas técnicas cadastradas. O valor real pode variar conforme a topografia e curvas de instalação.
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        {t('done')}
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-white transition-all transform active:scale-95"
                    >
                        <Download className="w-4 h-4" />
                        {t('report_export_csv')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: 'blue' | 'emerald' | 'amber' }> = ({ icon, label, value, color }) => {
    const colors = {
        blue: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
        emerald: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
        amber: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
    };

    return (
        <div className={`p-4 rounded-2xl border ${colors[color]} flex flex-col gap-1`}>
            <div className="flex items-center gap-2 opacity-70">
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-xl font-black">{value}</div>
        </div>
    );
};

const ReportRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">{label}</span>
        <span className="text-lg font-black text-slate-900 dark:text-white">{value}</span>
    </div>
);
