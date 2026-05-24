import React, { useState, useMemo, useEffect } from 'react';
import { POPData, OLT, DIO, SwitchData } from '../../types';
import { Network, Zap, Server, ArrowRight, ChevronDown, ChevronRight, Layers, GitMerge, GripVertical, Trash2 } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { Button } from '../common/Button';

interface LogicalPatchingViewProps {
    localPOP: POPData;
    onAddConnection: (sourceId: string, targetId: string) => void;
    onRemoveConnection: (sourceId: string, targetId: string) => void;
    onManageFusions?: (dioId: string) => void;
    onUpdatePatchingLayout?: (newLayout: { col1: string[]; col2: string[]; col3: string[] }) => void;
    onDeleteEquipment?: (type: 'OLT' | 'DIO', id: string, name: string) => void;
    /** Portas acesas pelo VFL — destaca em vermelho na grade. */
    litPorts?: Set<string>;
}

export const LogicalPatchingView: React.FC<LogicalPatchingViewProps> = ({
    localPOP,
    onAddConnection,
    onRemoveConnection,
    onManageFusions,
    onUpdatePatchingLayout,
    onDeleteEquipment,
    litPorts,
}) => {
    const { t } = useLanguage();
    const [selectedPortA, setSelectedPortA] = useState<string | null>(null);
    const [viewingConnection, setViewingConnection] = useState<{ sourceId: string; targetId: string } | null>(null);

    // Accordion States
    const [collapsedOLTs, setCollapsedOLTs] = useState<Set<string>>(new Set());
    const [collapsedDIOs, setCollapsedDIOs] = useState<Set<string>>(new Set());
    const [collapsedSwitches, setCollapsedSwitches] = useState<Set<string>>(new Set());

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
                if (!active.type || active.type === 'OLT') col1.push(active.id);
                else col2.push(active.id); // legacy: Switches/Routers criados antigamente no array olts
            });

            // Ativos novos (Switch/Router/Server/Other) vivem em localPOP.switches
            (localPOP.switches || []).forEach(sw => col2.push(sw.id));

            localPOP.dios.forEach(dio => col3.push(dio.id));

            setColumns({ col1, col2, col3 });
            // Optionally auto-save default layout on first load:
            // if (onUpdatePatchingLayout) onUpdatePatchingLayout({ col1, col2, col3 });
        }
    }, [localPOP.olts, localPOP.dios, localPOP.switches, localPOP.patchingLayout]); // Run when items change

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
    // Manobra mostra APENAS patches externos (port↔port sem fiber e sem splitter).
    // Fusões internas (port↔fiber ou port↔splitter.IN) são gerenciadas no modo de fusão
    // do DIO e não devem aparecer/bloquear seleções aqui.
    const connectionMap = useMemo(() => {
        const map: Record<string, string> = {};
        localPOP.connections.forEach(c => {
            const isSplice = c.sourceId.includes('fiber') || c.targetId.includes('fiber') ||
                c.sourceId.startsWith('splitter-') || c.targetId.startsWith('splitter-');
            if (!isSplice) {
                map[c.sourceId] = c.targetId;
                map[c.targetId] = c.sourceId;
            }
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
                const baseLabel = `${t('tray')} ${trayIdx + 1} P${localIdx + 1}`;
                const customName = dio.portLabels?.[portId];
                return {
                    eqName: dio.name,
                    label: customName ? `${customName} (${baseLabel})` : baseLabel,
                };
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
        const map = new Map<string, any>();
        localPOP.olts.forEach(o => map.set(o.id, o));
        localPOP.dios.forEach(d => map.set(d.id, { ...d, isDio: true }));
        (localPOP.switches || []).forEach(s => map.set(s.id, { ...s, isSwitch: true }));
        return map;
    }, [localPOP.olts, localPOP.dios, localPOP.switches]);


    const renderActiveEquipment = (olt: OLT) => {
        const portsPerSlot = olt.structure?.portsPerSlot || 16;
        const totalSlots = Math.ceil(olt.ports / portsPerSlot);

        return (
            <div
                key={olt.id}
                id={`kanban-item-${olt.id}`}
                className="bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden mb-4 transition-opacity duration-200"
                draggable
                onDragStart={(e) => handleDragStart(e, olt.id)}
                onDragEnd={(e) => handleDragEnd(e, olt.id)}
            >
                <div className="w-full bg-slate-50 dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-700/50 flex items-stretch cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-[#2a2e38] transition-colors">
                    {/* Drag Handle */}
                    <div className="w-8 flex items-center justify-center border-r border-slate-200 dark:border-slate-700/30 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <button
                        onClick={(e) => toggleOLT(olt.id, e)}
                        className="flex-1 px-3 py-3 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <span>{olt.name}</span>
                            {(() => {
                                const usedCount = (olt.portIds || []).filter((p: string) => !!connectionMap[p]).length;
                                const total = olt.portIds?.length || 0;
                                return (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${usedCount === total && total > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-[#2a2e38] text-slate-600 dark:text-slate-400'}`}>
                                        {usedCount}/{total}
                                    </span>
                                );
                            })()}
                        </div>
                        <div className="flex items-center gap-3">
                            {onDeleteEquipment && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteEquipment('OLT', olt.id, olt.name);
                                    }}
                                    className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    title={t('delete')}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            {collapsedOLTs.has(olt.id) ? <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
                        </div>
                    </button>
                </div>

                {!collapsedOLTs.has(olt.id) && (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: totalSlots }).map((_, slotIdx) => {
                            const slotPorts = olt.portIds.slice(slotIdx * portsPerSlot, (slotIdx + 1) * portsPerSlot);
                            if (slotPorts.length === 0) return null;

                            const slotConfig = olt.structure?.slotsConfig?.[slotIdx];
                            const slotLabel = slotConfig?.name || `Slot ${slotIdx + 1}`;

                            return (
                                <div key={slotIdx} className="border border-slate-200 dark:border-slate-700/40 rounded-lg overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-[#22262e] px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/40 uppercase flex items-center gap-2">
                                        <Server className="w-3 h-3 text-emerald-500" /> {slotLabel}
                                    </div>
                                    <div className="p-2 bg-slate-100 dark:bg-[#15171c]" style={{ display: 'grid', gridTemplateColumns: `repeat(${slotPorts.length}, 1fr)`, gap: '3px' }}>
                                        {slotPorts.map((pId, localIdx) => {
                                            const isConnected = !!connectionMap[pId];
                                            const isSelected = selectedPortA === pId;
                                            const isViewed = viewingConnection?.sourceId === pId || viewingConnection?.targetId === pId;
                                            const isLit = litPorts?.has(pId);
                                            const target = connectionMap[pId];
                                            const targetDetail = isConnected ? resolvePortDetail(target) : null;

                                                const isSpliced = localPOP.connections.some(c =>
                                                    (c.sourceId === pId && c.targetId.includes('fiber')) ||
                                                    (c.targetId === pId && c.sourceId.includes('fiber'))
                                                );

                                                return (
                                                    <button
                                                        key={pId}
                                                        onClick={() => handlePortClick(pId)}
                                                        className={`h-8 rounded-md border text-xs font-bold transition-all relative group
                                                            ${isLit ? 'bg-red-400 text-white border-red-500 ring-2 ring-red-300 shadow-lg z-10' :
                                                                isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 scale-110 z-20' :
                                                                    isSelected ? 'bg-indigo-500 text-white border-indigo-600 ring-2 ring-indigo-400 scale-105 z-10' :
                                                                        isConnected ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                                                                            'bg-white dark:bg-[#1e2028] text-slate-500 border-slate-200 dark:border-slate-600/40 hover:border-indigo-400 dark:hover:border-indigo-400/50'}`}
                                                        title={isConnected ? `${t('port_to')}: ${targetDetail?.eqName} [${targetDetail?.label}]` : t('port_free')}
                                                    >
                                                        {localIdx + 1}
                                                        <div className="absolute top-1 right-1 flex gap-0.5 pointer-events-none">
                                                            {isSpliced && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" title={t('type_FUSION')}></div>}
                                                            {isConnected && !isSelected && !isViewed && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                                                        </div>

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
                            <div className="border border-slate-200 dark:border-slate-700/40 rounded-lg overflow-hidden mt-2">
                                <div className="bg-slate-50 dark:bg-[#22262e] px-3 py-1 text-xs font-bold text-slate-500 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700/40 uppercase flex items-center gap-2">
                                    <Network className="w-3 h-3" /> {t('uplinks')}
                                </div>
                                <div className="p-3 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                                    {olt.uplinkPortIds.map((pId, uIdx) => {
                                        const isConnected = !!connectionMap[pId];
                                        const isSelected = selectedPortA === pId;
                                        const isViewed = viewingConnection?.sourceId === pId || viewingConnection?.targetId === pId;
                                        const isLit = litPorts?.has(pId);
                                        const target = connectionMap[pId];
                                        const targetDetail = isConnected ? resolvePortDetail(target) : null;

                                        return (
                                            <button
                                                key={pId}
                                                onClick={() => handlePortClick(pId)}
                                                className={`h-8 rounded-md border text-xs font-bold transition-all relative group
                                                        ${isLit ? 'bg-red-400 text-white border-red-500 ring-2 ring-red-300 shadow-lg z-10' :
                                                        isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 scale-110 z-20' :
                                                            isSelected ? 'bg-indigo-500 text-white border-indigo-600 ring-2 ring-indigo-400 scale-105 z-10' :
                                                                isConnected ? 'bg-slate-100 dark:bg-[#2a2e38] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600/50' :
                                                                    'bg-white dark:bg-[#1e2028] text-slate-500 border-slate-200 dark:border-slate-600/40 hover:border-indigo-400 dark:hover:border-indigo-400/50'}`}
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

    const toggleSwitch = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedSwitches(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const renderSwitchEquipment = (sw: SwitchData) => {
        const portsLinked = sw.ports.filter(p => !!p.allocation).length;
        const total = sw.ports.length;
        const typeLabel: Record<string, string> = {
            SWITCH: 'Switch', ROUTER: 'Roteador', SERVER: 'Servidor', OTHER: 'Ativo',
        };
        const badge = typeLabel[sw.type ?? 'SWITCH'] ?? 'Ativo';

        return (
            <div
                key={sw.id}
                id={`kanban-item-${sw.id}`}
                className="bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden mb-4 transition-opacity duration-200"
                draggable
                onDragStart={(e) => handleDragStart(e, sw.id)}
                onDragEnd={(e) => handleDragEnd(e, sw.id)}
            >
                <div className="w-full bg-slate-50 dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-700/50 flex items-stretch cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-[#2a2e38] transition-colors">
                    <div className="w-8 flex items-center justify-center border-r border-slate-200 dark:border-slate-700/30 text-slate-400 dark:text-slate-500">
                        <GripVertical className="w-4 h-4" />
                    </div>
                    <button
                        onClick={(e) => toggleSwitch(sw.id, e)}
                        className="flex-1 px-3 py-3 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <Network className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{sw.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 uppercase">
                                {badge}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${portsLinked === total && total > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-[#2a2e38] text-slate-600 dark:text-slate-400'}`}>
                                {portsLinked}/{total}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {collapsedSwitches.has(sw.id) ? <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
                        </div>
                    </button>
                </div>

                {!collapsedSwitches.has(sw.id) && (
                    <div className="p-3">
                        <div className="border border-slate-200 dark:border-slate-700/40 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 dark:bg-[#22262e] px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/40 uppercase flex items-center gap-2">
                                <Network className="w-3 h-3 text-emerald-500" /> SFP
                            </div>
                            <div className="p-2 bg-slate-100 dark:bg-[#15171c] grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(total, 12)}, 1fr)` }}>
                                {sw.ports.map((p, idx) => {
                                    const hasGbic = !!p.gbic;
                                    const hasAlloc = !!p.allocation;
                                    const title = `${p.label || `P${idx + 1}`}${hasGbic ? ` · ${p.gbic!.tipo} ${p.gbic!.transmissao}` : ''}${hasAlloc ? ' · conectado' : hasGbic ? ' · sem alocação' : ' · sem GBIC'}`;
                                    return (
                                        <div
                                            key={p.id}
                                            id={p.id}
                                            title={title}
                                            className="h-7 rounded flex items-center justify-center text-[9px] font-mono font-bold"
                                            style={{
                                                backgroundColor: hasAlloc ? '#10b981' : hasGbic ? '#334155' : '#1e2028',
                                                border: `1px solid ${hasAlloc ? '#34d399' : hasGbic ? '#475569' : '#3f4451'}`,
                                                color: hasAlloc ? '#fff' : hasGbic ? '#e2e8f0' : '#6b7280',
                                            }}
                                        >
                                            {idx + 1}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 italic">
                            O patching de switches é feito no editor do switch (ícone de edição no canvas).
                        </div>
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
                className="bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden mb-4 transition-opacity duration-200"
                draggable
                onDragStart={(e) => handleDragStart(e, dio.id)}
                onDragEnd={(e) => handleDragEnd(e, dio.id)}
            >
                <div className="w-full bg-slate-50 dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-700/50 flex items-stretch cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-[#2a2e38] transition-colors">
                    {/* Drag Handle */}
                    <div className="w-8 flex items-center justify-center border-r border-slate-200 dark:border-slate-700/30 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        <GripVertical className="w-4 h-4" />
                    </div>

                    <button
                        onClick={(e) => toggleDIO(dio.id, e)}
                        className="flex-1 px-3 py-3 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <span>{dio.name}</span>
                            {(() => {
                                const usedCount = (dio.portIds || []).filter((p: string) => !!connectionMap[p]).length;
                                const total = dio.portIds?.length || 0;
                                return (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${usedCount === total && total > 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-slate-200 dark:bg-[#2a2e38] text-slate-600 dark:text-slate-400'}`}>
                                        {usedCount}/{total}
                                    </span>
                                );
                            })()}
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
                            {onDeleteEquipment && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteEquipment('DIO', dio.id, dio.name);
                                    }}
                                    className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    title={t('delete')}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            {collapsedDIOs.has(dio.id) ? <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
                        </div>
                    </button>
                </div>

                {!collapsedDIOs.has(dio.id) && (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: trayCount }).map((_, tIdx) => {
                            const trayPorts = dio.portIds.slice(tIdx * TRAY_SIZE, (tIdx + 1) * TRAY_SIZE);
                            if (trayPorts.length === 0) return null;
                            const trayHasNames = trayPorts.some(p => !!dio.portLabels?.[p]);

                            // When any port in the tray has a custom name, use a wider/taller grid
                            // so the names are actually readable. Otherwise keep the dense layout.
                            const gridCls = trayHasNames
                                ? 'p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-2 bg-slate-100 dark:bg-[#15171c]'
                                : 'p-3 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 xl:grid-cols-12 gap-2 bg-slate-100 dark:bg-[#15171c]';
                            const buttonHeightCls = trayHasNames ? 'h-12' : 'h-8';

                            return (
                                <div key={tIdx} className="border border-slate-200 dark:border-slate-700/40 rounded-lg overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-[#22262e] px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/40 uppercase flex items-center gap-2">
                                        <Layers className="w-3 h-3 text-blue-500" /> {t('tray')} {tIdx + 1}
                                    </div>
                                    <div className={gridCls}>
                                        {trayPorts.map((pId, localIdx) => {
                                            const absIdx = (tIdx * TRAY_SIZE) + localIdx;
                                            const isConnected = !!connectionMap[pId];
                                            const isSelected = selectedPortA === pId;
                                            const isViewed = viewingConnection?.sourceId === pId || viewingConnection?.targetId === pId;
                                            const isLit = litPorts?.has(pId);
                                            const target = connectionMap[pId];
                                            const targetDetail = isConnected ? resolvePortDetail(target) : null;
                                            const customName = dio.portLabels?.[pId];

                                                const isSpliced = localPOP.connections.some(c =>
                                                    (c.sourceId === pId && c.targetId.includes('fiber')) ||
                                                    (c.targetId === pId && c.sourceId.includes('fiber'))
                                                );

                                                const baseLabel = `${t('tray')} ${tIdx + 1} P${localIdx + 1}`;
                                                const titleParts: string[] = [];
                                                titleParts.push(customName ? `${customName} (${baseLabel})` : baseLabel);
                                                if (isConnected) titleParts.push(`${t('port_to')}: ${targetDetail?.eqName} [${targetDetail?.label}]`);
                                                else titleParts.push(t('port_free'));

                                                return (
                                                    <button
                                                        key={pId}
                                                        onClick={() => handlePortClick(pId)}
                                                        className={`${buttonHeightCls} rounded-md border transition-all relative group flex flex-col items-center justify-center gap-0 px-1.5 overflow-hidden
                                                            ${isLit ? 'bg-red-400 text-white border-red-500 ring-2 ring-red-300 shadow-lg z-10' :
                                                                isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 scale-110 z-20' :
                                                                    isSelected ? 'bg-indigo-500 text-white border-indigo-600 ring-2 ring-indigo-400 scale-105 z-10' :
                                                                        isConnected ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                                                                            'bg-white dark:bg-[#1e2028] text-slate-500 border-slate-200 dark:border-slate-600/40 hover:border-indigo-400 dark:hover:border-indigo-400/50'}`}
                                                        title={titleParts.join(' · ')}
                                                    >
                                                        {trayHasNames ? (
                                                            <>
                                                                <span className="text-[9px] font-mono font-bold opacity-60 leading-none">P{absIdx + 1}</span>
                                                                <span className={`text-[11px] font-semibold leading-tight max-w-full truncate mt-0.5 ${customName ? '' : 'italic opacity-50'}`}>
                                                                    {customName || '—'}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs font-bold">{absIdx + 1}</span>
                                                        )}
                                                        <div className="absolute top-1 right-1 flex gap-0.5 pointer-events-none">
                                                            {isSpliced && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" title={t('type_FUSION')}></div>}
                                                            {isConnected && !isSelected && !isViewed && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                                                        </div>
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
                className={`flex-1 border-r border-slate-200 dark:border-slate-700/30 p-4 overflow-y-auto custom-scrollbar flex flex-col ${bgColor}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, colId)}
            >
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 select-none">
                    {icon} {title}
                    <span className="ml-auto text-xs font-normal text-slate-600 dark:text-slate-500 px-2 py-0.5 rounded-full bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-transparent">
                        {itemIds.length}
                    </span>
                </h4>
                <div className="flex-1 flex flex-col">
                    {itemIds.length === 0 && (
                        <div className="flex-1 border-2 border-dashed border-slate-300 dark:border-slate-600/40 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm italic select-none">
                            {t('drop_here')}
                        </div>
                    )}
                    {itemIds.map(id => {
                        const item = equipmentMap.get(id);
                        if (!item) return null;

                        if (item.isDio) {
                            return renderPassiveEquipment(item as unknown as DIO);
                        }
                        if (item.isSwitch) {
                            return renderSwitchEquipment(item as SwitchData);
                        }
                        return renderActiveEquipment(item as OLT);
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 w-full h-full bg-slate-100 dark:bg-[#22262e] overflow-hidden flex flex-col pointer-events-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700/40 bg-white dark:bg-[#1a1d23] shrink-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <Network className="text-indigo-500 w-5 h-5" />
                    {t('patching_matrix')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
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
                {renderColumn('col1', t('col_olts') || 'OLTs', <Zap className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />, 'bg-slate-50 dark:bg-[#22262e]')}
                {/* Flow arrow between columns */}
                <div className="flex items-center px-0 shrink-0 text-slate-400 dark:text-slate-600">
                    <ArrowRight className="w-4 h-4" />
                </div>
                {renderColumn('col2', t('col_switches') || 'Switches', <Network className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />, 'bg-slate-100 dark:bg-[#2a2e38]')}
                <div className="flex items-center px-0 shrink-0 text-slate-400 dark:text-slate-600">
                    <ArrowRight className="w-4 h-4" />
                </div>
                {renderColumn('col3', t('col_dios') || 'DIOs', <Server className="w-4 h-4 text-blue-500 dark:text-blue-400" />, 'bg-slate-50 dark:bg-[#1e2128]')}
            </div>
        </div>
    );
};
