import React from 'react';
import { Link2, X, Cable as CableIcon, Check, AlertCircle } from 'lucide-react';
import { Button } from '../../common/Button';

interface LinkCablesModalProps {
    configuringDioCablesId: string | null;
    setConfiguringDioCablesId: (id: string | null) => void;
    uniqueIncomingCables: any[];
    localPOP: any;
    handleToggleCableLink: (dioId: string, cableId: string) => void;
    t: (key: string, params?: Record<string, any>) => string;
}

export const LinkCablesModal: React.FC<LinkCablesModalProps> = ({
    configuringDioCablesId,
    setConfiguringDioCablesId,
    uniqueIncomingCables,
    localPOP,
    handleToggleCableLink,
    t
}) => {
    if (!configuringDioCablesId) return null;

    const dio = localPOP.dios.find((d: any) => d.id === configuringDioCablesId);
    const linkedCount = uniqueIncomingCables.filter(c => dio?.inputCableIds?.includes(c.id)).length;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-200"
            onClick={() => setConfiguringDioCablesId(null)}
        >
            <div
                className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                            <Link2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('link_cables')}</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{dio?.name || 'DIO'} &middot; {linkedCount} {linkedCount === 1 ? 'cabo vinculado' : 'cabos vinculados'}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setConfiguringDioCablesId(null)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {uniqueIncomingCables.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4">
                            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <CableIcon className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t('no_cables_available')}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs leading-relaxed">{t('no_cables_available_desc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {uniqueIncomingCables.map(cable => {
                                const isLinked = dio?.inputCableIds?.includes(cable.id);
                                const assignedToOther = localPOP.dios.find((d: any) => d.id !== configuringDioCablesId && d.inputCableIds?.includes(cable.id));

                                return (
                                    <button
                                        key={cable.id}
                                        disabled={!!assignedToOther}
                                        onClick={() => handleToggleCableLink(configuringDioCablesId, cable.id)}
                                        className={`
                                            w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group
                                            ${isLinked
                                                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600'
                                                : assignedToOther
                                                    ? 'bg-slate-50 dark:bg-[#151820] border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed'
                                                    : 'bg-white dark:bg-[#22262e]/50 border-slate-200 dark:border-slate-700/50 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'}
                                        `}
                                    >
                                        {/* Toggle indicator */}
                                        <div className={`
                                            w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                                            ${isLinked
                                                ? 'bg-emerald-500 border-emerald-500'
                                                : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-400'}
                                        `}>
                                            {isLinked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                        </div>

                                        {/* Cable icon */}
                                        <div className={`
                                            w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                                            ${isLinked ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}
                                        `}>
                                            <CableIcon className="w-4 h-4" />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{cable.name}</div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {t('fiber_count_label', { count: cable.fiberCount || 0 })}
                                                {assignedToOther && (
                                                    <span className="text-red-500 dark:text-red-400 font-bold ml-2">
                                                        &bull; {t('linked_to_dio', { name: assignedToOther.name })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/30 flex justify-end">
                    <Button
                        onClick={() => setConfiguringDioCablesId(null)}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm text-sm transition-all"
                    >
                        {t('done') || 'Concluir'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
