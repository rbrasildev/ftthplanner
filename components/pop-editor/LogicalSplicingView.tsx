import React, { useState, useMemo, useEffect } from 'react';
import { POPData, FiberConnection, CableData, DIO, Splitter, getFiberColor } from '../../types';
import { Layers, Cable as CableIcon, Split, ArrowRight, ArrowRightLeft, Check, ChevronRight, ChevronDown, Ruler, Flashlight, Zap, X, GitFork, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { Button } from '../common/Button';
import { getSplitters, SplitterCatalogItem } from '../../services/catalogService';

interface LogicalSplicingViewProps {
    dio: DIO;
    localPOP: POPData;
    incomingCables: CableData[];
    currentConnections: FiberConnection[];
    splittersInDio?: Splitter[];
    onAddConnection: (sourceId: string, targetId: string) => void;
    onRemoveConnection: (sourceId: string, targetId: string) => void;
    onUpdateSplicingLayout?: (newLayout: { col1: string[]; col2: string[]; col3: string[] }) => void;
    onAddSplitter?: (catalogItem: SplitterCatalogItem) => void;
    onDeleteSplitter?: (id: string) => void;
    onRenameSplitter?: (id: string, newName: string) => void;
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
    splittersInDio = [],
    onAddConnection,
    onRemoveConnection,
    onUpdateSplicingLayout,
    onAddSplitter,
    onDeleteSplitter,
    onRenameSplitter,
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

    // Auto Splice state
    const [showAutoSplice, setShowAutoSplice] = useState(false);
    const [autoSpliceCableId, setAutoSpliceCableId] = useState<string>('');

    // Add Splitter modal state
    const [showAddSplitter, setShowAddSplitter] = useState(false);
    const [splitterCatalog, setSplitterCatalog] = useState<SplitterCatalogItem[]>([]);
    const [selectedSplitterCatalogId, setSelectedSplitterCatalogId] = useState<string>('');

    useEffect(() => {
        if (showAddSplitter && splitterCatalog.length === 0) {
            getSplitters().then(setSplitterCatalog).catch(console.error);
        }
    }, [showAddSplitter]);

    // --- KANBAN STATE (kept for backward compat with splicingLayout) ---
    const [columns, setColumns] = useState<{ col1: string[]; col2: string[]; col3: string[] }>({ col1: [], col2: [], col3: [] });

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

    // All cable IDs in order
    const allCableIds = useMemo(() => {
        return [...columns.col1, ...columns.col2, ...columns.col3];
    }, [columns]);

    // Auto splice preview calculation
    const autoSplicePreview = useMemo(() => {
        if (!autoSpliceCableId) return { count: 0, freeFibers: 0, freePorts: 0 };
        const cable = relevantCables.find(c => c.id === autoSpliceCableId);
        if (!cable) return { count: 0, freeFibers: 0, freePorts: 0 };

        // Find already spliced fibers for this cable
        const fiberPrefix = `${cable.id}-fiber-`;
        const splicedFibers = new Set<string>();
        currentConnections.forEach(c => {
            if (c.sourceId.startsWith(fiberPrefix)) splicedFibers.add(c.sourceId);
            if (c.targetId.startsWith(fiberPrefix)) splicedFibers.add(c.targetId);
        });

        // Find already spliced ports
        const splicedPorts = new Set<string>();
        currentConnections.forEach(c => {
            if (c.sourceId.includes('fiber') || c.targetId.includes('fiber')) {
                const port = c.sourceId.includes('fiber') ? c.targetId : c.sourceId;
                if (dio.portIds.includes(port)) splicedPorts.add(port);
            }
        });

        const freeFibers = cable.fiberCount - splicedFibers.size;
        const freePorts = dio.portIds.length - splicedPorts.size;
        const count = Math.min(freeFibers, freePorts);

        return { count, freeFibers, freePorts };
    }, [autoSpliceCableId, relevantCables, currentConnections, dio.portIds]);

    const handleAutoSplice = () => {
        if (!autoSpliceCableId) return;
        const cable = relevantCables.find(c => c.id === autoSpliceCableId);
        if (!cable) return;

        const fiberPrefix = `${cable.id}-fiber-`;

        // Find already spliced fibers
        const splicedFibers = new Set<string>();
        currentConnections.forEach(c => {
            if (c.sourceId.startsWith(fiberPrefix)) splicedFibers.add(c.sourceId);
            if (c.targetId.startsWith(fiberPrefix)) splicedFibers.add(c.targetId);
        });

        // Find already spliced ports on this DIO
        const splicedPorts = new Set<string>();
        currentConnections.forEach(c => {
            if (c.sourceId.includes('fiber') || c.targetId.includes('fiber')) {
                const port = c.sourceId.includes('fiber') ? c.targetId : c.sourceId;
                if (dio.portIds.includes(port)) splicedPorts.add(port);
            }
        });

        // Get free fibers and ports in order
        const freeFibers: string[] = [];
        for (let i = 0; i < cable.fiberCount; i++) {
            const fId = `${cable.id}-fiber-${i}`;
            if (!splicedFibers.has(fId)) freeFibers.push(fId);
        }

        const freePorts = dio.portIds.filter(p => !splicedPorts.has(p));
        const count = Math.min(freeFibers.length, freePorts.length);

        for (let i = 0; i < count; i++) {
            onAddConnection(freeFibers[i], freePorts[i]);
        }

        setShowAutoSplice(false);
        setAutoSpliceCableId('');
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

    // Helpers de classificação de conexão.
    // Splice (fusão dentro do DIO) inclui:
    //   - fibra de cabo ↔ porta DIO
    //   - fibra de cabo ↔ saída de splitter
    //   - porta DIO ↔ entrada de splitter
    //   - saída de splitter ↔ entrada de outro splitter (cascateamento)
    const isSpliceConn = (c: { sourceId: string; targetId: string }) =>
        c.sourceId.includes('fiber') || c.targetId.includes('fiber') ||
        c.sourceId.startsWith('splitter-') || c.targetId.startsWith('splitter-');

    // O(1) Lookup maps
    // Aqui na splicing view só interessam SPLICES (fusões). Patches externos (manobra
    // OLT↔DIO) coexistem com fusões na mesma porta e não devem ser tratados como
    // "conexão pré-existente" — senão clicar pra fusionar acabaria apagando o patch.
    const connectionMap = useMemo(() => {
        const map: Record<string, string> = {};
        currentConnections.forEach(c => {
            if (isSpliceConn(c)) {
                map[c.sourceId] = c.targetId;
                map[c.targetId] = c.sourceId;
            }
        });
        return map;
    }, [currentConnections]);

    // Identifica o tipo de um item clicável.
    // - 'fiber': fibra de cabo (id contém '-fiber-')
    // - 'splitter-in': entrada de splitter (id termina com '-in')
    // - 'splitter-out': saída de splitter (id contém '-out-')
    // - 'port': porta de DIO (resto)
    const getItemType = (id: string): 'fiber' | 'port' | 'splitter-in' | 'splitter-out' => {
        if (id.includes('-fiber-')) return 'fiber';
        if (id.startsWith('splitter-')) {
            if (id.endsWith('-in')) return 'splitter-in';
            if (id.includes('-out-')) return 'splitter-out';
        }
        return 'port';
    };

    // Pares válidos de fusão (refletem a topologia física):
    //  - fiber ↔ port               : fusão clássica (fibra de cabo ↔ porta do DIO)
    //  - fiber ↔ splitter-out       : fibra do cabo de saída ↔ pigtail da saída do splitter
    //  - port ↔ splitter-in         : porta do DIO ↔ pigtail da entrada do splitter
    //  - splitter-out ↔ splitter-in : cascateamento (saída de um splitter ↔ entrada de outro)
    const isValidPair = (a: ReturnType<typeof getItemType>, b: ReturnType<typeof getItemType>): boolean => {
        const key = [a, b].sort().join('|');
        return key === 'fiber|port'
            || key === 'fiber|splitter-out'
            || key === 'port|splitter-in'
            || key === 'splitter-in|splitter-out';
    };

    const handleItemClick = (id: string) => {
        if (isOtdrToolActive && onSelectOtdrTarget) {
            onSelectOtdrTarget(id);
            return;
        }

        if (isVflToolActive && onToggleVfl) {
            onToggleVfl(id);
            return;
        }

        // Check if this item already has a fusion connection to VIEW
        const existingConn = currentConnections.find(c =>
            (c.sourceId === id || c.targetId === id) &&
            (c.sourceId.includes('fiber') || c.targetId.includes('fiber') ||
             c.sourceId.startsWith('splitter-') || c.targetId.startsWith('splitter-'))
        );

        if (!selectedFiberId) {
            if (existingConn) {
                setViewingConnectionStr(existingConn);
            } else {
                setSelectedFiberId(id);
            }
        } else {
            // CONNECTING: A second item has been clicked
            const t1 = getItemType(selectedFiberId);
            const t2 = getItemType(id);

            // Mesmo tipo OU par inválido → troca seleção (ou abre conexão existente)
            if (!isValidPair(t1, t2)) {
                if (existingConn) {
                    setViewingConnectionStr(existingConn);
                    setSelectedFiberId(null);
                } else {
                    setSelectedFiberId(id);
                }
                return;
            }

            const a = selectedFiberId;
            const b = id;

            // Desconecta fusões anteriores em qualquer um dos dois itens
            if (connectionMap[a] && connectionMap[a] !== b) onRemoveConnection(a, connectionMap[a]);
            if (connectionMap[b] && connectionMap[b] !== a) onRemoveConnection(b, connectionMap[b]);

            // Toggle: remove if same, else add
            if (connectionMap[a] === b) {
                onRemoveConnection(a, b);
            } else {
                onAddConnection(a, b);
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

        // Count connected fibers for this cable
        const fiberPrefix = `${cable.id}-fiber-`;
        const connectedCount = currentConnections.filter(c =>
            c.sourceId.startsWith(fiberPrefix) || c.targetId.startsWith(fiberPrefix)
        ).length;

        return (
            <div
                key={cable.id}
                id={`cable-card-${cable.id}`}
                className="bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden mb-3"
            >
                <button
                    onClick={(e) => toggleCable(cable.id, e)}
                    className="w-full px-3 py-2.5 border-b border-slate-200 dark:border-slate-700/30 font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                            <CableIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div className="min-w-0">
                            <span className="truncate block">{cable.name}</span>
                            <div className="flex items-center gap-2 text-[10px] font-normal text-slate-500">
                                <span>{cable.fiberCount} FO</span>
                                <span>&middot;</span>
                                <span className={connectedCount > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                                    {connectedCount}/{cable.fiberCount}
                                </span>
                            </div>
                        </div>
                    </div>
                    {collapsedCables.has(cable.id) ? (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                </button>

                {!collapsedCables.has(cable.id) && (
                    <div className="p-2.5">
                        {Array.from({ length: looseTubeCount }).map((_, tubeIdx) => {
                            const tubeColor = getFiberColor(tubeIdx, cable.colorStandard);
                            const isLight = [1, 2, 3, 8, 10, 11, 12].includes((tubeIdx % 12) + 1);

                            const startFiberIndex = tubeIdx * fibersPerTube;
                            const endFiberIndex = Math.min(startFiberIndex + fibersPerTube, cable.fiberCount);
                            const tubeFibersCount = Math.max(0, endFiberIndex - startFiberIndex);

                            if (tubeFibersCount === 0) return null;

                            return (
                                <div key={tubeIdx} className="mb-2 last:mb-0 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden w-fit max-w-full">
                                    <div
                                        className={`px-2.5 py-1 text-[10px] font-bold uppercase border-b border-black/5 dark:border-white/5 ${isLight ? 'text-slate-900' : 'text-white'}`}
                                        style={{ backgroundColor: tubeColor }}
                                    >
                                        T{tubeIdx + 1}
                                    </div>
                                    <div
                                        className="p-1.5 grid gap-1 bg-slate-50 dark:bg-[#1a1d23]/50"
                                        style={{ gridTemplateColumns: `repeat(${tubeFibersCount}, minmax(0, 2.5rem))` }}
                                    >
                                        {Array.from({ length: tubeFibersCount }).map((__, fOffset) => {
                                            const fiberIndex = startFiberIndex + fOffset;
                                            const fiberId = `${cable.id}-fiber-${fiberIndex}`;
                                            const color = getFiberColor(fOffset, cable.colorStandard);

                                            const isConnected = !!connectionMap[fiberId];
                                            const isSelected = selectedFiberId === fiberId;
                                            const isViewed = viewingConnectionStr?.sourceId === fiberId || viewingConnectionStr?.targetId === fiberId;
                                            const isLit = litPorts?.has(fiberId);
                                            const targetPort = connectionMap[fiberId];
                                            const targetPortNum = targetPort ? parseInt(targetPort.split('-p-')[1] || targetPort.split('-p')[1] || '0') + 1 : '';
                                            const isLightColor = [1, 2, 3, 8, 10, 11, 12].includes((fOffset % 12) + 1);

                                            return (
                                                <button
                                                    key={fiberId}
                                                    onClick={() => handleItemClick(fiberId)}
                                                    className={`
                                                        relative aspect-square min-w-0 rounded-md border flex items-center justify-center
                                                        text-[10px] font-bold transition-all
                                                        hover:scale-105 hover:z-10 hover:shadow-md
                                                        ${isSelected ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-900 z-10' : ''}
                                                        ${isViewed ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-900 z-10' : ''}
                                                        ${isLit ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-900 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]' : ''}
                                                    `}
                                                    style={{
                                                        backgroundColor: color,
                                                        borderColor: isLit ? '#ef4444' : 'rgba(0,0,0,0.2)',
                                                        color: isLightColor ? '#0f172a' : '#ffffff',
                                                    }}
                                                    title={isConnected ? `Fibra ${(fiberIndex % 12) + 1} → DIO P${targetPortNum}` : `Fibra ${(fiberIndex % 12) + 1} · ${t('port_free')}`}
                                                >
                                                    <span className="relative z-[5]">{(fiberIndex % 12) + 1}</span>
                                                    {isConnected && !isSelected && !isLit && (
                                                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-800 shadow-sm" />
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

    return (
        <div className="flex-1 w-full h-full bg-slate-50 dark:bg-[#1a1d23] flex flex-col pointer-events-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700/30 bg-white dark:bg-[#1a1d23] shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Split className="text-orange-500 w-5 h-5" />
                            {t('splicing_matrix')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {t('splicing_instruct')}
                        </p>
                    </div>
                    {relevantCables.length > 0 && (
                        <button
                            onClick={() => {
                                setAutoSpliceCableId(relevantCables[0]?.id || '');
                                setShowAutoSplice(true);
                            }}
                            className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg shadow-sm text-xs flex items-center gap-2 transition-all shrink-0"
                        >
                            <Zap className="w-3.5 h-3.5" />
                            {t('auto_splice_dio')}
                        </button>
                    )}
                </div>

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
                    // Resolve cada ponta para um label legível.
                    // Suporta: fibra de cabo, porta DIO, IN/OUT de splitter.
                    const labelForId = (id: string): { kind: string; label: string } | null => {
                        if (id.includes('-fiber-')) {
                            const cId = id.split('-fiber-')[0];
                            const fNum = Number(id.split('-fiber-')[1]) + 1;
                            const cable = incomingCables.find(c => c.id === cId);
                            return { kind: t('conn_fiber'), label: `${cable?.name ?? 'Cabo'} (F:${fNum})` };
                        }
                        if (id.startsWith('splitter-')) {
                            const sp = splittersInDio.find(s => s.inputPortId === id || s.outputPortIds.includes(id));
                            if (sp) {
                                const role = sp.inputPortId === id ? 'IN' : `OUT ${sp.outputPortIds.indexOf(id) + 1}`;
                                return { kind: 'Splitter', label: `${sp.name} (${role})` };
                            }
                            return { kind: 'Splitter', label: id };
                        }
                        const portIdx = dio.portIds.indexOf(id);
                        if (portIdx !== -1) {
                            return { kind: t('conn_port'), label: `${portIdx + 1}` };
                        }
                        return null;
                    };

                    const a = labelForId(viewingConnectionStr.sourceId);
                    const b = labelForId(viewingConnectionStr.targetId);
                    if (!a || !b) return null;

                    return (
                        <div className="mt-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="opacity-70">{t('type_FUSION')}:</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-[#22262e] rounded-md shadow-sm border border-emerald-100 dark:border-emerald-900/50">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{a.kind}</span>
                                <strong>{a.label}</strong>
                            </div>
                            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 mx-1" />
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-[#22262e] rounded-md shadow-sm border border-emerald-100 dark:border-emerald-900/50">
                                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{b.kind}</span>
                                <strong>{b.label}</strong>
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
                {/* Lado A: Cables List */}
                <div className="w-1/3 flex flex-col overflow-hidden border-r border-slate-200 dark:border-slate-700/30 bg-slate-100/50 dark:bg-[#1a1d23]/50">
                    <div className="px-4 py-2.5 bg-white dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <CableIcon className="w-4 h-4 text-sky-500" />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('linked_cables')}</span>
                        </div>
                        <span className="bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold text-sky-600 dark:text-sky-400">{allCableIds.length}</span>
                    </div>
                    <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                        {allCableIds.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-3">
                                    <CableIcon className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">{t('no_cables_available')}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">{t('link_cables_help')}</p>
                            </div>
                        ) : (
                            allCableIds.map(id => renderCableCard(id))
                        )}
                    </div>
                </div>

                {/* Coluna do meio: Splitters (cards verticais) */}
                <div className="w-72 shrink-0 flex flex-col overflow-hidden border-r border-slate-200 dark:border-slate-700/30 bg-violet-50/20 dark:bg-violet-900/5">
                    <div className="px-4 py-2.5 bg-white dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <GitFork className="w-4 h-4 text-violet-500" />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Splitters</span>
                            <span className="bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold text-violet-600 dark:text-violet-400">{splittersInDio.length}</span>
                        </div>
                        {onAddSplitter && (
                            <button
                                onClick={() => { setSelectedSplitterCatalogId(''); setShowAddSplitter(true); }}
                                className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-md shadow-sm text-[11px] flex items-center gap-1 transition-all"
                            >
                                <Plus className="w-3 h-3" />
                                Adicionar
                            </button>
                        )}
                    </div>
                    <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                        {splittersInDio.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center mb-3">
                                    <GitFork className="w-6 h-6 text-violet-400" />
                                </div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nenhum splitter</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">Adicione um splitter pra fazer fusões com fibras e portas.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {splittersInDio.map(sp => {
                                    const inIsConnected = !!connectionMap[sp.inputPortId];
                                    const inIsSelected = selectedFiberId === sp.inputPortId;
                                    const inIsViewed = viewingConnectionStr?.sourceId === sp.inputPortId || viewingConnectionStr?.targetId === sp.inputPortId;
                                    return (
                                        <div key={sp.id} className="bg-white dark:bg-[#1a1d23] border border-violet-200 dark:border-violet-500/30 rounded-lg overflow-hidden shadow-sm">
                                            {/* Header */}
                                            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-200 dark:border-violet-500/30">
                                                <GitFork className="w-3 h-3 text-violet-500 shrink-0" />
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate flex-1" title={sp.name}>{sp.name}</span>
                                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 uppercase shrink-0">
                                                    1:{sp.outputPortIds.length}
                                                </span>
                                                {sp.polishType && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                                        {sp.polishType}
                                                    </span>
                                                )}
                                                {onRenameSplitter && (
                                                    <button
                                                        onClick={() => {
                                                            const newName = window.prompt('Nome do splitter', sp.name);
                                                            if (newName && newName.trim()) onRenameSplitter(sp.id, newName.trim());
                                                        }}
                                                        className="text-slate-400 hover:text-emerald-500 text-[10px] font-bold shrink-0"
                                                        title="Renomear"
                                                    >
                                                        ✎
                                                    </button>
                                                )}
                                                {onDeleteSplitter && (
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm(`Remover splitter "${sp.name}"? As fusões nas portas dele serão removidas.`)) {
                                                                onDeleteSplitter(sp.id);
                                                            }
                                                        }}
                                                        className="text-slate-400 hover:text-rose-500 shrink-0"
                                                        title="Remover"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            {/* Body: IN row + OUTs grid */}
                                            <div className="p-2.5 space-y-2">
                                                {/* IN row */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 w-8 shrink-0">IN</span>
                                                    <button
                                                        onClick={() => handleItemClick(sp.inputPortId)}
                                                        className={`flex-1 h-8 rounded-md border-2 text-[10px] font-mono font-bold transition-all flex items-center justify-center gap-1
                                                            ${inIsViewed ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-400 scale-[1.02] z-10' :
                                                                inIsSelected ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-400 scale-[1.02] z-10' :
                                                                    inIsConnected ? 'bg-violet-500 text-white border-violet-600' :
                                                                        'bg-white dark:bg-[#1e2028] text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30 hover:border-violet-400'}`}
                                                        title={inIsConnected ? 'IN (conectado)' : 'IN (livre — clique pra fusionar com porta do DIO)'}
                                                    >
                                                        {inIsConnected ? '● Conectada' : 'Clique pra fusionar com porta do DIO'}
                                                    </button>
                                                </div>
                                                {/* OUT row */}
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-violet-500 w-8 shrink-0 pt-1">OUT</span>
                                                    <div className="flex-1 grid grid-cols-4 sm:grid-cols-6 gap-1">
                                                        {sp.outputPortIds.map((opId, idx) => {
                                                            const isConnected = !!connectionMap[opId];
                                                            const isSelected = selectedFiberId === opId;
                                                            const isViewed = viewingConnectionStr?.sourceId === opId || viewingConnectionStr?.targetId === opId;
                                                            return (
                                                                <button
                                                                    key={opId}
                                                                    onClick={() => handleItemClick(opId)}
                                                                    className={`h-8 w-full rounded-md border-2 text-[10px] font-mono font-bold transition-all relative
                                                                        ${isViewed ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-400 scale-110 z-10' :
                                                                            isSelected ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-400 scale-110 z-10' :
                                                                                isConnected ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-500/40' :
                                                                                    'bg-white dark:bg-[#1e2028] text-slate-500 border-slate-200 dark:border-slate-600/40 hover:border-violet-400'}`}
                                                                    title={isConnected ? `OUT ${idx + 1} (conectado)` : `OUT ${idx + 1} (livre — clique pra fusionar com fibra)`}
                                                                >
                                                                    {idx + 1}
                                                                    {isConnected && !isSelected && !isViewed && (
                                                                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-500"></div>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lado B: DIO (Trays/Ports) */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-[#1a1d23]">
                    <div className="px-4 py-2.5 bg-white dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-orange-500" />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('tray')}s</span>
                        </div>
                        <span className="bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold text-orange-600 dark:text-orange-400">{dio.ports}P</span>
                    </div>
                    <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col gap-2">
                            {Array.from({ length: totalTrays }).map((_, trayIdx) => {
                                const startPort = trayIdx * PORTS_PER_TRAY;
                                const endPort = Math.min(startPort + PORTS_PER_TRAY, dio.ports);
                                const portsInTray = endPort - startPort;

                                return (
                                    <div key={trayIdx} className="bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
                                        <button
                                            onClick={(e) => toggleTray(trayIdx, e)}
                                            className="w-full bg-slate-50 dark:bg-[#22262e] px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 text-xs font-bold uppercase flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
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
                                            <div className="p-2.5 flex flex-wrap gap-1.5 bg-slate-50 dark:bg-[#1a1d23]/50">
                                                {Array.from({ length: portsInTray }).map((__, pOffset) => {
                                                    const pIndex = startPort + pOffset;
                                                    const pId = dio.portIds[pIndex];

                                                    // Patch externo = port↔port com OLT/Switch (parceiro NÃO é fibra nem splitter).
                                                    // Splice/fusão = port↔fibra OU port↔splitter.IN.
                                                    const patchingConn = localPOP.connections.find(c => {
                                                        const isOnPort = c.sourceId === pId || c.targetId === pId;
                                                        if (!isOnPort) return false;
                                                        const partner = c.sourceId === pId ? c.targetId : c.sourceId;
                                                        return !partner.includes('fiber') && !partner.startsWith('splitter-');
                                                    });

                                                    const splicingConn = currentConnections.find((c: any) => {
                                                        const isOnPort = c.sourceId === pId || c.targetId === pId;
                                                        if (!isOnPort) return false;
                                                        const partner = c.sourceId === pId ? c.targetId : c.sourceId;
                                                        return partner.includes('fiber') || partner.startsWith('splitter-');
                                                    });

                                                    const isSpliced = !!splicingConn;
                                                    const isPatched = !!patchingConn;
                                                    const isSelected = selectedFiberId === pId;
                                                    const isViewed = viewingConnectionStr?.sourceId === pId || viewingConnectionStr?.targetId === pId;
                                                    const isLit = litPorts?.has(pId);

                                                    // Resolve a label do parceiro pra exibir no tooltip:
                                                    //  - fibra de cabo → "F: N"
                                                    //  - splitter IN  → "Splitter X (IN)"
                                                    const partnerId = splicingConn ? (splicingConn.sourceId === pId ? splicingConn.targetId : splicingConn.sourceId) : null;
                                                    let connectedLabel = '';
                                                    if (partnerId) {
                                                        if (partnerId.includes('-fiber-')) {
                                                            connectedLabel = `F: ${parseInt(partnerId.split('-').pop() || '0') + 1}`;
                                                        } else if (partnerId.startsWith('splitter-')) {
                                                            const sp = splittersInDio.find(s => s.inputPortId === partnerId || s.outputPortIds.includes(partnerId));
                                                            const role = sp?.inputPortId === partnerId ? 'IN' : (sp ? `OUT ${sp.outputPortIds.indexOf(partnerId) + 1}` : '');
                                                            connectedLabel = sp ? `${sp.name} (${role})` : 'Splitter';
                                                        }
                                                    }

                                                    return (
                                                        <button
                                                            key={pId}
                                                            onClick={() => handleItemClick(pId)}
                                                            className={`
                                                            h-9 w-9 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all relative
                                                            ${isSelected ? 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-400 scale-110 z-10' :
                                                                    isViewed ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg ring-2 ring-emerald-400 scale-110 z-10' :
                                                                        isLit ? 'bg-red-500 text-white border-red-600 ring-2 ring-red-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)] z-10' :
                                                                            isSpliced ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400' :
                                                                                'bg-white dark:bg-[#1a1d23] border-slate-200 dark:border-slate-700 text-slate-500 hover:border-orange-400 hover:scale-105'}
                                                        `}
                                                            title={isSpliced ? connectedLabel : t('port_free')}
                                                        >
                                                            {isLit && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-700/30 shadow-sm z-20" />}
                                                            {isLit && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping z-10" />}
                                                            <span className="text-[10px] font-bold relative z-[5]">{pIndex + 1}</span>
                                                            <div className="flex gap-0.5 mt-0.5">
                                                                {isSpliced && !isSelected && !isViewed && <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>}
                                                                {isPatched && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
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

            {/* Auto Splice Modal */}
            {showAutoSplice && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAutoSplice(false)}>
                    <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center">
                                    <Zap className="w-4.5 h-4.5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('auto_splice_dio')}</h3>
                                    <p className="text-[11px] text-slate-500">{t('auto_splice_dio_desc')}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAutoSplice(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">{t('auto_splice_dio_select_cable')}</label>
                                <div className="space-y-2">
                                    {relevantCables.map(cable => {
                                        const isSelected = autoSpliceCableId === cable.id;
                                        const fiberPrefix = `${cable.id}-fiber-`;
                                        const splicedCount = currentConnections.filter(c =>
                                            c.sourceId.startsWith(fiberPrefix) || c.targetId.startsWith(fiberPrefix)
                                        ).length;

                                        return (
                                            <button
                                                key={cable.id}
                                                onClick={() => setAutoSpliceCableId(cable.id)}
                                                className={`
                                                    w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                                                    ${isSelected
                                                        ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600'
                                                        : 'bg-white dark:bg-[#22262e]/50 border-slate-200 dark:border-slate-700/50 hover:border-orange-300'}
                                                `}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                    <CableIcon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{cable.name}</div>
                                                    <div className="text-[11px] text-slate-500">{cable.fiberCount} FO &middot; {splicedCount}/{cable.fiberCount} {t('type_FUSION').toLowerCase()}</div>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                                                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Preview */}
                            {autoSpliceCableId && (
                                <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${autoSplicePreview.count > 0
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500'
                                    }`}>
                                    {autoSplicePreview.count > 0 ? (
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-4 h-4" />
                                            <span><strong>{autoSplicePreview.count}</strong> {t('fusions_to_create')}</span>
                                        </div>
                                    ) : (
                                        <span>{t('no_available_fusions')}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/30 flex justify-end gap-2">
                            <button
                                onClick={() => setShowAutoSplice(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleAutoSplice}
                                disabled={!autoSpliceCableId || autoSplicePreview.count === 0}
                                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-sm text-sm flex items-center gap-2 transition-all"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                {t('auto_splice_dio')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Splitter Modal */}
            {showAddSplitter && onAddSplitter && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddSplitter(false)}>
                    <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                                    <GitFork className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Adicionar splitter</h3>
                                    <p className="text-[11px] text-slate-500">Escolha um modelo do catálogo. Depois faça as fusões: IN ↔ porta DIO, OUTs ↔ fibras.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddSplitter(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5">
                            {splitterCatalog.length === 0 ? (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-700 dark:text-amber-300">
                                    Nenhum splitter cadastrado no catálogo. Cadastre primeiro em "Cadastros → Splitters".
                                </div>
                            ) : (
                                <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                    {splitterCatalog.map(sp => {
                                        const isSelected = selectedSplitterCatalogId === sp.id;
                                        const att = (() => {
                                            const a: any = sp.attenuation;
                                            if (!a) return '';
                                            if (typeof a === 'object' && 'port1' in a) return `${a.port1}/${a.port2} dB`;
                                            if (typeof a === 'object' && 'value' in a) return `${a.value} dB`;
                                            return '';
                                        })();
                                        return (
                                            <button
                                                key={sp.id}
                                                onClick={() => setSelectedSplitterCatalogId(sp.id)}
                                                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all
                                                    ${isSelected
                                                        ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-500 text-violet-700 dark:text-violet-300'
                                                        : 'bg-white dark:bg-[#22262e]/50 border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:border-violet-300'}`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500'}`}>
                                                    <GitFork className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold truncate">{sp.name}</div>
                                                    <div className="text-[10px] opacity-70 truncate">
                                                        1:{sp.outputs} · {sp.mode || 'Balanced'}{att ? ` · ${att}` : ''}{sp.polishType ? ` · ${sp.polishType}` : ''}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/30 flex justify-end gap-2">
                            <button
                                onClick={() => setShowAddSplitter(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const cat = splitterCatalog.find(s => s.id === selectedSplitterCatalogId);
                                    if (cat) {
                                        onAddSplitter(cat);
                                        setShowAddSplitter(false);
                                        setSelectedSplitterCatalogId('');
                                    }
                                }}
                                disabled={!selectedSplitterCatalogId}
                                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-sm text-sm flex items-center gap-2 transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Criar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
