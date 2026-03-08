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
        if (!selectedFiberId) {
            // Can start from either side
            setSelectedFiberId(id);
        } else {
            // Prevent same-side selections (fiber-fiber or port-port)
            const isFiber1 = selectedFiberId.includes('fiber');
            const isFiber2 = id.includes('fiber');

            if (isFiber1 === isFiber2) {
                // Ignore or change selection
                setSelectedFiberId(id);
                return;
            }

            const fiber = isFiber1 ? selectedFiberId : id;
            const port = isFiber1 ? id : selectedFiberId;

            // Remove existing SPLICING connections (do not remove patching connections)
            if (connectionMap[fiber] && connectionMap[fiber] !== port) {
                onRemoveConnection(fiber, connectionMap[fiber]);
            }

            // Check if port already has a fiber spliced
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
                {selectedFiberId && (
                    <div className="mt-3 px-3 py-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/50 rounded-lg text-sm text-orange-700 dark:text-orange-300 font-medium flex items-center gap-2 animate-pulse">
                        <ArrowRight className="w-4 h-4" /> Selecionado: {selectedFiberId.split('-').pop()}. Aguardando Lado B...
                        <button onClick={() => setSelectedFiberId(null)} className="ml-auto text-xs bg-orange-200 dark:bg-orange-800 px-2 py-1 rounded hover:bg-orange-300 dark:hover:bg-orange-700">Cancelar</button>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Lado A: Incoming Cables (Fibers) */}
                <div className="w-1/2 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto custom-scrollbar">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <CableIcon className="w-4 h-4 text-slate-500" /> Cabos de Entrada (Fibras)
                    </h4>

                    {relevantCables.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <Unplug className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">Nenhum cabo vinculado a este DIO.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
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
                                                                Tubo {tubeIdx + 1}
                                                            </div>
                                                            <div className="p-2 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5 bg-slate-50 dark:bg-slate-900/50">
                                                                {Array.from({ length: tubeFibersCount }).map((__, fOffset) => {
                                                                    const fiberIndex = startFiberIndex + fOffset;
                                                                    const fiberId = `${cable.id}-fiber-${fiberIndex}`;
                                                                    const color = getFiberColor(fOffset, cable.colorStandard);

                                                                    const isConnected = !!connectionMap[fiberId];
                                                                    const isSelected = selectedFiberId === fiberId;
                                                                    const targetPort = connectionMap[fiberId];

                                                                    return (
                                                                        <button
                                                                            key={fiberId}
                                                                            onClick={() => handleItemClick(fiberId, 'fiber')}
                                                                            className={`
                                                                            h-8 rounded-[4px] border text-[10px] font-bold transition-all relative group
                                                                            ${isSelected ? 'ring-2 ring-orange-500 scale-105 z-10' : ''}
                                                                            ${isConnected && !isSelected ? 'opacity-50 hover:opacity-100' : 'hover:scale-105 hover:shadow-md'}
                                                                        `}
                                                                            style={{
                                                                                backgroundColor: color,
                                                                                borderColor: isSelected ? '#f97316' : 'rgba(0,0,0,0.1)',
                                                                                color: [1, 2, 3, 8, 10, 11, 12].includes((fOffset % 12) + 1) ? '#0f172a' : '#ffffff'
                                                                            }}
                                                                            title={isConnected ? `Fundida na ${targetPort}` : `Fibra Livre`}
                                                                        >
                                                                            {fiberIndex + 1}
                                                                            {isConnected && !isSelected && (
                                                                                <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center bg-black/20 rounded-[3px]">
                                                                                    <Check className="w-3 h-3 text-white drop-shadow-md" />
                                                                                </div>
                                                                            )}

                                                                            {isConnected && (
                                                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                                                    \u2192 DIO: {targetPort.split('-p-')[1]}
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
                        <Layers className="w-4 h-4 text-orange-500" /> DIO (Bandejas de Fusão)
                    </h4>

                    <div className="flex flex-col gap-4">
                        {Array.from({ length: totalTrays }).map((_, trayIdx) => {
                            const trayColor = getFiberColor(trayIdx, 'ABNT');
                            const isLightTray = [1, 2, 3, 8, 10, 11, 12].includes((trayIdx % 12) + 1);

                            const startPort = trayIdx * PORTS_PER_TRAY;
                            const endPort = Math.min(startPort + PORTS_PER_TRAY, dio.ports);
                            const portsInTray = endPort - startPort;

                            return (
                                <div key={trayIdx} className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-4">
                                    <button
                                        onClick={(e) => toggleTray(trayIdx, e)}
                                        className={`w-full px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase flex items-center justify-between hover:brightness-95 transition-all cursor-pointer ${isLightTray ? 'text-slate-900' : 'text-white'}`}
                                        style={{ backgroundColor: trayColor }}
                                    >
                                        <span>Bandeja {trayIdx + 1}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-70">{portsInTray} Posições</span>
                                            {collapsedTrays.has(trayIdx) ? (
                                                <ChevronRight className="w-4 h-4 opacity-70" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 opacity-70" />
                                            )}
                                        </div>
                                    </button>

                                    {!collapsedTrays.has(trayIdx) && (
                                        <div className="p-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 bg-slate-50 dark:bg-slate-900/50">
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
                                                const fiberId = splicingConn ? (splicingConn.sourceId === pId ? splicingConn.targetId : splicingConn.sourceId) : null;

                                                return (
                                                    <button
                                                        key={pId}
                                                        onClick={() => handleItemClick(pId, 'port')}
                                                        className={`
                                                        h-12 rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-all relative group
                                                        ${isSelected ? 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-400 scale-105 z-10' :
                                                                isSpliced ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 hover:border-orange-500 text-orange-700 dark:text-orange-400' :
                                                                    'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-orange-400 hover:shadow-sm'}
                                                    `}
                                                        title={isSpliced ? `Fundida com ${fiberId?.split('-').pop()}` : `Posição Livre`}
                                                    >
                                                        <span className="text-xs font-bold">{pIndex + 1}</span>

                                                        {/* Indicators (Patch vs Splice) */}
                                                        <div className="flex gap-1 mt-1">
                                                            {isSpliced && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" title="Fibra Fundida Atrás"></div>}
                                                            {isPatched && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Patch Cord Ligado na Frente"></div>}
                                                        </div>

                                                        {isSpliced && (
                                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                                &#8592; F: {fiberId?.split('-').pop()}
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
