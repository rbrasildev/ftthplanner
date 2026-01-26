import React, { useState, useEffect } from 'react';
import { Router, Server, Link2, Link2Off, Cable as CableIcon, X, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';

interface PatchPanelModalProps {
    configuringOltPortId: string | null;
    setConfiguringOltPortId: (id: string | null) => void;
    localPOP: any;
    handleDisconnectPort: () => void;
    handleConnectPort: (pid: string) => void;
}

export const PatchPanelModal: React.FC<PatchPanelModalProps> = ({
    configuringOltPortId,
    setConfiguringOltPortId,
    localPOP,
    handleDisconnectPort,
    handleConnectPort
}) => {
    const { t } = useLanguage();
    const [expandedDioIds, setExpandedDioIds] = useState<string[]>([]);

    // Auto-expand DIO containing the connection if exists
    useEffect(() => {
        if (!configuringOltPortId) return;
        const connectedDioId = localPOP.dios.find((dio: any) =>
            dio.portIds.some((pid: string) =>
                localPOP.connections.some((c: any) =>
                    (c.sourceId === pid && c.targetId === configuringOltPortId) ||
                    (c.targetId === pid && c.sourceId === configuringOltPortId)
                )
            )
        )?.id;

        if (connectedDioId) {
            setExpandedDioIds(prev => prev.includes(connectedDioId) ? prev : [...prev, connectedDioId]);
        }
    }, [configuringOltPortId, localPOP.connections, localPOP.dios]);

    const toggleDio = (dioId: string) => {
        setExpandedDioIds(prev =>
            prev.includes(dioId) ? prev.filter(id => id !== dioId) : [...prev, dioId]
        );
    };

    if (!configuringOltPortId) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setConfiguringOltPortId(null)}>
            <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-[600px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="h-10 bg-slate-700 px-4 flex items-center justify-between border-b border-slate-600">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Router className="w-4 h-4 text-sky-400" />
                        {t('connection_slot_port') || 'Connection for Slot/Port'}
                    </h3>
                    <button onClick={() => setConfiguringOltPortId(null)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] space-y-4">
                    {/* Current Status */}
                    <div className="bg-slate-900 rounded p-3 border border-slate-700">
                        {localPOP.connections.find((c: any) => c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId) ? (
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-green-400 font-bold flex items-center gap-2">
                                    <Link2 className="w-4 h-4" /> {t('connected') || 'Connected'}
                                </div>
                                <button onClick={handleDisconnectPort} className="px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-white rounded text-xs border border-red-900/50 flex items-center gap-1 transition">
                                    <Link2Off className="w-3 h-3" /> {t('disconnect') || 'Disconnect'}
                                </button>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
                                <Link2Off className="w-4 h-4" /> {t('not_connected') || 'Not Connected'}
                            </div>
                        )}
                    </div>

                    {/* Available DIOs */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">{t('select_dio_port') || 'Select DIO Port'}</h4>
                        <div className="space-y-3">
                            {localPOP.dios.map((dio: any) => {
                                const PORTS_PER_TRAY = 12;
                                const totalTrays = Math.ceil(dio.portIds.length / PORTS_PER_TRAY);
                                const isExpanded = expandedDioIds.includes(dio.id);

                                return (
                                    <div key={dio.id} className="bg-slate-900/50 rounded border border-slate-700/50 overflow-hidden">
                                        <button
                                            onClick={() => toggleDio(dio.id)}
                                            className="w-full px-3 py-2 bg-slate-800 text-xs font-bold text-slate-300 border-b border-slate-700/50 flex items-center gap-2 hover:bg-slate-750 transition-colors"
                                        >
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                            <Server className="w-3 h-3" />
                                            <span className="flex-1 text-left">{dio.name}</span>
                                        </button>

                                        {isExpanded && (
                                            <div className="p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                {Array.from({ length: totalTrays }).map((_, trayIdx) => {
                                                    const startIdx = trayIdx * PORTS_PER_TRAY;
                                                    const trayPorts = dio.portIds.slice(startIdx, startIdx + PORTS_PER_TRAY);

                                                    return (
                                                        <div key={trayIdx}>
                                                            <div className="flex items-center gap-2 mb-1.5 opacity-50">
                                                                <Layers className="w-3 h-3 text-slate-400" />
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{t('tray') || 'Tray'} {trayIdx + 1}</span>
                                                                <div className="h-[1px] flex-1 bg-slate-700" />
                                                            </div>
                                                            <div className="grid grid-cols-12 gap-1.5">
                                                                {trayPorts.map((pid: string, idx: number) => {
                                                                    const absoluteIndex = startIdx + idx;
                                                                    const existingConns = localPOP.connections.filter((c: any) => c.sourceId === pid || c.targetId === pid);

                                                                    const isConnectedToSelf = existingConns.some((c: any) => c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId);

                                                                    const occupiedByOtherOLT = existingConns.some((c: any) => {
                                                                        if (c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId) return false;
                                                                        const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                                        return partner.includes('olt');
                                                                    });

                                                                    const hasBackboneLink = existingConns.some((c: any) => {
                                                                        const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                                        return partner.includes('fiber');
                                                                    });

                                                                    return (
                                                                        <button
                                                                            key={pid}
                                                                            disabled={occupiedByOtherOLT}
                                                                            onClick={() => handleConnectPort(pid)}
                                                                            className={`
                                                                                        w-8 h-8 mx-auto rounded text-[9px] font-mono flex items-center justify-center border transition-all relative
                                                                                        ${isConnectedToSelf ? 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-emerald-400/50 font-bold scale-110 z-10' : ''}
                                                                                        ${occupiedByOtherOLT ? 'bg-slate-950 border-slate-800 text-slate-700 cursor-not-allowed' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-sky-600 hover:text-white hover:border-sky-400'}
                                                                                    `}
                                                                        >
                                                                            {(idx + 1) + 0 /* idx is 0-based relative to tray slice, so +1 gives 1-12. If we want 1-12 always, (idx+1) is correct. */}
                                                                            {hasBackboneLink && !isConnectedToSelf && !occupiedByOtherOLT && (
                                                                                <CableIcon className="w-3 h-3 text-sky-500 absolute -top-1 -right-1" />
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
