import React from 'react';
import { OpticalPathResult } from '../../utils/opticalUtils';
import { X, CheckCircle, AlertTriangle, XCircle, Activity, ArrowDown, Network } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

interface OpticalPowerModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: OpticalPathResult | null;
    splitterName: string;
}

export const OpticalPowerModal: React.FC<OpticalPowerModalProps> = ({ isOpen, onClose, result, splitterName }) => {
    const { t } = useLanguage();

    if (!isOpen || !result) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OK': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
            case 'MARGINAL': return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
            case 'FAIL': return 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            default: return 'text-slate-500';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'OK': return <CheckCircle className="w-8 h-8" />;
            case 'MARGINAL': return <AlertTriangle className="w-8 h-8" />;
            case 'FAIL': return <XCircle className="w-8 h-8" />;
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/20">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-6 h-6 text-sky-500" />
                            {t('optical_budget') || 'Orçamento Óptico'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('optical_path_for') || 'Caminho óptico para'} <span className="font-semibold text-slate-700 dark:text-slate-200">{splitterName}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8">

                    {/* Summary Card */}
                    <div className={`p-6 rounded-xl border flex items-center justify-between ${getStatusColor(result.status)}`}>
                        <div className="flex items-center gap-4">
                            {getStatusIcon(result.status)}
                            <div>
                                <div className="text-sm font-semibold opacity-80 uppercase tracking-wide">Potência Final</div>
                                <div className="text-3xl font-bold font-mono tracking-tight">{result.finalPower.toFixed(2)} dBm</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-semibold opacity-80 uppercase tracking-wide">Status</div>
                            <div className="text-xl font-bold">
                                {result.status === 'OK' && t('status_ok')}
                                {result.status === 'MARGINAL' && t('status_marginal')}
                                {result.status === 'FAIL' && t('status_fail')}
                                {!['OK', 'MARGINAL', 'FAIL'].includes(result.status) && result.status}
                            </div>
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Origem (OLT)</div>
                            <div className="text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                                <Network className="w-4 h-4 text-sky-500" />
                                {result.oltDetails?.name || (result.sourceName === 'NO_SIGNAL' ? t('no_signal') : result.sourceName)}
                            </div>
                            {result.oltDetails ? (
                                <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                    <span>{t('slot') || 'Slot'}: <strong>{result.oltDetails.slot || '?'}</strong></span>
                                    <span>{t('pon') || 'PON'}: <strong>{result.oltDetails.port || '?'}</strong></span>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 mt-1">Potência de Saída: <strong>{result.oltPower} dBm</strong></div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Perda Total</div>
                            <div className="text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                                <ArrowDown className="w-4 h-4 text-rose-500" />
                                {result.totalLoss.toFixed(2)} dB
                            </div>
                            <div className="text-xs text-slate-500 mt-1">Elementos no caminho: <strong>{result.path.length}</strong></div>
                        </div>
                    </div>

                    {/* Path Table */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2">Detalhes do Percurso</h3>
                        <div className="relative">
                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 z-0"></div>
                            <div className="space-y-6 relative z-10">
                                {result.path.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-4">
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2
                                            ${item.type === 'CABLE' ? 'bg-white border-sky-500 text-sky-600' : ''}
                                            ${item.type === 'SPLITTER' ? 'bg-white border-indigo-500 text-indigo-600' : ''}
                                            ${item.type === 'FUSION' ? 'bg-white border-amber-500 text-amber-600' : ''}
                                            ${item.type === 'OLT' ? 'bg-sky-500 border-sky-600 text-white' : ''}
                                        `}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.name}</div>
                                                    <div className="text-xs text-slate-500">{t(`type_${item.type}`)} {item.details ? `• ${item.details}` : ''}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-rose-500 font-mono font-bold text-sm">-{item.loss.toFixed(2)} dB</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
