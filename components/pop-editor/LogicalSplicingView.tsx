import React, { useState, useMemo } from 'react';
import { POPData, FiberConnection, CableData, DIO, getFiberColor } from '../../types';
import { Layers, Cable as CableIcon, Split, Unplug, ArrowRight, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

interface LogicalSplicingViewProps {
    dio: DIO;
    localPOP: POPData;
    incomingCables: CableData[];
    currentConnections: FiberConnection[];
    onAddConnection: (sourceId: string, targetId: string) => void;
    onRemoveConnection: (sourceId: string, targetId: string) => void;
}

export const LogicalSplicingView: React.FC<LogicalSplicingViewProps> = ({
    dio,
    localPOP,
    incomingCables,
    currentConnections,
    onAddConnection,
    onRemoveConnection
}) => {
    const { t } = useLanguage();
    const [selectedFiberId, setSelectedFiberId] = useState<string | null>(null);

    // Accordion states
    const [collapsedCables, setCollapsedCables] = useState<Set<string>>(new Set());
    const [collapsedTrays, setCollapsedTrays] = useState<Set<number>>(new Set());

    // State for viewing an already connected item's details
    const [viewingConnectionStr, setViewingConnectionStr] = useState<{ sourceId: string; targetId: string } | null>(null);

    const toggleCable = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedCables(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleTray = (idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedTrays(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const relevantCables = useMemo(() => {
        return incomingCables.filter(c => dio.inputCableIds?.includes(c.id));
    }, [incomingCables, dio.inputCableIds]);

    // O(1) Lookup maps
    const connectionMap = useMemo(() => {
        const map: Record<string, string> = {};
        currentConnections.forEach(c => {
            map[c.sourceId] = c.targetId;
            map[c.targetId] = c.sourceId;
        });
        return map;
    }, [currentConnections]);

    const handleItemClick = (id: string, type: 'fiber' | 'port') => {
        const isConnectedTo = connectionMap[id];

        // 1. Always prioritize clearing viewing state on new click (unless clicking the exact same again)
        if (viewingConnectionStr) {
            setViewingConnectionStr(null);
            // Don't return, let it process the click as a new selection or connection phase
            if (viewingConnectionStr.sourceId === id || viewingConnectionStr.targetId === id) return;
        }

        // 2. If it is already connected and nothing is selected to connect TO, just view it
        if (isConnectedTo && !selectedFiberId) {
            setViewingConnectionStr({ sourceId: id, targetId: isConnectedTo });
            return;
        }

        if (!selectedFiberId) {
            // Start connection flow
            setSelectedFiberId(id);
        } else {
            // Try to connect
            const isFiber1 = selectedFiberId.includes('fiber');
            const isFiber2 = id.includes('fiber');

            if (isFiber1 === isFiber2) {
                // Ignore or change selection
                setSelectedFiberId(id);
                return;
            }

            const fiber = isFiber1 ? selectedFiberId : id;
            const port = isFiber1 ? id : selectedFiberId;

            // Remove existing connections on both ends if needed
            if (connectionMap[fiber] && connectionMap[fiber] !== port) {
                onRemoveConnection(fiber, connectionMap[fiber]);
            }

            const existingFusionOnPort = currentConnections.find(c =>
                (c.sourceId === port && c.targetId.includes('fiber')) ||
                (c.targetId === port && c.sourceId.includes('fiber'))
            );

            if (existingFusionOnPort) {
                const oldFiber = existingFusionOnPort.sourceId === port ? existingFusionOnPort.targetId : existingFusionOnPort.sourceId;
                if (oldFiber !== fiber) {
                    onRemoveConnection(port, oldFiber);
                }
            }

            if (connectionMap[fiber] === port) {
                onRemoveConnection(fiber, port); // Disconnect if explicitly clicking the connected pair
            } else {
                onAddConnection(fiber, port);
            }

            setSelectedFiberId(null);
        }
    };

    const PORTS_PER_TRAY = 12;
    const totalTrays = Math.ceil(dio.ports / PORTS_PER_TRAY);

    return (
        <div className="flex-1 w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col pointer-events-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Split className="text-orange-500 w-5 h-5" />
                    {t('splicing_matrix') || 'Matriz de Fusão'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('splicing_instruct') || 'Clique numa Fibra e depois numa Porta do DIO para realizar a fusão.'}
                </p>
                {selectedFiberId && !viewingConnectionStr && (
                    <div className="mt-3 px-3 py-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/50 rounded-lg text-sm text-orange-700 dark:text-orange-300 font-medium flex items-center gap-2 animate-pulse">
                        <ArrowRight className="w-4 h-4" /> Selecionado: {selectedFiberId.split('-').pop()}. {t('waiting_b_side') || 'Aguardando Lado B...'}
                        <button onClick={() => setSelectedFiberId(null)} className="ml-auto text-xs bg-orange-200 dark:bg-orange-800 px-2 py-1 rounded hover:bg-orange-300 dark:hover:bg-orange-700">{t('cancel_btn') || 'Cancelar'}</button>
                    </div>
                )}
                {viewingConnectionStr && (
                    <div className="mt-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Conexão: A {t('conn_fiber') || 'Fibra'} <strong>{viewingConnectionStr.sourceId.includes('fiber') ? parseInt(viewingConnectionStr.sourceId.split('-fiber-')[1] || '0') + 1 : parseInt(viewingConnectionStr.targetId.split('-fiber-')[1] || '0') + 1}</strong> está fundida na {t('conn_port') || 'Porta'} <strong>{viewingConnectionStr.sourceId.includes('-p-') ? parseInt(viewingConnectionStr.sourceId.split('-p-')[1] || '0') + 1 : parseInt(viewingConnectionStr.targetId.split('-p-')[1] || '0') + 1}</strong>

                        <div className="ml-auto flex items-center gap-2">
                            <button
                                onClick={() => {
                                    onRemoveConnection(viewingConnectionStr.sourceId, viewingConnectionStr.targetId);
                                    setViewingConnectionStr(null);
                                }}
                                className="text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-3 py-1.5 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            >
                                {t('disconnect_btn') || 'Desconectar'}
                            </button>
                            <button onClick={() => setViewingConnectionStr(null)} className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">{t('cancel_btn') || 'Fechar'}</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Lado A: Incoming Cables (Fibers) */}
                <div className="w-1/2 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto custom-scrollbar">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <CableIcon className="w-4 h-4 text-slate-500" /> {t('incoming_cables') || 'Cabos de Entrada'}
                    </h4>

                    {relevantCables.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <Unplug className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">{t('incoming_cables_empty') || 'Nenhum cabo vinculado a este DIO.'}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {relevantCables.map((cable, cIdx) => {
                                const looseTubeCount = cable.looseTubeCount || 1;
                                const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);

                                return (
                                    <div key={cable.id} className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-4">
                                        <button
                                            onClick={(e) => toggleCable(cable.id, e)}
                                            className="w-full bg-slate-100 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center">
                                                {cable.name} <span className="text-xs font-normal text-slate-500 ml-2">({cable.fiberCount} FO)</span>
                                            </div>
                                            {collapsedCables.has(cable.id) ? (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            )}
                                        </button>

                                        {!collapsedCables.has(cable.id) && (
                                            <div className="p-3">
                                                {Array.from({ length: looseTubeCount }).map((_, tubeIdx) => {
                                                    const tubeColor = getFiberColor(tubeIdx, cable.colorStandard);
                                                    const isLight = [1, 2, 3, 8, 10, 11, 12].includes((tubeIdx % 12) + 1);

                                                    const startFiberIndex = tubeIdx * fibersPerTube;
                                                    const endFiberIndex = Math.min(startFiberIndex + fibersPerTube, cable.fiberCount);
                                                    const tubeFibersCount = Math.max(0, endFiberIndex - startFiberIndex);

                                                    if (tubeFibersCount === 0) return null;

                                                    return (
                                                        <div key={tubeIdx} className="mb-4 last:mb-0 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                                            <div
                                                                className={`px-3 py-1.5 text-xs font-bold uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}
                                                                style={{ backgroundColor: tubeColor }}
                                                            >
                                                                {t('tube_number', { num: (tubeIdx + 1).toString() }) || `Tubo ${tubeIdx + 1}`}
                                                            </div>
                                                            <div className="p-2 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5 bg-slate-50 dark:bg-slate-900/50">
                                                                {Array.from({ length: tubeFibersCount }).map((__, fOffset) => {
                                                                    const fiberIndex = startFiberIndex + fOffset;
                                                                    const fiberId = `${cable.id}-fiber-${fiberIndex}`;
                                                                    const color = getFiberColor(fOffset, cable.colorStandard);

                                                                    const isConnected = !!connectionMap[fiberId];
                                                                    const isSelected = selectedFiberId === fiberId;
                                                                    const isViewed = viewingConnectionStr?.sourceId === fiberId || viewingConnectionStr?.targetId === fiberId;
                                                                    const targetPort = connectionMap[fiberId];

                                                                    const targetPortNum = targetPort ? parseInt(targetPort.split('-p-')[1] || targetPort.split('-p')[1] || '0') + 1 : '';

                                                                    return (
                                                                        <button
                                                                            key={fiberId}
                                                                            onClick={() => handleItemClick(fiberId, 'fiber')}
                                                                            className={`
                                                                            h-8 w-8 mx-auto rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all relative group
                                                                            ${isSelected ? 'ring-2 ring-orange-500 scale-105 z-10' : ''}
                                                                            ${isViewed ? 'ring-2 ring-emerald-500 scale-105 z-10 opacity-100 shadow-md rotate-[360deg] transition-transform duration-500' : ''}
                                                                            ${!isSelected && !isViewed && isConnected && viewingConnectionStr ? 'opacity-30' : ''}
                                                                            ${!isSelected && !isViewed ? 'hover:scale-105 hover:shadow-md' : ''}
                                                                        `}
                                                                            style={{
                                                                                backgroundColor: color,
                                                                                borderColor: isSelected ? '#f97316' : (isViewed ? '#10b981' : 'rgba(0,0,0,0.2)'),
                                                                                color: [1, 2, 3, 8, 10, 11, 12].includes((fOffset % 12) + 1) ? '#0f172a' : '#ffffff'
                                                                            }}
                                                                            title={isConnected ? t('spliced_to_port', { port: targetPortNum.toString() }) : (t('free_fiber') || 'Fibra Livre')}
                                                                        >
                                                                            {fiberIndex + 1}
                                                                            {isConnected && !isSelected && (
                                                                                <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_3px_rgba(0,0,0,0.6)] border border-white" title={t('spliced_fiber') || 'Fibra Fundida'}></div>
                                                                            )}

                                                                            {isConnected && (
                                                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                                                    DIO: {targetPortNum}
                                                                                </div>
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
                    )}
                </div>

                {/* Lado B: DIO (Trays/Ports) */}
                <div className="w-1/2 p-4 overflow-y-auto custom-scrollbar">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-orange-500" /> DIO ({t('tray') || 'Bandeja'}s)
                    </h4>

                    <div className="flex flex-col">
                        {Array.from({ length: totalTrays }).map((_, trayIdx) => {
                            const trayColor = getFiberColor(trayIdx, 'ABNT');
                            const isLightTray = [1, 2, 3, 8, 10, 11, 12].includes((trayIdx % 12) + 1);

                            const startPort = trayIdx * PORTS_PER_TRAY;
                            const endPort = Math.min(startPort + PORTS_PER_TRAY, dio.ports);
                            const portsInTray = endPort - startPort;

                            return (
                                <div key={trayIdx} className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-2">
                                    <button
                                        onClick={(e) => toggleTray(trayIdx, e)}
                                        className="w-full bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-xs font-bold uppercase flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-slate-400" />
                                            <span>{t('tray') || 'Bandeja'} {trayIdx + 1}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-70 font-normal normal-case text-slate-500">{portsInTray} {t('dio_ports') || 'Posições'}</span>
                                            {collapsedTrays.has(trayIdx) ? (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            )}
                                        </div>
                                    </button>

                                    {!collapsedTrays.has(trayIdx) && (
                                        <div className="p-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-900/50">
                                            {Array.from({ length: portsInTray }).map((__, pOffset) => {
                                                const pIndex = startPort + pOffset;
                                                const pId = dio.portIds[pIndex];

                                                // Determine BOTH types of connections
                                                // Patching connection: OLT to Port
                                                const patchingConn = localPOP.connections.find(c =>
                                                    (c.sourceId === pId && !c.targetId.includes('fiber')) ||
                                                    (c.targetId === pId && !c.sourceId.includes('fiber'))
                                                );

                                                // Splicing connection: Fiber to Port
                                                const splicingConn = currentConnections.find((c: any) =>
                                                    (c.sourceId === pId && c.targetId.includes('fiber')) ||
                                                    (c.targetId === pId && c.sourceId.includes('fiber'))
                                                );

                                                const isSpliced = !!splicingConn;
                                                const isPatched = !!patchingConn;
                                                const isSelected = selectedFiberId === pId;
                                                const isViewed = viewingConnectionStr?.sourceId === pId || viewingConnectionStr?.targetId === pId;

                                                const fiberId = splicingConn ? (splicingConn.sourceId === pId ? splicingConn.targetId : splicingConn.sourceId) : null;
                                                const connectedFiberNum = fiberId ? parseInt(fiberId.split('-').pop() || '0') + 1 : '';

                                                return (
                                                    <button
                                                        key={pId}
                                                        onClick={() => handleItemClick(pId, 'port')}
                                                        className={`
                                                        h-12 rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-all relative group
                                                        ${isSelected ? 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-400 scale-105 z-10' :
                                                                isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 scale-110 z-20 transition-transform duration-500' :
                                                                    isSpliced ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 hover:border-orange-500 text-orange-700 dark:text-orange-400' :
                                                                        'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-orange-400 hover:shadow-sm'}
                                                        ${!isSelected && !isViewed && isSpliced && viewingConnectionStr ? 'opacity-30' : ''}
                                                    `}
                                                        title={isSpliced ? t('spliced_to_fiber', { port: connectedFiberNum.toString() }) : (t('free_port') || 'Posição Livre')}
                                                    >
                                                        <span className="text-xs font-bold">{pIndex + 1}</span>

                                                        {/* Indicators (Patch vs Splice) */}
                                                        <div className="flex gap-1 mt-1">
                                                            {isSpliced && !isSelected && !isViewed && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" title={t('spliced_fiber') || "Fibra Fundida"}></div>}
                                                            {isPatched && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={t('patched_fiber') || "Patch Cord Ligado na Frente"}></div>}
                                                        </div>

                                                        {isSpliced && (
                                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                                &#8592; F: {connectedFiberNum}
                                                            </div>
                                                        )}
                                                    </button>
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
    );
};
