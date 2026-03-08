import React, { useState, useMemo } from 'react';
import { POPData, CableData, FiberConnection, DIO } from '../types';
import { X, Save, AlertCircle, Link2, Check, Split } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { LogicalSplicingView } from './pop-editor/LogicalSplicingView';

interface DIOEditorProps {
    dio: DIO;
    pop: POPData;
    incomingCables: CableData[];
    onClose: () => void;
    onSave: (updatedConnections: FiberConnection[]) => void;
    onUpdateDio?: (updatedDio: DIO) => void;

    // VFL Props (Kept for TS backward compatibility, but UI retired in Matrix mode)
    litPorts?: Set<string>;
    vflSource?: string | null;
    onToggleVfl?: (portId: string) => void;

    // OTDR Prop (Kept for TS backward compatibility)
    onOtdrTrace?: (portId: string, distance: number) => void;
}

export const DIOEditor: React.FC<DIOEditorProps> = ({
    dio,
    pop,
    incomingCables,
    onClose,
    onSave,
    onUpdateDio
}) => {
    const { t } = useLanguage();
    const [currentConnections, setCurrentConnections] = useState<FiberConnection[]>(pop.connections);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    const relevantCables = useMemo(() => {
        return incomingCables.filter(c => dio.inputCableIds?.includes(c.id));
    }, [incomingCables, dio.inputCableIds]);

    const handleAddLogicalConnection = (source: string, target: string) => {
        const newConn: FiberConnection = {
            id: `fusion-${Date.now()}`,
            sourceId: source,
            targetId: target,
            color: '#22c55e',
            points: []
        };
        setCurrentConnections(prev => [...prev, newConn]);
    };

    const handleRemoveLogicalConnection = (source: string, target: string) => {
        setCurrentConnections(prev => prev.filter(c =>
            !(c.sourceId === source && c.targetId === target) &&
            !(c.sourceId === target && c.targetId === source)
        ));
    };

    const handleToggleCableLink = (cableId: string) => {
        if (!onUpdateDio) return;

        const currentCables = dio.inputCableIds || [];
        let newCables;
        if (currentCables.includes(cableId)) {
            newCables = currentCables.filter(c => c !== cableId);
        } else {
            // Check if assigned to other DIO
            const assignedToOther = pop.dios.find(d => d.id !== dio.id && d.inputCableIds?.includes(cableId));
            if (assignedToOther) return;
            newCables = [...currentCables, cableId];
        }

        onUpdateDio({ ...dio, inputCableIds: newCables });
    };

    return (
        <div
            className="fixed inset-0 z-[2200] bg-black/60 flex items-center justify-center backdrop-blur-md select-none"
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="w-[95vw] h-[95vh] bg-slate-950/80 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden relative backdrop-blur-xl">

                {/* Toolbar */}
                <div className="h-16 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50 shadow-md">
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                <Split className="w-6 h-6 text-orange-500" />
                            </div>
                            <div className="select-none">
                                <h2 className="font-bold text-white text-lg leading-none mb-1">{dio.name}</h2>
                                <p className="text-xs text-slate-400 font-medium">{t('manage_splicing')}</p>
                            </div>
                        </div>

                        {onUpdateDio && (
                            <div className="h-8 w-[1px] bg-white/10 mx-2" />
                        )}

                        {onUpdateDio && (
                            <button
                                onClick={() => setIsLinkModalOpen(true)}
                                className="px-3 py-1.5 bg-slate-800/50 hover:bg-sky-600/20 hover:border-sky-500/50 rounded-lg text-xs font-bold text-slate-300 hover:text-sky-400 flex items-center gap-2 border border-white/10 transition-all select-none"
                            >
                                <Link2 className="w-3.5 h-3.5" />
                                {t('link_cables')}
                                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-400">{relevantCables.length}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onSave(currentConnections)}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 flex items-center gap-2 text-sm transition-all transform hover:scale-105 active:scale-95 select-none"
                        >
                            <Save className="w-4 h-4" /> {t('save')}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Splicing View */}
                <div className="flex-1 bg-white dark:bg-slate-950 relative overflow-hidden">
                    <LogicalSplicingView
                        dio={dio}
                        localPOP={pop}
                        incomingCables={incomingCables}
                        currentConnections={currentConnections}
                        onAddConnection={handleAddLogicalConnection}
                        onRemoveConnection={handleRemoveLogicalConnection}
                    />
                </div>

                {/* --- ADD NEW CABLE MODAL --- */}
                {isLinkModalOpen && (
                    <div className="absolute inset-0 z-[2400] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setIsLinkModalOpen(false)}>
                        <div className="bg-slate-900 border border-white/10 rounded-2xl w-[450px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="h-14 bg-gradient-to-r from-slate-900 to-slate-800 px-5 flex items-center justify-between border-b border-white/5">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <Link2 className="w-5 h-5 text-sky-400" />
                                    {t('link_cables')}
                                </h3>
                                <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-4 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2 bg-slate-950/50">
                                {incomingCables.length === 0 && (
                                    <div className="text-center p-8 text-slate-500">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>{t('no_cables_available')}</p>
                                    </div>
                                )}
                                {incomingCables.map(cable => {
                                    const isLinked = dio.inputCableIds?.includes(cable.id);
                                    const assignedToWho = pop.dios.find(d => d.id !== dio.id && d.inputCableIds?.includes(cable.id));

                                    return (
                                        <button
                                            key={cable.id}
                                            onClick={() => handleToggleCableLink(cable.id)}
                                            disabled={!!assignedToWho}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group
                                        ${isLinked
                                                    ? 'bg-sky-500/10 border-sky-500/50 text-white shadow-[0_0_10px_rgba(14,165,233,0.1)]'
                                                    : (assignedToWho ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-500')}
                                    `}
                                        >
                                            <div>
                                                <div className="font-bold text-sm mb-0.5 flex items-center gap-2">
                                                    {cable.name}
                                                    {assignedToWho && <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">{t('linked_to_dio', { name: assignedToWho.name })}</span>}
                                                </div>
                                                <div className="text-[10px] opacity-60 font-mono">{cable.fiberCount} Fibers</div>
                                            </div>
                                            {isLinked && <Check className="w-4 h-4 text-sky-400" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
