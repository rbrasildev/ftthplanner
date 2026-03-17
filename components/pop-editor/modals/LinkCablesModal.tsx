import React from 'react';
import { Link2, X, Cable as CableIcon, Check } from 'lucide-react';
import { Button } from '../../common/Button';

interface LinkCablesModalProps {
    configuringDioCablesId: string | null;
    setConfiguringDioCablesId: (id: string | null) => void;
    uniqueIncomingCables: any[];
    localPOP: any;
    handleToggleCableLink: (dioId: string, cableId: string) => void;
    t: (key: string) => string;
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

    return (
        <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-slate-950 pointer-events-auto animate-in fade-in duration-200">
            <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    {t('link_cables')}
                </h3>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfiguringDioCablesId(null)}
                    className="h-10 w-10 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400"
                >
                    <X className="w-6 h-6" />
                </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div>
                        <p className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-wider">{t('link_cables_help')}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {uniqueIncomingCables.length === 0 && (
                                <div className="col-span-full text-center text-slate-500 py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    {t('no_cables_available')}
                                </div>
                            )}
                            {uniqueIncomingCables.map(cable => {
                                const dio = localPOP.dios.find((d: any) => d.id === configuringDioCablesId);
                                const isLinked = dio?.inputCableIds?.includes(cable.id);
                                const assignedToOther = localPOP.dios.find((d: any) => d.id !== configuringDioCablesId && d.inputCableIds?.includes(cable.id));

                                return (
                                    <button
                                        key={cable.id}
                                        disabled={!!assignedToOther}
                                        onClick={() => handleToggleCableLink(configuringDioCablesId, cable.id)}
                                        className={`
                                            flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left
                                            ${isLinked ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-500 text-emerald-900 dark:text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}
                                            ${assignedToOther ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-950' : ''}
                                        `}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${isLinked ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                <CableIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm leading-tight">{cable.name}</div>
                                                {assignedToOther && <div className="text-[10px] text-red-500 dark:text-red-400 font-bold uppercase mt-1">{t('linked_to_dio', { name: assignedToOther.name })}</div>}
                                            </div>
                                        </div>
                                        {isLinked && <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-center pt-6">
                        <Button
                            onClick={() => setConfiguringDioCablesId(null)}
                            className="px-10 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-xl hover:scale-105 transition-transform"
                        >
                            {t('done') || 'Concluir'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
