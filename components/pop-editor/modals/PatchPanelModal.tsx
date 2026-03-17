import React, { useState, useEffect } from 'react';
import { Router, Server, Link2, Link2Off, Cable as CableIcon, X, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../../common/Button';
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setConfiguringOltPortId(null)}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl w-[600px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="h-10 bg-slate-50 dark:bg-slate-800/50 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="p-1 rounded bg-emerald-600 text-white">
                            <Router className="w-3.5 h-3.5" />
                        </div>
                        {t('connection_slot_port') || 'Connection for Slot/Port'}
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfiguringOltPortId(null)}
                        className="w-6 h-6 p-0 hover:bg-slate-200 dark:hover:bg-white/10"
                    >
                        <X className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-white" />
                    </Button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] space-y-4">
                    {/* Current Status */}
                    <div className="bg-slate-50 dark:bg-slate-950 rounded p-3 border border-slate-200 dark:border-slate-800">
                        {localPOP.connections.find((c: any) => c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId) ? (
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2">
                                    <Link2 className="w-4 h-4" /> {t('connected') || 'Connected'}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDisconnectPort}
                                    className="h-7 text-[10px] bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 border-red-200 dark:border-red-500/20"
                                    icon={<Link2Off className="w-3 h-3" />}
                                >
                                    {t('disconnect') || 'Disconnect'}
                                </Button>
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
                                    <div key={dio.id} className="bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleDio(dio.id)}
                                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors justify-start rounded-none"
                                        >
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
                                            <Server className="w-3 h-3 text-emerald-600 dark:text-emerald-500" />
                                            <span className="flex-1 text-left">{dio.name}</span>
                                        </Button>

                                        {isExpanded && (
                                            <div className="p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                {Array.from({ length: totalTrays }).map((_, trayIdx) => {
                                                    const startIdx = trayIdx * PORTS_PER_TRAY;
                                                    const trayPorts = dio.portIds.slice(startIdx, startIdx + PORTS_PER_TRAY);

                                                    return (
                                                        <div key={trayIdx}>
                                                            <div className="flex items-center gap-2 mb-1.5 opacity-60">
                                                                <Layers className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t('tray') || 'Tray'} {trayIdx + 1}</span>
                                                                <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700" />
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
                                                                                        ${isConnectedToSelf ? 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-emerald-500/20 font-bold scale-110 z-10' : ''}
                                                                                        ${occupiedByOtherOLT ? 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-400'}
                                                                                    `}
                                                                        >
                                                                            {(idx + 1) + 0 /* idx is 0-based relative to tray slice, so +1 gives 1-12. If we want 1-12 always, (idx+1) is correct. */}
                                                                            {hasBackboneLink && !isConnectedToSelf && !occupiedByOtherOLT && (
                                                                                <CableIcon className="w-3 h-3 text-emerald-500 absolute -top-1 -right-1" />
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
