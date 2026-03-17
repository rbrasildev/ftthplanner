import React, { useState, useMemo, useEffect } from 'react';
import { POPData, OLT, DIO } from '../../types';
import { Network, Zap, Server, ArrowRight, ChevronDown, ChevronRight, Layers, GitMerge, GripVertical } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { Button } from '../common/Button';

interface LogicalPatchingViewProps {
    localPOP: POPData;
    onAddConnection: (sourceId: string, targetId: string) => void;
    onRemoveConnection: (sourceId: string, targetId: string) => void;
    onManageFusions?: (dioId: string) => void;
    onUpdatePatchingLayout?: (newLayout: { col1: string[]; col2: string[]; col3: string[] }) => void;
}

export const LogicalPatchingView: React.FC<LogicalPatchingViewProps> = ({
    localPOP,
    onAddConnection,
    onRemoveConnection,
    onManageFusions,
    onUpdatePatchingLayout
}) => {
    const { t } = useLanguage();
    const [selectedPortA, setSelectedPortA] = useState<string | null>(null);
    const [viewingConnection, setViewingConnection] = useState<{ sourceId: string; targetId: string } | null>(null);

    // Accordion States
    const [collapsedOLTs, setCollapsedOLTs] = useState<Set<string>>(new Set());
    const [collapsedDIOs, setCollapsedDIOs] = useState<Set<string>>(new Set());

    // --- KANBAN STATE ---
    const [columns, setColumns] = useState<{ col1: string[]; col2: string[]; col3: string[] }>({ col1: [], col2: [], col3: [] });
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

    // Initialize Columns
    useEffect(() => {
        if (localPOP.patchingLayout) {
            // Use saved layout
            setColumns(localPOP.patchingLayout);
        } else {
            // Default layout: OLTs in Col 1, Other Actives in Col 2, Passives in Col 3
            const col1: string[] = [];
            const col2: string[] = [];
            const col3: string[] = [];

            localPOP.olts.forEach(active => {
                if (active.type === 'OLT') col1.push(active.id);
                else col2.push(active.id); // Switches, Routers, etc.
            });

            localPOP.dios.forEach(dio => col3.push(dio.id));

            setColumns({ col1, col2, col3 });
            // Optionally auto-save default layout on first load:
            // if (onUpdatePatchingLayout) onUpdatePatchingLayout({ col1, col2, col3 });
        }
    }, [localPOP.olts, localPOP.dios, localPOP.patchingLayout]); // Run when items change

    // --- DRAG AND DROP HANDLERS ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedItemId(id);
        e.dataTransfer.effectAllowed = 'move';
        // Need to set data to satisfy Firefox
        e.dataTransfer.setData('text/plain', id);

        // Slightly delay hiding the dragged element so clone still renders
        setTimeout(() => {
            const el = document.getElementById(`kanban-item-${id}`);
            if (el) el.classList.add('opacity-50');
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent, id: string) => {
        setDraggedItemId(null);
        const el = document.getElementById(`kanban-item-${id}`);
        if (el) el.classList.remove('opacity-50');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetColId: 'col1' | 'col2' | 'col3') => {
        e.preventDefault();
        if (!draggedItemId) return;

        // Find which column the item is currently in
        let sourceColId: 'col1' | 'col2' | 'col3' | null = null;
        if (columns.col1.includes(draggedItemId)) sourceColId = 'col1';
        else if (columns.col2.includes(draggedItemId)) sourceColId = 'col2';
        else if (columns.col3.includes(draggedItemId)) sourceColId = 'col3';

        if (!sourceColId || sourceColId === targetColId) return;

        // Moving to a new column is just appending for now (no precise vertical sorting)
        const newSource = columns[sourceColId].filter(id => id !== draggedItemId);
        const newTarget = [...columns[targetColId], draggedItemId];

        const newColumns = {
            ...columns,
            [sourceColId]: newSource,
            [targetColId]: newTarget
        };

        setColumns(newColumns);
        if (onUpdatePatchingLayout) {
            onUpdatePatchingLayout(newColumns);
        }
    };


    const toggleOLT = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedOLTs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleDIO = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedDIOs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Fast lookup for bidirectional connections
    const connectionMap = useMemo(() => {
        const map: Record<string, string> = {};
        localPOP.connections.forEach(c => {
            map[c.sourceId] = c.targetId;
            map[c.targetId] = c.sourceId;
        });
        return map;
    }, [localPOP.connections]);

    const resolvePortDetail = (portId: string) => {
        // Try OLT
        for (const olt of localPOP.olts) {
            const portsPerSlot = olt.structure?.portsPerSlot || 16;

            // Standard Ports
            const sIdx = olt.portIds.indexOf(portId);
            if (sIdx !== -1) {
                const slotIdx = Math.floor(sIdx / portsPerSlot);
                const localIdx = sIdx % portsPerSlot;
                return { eqName: olt.name, label: `Slot ${slotIdx + 1} P${localIdx + 1}` };
            }

            // Uplink Ports
            if (olt.uplinkPortIds) {
                const uIdx = olt.uplinkPortIds.indexOf(portId);
                if (uIdx !== -1) {
                    return { eqName: olt.name, label: `Uplink ${uIdx + 1}` };
                }
            }
        }

        // Try DIO
        for (const dio of localPOP.dios) {
            const TRAY_SIZE = 12;
            const dIdx = dio.portIds.indexOf(portId);
            if (dIdx !== -1) {
                const trayIdx = Math.floor(dIdx / TRAY_SIZE);
                const localIdx = dIdx % TRAY_SIZE;
                return { eqName: dio.name, label: `${t('tray')} ${trayIdx + 1} P${localIdx + 1}` };
            }
        }

        return { eqName: '?', label: portId.split('-').pop() || '?' };
    };

    const handlePortClick = (portId: string) => {
        const isConnectedTo = connectionMap[portId];

        // 1. Clear viewing state on new click if it's active
        if (viewingConnection) {
            setViewingConnection(null);
            // If clicking one of the ports already being viewed, just close it
            if (viewingConnection.sourceId === portId || viewingConnection.targetId === portId) return;
        }

        // 2. If it's already connected and nothing is selected to connect TO, just view it
        if (isConnectedTo && !selectedPortA) {
            setViewingConnection({ sourceId: portId, targetId: isConnectedTo });
            return;
        }

        if (!selectedPortA) {
            setSelectedPortA(portId);
        } else {
            const getEqId = (pId: string) => {
                const olt = localPOP.olts.find(o => o.portIds.includes(pId) || o.uplinkPortIds?.includes(pId));
                if (olt) return olt.id;
                const dio = localPOP.dios.find(d => d.portIds.includes(pId));
                if (dio) return dio.id;
                return null;
            };

            const eq1 = getEqId(selectedPortA);
            const eq2 = getEqId(portId);

            if (eq1 === eq2) {
                // Clicking on same equipment toggles selection to the new port
                if (selectedPortA !== portId) {
                    setSelectedPortA(portId);
                } else {
                    setSelectedPortA(null);
                }
                return;
            }

            // Execute Patch / Toggle Connection
            const source = selectedPortA;
            const target = portId;

            if (connectionMap[source] && connectionMap[source] !== target) {
                onRemoveConnection(source, connectionMap[source]);
            }
            if (connectionMap[target] && connectionMap[target] !== source) {
                onRemoveConnection(connectionMap[target], target);
            }

            if (connectionMap[source] === target) {
                onRemoveConnection(source, target);
            } else {
                onAddConnection(source, target);
            }

            setSelectedPortA(null);
        }
    };

    // --- RENDER HELPERS ---

    // Create maps for quick lookup during render based on the column arrays
    const equipmentMap = useMemo(() => {
        const map = new Map<string, OLT | DIO | { isDio: true }>();
        localPOP.olts.forEach(o => map.set(o.id, o));
        localPOP.dios.forEach(d => map.set(d.id, { ...d, isDio: true }));
        return map;
    }, [localPOP.olts, localPOP.dios]);


    const renderActiveEquipment = (olt: OLT) => {
        const portsPerSlot = olt.structure?.portsPerSlot || 16;
        const totalSlots = Math.ceil(olt.ports / portsPerSlot);

        return (
            <div
                key={olt.id}
                id={`kanban-item-${olt.id}`}
                className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-4 transition-opacity duration-200"
                draggable
                onDragStart={(e) => handleDragStart(e, olt.id)}
                onDragEnd={(e) => handleDragEnd(e, olt.id)}
            >
                <div className="w-full bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-stretch cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                    {/* Drag Handle */}
                    <div className="w-8 flex items-center justify-center border-r border-slate-200 dark:border-slate-700/50 text-slate-400 hover:text-slate-600">
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <button
                        onClick={(e) => toggleOLT(olt.id, e)}
                        className="flex-1 px-3 py-3 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <span>{olt.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{olt.ports} ports</span>
                        </div>
                        {collapsedOLTs.has(olt.id) ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                </div>

                {!collapsedOLTs.has(olt.id) && (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: totalSlots }).map((_, slotIdx) => {
                            const slotPorts = olt.portIds.slice(slotIdx * portsPerSlot, (slotIdx + 1) * portsPerSlot);
                            if (slotPorts.length === 0) return null;

                            return (
                                <div key={slotIdx} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 uppercase flex items-center gap-2">
                                        <Server className="w-3 h-3 text-emerald-500" /> Slot {slotIdx + 1}
                                    </div>
                                    <div className="p-3 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 bg-white dark:bg-slate-900/30">
                                        {slotPorts.map((pId, localIdx) => {
                                            const isConnected = !!connectionMap[pId];
                                            const isSelected = selectedPortA === pId;
                                            const isViewed = viewingConnection?.sourceId === pId || viewingConnection?.targetId === pId;
                                            const target = connectionMap[pId];
                                            const targetDetail = isConnected ? resolvePortDetail(target) : null;

                                            return (
                                                <button
                                                    key={pId}
                                                    onClick={() => handlePortClick(pId)}
                                                    className={`h-8 rounded-md border text-xs font-bold transition-all relative group
                                                        ${isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 scale-110 z-20' :
                                                            isSelected ? 'bg-indigo-500 text-white border-indigo-600 ring-2 ring-indigo-400 scale-105 z-10' :
                                                                isConnected ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                                                                    'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                                    title={isConnected ? `${t('port_to')}: ${targetDetail?.eqName} [${targetDetail?.label}]` : t('port_free')}
                                                >
                                                    {localIdx + 1}
                                                    {isConnected && !isSelected && !isViewed && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}

                                                    {isConnected && (
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-0.5 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                            → {targetDetail?.eqName}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Uplinks */}
                        {olt.uplinkPortIds && olt.uplinkPortIds.length > 0 && (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mt-2">
                                <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-1 text-xs font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700 uppercase flex items-center gap-2">
                                    <Network className="w-3 h-3" /> {t('uplinks')}
                                </div>
                                <div className="p-3 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                                    {olt.uplinkPortIds.map((pId, uIdx) => {
                                        const isConnected = !!connectionMap[pId];
                                        const isSelected = selectedPortA === pId;
                                        const isViewed = viewingConnection?.sourceId === pId || viewingConnection?.targetId === pId;
                                        const target = connectionMap[pId];
                                        const targetDetail = isConnected ? resolvePortDetail(target) : null;

                                        return (
                                            <button
                                                key={pId}
                                                onClick={() => handlePortClick(pId)}
                                                className={`h-8 rounded-md border text-xs font-bold transition-all relative group
                                                        ${isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 scale-110 z-20' :
                                                        isSelected ? 'bg-indigo-500 text-white border-indigo-600 ring-2 ring-indigo-400 scale-105 z-10' :
                                                            isConnected ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600' :
                                                                'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                                title={isConnected ? `${t('port_to')}: ${targetDetail?.eqName} [${targetDetail?.label}]` : t('port_free')}
                                            >
                                                U{uIdx + 1}
                                                {isConnected && !isSelected && !isViewed && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-400"></div>}
                                                {isConnected && (
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-0.5 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                        → {targetDetail?.eqName}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderPassiveEquipment = (dio: DIO) => {
        const TRAY_SIZE = 12;
        const trayCount = Math.ceil(dio.ports / TRAY_SIZE);

        return (
            <div
                key={dio.id}
                id={`kanban-item-${dio.id}`}
                className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-4 transition-opacity duration-200"
                draggable
                onDragStart={(e) => handleDragStart(e, dio.id)}
                onDragEnd={(e) => handleDragEnd(e, dio.id)}
            >
                <div className="w-full bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-stretch cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                    {/* Drag Handle */}
                    <div className="w-8 flex items-center justify-center border-r border-slate-200 dark:border-slate-700/50 text-slate-400 hover:text-slate-600">
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <button
                        onClick={(e) => toggleDIO(dio.id, e)}
                        className="flex-1 px-3 py-3 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <span>{dio.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{dio.ports} ports</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {onManageFusions && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onManageFusions(dio.id);
                                    }}
                                    className="h-7 text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50"
                                    icon={<GitMerge className="w-3 h-3" />}
                                >
                                    {t('manage_fusions')}
                                </Button>
                            )}
                            {collapsedDIOs.has(dio.id) ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                    </button>
                </div>

                {!collapsedDIOs.has(dio.id) && (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: trayCount }).map((_, tIdx) => {
                            const trayPorts = dio.portIds.slice(tIdx * TRAY_SIZE, (tIdx + 1) * TRAY_SIZE);
                            if (trayPorts.length === 0) return null;

                            return (
                                <div key={tIdx} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 uppercase flex items-center gap-2">
                                        <Layers className="w-3 h-3 text-blue-500" /> {t('tray')} {tIdx + 1}
                                    </div>
                                    <div className="p-3 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 xl:grid-cols-12 gap-2 bg-white dark:bg-slate-900/30">
                                        {trayPorts.map((pId, localIdx) => {
                                            const absIdx = (tIdx * TRAY_SIZE) + localIdx;
                                            const isConnected = !!connectionMap[pId];
                                            const isSelected = selectedPortA === pId;
                                            const isViewed = viewingConnection?.sourceId === pId || viewingConnection?.targetId === pId;
                                            const target = connectionMap[pId];
                                            const targetDetail = isConnected ? resolvePortDetail(target) : null;

                                            return (
                                                <button
                                                    key={pId}
                                                    onClick={() => handlePortClick(pId)}
                                                    className={`h-8 rounded-md border text-xs font-bold transition-all relative group
                                                            ${isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 scale-110 z-20' :
                                                            isSelected ? 'bg-indigo-500 text-white border-indigo-600 ring-2 ring-indigo-400 scale-105 z-10' :
                                                                isConnected ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                                                                    'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                                    title={isConnected ? `${t('port_to')}: ${targetDetail?.eqName} [${targetDetail?.label}]` : t('port_free')}
                                                >
                                                    {absIdx + 1}
                                                    {isConnected && !isSelected && !isViewed && <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-blue-500"></div>}
                                                    {isConnected && (
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-0.5 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                            → {targetDetail?.eqName}
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
    };

    const renderColumn = (colId: 'col1' | 'col2' | 'col3', title: string, icon: React.ReactNode, bgColor: string) => {
        const itemIds = columns[colId] || [];

        return (
            <div
                className={`flex-1 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto custom-scrollbar flex flex-col ${bgColor}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, colId)}
            >
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 select-none">
                    {icon} {title}
                    <span className="ml-auto text-xs font-normal text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                        {itemIds.length}
                    </span>
                </h4>
                <div className="flex-1 flex flex-col">
                    {itemIds.length === 0 && (
                        <div className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 text-sm italic select-none">
                            {t('drop_here')}
                        </div>
                    )}
                    {itemIds.map(id => {
                        const item = equipmentMap.get(id);
                        if (!item) return null;

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if ((item as any).isDio) {
                            return renderPassiveEquipment(item as unknown as DIO);
                        } else {
                            return renderActiveEquipment(item as OLT);
                        }
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 w-full h-full bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col pointer-events-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Network className="text-indigo-500 w-5 h-5" />
                    {t('patching_matrix')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('patching_kanban_instruction')}
                </p>
                {selectedPortA && !viewingConnection && (
                    <div className="mt-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 rounded-lg text-sm text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-2 animate-pulse transition-all duration-300">
                        {(() => {
                            const detail = resolvePortDetail(selectedPortA);
                            return (
                                <>
                                    <ArrowRight className="w-4 h-4" />
                                    {t('selected_port')}: <strong>{detail.eqName} [{detail.label}]</strong>. {t('select_destination')}
                                </>
                            );
                        })()}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedPortA(null)}
                            className="ml-auto h-7 px-2 text-xs"
                        >
                            {t('cancel_btn')}
                        </Button>
                    </div>
                )}
                {viewingConnection && (
                    <div className="mt-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 transition-all duration-300">
                        <Zap className="w-4 h-4 text-emerald-500" />
                        {(() => {
                            const src = resolvePortDetail(viewingConnection.sourceId);
                            const tgt = resolvePortDetail(viewingConnection.targetId);
                            return (
                                <span>
                                    {t('patching_summary')}: <strong>{src.eqName} [{src.label}]</strong> ↔ <strong>{tgt.eqName} [{tgt.label}]</strong>
                                </span>
                            );
                        })()}

                        <div className="ml-auto flex items-center gap-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    onRemoveConnection(viewingConnection.sourceId, viewingConnection.targetId);
                                    setViewingConnection(null);
                                }}
                                className="h-8 shadow-sm font-bold"
                            >
                                {t('disconnect_btn')}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setViewingConnection(null)}
                                className="h-8"
                            >
                                {t('close_btn')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {renderColumn('col1', `${t('column_name')} 1`, <Server className="w-4 h-4 text-emerald-500" />, 'bg-slate-50 dark:bg-slate-900')}
                {renderColumn('col2', `${t('column_name')} 2`, <Network className="w-4 h-4 text-indigo-500" />, 'bg-white dark:bg-slate-950')}
                {renderColumn('col3', `${t('column_name')} 3`, <Zap className="w-4 h-4 text-blue-500" />, 'bg-slate-100/50 dark:bg-slate-900/50')}
            </div>
        </div>
    );
};
