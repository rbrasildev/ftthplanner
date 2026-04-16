import React, { useState, useEffect, useMemo } from 'react';
import { Router, Server, Link2, Link2Off, X, Layers, ChevronDown, ChevronRight } from 'lucide-react';
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
    const [expandedEquipIds, setExpandedEquipIds] = useState<string[]>([]);

    // Determine if the clicked port is OLT or DIO
    const clickedFromDio = useMemo(() => {
        if (!configuringOltPortId) return null;
        return localPOP.dios.find((d: any) => d.portIds?.includes(configuringOltPortId)) || null;
    }, [configuringOltPortId, localPOP.dios]);

    const isDioSource = !!clickedFromDio;

    // Find OLT port info (when clicked port is an OLT port)
    const oltPortInfo = useMemo(() => {
        if (!configuringOltPortId) return null;
        for (const olt of localPOP.olts) {
            if (olt.portIds?.includes(configuringOltPortId)) {
                const idx = olt.portIds.indexOf(configuringOltPortId);
                return { oltName: olt.name, portNum: idx + 1 };
            }
            if (olt.slots) {
                for (let sIdx = 0; sIdx < olt.slots.length; sIdx++) {
                    const slot = olt.slots[sIdx];
                    if (slot.portIds?.includes(configuringOltPortId)) {
                        const idx = slot.portIds.indexOf(configuringOltPortId);
                        return { oltName: olt.name, slotNum: sIdx + 1, portNum: idx + 1 };
                    }
                }
            }
        }
        return null;
    }, [configuringOltPortId, localPOP.olts]);

    // Find DIO port info (when clicked port is a DIO port)
    const dioPortInfo = useMemo(() => {
        if (!configuringOltPortId || !clickedFromDio) return null;
        const idx = clickedFromDio.portIds.indexOf(configuringOltPortId);
        return {
            dioName: clickedFromDio.name,
            portNum: idx + 1,
            trayNum: Math.floor(idx / 12) + 1
        };
    }, [configuringOltPortId, clickedFromDio]);

    const activeConnection = useMemo(() => {
        if (!configuringOltPortId) return null;
        // Only patching connections (exclude fiber fusions)
        return localPOP.connections.find((c: any) => {
            const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber');
            if (isFiber) return false;
            return c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId;
        }) || null;
    }, [configuringOltPortId, localPOP.connections]);

    // Info about the OTHER side of the connection (what we're connected to)
    const connectedInfo = useMemo(() => {
        if (!activeConnection || !configuringOltPortId) return null;
        const otherId = activeConnection.sourceId === configuringOltPortId ? activeConnection.targetId : activeConnection.sourceId;

        if (isDioSource) {
            // Clicked a DIO port - show OLT info of connected end
            for (const olt of localPOP.olts) {
                if (olt.portIds?.includes(otherId)) {
                    const idx = olt.portIds.indexOf(otherId);
                    return { type: 'olt', label: olt.name, secondary: `Porta ${idx + 1}` };
                }
                if (olt.slots) {
                    for (let sIdx = 0; sIdx < olt.slots.length; sIdx++) {
                        const slot = olt.slots[sIdx];
                        if (slot.portIds?.includes(otherId)) {
                            const idx = slot.portIds.indexOf(otherId);
                            return { type: 'olt', label: olt.name, secondary: `Slot ${sIdx + 1} · Porta ${idx + 1}` };
                        }
                    }
                }
            }
        } else {
            // Clicked an OLT port - show DIO info of connected end
            for (const dio of localPOP.dios) {
                const idx = dio.portIds.indexOf(otherId);
                if (idx !== -1) {
                    return { type: 'dio', label: dio.name, secondary: `Bandeja ${Math.floor(idx / 12) + 1} · Porta ${idx + 1}` };
                }
            }
        }
        return null;
    }, [activeConnection, configuringOltPortId, isDioSource, localPOP.olts, localPOP.dios]);

    // Auto-expand equipment containing the connection
    useEffect(() => {
        if (!configuringOltPortId) return;
        const targetList = isDioSource ? localPOP.olts : localPOP.dios;
        if (targetList.length === 0) return;

        let connectedEquipId: string | null = null;
        for (const eq of targetList) {
            const allPorts = eq.portIds || [];
            const slotPorts = (eq.slots || []).flatMap((s: any) => s.portIds || []);
            const allIds = [...allPorts, ...slotPorts];
            const hasConn = allIds.some((pid: string) =>
                localPOP.connections.some((c: any) =>
                    (c.sourceId === pid && c.targetId === configuringOltPortId) ||
                    (c.targetId === pid && c.sourceId === configuringOltPortId)
                )
            );
            if (hasConn) {
                connectedEquipId = eq.id;
                break;
            }
        }

        if (connectedEquipId) {
            setExpandedEquipIds(prev => prev.includes(connectedEquipId!) ? prev : [...prev, connectedEquipId!]);
        } else {
            setExpandedEquipIds(prev => prev.length === 0 ? [targetList[0].id] : prev);
        }
    }, [configuringOltPortId, isDioSource, localPOP.connections, localPOP.olts, localPOP.dios]);

    const toggleEquip = (id: string) => {
        setExpandedEquipIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    if (!configuringOltPortId) return null;

    // Render a single port button
    const renderPortButton = (pid: string, label: number, hasBackboneLink: boolean = false) => {
        const existingConns = localPOP.connections.filter((c: any) => {
            const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber');
            if (isFiber) return false;
            return c.sourceId === pid || c.targetId === pid;
        });

        const isConnectedToSelf = existingConns.some((c: any) =>
            c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId
        );

        const occupiedByOther = existingConns.some((c: any) =>
            c.sourceId !== configuringOltPortId && c.targetId !== configuringOltPortId
        );

        return (
            <button
                key={pid}
                disabled={occupiedByOther}
                onClick={() => handleConnectPort(pid)}
                title={
                    isConnectedToSelf ? 'Conectada ao seu par' :
                        occupiedByOther ? 'Porta ocupada' :
                            hasBackboneLink ? `Porta ${label} (com fusão)` :
                                `Porta ${label} (livre)`
                }
                className={`
                    h-9 w-9 mx-auto rounded-lg text-[10px] font-bold flex items-center justify-center border-2 transition-all relative
                    ${isConnectedToSelf
                        ? 'bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-300 dark:ring-emerald-500/40 shadow-md scale-110 z-10'
                        : occupiedByOther
                            ? 'bg-slate-100 dark:bg-[#22262e]/30 border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-60'
                            : hasBackboneLink
                                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-emerald-500 hover:border-emerald-600 hover:text-white hover:scale-110'
                                : 'bg-white dark:bg-[#22262e] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:border-emerald-600 hover:text-white hover:scale-110'}
                `}
            >
                {label}
                {hasBackboneLink && !isConnectedToSelf && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 border border-white dark:border-slate-900" />
                )}
            </button>
        );
    };

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-200"
            onClick={() => setConfiguringOltPortId(null)}
        >
            <div
                className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`px-5 py-4 border-b border-slate-200 dark:border-slate-700/30 flex items-center justify-between bg-gradient-to-r ${isDioSource ? 'from-cyan-50 dark:from-cyan-900/10' : 'from-emerald-50 dark:from-emerald-900/10'} to-transparent`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDioSource ? 'bg-cyan-100 dark:bg-cyan-500/15' : 'bg-emerald-100 dark:bg-emerald-500/15'}`}>
                            {isDioSource
                                ? <Server className={`w-4.5 h-4.5 text-cyan-600 dark:text-cyan-400`} />
                                : <Router className={`w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400`} />
                            }
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {isDioSource ? 'Conexão da Porta DIO' : (t('connection_slot_port') || 'Conexão para Slot/Porta')}
                            </h3>
                            {isDioSource && dioPortInfo && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {dioPortInfo.dioName} &middot; Bandeja {dioPortInfo.trayNum} &middot; Porta {dioPortInfo.portNum}
                                </p>
                            )}
                            {!isDioSource && oltPortInfo && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {oltPortInfo.oltName}
                                    {oltPortInfo.slotNum && <> &middot; Slot {oltPortInfo.slotNum}</>}
                                    <> &middot; Porta {oltPortInfo.portNum}</>
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setConfiguringOltPortId(null)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Status Banner */}
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/30 shrink-0">
                    {activeConnection && connectedInfo ? (
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                                    <Link2 className="w-4 h-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                        {connectedInfo.type === 'olt' ? <Router className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                                        Conectado a {connectedInfo.label}
                                    </div>
                                    <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 truncate">
                                        {connectedInfo.secondary}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleDisconnectPort}
                                className="shrink-0 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-white dark:bg-[#1a1d23] hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                            >
                                <Link2Off className="w-3 h-3" />
                                {t('disconnect') || 'Desconectar'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                <Link2Off className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('not_connected') || 'Não Conectado'}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {isDioSource ? 'Selecione uma porta OLT abaixo' : (t('select_dio_port') || 'Selecione uma porta do DIO abaixo')}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Equipment List - show OLTs if DIO port clicked, else DIOs */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 max-h-[55vh] space-y-2 bg-slate-50/50 dark:bg-[#151820]/50">
                    {isDioSource ? (
                        // --- Show OLTs ---
                        localPOP.olts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10">
                                <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-3">
                                    <Router className="w-7 h-7 text-slate-400" />
                                </div>
                                <p className="text-sm font-bold text-slate-500">Nenhuma OLT disponível</p>
                            </div>
                        ) : localPOP.olts.map((olt: any) => {
                            const isExpanded = expandedEquipIds.includes(olt.id);
                            const slots = olt.slots || [];
                            const simplePorts = olt.portIds || [];

                            // Count free vs occupied
                            const allOltPorts = [...simplePorts, ...slots.flatMap((s: any) => s.portIds || [])];
                            const occupiedForOthers = new Set<string>();
                            localPOP.connections.forEach((c: any) => {
                                const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber');
                                if (isFiber) return;
                                if (c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId) return;
                                if (allOltPorts.includes(c.sourceId)) occupiedForOthers.add(c.sourceId);
                                if (allOltPorts.includes(c.targetId)) occupiedForOthers.add(c.targetId);
                            });
                            const freePortsCount = allOltPorts.filter(p => !occupiedForOthers.has(p)).length;

                            return (
                                <div key={olt.id} className="bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700/30 overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => toggleEquip(olt.id)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                                    >
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                            <Router className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{olt.name}</div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {allOltPorts.length} portas &middot; {freePortsCount} livres
                                                {slots.length > 0 && <> &middot; {slots.length} slot(s)</>}
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-1 space-y-3 animate-in slide-in-from-top-2 duration-200 bg-slate-50/50 dark:bg-[#151820]/50 border-t border-slate-200 dark:border-slate-700/30">
                                            {/* Direct ports (no slots) */}
                                            {simplePorts.length > 0 && (
                                                <div className="pt-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Layers className="w-3 h-3 text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Portas</span>
                                                        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700/50" />
                                                    </div>
                                                    <div className="grid grid-cols-12 gap-1.5">
                                                        {simplePorts.map((pid: string, idx: number) => renderPortButton(pid, idx + 1, false))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Slot-based ports */}
                                            {slots.map((slot: any, sIdx: number) => (
                                                <div key={sIdx} className="pt-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Layers className="w-3 h-3 text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Slot {sIdx + 1}</span>
                                                        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700/50" />
                                                    </div>
                                                    <div className="grid grid-cols-12 gap-1.5">
                                                        {(slot.portIds || []).map((pid: string, idx: number) => renderPortButton(pid, idx + 1, false))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        // --- Show DIOs (original behavior) ---
                        localPOP.dios.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10">
                                <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-3">
                                    <Server className="w-7 h-7 text-slate-400" />
                                </div>
                                <p className="text-sm font-bold text-slate-500">Nenhum DIO disponível</p>
                            </div>
                        ) : localPOP.dios.map((dio: any) => {
                            const PORTS_PER_TRAY = 12;
                            const totalTrays = Math.ceil(dio.portIds.length / PORTS_PER_TRAY);
                            const isExpanded = expandedEquipIds.includes(dio.id);

                            const occupiedPortsForOtherOlts = new Set<string>();
                            const fusedPorts = new Set<string>();
                            localPOP.connections.forEach((c: any) => {
                                const isOltConn = c.sourceId.includes('olt') || c.targetId.includes('olt');
                                const isFiberConn = c.sourceId.includes('fiber') || c.targetId.includes('fiber');
                                if (isOltConn && c.sourceId !== configuringOltPortId && c.targetId !== configuringOltPortId) {
                                    occupiedPortsForOtherOlts.add(c.sourceId);
                                    occupiedPortsForOtherOlts.add(c.targetId);
                                }
                                if (isFiberConn) {
                                    if (dio.portIds.includes(c.sourceId)) fusedPorts.add(c.sourceId);
                                    if (dio.portIds.includes(c.targetId)) fusedPorts.add(c.targetId);
                                }
                            });

                            const freePorts = dio.portIds.filter((p: string) => !occupiedPortsForOtherOlts.has(p)).length;

                            return (
                                <div key={dio.id} className="bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700/30 overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => toggleEquip(dio.id)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                                    >
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                        <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                                            <Server className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{dio.name}</div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {dio.portIds.length} portas &middot; {freePorts} livres &middot; {fusedPorts.size} fusionadas
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-1 space-y-3 animate-in slide-in-from-top-2 duration-200 bg-slate-50/50 dark:bg-[#151820]/50 border-t border-slate-200 dark:border-slate-700/30">
                                            {Array.from({ length: totalTrays }).map((_, trayIdx) => {
                                                const startIdx = trayIdx * PORTS_PER_TRAY;
                                                const trayPorts = dio.portIds.slice(startIdx, startIdx + PORTS_PER_TRAY);

                                                return (
                                                    <div key={trayIdx} className="pt-3">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Layers className="w-3 h-3 text-slate-400" />
                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('tray') || 'Bandeja'} {trayIdx + 1}</span>
                                                            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700/50" />
                                                        </div>
                                                        <div className="grid grid-cols-12 gap-1.5">
                                                            {trayPorts.map((pid: string, idx: number) => {
                                                                const hasBackboneLink = localPOP.connections.some((c: any) => {
                                                                    if (c.sourceId !== pid && c.targetId !== pid) return false;
                                                                    const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                                    return partner.includes('fiber');
                                                                });
                                                                return renderPortButton(pid, idx + 1, hasBackboneLink);
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Legend Footer */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/30 flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1a1d23]">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600" />
                        <span>Conectada</span>
                    </div>
                    {!isDioSource && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 relative">
                                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-500" />
                            </div>
                            <span>Com fusão</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-white dark:bg-[#22262e] border border-slate-300 dark:border-slate-600" />
                        <span>Livre</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-slate-100 dark:bg-[#22262e]/30 border border-slate-200 dark:border-slate-800 opacity-60" />
                        <span>Ocupada</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
