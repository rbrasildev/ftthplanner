import React from 'react';
import { Link2, X, Cable as CableIcon, Check } from 'lucide-react';

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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setConfiguringDioCablesId(null)}>
            <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="h-10 bg-slate-700 px-4 flex items-center justify-between border-b border-slate-600">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-sky-400" />
                        {t('link_cables')}
                    </h3>
                    <button onClick={() => setConfiguringDioCablesId(null)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                </div>
                <div className="p-4 space-y-2">
                    <p className="text-xs text-slate-400 mb-2">{t('link_cables_help')}</p>
                    {uniqueIncomingCables.length === 0 && <div className="text-center text-xs text-slate-500 py-4">No cables available in this POP.</div>}
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
                                     w-full flex items-center justify-between p-2 rounded border text-xs font-medium transition-all
                                     ${isLinked ? 'bg-sky-900/40 border-sky-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}
                                     ${assignedToOther ? 'opacity-50 cursor-not-allowed bg-slate-950' : ''}
                                 `}
                            >
                                <span className="flex items-center gap-2">
                                    <CableIcon className="w-3 h-3" />
                                    {cable.name}
                                </span>
                                {isLinked && <Check className="w-3 h-3 text-sky-400" />}
                                {assignedToOther && <span className="text-[9px] text-red-400">Linked to {assignedToOther.name}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
