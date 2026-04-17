import React, { useMemo } from 'react';
import { OpticalPathResult } from '../../utils/opticalUtils';
import { Splitter } from '../../types';
import { SplitterCatalogItem } from '../../services/catalogService';
import { X, CheckCircle, AlertTriangle, XCircle, Activity, ArrowDown, Network, Unplug, Zap, GitFork } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

interface OpticalPowerModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: OpticalPathResult | null;
    splitterName: string;
    splitter?: Splitter | null;
    catalogItem?: SplitterCatalogItem;
}

const getPortStatus = (power: number): 'OK' | 'MARGINAL' | 'FAIL' => {
    if (power >= -25) return 'OK';
    if (power >= -28) return 'MARGINAL';
    return 'FAIL';
};

const statusConfig = {
    OK: { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', icon: CheckCircle },
    MARGINAL: { color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: AlertTriangle },
    FAIL: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: XCircle },
};

export const OpticalPowerModal: React.FC<OpticalPowerModalProps> = ({ isOpen, onClose, result, splitterName, splitter, catalogItem }) => {
    const { t } = useLanguage();

    const outputPorts = useMemo(() => {
        if (!result || !splitter || !catalogItem) return null;
        const isDisc = !isFinite(result.finalPower);
        if (isDisc) return null;

        const inputPower = result.finalPower;
        let att: any = catalogItem.attenuation;
        if (typeof att === 'string' && att.trim().startsWith('{')) {
            try { att = JSON.parse(att); } catch { return null; }
        }

        const isUnbalanced = catalogItem.mode === 'Unbalanced' && typeof att === 'object' && att?.port1 && att?.port2;

        const ports: { index: number; label: string; attenuation: number; power: number; isHighPower: boolean }[] = [];

        if (isUnbalanced) {
            const p1Att = parseFloat(att.port1);
            const p2Att = parseFloat(att.port2);
            if (isNaN(p1Att) || isNaN(p2Att)) return null;
            const hpIdx = p1Att < p2Att ? 0 : 1;
            ports.push(
                { index: 0, label: `${t('port_label', { number: 1 }) || 'Porta 1'}`, attenuation: p1Att, power: inputPower - p1Att, isHighPower: hpIdx === 0 },
                { index: 1, label: `${t('port_label', { number: 2 }) || 'Porta 2'}`, attenuation: p2Att, power: inputPower - p2Att, isHighPower: hpIdx === 1 }
            );
        } else {
            let attVal = 0;
            if (typeof att === 'object' && att?.value !== undefined) {
                attVal = parseFloat(att.value);
            } else if (typeof att === 'number') {
                attVal = att;
            } else if (typeof att === 'string') {
                attVal = parseFloat(att);
            }
            if (isNaN(attVal) || attVal === 0) return null;

            for (let i = 0; i < splitter.outputPortIds.length; i++) {
                ports.push({
                    index: i,
                    label: `${t('port_label', { number: i + 1 }) || `Porta ${i + 1}`}`,
                    attenuation: attVal,
                    power: inputPower - attVal,
                    isHighPower: false
                });
            }
        }

        return ports;
    }, [result, splitter, catalogItem, t]);

    if (!isOpen || !result) return null;

    const isDisconnected = !isFinite(result.finalPower);

    const getStatusColor = (status: string) => {
        if (isDisconnected) return 'text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700';
        return statusConfig[status as keyof typeof statusConfig]
            ? `${statusConfig[status as keyof typeof statusConfig].color} ${statusConfig[status as keyof typeof statusConfig].bg} ${statusConfig[status as keyof typeof statusConfig].border}`
            : 'text-slate-500';
    };

    const getStatusIcon = (status: string) => {
        if (isDisconnected) return <Unplug className="w-8 h-8" />;
        const cfg = statusConfig[status as keyof typeof statusConfig];
        return cfg ? <cfg.icon className="w-8 h-8" /> : null;
    };

    const getStatusLabel = (status: string) => {
        if (isDisconnected) return t('no_signal') || 'Sem Sinal';
        if (status === 'OK') return t('status_ok');
        if (status === 'MARGINAL') return t('status_marginal');
        if (status === 'FAIL') return t('status_fail');
        return status;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700/30 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center justify-between bg-slate-50/50 dark:bg-[#1a1d23]/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                                {t('optical_budget') || 'Orçamento Óptico'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {t('optical_path_for') || 'Caminho óptico para'} <span className="font-bold text-slate-700 dark:text-slate-300">{splitterName}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/30 dark:bg-[#1a1d23]">

                    {/* Summary Card */}
                    <div className={`p-5 rounded-xl border flex items-center justify-between ${getStatusColor(result.status)}`}>
                        <div className="flex items-center gap-4">
                            {getStatusIcon(result.status)}
                            <div>
                                <div className="text-[10px] font-bold opacity-70 uppercase tracking-wider">{t('final_power')}</div>
                                <div className="text-3xl font-bold font-mono tracking-tight">
                                    {isDisconnected ? '-- ' : result.finalPower.toFixed(2)} dBm
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-bold opacity-70 uppercase tracking-wider">{t('status')}</div>
                            <div className="text-xl font-bold">{getStatusLabel(result.status)}</div>
                        </div>
                    </div>

                    {/* Output Power Distribution */}
                    {outputPorts && outputPorts.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-3 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/30 pb-2 flex items-center gap-2">
                                <GitFork className="w-3.5 h-3.5 text-indigo-500" />
                                {t('output_distribution') || 'Potência nas Saídas'}
                            </h3>
                            <div className={`grid gap-2 ${outputPorts.length <= 2 ? 'grid-cols-2' : outputPorts.length <= 4 ? 'grid-cols-4' : 'grid-cols-4 sm:grid-cols-8'}`}>
                                {outputPorts.map((port) => {
                                    const ps = getPortStatus(port.power);
                                    const cfg = statusConfig[ps];
                                    const StatusIcon = cfg.icon;
                                    return (
                                        <div key={port.index} className={`px-2 py-2 rounded-lg border ${cfg.bg} ${cfg.border} flex items-center gap-2 relative`}>
                                            {port.isHighPower && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                                                    <Zap className="w-2.5 h-2.5 text-amber-900" />
                                                </div>
                                            )}
                                            <StatusIcon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                                            <div className="flex flex-col min-w-0">
                                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-none">{port.label}</div>
                                                <div className={`text-sm font-bold font-mono ${cfg.color} leading-tight`}>{port.power.toFixed(2)} <span className="text-[8px] font-normal">dBm</span></div>
                                                <div className="text-[8px] text-slate-400 font-mono leading-none">-{port.attenuation.toFixed(1)} dB</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white dark:bg-[#22262e] rounded-xl border border-slate-100 dark:border-slate-700/30">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1.5">{t('origin_olt')}</div>
                            <div className="text-slate-900 dark:text-white font-bold flex items-center gap-2 text-sm">
                                <Network className="w-4 h-4 text-emerald-500 shrink-0" />
                                {result.oltDetails?.name || (result.sourceName === 'NO_SIGNAL' ? t('no_signal') : result.sourceName)}
                            </div>
                            {result.oltDetails ? (
                                <div className="text-xs text-slate-500 mt-1.5 flex gap-3">
                                    <span>{t('slot')}: <strong>{result.oltDetails.slot || '?'}</strong></span>
                                    <span>{t('pon')}: <strong>{result.oltDetails.port || '?'}</strong></span>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 mt-1.5">{t('output_power_short')}: <strong>{isDisconnected ? '--' : `${result.oltPower} dBm`}</strong></div>
                            )}
                        </div>
                        <div className="p-4 bg-white dark:bg-[#22262e] rounded-xl border border-slate-100 dark:border-slate-700/30">
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1.5">{t('total_loss')}</div>
                            <div className="text-slate-900 dark:text-white font-bold flex items-center gap-2 text-sm">
                                <ArrowDown className="w-4 h-4 text-rose-500 shrink-0" />
                                {result.totalLoss.toFixed(2)} dB
                            </div>
                            <div className="text-xs text-slate-500 mt-1.5">{t('path_elements')}: <strong>{result.path.length}</strong></div>
                        </div>
                    </div>

                    {/* Path Details */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/30 pb-2">{t('path_details')}</h3>

                        {result.path.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                <Unplug className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm font-medium">{t('no_signal') || 'Sem sinal'}</p>
                                <p className="text-xs mt-1">{t('optical_no_path') || 'Nenhum caminho óptico encontrado até a OLT.'}</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700/50 z-0"></div>
                                <div className="space-y-4 relative z-10">
                                    {result.path.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-3">
                                            <div className={`
                                                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 shadow-sm
                                                ${item.type === 'CABLE' ? 'bg-white dark:bg-[#1a1d23] border-emerald-500 text-emerald-600' : ''}
                                                ${item.type === 'SPLITTER' ? 'bg-white dark:bg-[#1a1d23] border-indigo-500 text-indigo-600' : ''}
                                                ${item.type === 'FUSION' ? 'bg-white dark:bg-[#1a1d23] border-amber-500 text-amber-600' : ''}
                                                ${item.type === 'OLT' ? 'bg-emerald-500 border-emerald-600 text-white' : ''}
                                            `}>
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-[#22262e] p-3 rounded-xl border border-slate-100 dark:border-slate-700/30 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.name}</div>
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t(`type_${item.type}`)} {item.details ? `• ${item.details}` : ''}</div>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-3">
                                                        <div className="text-rose-500 font-mono font-bold text-sm">-{item.loss.toFixed(2)} dB</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-[#1a1d23]/50 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors"
                    >
                        {t('close_btn')}
                    </button>
                </div>
            </div>
        </div>
    );
};
