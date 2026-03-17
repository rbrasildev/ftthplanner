import React, { useState, useMemo, useEffect } from 'react';
import { POPData, FiberConnection, CableData, DIO, getFiberColor } from '../../types';
import { Layers, Cable as CableIcon, Split, Unplug, ArrowRight, ArrowRightLeft, Check, ChevronRight, ChevronDown, GripVertical, Ruler, Flashlight } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { Button } from '../common/Button';

interface LogicalSplicingViewProps {
    dio: DIO;
    localPOP: POPData;
    incomingCables: CableData[];
    currentConnections: FiberConnection[];
    onAddConnection: (sourceId: string, targetId: string) => void;
    onRemoveConnection: (sourceId: string, targetId: string) => void;
    onUpdateSplicingLayout?: (newLayout: { col1: string[]; col2: string[]; col3: string[] }) => void;
    isOtdrToolActive?: boolean;
    onSelectOtdrTarget?: (id: string) => void;
    isVflToolActive?: boolean;
    litPorts?: Set<string>;
    onToggleVfl?: (id: string) => void;
}

export const LogicalSplicingView: React.FC<LogicalSplicingViewProps> = ({
    dio,
    localPOP,
    incomingCables,
    currentConnections,
    onAddConnection,
    onRemoveConnection,
    onUpdateSplicingLayout,
    isOtdrToolActive,
    onSelectOtdrTarget,
    isVflToolActive,
    litPorts,
    onToggleVfl
}) => {
    const { t } = useLanguage();
    const [selectedFiberId, setSelectedFiberId] = useState<string | null>(null);

    // Accordion states
    const [collapsedCables, setCollapsedCables] = useState<Set<string>>(new Set());
    const [collapsedTrays, setCollapsedTrays] = useState<Set<number>>(new Set());

    // State for viewing an already connected item's details
    const [viewingConnectionStr, setViewingConnectionStr] = useState<{ sourceId: string; targetId: string } | null>(null);

    // --- KANBAN STATE ---
    const [columns, setColumns] = useState<{ col1: string[]; col2: string[]; col3: string[] }>({ col1: [], col2: [], col3: [] });
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

    const relevantCables = useMemo(() => {
        return incomingCables.filter(c => dio.inputCableIds?.includes(c.id));
    }, [incomingCables, dio.inputCableIds]);

    // Initialize Columns
    useEffect(() => {
        let newCols = dio.splicingLayout ? { ...dio.splicingLayout } : { col1: [], col2: [], col3: [] };

        // Ensure all relevant cables are present in some column
        const currentIds = new Set([...newCols.col1, ...newCols.col2, ...newCols.col3]);
        relevantCables.forEach(c => {
            if (!currentIds.has(c.id)) {
                newCols.col1.push(c.id);
            }
        });

        // Remove cables that are no longer relevant
        const relevantIds = new Set(relevantCables.map(c => c.id));
        newCols.col1 = newCols.col1.filter(id => relevantIds.has(id));
        newCols.col2 = newCols.col2.filter(id => relevantIds.has(id));
        newCols.col3 = newCols.col3.filter(id => relevantIds.has(id));

        setColumns(newCols);
    }, [relevantCables, dio.splicingLayout]);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedItemId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        setTimeout(() => {
            const el = document.getElementById(`cable-card-${id}`);
            if (el) el.classList.add('opacity-50');
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent, id: string) => {
        setDraggedItemId(null);
        const el = document.getElementById(`cable-card-${id}`);
        if (el) el.classList.remove('opacity-50');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetColId: 'col1' | 'col2' | 'col3') => {
        e.preventDefault();
        if (!draggedItemId) return;

        let sourceColId: 'col1' | 'col2' | 'col3' | null = null;
        if (columns.col1.includes(draggedItemId)) sourceColId = 'col1';
        else if (columns.col2.includes(draggedItemId)) sourceColId = 'col2';
        else if (columns.col3.includes(draggedItemId)) sourceColId = 'col3';

        if (!sourceColId || sourceColId === targetColId) return;

        const newSource = columns[sourceColId].filter(id => id !== draggedItemId);
        const newTarget = [...columns[targetColId], draggedItemId];

        const newColumns = {
            ...columns,
            [sourceColId]: newSource,
            [targetColId]: newTarget
        };

        setColumns(newColumns);
        if (onUpdateSplicingLayout) {
            onUpdateSplicingLayout(newColumns);
        }
    };

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

    // O(1) Lookup maps
    const connectionMap = useMemo(() => {
        const map: Record<string, string> = {};

        // Populate map in two passes: 
        // 1. Port-to-Port (Patching/OLT - Lower Priority)
        currentConnections.forEach(c => {
            if (!c.sourceId.includes('fiber') && !c.targetId.includes('fiber')) {
                map[c.sourceId] = c.targetId;
                map[c.targetId] = c.sourceId;
            }
        });

        // 2. Fiber-to-Port (Splicing/Fusion - Higher Priority)
        // Overwrites port->port mappings IF a port is also spliced
        currentConnections.forEach(c => {
            if (c.sourceId.includes('fiber') || c.targetId.includes('fiber')) {
                map[c.sourceId] = c.targetId;
                map[c.targetId] = c.sourceId;
            }
        });

        return map;
    }, [currentConnections]);

    const handleItemClick = (id: string, type: 'fiber' | 'port') => {
        if (isOtdrToolActive && onSelectOtdrTarget) {
            onSelectOtdrTarget(id);
            return;
        }

        if (isVflToolActive && onToggleVfl) {
            onToggleVfl(id);
            return;
        }

        const isConnectedTo = connectionMap[id];

        // If we are already viewing something, clear it first
        if (viewingConnectionStr) {
            setViewingConnectionStr(null);
            // If we clicked the same item again, just stop here
            if (viewingConnectionStr.sourceId === id || viewingConnectionStr.targetId === id) return;
        }

        // ENTRY POINT FOR VIEWING EXISTING CONNECTION
        if (isConnectedTo && !selectedFiberId) {
            setViewingConnectionStr({ sourceId: id, targetId: isConnectedTo });

            // Auto-expand accordions to show both sides
            const sides = [id, isConnectedTo];

            sides.forEach(sideId => {
                // Expand Fiber side if needed
                if (sideId.includes('fiber')) {
                    const cId = sideId.split('-fiber-')[0];
                    setCollapsedCables(prev => {
                        const next = new Set(prev);
                        next.delete(cId);
                        return next;
                    });
                } else if (sideId.includes('-p')) {
                    // Expand Port side if needed
                    const pIdx = dio.portIds.indexOf(sideId);
                    if (pIdx !== -1) {
                        const tIdx = Math.floor(pIdx / PORTS_PER_TRAY);
                        setCollapsedTrays(prev => {
                            const next = new Set(prev);
                            next.delete(tIdx);
                            return next;
                        });
                    }
                }
            });

            return;
        }

        if (!selectedFiberId) {
            setSelectedFiberId(id);
        } else {
            const isFiber1 = selectedFiberId.includes('fiber');
            const isFiber2 = id.includes('fiber');

            if (isFiber1 === isFiber2) {
                setSelectedFiberId(id);
                return;
            }

            const fiber = isFiber1 ? selectedFiberId : id;
            const port = isFiber1 ? id : selectedFiberId;

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
                onRemoveConnection(fiber, port);
            } else {
                onAddConnection(fiber, port);
            }

            setSelectedFiberId(null);
        }
    };

    const PORTS_PER_TRAY = 12;
    const totalTrays = Math.ceil(dio.ports / PORTS_PER_TRAY);

    const renderCableCard = (cableId: string) => {
        const cable = relevantCables.find(c => c.id === cableId);
        if (!cable) return null;

        const looseTubeCount = cable.looseTubeCount || 1;
        const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);

        return (
            <div
                key={cable.id}
                id={`cable-card-${cable.id}`}
                draggable
                onDragStart={(e) => handleDragStart(e, cable.id)}
                onDragEnd={(e) => handleDragEnd(e, cable.id)}
                className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-4 group"
            >
                <button
                    onClick={(e) => toggleCable(cable.id, e)}
                    className="w-full bg-slate-100 dark:bg-slate-900 px-3 py-2 border-b border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="truncate max-w-[120px]">{cable.name}</span>
                        <span className="text-[10px] font-normal text-slate-500">({cable.fiberCount} FO)</span>
                    </div>
                    {collapsedCables.has(cable.id) ? (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </button>

                {!collapsedCables.has(cable.id) && (
                    <div className="p-2">
                        {Array.from({ length: looseTubeCount }).map((_, tubeIdx) => {
                            const tubeColor = getFiberColor(tubeIdx, cable.colorStandard);
                            const isLight = [1, 2, 3, 8, 10, 11, 12].includes((tubeIdx % 12) + 1);

                            const startFiberIndex = tubeIdx * fibersPerTube;
                            const endFiberIndex = Math.min(startFiberIndex + fibersPerTube, cable.fiberCount);
                            const tubeFibersCount = Math.max(0, endFiberIndex - startFiberIndex);

                            if (tubeFibersCount === 0) return null;

                            return (
                                <div key={tubeIdx} className="mb-2 last:mb-0 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <div
                                        className={`px-2 py-1 text-[10px] font-bold uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}
                                        style={{ backgroundColor: tubeColor }}
                                    >
                                        T{tubeIdx + 1}
                                    </div>
                                    <div className="p-1.5 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1 bg-slate-50 dark:bg-slate-900/50">
                                        {Array.from({ length: tubeFibersCount }).map((__, fOffset) => {
                                            const fiberIndex = startFiberIndex + fOffset;
                                            const fiberId = `${cable.id}-fiber-${fiberIndex}`;
                                            const color = getFiberColor(fOffset, cable.colorStandard);

                                            const isConnected = !!connectionMap[fiberId];
                                            const isSelected = selectedFiberId === fiberId;
                                            const isViewed = viewingConnectionStr?.sourceId === fiberId || viewingConnectionStr?.targetId === fiberId;
                                            const isLit = litPorts?.has(fiberId); // Assuming litPorts is available in scope
                                            const targetPort = connectionMap[fiberId];
                                            const targetPortNum = targetPort ? parseInt(targetPort.split('-p-')[1] || targetPort.split('-p')[1] || '0') + 1 : '';

                                            return (
                                                <button
                                                    key={fiberId}
                                                    onClick={() => handleItemClick(fiberId, 'fiber')}
                                                    className={`
                                                        h-6 w-6 mx-auto rounded-full border flex items-center justify-center text-[9px] font-bold transition-all relative
                                                        ${isSelected ? 'ring-2 ring-orange-500 scale-105 z-10' : ''}
                                                        ${isViewed ? 'ring-2 ring-emerald-500 scale-105 z-10' : ''}
                                                        ${isLit ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-50 animate-pulse border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)] dark:ring-offset-slate-900' : ''}
                                                    `}
                                                    style={{
                                                        backgroundColor: color,
                                                        borderColor: isSelected ? '#f97316' : (isViewed ? '#10b981' : (isLit ? '#ef4444' : 'rgba(0,0,0,0.1)')),
                                                        color: [1, 2, 3, 8, 10, 11, 12].includes((fOffset % 12) + 1) ? '#0f172a' : '#ffffff'
                                                    }}
                                                    title={isConnected ? `DIO: ${targetPortNum}` : t('port_free')}
                                                >
                                                    {isLit && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-800 shadow-sm z-20" />}
                                                    {isLit && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping z-10" />}
                                                    <span className="relative z-[5]">{(fiberIndex % 12) + 1}</span>
                                                    {isConnected && !isSelected && (
                                                        <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white"></div>
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
    };

    const renderColumn = (colId: 'col1' | 'col2' | 'col3', title: string) => {
        const itemIds = columns[colId];
        return (
            <div
                className="flex-1 min-w-[200px] border-r border-slate-200 dark:border-slate-800 flex flex-col"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, colId)}
            >
                <div className="px-3 py-2 bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
                    <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-500">{itemIds.length}</span>
                </div>
                <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                    {itemIds.length === 0 ? (
                        <div className="h-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-[10px] italic">
                            {t('drop_here')}
                        </div>
                    ) : (
                        itemIds.map(id => renderCableCard(id))
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col pointer-events-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Split className="text-orange-500 w-5 h-5" />
                    {t('splicing_matrix')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('splicing_instruct')}
                </p>

                {isOtdrToolActive && (
                    <div className="mt-3 px-3 py-2 bg-indigo-600 dark:bg-indigo-900/90 text-white rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse shadow-lg border border-indigo-400">
                        <Ruler className="w-4 h-4" />
                        {t('otdr_instruction_banner')}
                    </div>
                )}

                {isVflToolActive && (
                    <div className="mt-3 px-3 py-2 bg-red-600 dark:bg-red-900/90 text-white rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse shadow-lg border border-red-400">
                        <Flashlight className="w-4 h-4" />
                        {t('vfl_instruction_banner')}
                    </div>
                )}
                {selectedFiberId && !viewingConnectionStr && (() => {
                    const isFiber = selectedFiberId.includes('fiber');
                    const label = isFiber ? t('conn_fiber') : t('conn_port');
                    let displayId = selectedFiberId.split('-').pop();
                    if (!isNaN(Number(displayId))) displayId = (Number(displayId) + 1).toString();

                    return (
                        <div className="mt-3 px-3 py-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/50 rounded-lg text-sm text-orange-700 dark:text-orange-300 font-medium flex items-center gap-2 animate-pulse">
                            <ArrowRight className="w-4 h-4" />
                            <strong>{label} {displayId}</strong>: {t('waiting_b_side')}
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedFiberId(null)}
                                className="ml-auto h-7 px-2 text-xs"
                            >
                                {t('cancel_btn')}
                            </Button>
                        </div>
                    );
                })()}
                {viewingConnectionStr && (() => {
                    // Refined ID isolation: Fiber IDs always contain 'fiber', Port IDs contain '-p'
                    // We need to find which side is which regardless of source/target order
                    const vFiberId = viewingConnectionStr.sourceId.includes('fiber')
                        ? viewingConnectionStr.sourceId
                        : (viewingConnectionStr.targetId.includes('fiber') ? viewingConnectionStr.targetId : null);

                    const vPortId = viewingConnectionStr.sourceId.includes('-p') && viewingConnectionStr.sourceId !== vFiberId
                        ? viewingConnectionStr.sourceId
                        : (viewingConnectionStr.targetId.includes('-p') && viewingConnectionStr.targetId !== vFiberId ? viewingConnectionStr.targetId : null);

                    // If we don't have a fiber involved, this isn't a "Fusion" and shouldn't be here in this view
                    if (!vFiberId || !vPortId) return null;

                    const cId = vFiberId.split('-fiber-')[0];
                    const fNum = Number(vFiberId.split('-fiber-')[1]) + 1;
                    const vCable = incomingCables.find(c => c.id === cId);
                    const pNum = (dio.portIds.indexOf(vPortId) + 1);

                    return (
                        <div className="mt-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="opacity-70">{t('type_FUSION')}:</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-emerald-100 dark:border-emerald-900/50">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{t('conn_fiber')}</span>
                                <strong>{vCable?.name} (F:{fNum})</strong>
                            </div>
                            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 mx-1" />
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-emerald-100 dark:border-emerald-900/50">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{t('conn_port')}</span>
                                <strong>{pNum}</strong>
                            </div>

                             <div className="ml-auto flex items-center gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        onRemoveConnection(viewingConnectionStr.sourceId, viewingConnectionStr.targetId);
                                        setViewingConnectionStr(null);
                                    }}
                                    className="h-8 shadow-sm font-bold"
                                >
                                    {t('disconnect_btn')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setViewingConnectionStr(null)}
                                    className="h-8"
                                >
                                    {t('close_btn')}
                                </Button>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Lado A: Kanban Columns for Cables */}
                <div className="w-2/3 flex overflow-hidden bg-slate-100/30 dark:bg-slate-900/10">
                    {renderColumn('col1', `${t('column_name')} 1`)}
                    {renderColumn('col2', `${t('column_name')} 2`)}
                    {renderColumn('col3', `${t('column_name')} 3`)}
                </div>

                {/* Lado B: DIO (Trays/Ports) */}
                <div className="w-1/3 p-4 overflow-y-auto custom-scrollbar border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-orange-500" /> {t('tray')}s
                    </h4>

                    <div className="flex flex-col">
                        {Array.from({ length: totalTrays }).map((_, trayIdx) => {
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
                                            <span>{t('tray')} {trayIdx + 1}</span>
                                        </div>
                                        {collapsedTrays.has(trayIdx) ? (
                                            <ChevronRight className="w-4 h-4 text-slate-400" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                        )}
                                    </button>

                                    {!collapsedTrays.has(trayIdx) && (
                                        <div className="p-2 grid grid-cols-6 sm:grid-cols-12 md:grid-cols-12 lg:grid-cols-12 gap-1 bg-slate-50 dark:bg-slate-900/50">
                                            {Array.from({ length: portsInTray }).map((__, pOffset) => {
                                                const pIndex = startPort + pOffset;
                                                const pId = dio.portIds[pIndex];

                                                const patchingConn = localPOP.connections.find(c =>
                                                    (c.sourceId === pId && !c.targetId.includes('fiber')) ||
                                                    (c.targetId === pId && !c.sourceId.includes('fiber'))
                                                );

                                                const splicingConn = currentConnections.find((c: any) =>
                                                    (c.sourceId === pId && c.targetId.includes('fiber')) ||
                                                    (c.targetId === pId && c.sourceId.includes('fiber'))
                                                );

                                                const isSpliced = !!splicingConn;
                                                const isPatched = !!patchingConn;
                                                const isSelected = selectedFiberId === pId;
                                                const isViewed = viewingConnectionStr?.sourceId === pId || viewingConnectionStr?.targetId === pId;
                                                const isLit = litPorts?.has(pId);

                                                const fiberId = splicingConn ? (splicingConn.sourceId === pId ? splicingConn.targetId : splicingConn.sourceId) : null;
                                                const connectedFiberNum = fiberId ? parseInt(fiberId.split('-').pop() || '0') + 1 : '';

                                                return (
                                                    <button
                                                        key={pId}
                                                        onClick={() => handleItemClick(pId, 'port')}
                                                        className={`
                                                        h-8 rounded border flex flex-col items-center justify-center cursor-pointer transition-all relative group
                                                        ${isSelected ? 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-400 z-10' :
                                                                isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 z-10' :
                                                                    isLit ? 'bg-red-500 text-white border-red-600 ring-2 ring-red-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)] z-10' :
                                                                        isSpliced ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400' :
                                                                            'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-orange-400'}
                                                    `}
                                                        title={isSpliced ? `F: ${connectedFiberNum}` : t('port_free')}
                                                    >
                                                        {isLit && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-800 shadow-sm z-20" />}
                                                        {isLit && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping z-10" />}
                                                        <span className="text-[10px] font-bold relative z-[5]">{pIndex + 1}</span>
                                                        <div className="flex gap-1 mt-0.5">
                                                            {isSpliced && !isSelected && !isViewed && <div className="w-1 h-1 rounded-full bg-orange-500"></div>}
                                                            {isPatched && !isSelected && <div className="w-1 h-1 rounded-full bg-emerald-500"></div>}
                                                        </div>
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
