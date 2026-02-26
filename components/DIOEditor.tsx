
import React, { useState, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { POPData, CableData, FiberConnection, getFiberColor, DIO } from '../types';
import { X, Save, ZoomIn, ZoomOut, GripHorizontal, Zap, Cable as CableIcon, AlertCircle, Link2, Check, Layers, Unplug, Router, Flashlight, Ruler, ArrowRight, Settings2, Split } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface DIOEditorProps {
    dio: DIO;
    pop: POPData; // We need the full POP data to check OLT connections (Signal)
    incomingCables: CableData[];
    onClose: () => void;
    onSave: (updatedConnections: FiberConnection[]) => void;
    onUpdateDio?: (updatedDio: DIO) => void;

    // VFL Props
    litPorts: Set<string>;
    vflSource: string | null;
    onToggleVfl: (portId: string) => void;

    // OTDR Prop
    onOtdrTrace: (portId: string, distance: number) => void;
}

type DragMode = 'view' | 'connection' | 'reconnect' | 'cablePanel' | 'trayPanel';

export const DIOEditor: React.FC<DIOEditorProps> = ({ dio, pop, incomingCables, onClose, onSave, onUpdateDio, litPorts, vflSource, onToggleVfl, onOtdrTrace }) => {
    const { t } = useLanguage();

    // Local state only tracks the connections relevant to THIS DIO
    const [currentConnections, setCurrentConnections] = useState<FiberConnection[]>(pop.connections);

    // Viewport State
    const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);

    // Draggable Panels State
    const [cablePanelOffsets, setCablePanelOffsets] = useState<Record<string, { x: number, y: number }>>(dio.cableLayout || {});
    const [trayPanelOffset, setTrayPanelOffset] = useState(dio.trayLayout || { x: 0, y: 0 });

    // State for internal "Link Cables" modal
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    // State for "Click-to-Connect" Modal
    const [configuringFiberId, setConfiguringFiberId] = useState<string | null>(null);

    // VFL Mode UI Toggle
    const [isVflToolActive, setIsVflToolActive] = useState(false);

    // OTDR Mode State
    const [isOtdrToolActive, setIsOtdrToolActive] = useState(false);
    const [otdrTargetPort, setOtdrTargetPort] = useState<string | null>(null);
    const [otdrDistance, setOtdrDistance] = useState<string>('');

    // Filter incoming cables to only those assigned to this DIO
    const relevantCables = incomingCables.filter(c => dio.inputCableIds?.includes(c.id));

    // Interaction State
    const [dragState, setDragState] = useState<{
        mode: DragMode;
        portId?: string;
        connectionId?: string;
        fixedPortId?: string;
        movingSide?: 'source' | 'target';
        startX: number;
        startY: number;
        currentMouseX?: number;
        currentMouseY?: number;
        initialPanelOffset?: { x: number, y: number }; // For panel dragging
        panelId?: string; // For independent cable dragging
    } | null>(null);

    // Force re-render for SVG lines
    const [, setForceUpdate] = useState(0);
    useLayoutEffect(() => setForceUpdate(n => n + 1), [viewState]);

    // --- Calculate Lit Connections Locally (Visuals) ---
    const litConnections = useMemo(() => {
        const lit = new Set<string>();
        currentConnections.forEach(conn => {
            if (litPorts.has(conn.sourceId) || litPorts.has(conn.targetId)) {
                lit.add(conn.id);
            }
        });
        return lit;
    }, [litPorts, currentConnections]);


    // --- Cable Linking Logic ---
    const handleToggleCableLink = (cableId: string) => {
        if (!onUpdateDio) return;

        const currentCables = dio.inputCableIds || [];
        let newCables;
        if (currentCables.includes(cableId)) {
            newCables = currentCables.filter(c => c !== cableId);
        } else {
            // Check if assigned to other DIO in the POP
            const assignedToOther = pop.dios.find(d => d.id !== dio.id && d.inputCableIds?.includes(cableId));
            if (assignedToOther) return;

            newCables = [...currentCables, cableId];
        }

        onUpdateDio({ ...dio, inputCableIds: newCables });
    };

    // --- Performance Optimizations (O(1) Lookups) ---
    const fiberFusionsMap = useMemo(() => {
        const map = new Map<string, FiberConnection>();
        currentConnections.forEach(c => {
            if (c.sourceId.includes('fiber')) map.set(c.sourceId, c);
            if (c.targetId.includes('fiber')) map.set(c.targetId, c);
        });
        return map;
    }, [currentConnections]);

    const dioPortIsFiberConnSet = useMemo(() => {
        const set = new Set<string>();
        currentConnections.forEach(c => {
            const sourceIsFiber = c.sourceId.includes('fiber');
            const targetIsFiber = c.targetId.includes('fiber');
            if (sourceIsFiber && !targetIsFiber) set.add(c.targetId);
            if (!sourceIsFiber && targetIsFiber) set.add(c.sourceId);
        });
        return set;
    }, [currentConnections]);

    // Pre-calculate OLT connections for all DIO ports to avoid O(N*M) in render sweeps
    const oltInfoMap = useMemo(() => {
        const map = new Map<string, string>();
        pop.connections.forEach(c => {
            const isSourceDio = c.sourceId.startsWith('dio-');
            const isTargetDio = c.targetId.startsWith('dio-');
            const isSourceOlt = c.sourceId.includes('olt');
            const isTargetOlt = c.targetId.includes('olt');

            if (isSourceDio && isTargetOlt) {
                const oltPortId = c.targetId;
                const olt = pop.olts.find(o => oltPortId.startsWith(o.id));
                const oltName = olt ? olt.name : 'OLT';
                const match = oltPortId.match(/-s(\d+)-p(\d+)$/);
                if (match) map.set(c.sourceId, `${oltName}: S${match[1]} / P${match[2]}`);
                else map.set(c.sourceId, oltName);
            } else if (isTargetDio && isSourceOlt) {
                const oltPortId = c.sourceId;
                const olt = pop.olts.find(o => oltPortId.startsWith(o.id));
                const oltName = olt ? olt.name : 'OLT';
                const match = oltPortId.match(/-s(\d+)-p(\d+)$/);
                if (match) map.set(c.targetId, `${oltName}: S${match[1]} / P${match[2]}`);
                else map.set(c.targetId, oltName);
            }
        });
        return map;
    }, [pop.connections, pop.olts]);

    // --- Signal Logic ---
    const getConnectedOltInfo = useCallback((dioPortId: string): string | null => {
        return oltInfoMap.get(dioPortId) || null;
    }, [oltInfoMap]);

    const isPortActive = useCallback((dioPortId: string) => {
        return oltInfoMap.has(dioPortId);
    }, [oltInfoMap]);

    // --- Helpers ---
    const screenToCanvas = (sx: number, sy: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (sx - rect.left - viewState.x) / viewState.zoom,
            y: (sy - rect.top - viewState.y) / viewState.zoom
        };
    };

    /**
     * Calculates the anchor coordinates for a connection.
     */
    const getPortCoordinates = (portId: string): { x: number, y: number, side: 'left' | 'right' } | null => {
        const el = document.getElementById(portId);
        if (el && containerRef.current) {
            const rect = el.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            const isFiber = portId.includes('fiber');

            const relY = rect.top + rect.height / 2 - containerRect.top;
            const y = (relY - viewState.y) / viewState.zoom;

            if (isFiber) {
                const relX = rect.left + rect.width - containerRect.left;
                const x = (relX - viewState.x) / viewState.zoom;
                return { x, y, side: 'right' };
            } else {
                const relX = rect.left - containerRect.left;
                const x = (relX - viewState.x) / viewState.zoom;
                return { x, y, side: 'left' };
            }
        }
        return null;
    };

    // --- Click-to-Connect Handlers ---
    const handleFiberClick = (e: React.MouseEvent, fiberId: string) => {
        e.stopPropagation();
        if (isVflToolActive) {
            onToggleVfl(fiberId);
            return;
        }
        if (isOtdrToolActive) {
            setOtdrTargetPort(fiberId);
            return;
        }
        setConfiguringFiberId(fiberId);
    };

    const handleSelectDioPort = (dioPortId: string) => {
        if (!configuringFiberId) return;

        // Logic Update: 
        // We allow connecting to a DIO port even if it has an OLT connection (Patching).
        // We ONLY prevent/overwrite if it has another FIBER connection (SPLICING).

        // 1. Remove any existing SPLICING connection for this specific fiber (Moving the fiber)
        let nextConnections = currentConnections.filter(c =>
            c.sourceId !== configuringFiberId && c.targetId !== configuringFiberId
        );

        // 2. Remove any existing SPLICING connection on the target DIO port (Replacing existing fiber)
        nextConnections = nextConnections.filter(c => {
            if (c.sourceId === dioPortId || c.targetId === dioPortId) {
                const partner = c.sourceId === dioPortId ? c.targetId : c.sourceId;
                // If partner is a fiber, remove it (we are overwriting the splice)
                if (partner.includes('fiber')) return false;
                // If partner is OLT, KEEP IT (it's the patch cord on the front)
                return true;
            }
            return true;
        });

        const newConn: FiberConnection = {
            id: `fusion-${Date.now()}`,
            sourceId: configuringFiberId,
            targetId: dioPortId,
            color: '#22c55e',
            points: []
        };

        setCurrentConnections([...nextConnections, newConn]);
        setConfiguringFiberId(null);
    };

    const handleDisconnectFiber = () => {
        if (!configuringFiberId) return;
        // Only remove connections involving this fiber
        setCurrentConnections(prev => prev.filter(c => c.sourceId !== configuringFiberId && c.targetId !== configuringFiberId));
        setConfiguringFiberId(null);
    };

    // --- Mouse Wheel Zoom ---
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const newZoom = Math.min(Math.max(0.1, viewState.zoom + delta), 5);
        setViewState(prev => ({ ...prev, zoom: newZoom }));
    };

    // --- Panel Dragging Helpers ---
    const handlePanelDragStart = (e: React.MouseEvent, mode: 'cablePanel' | 'trayPanel', panelId?: string) => {
        e.stopPropagation();

        let initial = { x: 0, y: 0 };
        if (mode === 'cablePanel' && panelId) {
            initial = cablePanelOffsets[panelId] || { x: 0, y: 0 };
        } else if (mode === 'trayPanel') {
            initial = trayPanelOffset;
        }

        setDragState({
            mode,
            startX: e.clientX,
            startY: e.clientY,
            initialPanelOffset: initial,
            panelId
        });
    };

    // --- Drag Handlers (Legacy/Manual Adjustment) ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) {
            setDragState({ mode: 'view', startX: e.clientX, startY: e.clientY });
        }
    };

    const handlePortMouseDown = (e: React.MouseEvent, portId: string) => {
        if (portId.includes('fiber')) return;

        e.stopPropagation();

        if (isVflToolActive) {
            onToggleVfl(portId);
            return;
        }

        const { x, y } = screenToCanvas(e.clientX, e.clientY);

        // Find connection to a FIBER
        const existingFusion = currentConnections.find(c => {
            const isLinked = c.sourceId === portId || c.targetId === portId;
            if (!isLinked) return false;
            const partner = c.sourceId === portId ? c.targetId : c.sourceId;
            return partner.includes('fiber');
        });

        if (existingFusion) {
            const isSource = existingFusion.sourceId === portId;
            setDragState({
                mode: 'reconnect',
                connectionId: existingFusion.id,
                fixedPortId: isSource ? existingFusion.targetId : existingFusion.sourceId,
                movingSide: isSource ? 'source' : 'target',
                startX: e.clientX,
                startY: e.clientY,
                currentMouseX: x,
                currentMouseY: y
            });
        } else {
            // Dragging from DIO Port
            setDragState({
                mode: 'connection',
                portId: portId,
                startX: e.clientX,
                startY: e.clientY,
                currentMouseX: x,
                currentMouseY: y
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragState) return;

        if (dragState.mode === 'view') {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setDragState(prev => ({ ...prev!, startX: e.clientX, startY: e.clientY }));
        }
        else if (dragState.mode === 'cablePanel' || dragState.mode === 'trayPanel') {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            const initial = dragState.initialPanelOffset || { x: 0, y: 0 };

            if (dragState.mode === 'cablePanel' && dragState.panelId) {
                setCablePanelOffsets(prev => ({
                    ...prev,
                    [dragState.panelId!]: { x: initial.x + dx, y: initial.y + dy }
                }));
            } else {
                setTrayPanelOffset({ x: initial.x + dx, y: initial.y + dy });
            }
        }
        else if (dragState.mode === 'connection' || dragState.mode === 'reconnect') {
            const { x, y } = screenToCanvas(e.clientX, e.clientY);
            setDragState(prev => ({ ...prev!, currentMouseX: x, currentMouseY: y }));
        }
    };

    const handleMouseUp = () => {
        if (dragState?.mode === 'connection' && hoveredPortId && dragState.portId) {
            const source = dragState.portId;
            const target = hoveredPortId;

            const isSourceDio = source.startsWith(dio.id);
            const isTargetDio = target.startsWith(dio.id);

            if (source !== target && (isSourceDio !== isTargetDio)) {
                // Remove existing FIBER connections for the involved ports (overwrite splice)
                // But preserve OLT connections
                let nextConns = currentConnections.filter(c => {
                    // Check Source
                    if (c.sourceId === source || c.targetId === source) {
                        const partner = c.sourceId === source ? c.targetId : c.sourceId;
                        if (partner.includes('fiber')) return false;
                    }
                    // Check Target
                    if (c.sourceId === target || c.targetId === target) {
                        const partner = c.sourceId === target ? c.targetId : c.sourceId;
                        if (partner.includes('fiber')) return false;
                    }
                    return true;
                });

                const newConn: FiberConnection = {
                    id: `fusion-${Date.now()}`,
                    sourceId: source,
                    targetId: target,
                    color: '#22c55e',
                    points: []
                };
                setCurrentConnections([...nextConns, newConn]);
            }
        } else if (dragState?.mode === 'reconnect' && dragState.connectionId) {
            if (!hoveredPortId) {
                setCurrentConnections(prev => prev.filter(c => c.id !== dragState.connectionId));
            }
        } else if (dragState?.mode === 'cablePanel' && dragState.panelId && onUpdateDio) {
            // Persist cable position on drag end
            onUpdateDio({
                ...dio,
                cableLayout: {
                    ...dio.cableLayout,
                    ...cablePanelOffsets
                }
            });
        } else if (dragState?.mode === 'trayPanel' && onUpdateDio) {
            // Persist tray position on drag end
            onUpdateDio({
                ...dio,
                trayLayout: trayPanelOffset
            });
        }
        setDragState(null);
    };

    const handleOtdrSubmit = () => {
        if (!otdrTargetPort || !otdrDistance) return;
        const dist = parseFloat(otdrDistance);
        if (isNaN(dist)) return;

        onOtdrTrace(otdrTargetPort, dist);
        setOtdrTargetPort(null); // Close modal
        setIsOtdrToolActive(false); // Turn off tool
    };

    const PORTS_PER_TRAY = 12;
    const totalTrays = Math.ceil(dio.portIds.length / PORTS_PER_TRAY);

    return (
        <div className={`fixed inset-0 z-[2200] bg-black/60 flex items-center justify-center backdrop-blur-md ${isVflToolActive || isOtdrToolActive ? 'cursor-crosshair' : ''}`}>
            <div className="w-[95vw] h-[95vh] bg-slate-950/80 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden relative overflow-hidden backdrop-blur-xl">

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
                        {/* Tools Group */}
                        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                            <button
                                onClick={() => { setIsVflToolActive(!isVflToolActive); setIsOtdrToolActive(false); }}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all select-none ${isVflToolActive ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                title={t('tool_vfl')}
                            >
                                <Flashlight className={`w-3.5 h-3.5 ${isVflToolActive ? 'fill-current' : ''}`} /> VFL
                            </button>
                            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                            <button
                                onClick={() => { setIsOtdrToolActive(!isOtdrToolActive); setIsVflToolActive(false); }}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all select-none ${isOtdrToolActive ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                title="OTDR"
                            >
                                <Ruler className="w-3.5 h-3.5" /> OTDR
                            </button>
                        </div>

                        {/* View Controls */}
                        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5 mx-2">
                            <button onClick={() => setViewState(s => ({ ...s, zoom: s.zoom + 0.1 }))} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"><ZoomIn className="w-4 h-4" /></button>
                            <button onClick={() => setViewState(s => ({ ...s, zoom: Math.max(0.1, s.zoom - 0.1) }))} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"><ZoomOut className="w-4 h-4" /></button>
                        </div>

                        {/* Actions */}
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

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-slate-950 relative overflow-hidden"
                    style={{ cursor: isVflToolActive || isOtdrToolActive ? 'crosshair' : 'default' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onWheel={handleWheel}
                >
                    {/* VFL Info Banner */}
                    {isVflToolActive && (
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500/10 backdrop-blur-md text-red-200 px-6 py-2.5 rounded-full border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)] z-50 text-sm font-bold flex items-center gap-3 pointer-events-none animate-in slide-in-from-top-4 duration-300 select-none">
                            <div className="relative">
                                <Flashlight className="w-4 h-4 text-red-500 relative z-10" />
                                <div className="absolute inset-0 bg-red-500 blur-sm opacity-50 animate-pulse"></div>
                            </div>
                            {t('vfl_active_msg')}
                        </div>
                    )}

                    {/* OTDR Info Banner */}
                    {isOtdrToolActive && (
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-indigo-500/10 backdrop-blur-md text-indigo-200 px-6 py-2.5 rounded-full border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)] z-50 text-sm font-bold flex items-center gap-3 pointer-events-none animate-in slide-in-from-top-4 duration-300 select-none">
                            <Ruler className="w-4 h-4 text-indigo-400" />
                            {t('otdr_instruction_banner')}
                        </div>
                    )}

                    {/* Background Grid */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-[0.07]"
                        style={{
                            backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
                            backgroundSize: `${30 * viewState.zoom}px ${30 * viewState.zoom}px`,
                            backgroundPosition: `${viewState.x}px ${viewState.y}px`
                        }}
                    />

                    <div
                        style={{
                            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`,
                            transformOrigin: '0 0',
                            width: '100%',
                            height: '100%' // Ensure full height coverage
                        }}
                    >
                        {/* SVG Connections Layer */}
                        <svg className="absolute top-[-5000px] left-[-5000px] w-[10000px] h-[10000px] pointer-events-none overflow-visible z-10">
                            {currentConnections.map(conn => {
                                // Only visualize connections involving FIBERS in this view
                                const isDioConn = (conn.sourceId.startsWith(dio.id) || conn.targetId.startsWith(dio.id));
                                const isFiberConn = (conn.sourceId.includes('fiber') || conn.targetId.includes('fiber'));

                                if (!isDioConn || !isFiberConn) return null;
                                if (dragState?.mode === 'reconnect' && dragState.connectionId === conn.id) return null;

                                const p1 = getPortCoordinates(conn.sourceId);
                                const p2 = getPortCoordinates(conn.targetId);
                                if (!p1 || !p2) return null;

                                const activeSignal = isPortActive(conn.sourceId.startsWith(dio.id) ? conn.sourceId : conn.targetId);
                                const isLit = litConnections.has(conn.id);

                                const lineColor = isLit ? '#ef4444' : (activeSignal ? '#10b981' : '#64748b');
                                const lineWidth = isLit ? 4 : (activeSignal ? 3 : 2);

                                const distX = Math.abs(p2.x - p1.x);
                                const controlOffset = Math.max(distX * 0.5, 80);

                                return (
                                    <g key={conn.id} className="pointer-events-auto group">
                                        {/* Shadow/Glow for active lines */}
                                        {(isLit || activeSignal) && (
                                            <path
                                                d={`M ${p1.x} ${p1.y} C ${p1.x + controlOffset} ${p1.y}, ${p2.x - controlOffset} ${p2.y}, ${p2.x} ${p2.y}`}
                                                stroke={lineColor}
                                                strokeWidth={lineWidth * 3}
                                                fill="none"
                                                opacity={0.3}
                                                className="blur-[4px]"
                                            />
                                        )}
                                        <path
                                            d={`M ${p1.x} ${p1.y} C ${p1.x + controlOffset} ${p1.y}, ${p2.x - controlOffset} ${p2.y}, ${p2.x} ${p2.y}`}
                                            stroke={lineColor}
                                            strokeWidth={lineWidth}
                                            fill="none"
                                            strokeLinecap="round"
                                            className="transition-all duration-300"
                                        />
                                        {/* Hover hitbox */}
                                        <path
                                            d={`M ${p1.x} ${p1.y} C ${p1.x + controlOffset} ${p1.y}, ${p2.x - controlOffset} ${p2.y}, ${p2.x} ${p2.y}`}
                                            stroke="transparent"
                                            strokeWidth={15}
                                            fill="none"
                                            className="cursor-pointer"
                                        />
                                        <circle cx={p1.x} cy={p1.y} r={3} fill={lineColor} />
                                        <circle cx={p2.x} cy={p2.y} r={3} fill={lineColor} />
                                    </g>
                                );
                            })}

                            {(dragState?.mode === 'connection' || dragState?.mode === 'reconnect') && dragState.currentMouseX && (
                                <g>
                                    <path
                                        d={`M ${(getPortCoordinates(dragState.portId || dragState.fixedPortId!)?.x || 0)} ${(getPortCoordinates(dragState.portId || dragState.fixedPortId!)?.y || 0)} 
                                        L ${dragState.currentMouseX} ${dragState.currentMouseY}`}
                                        stroke="#facc15"
                                        strokeWidth={2}
                                        strokeDasharray="6,4"
                                        fill="none"
                                        className="animate-pulse"
                                    />
                                    <circle cx={dragState.currentMouseX} cy={dragState.currentMouseY} r={4} fill="#facc15" />
                                </g>
                            )}
                        </svg>

                        {/* --- LEFT SIDE: Incoming Cables (Filtered by Assignment) --- */}
                        <div
                            className="absolute top-20 left-20 flex flex-col gap-10 pb-40"
                        >
                            <div
                                className="absolute -top-8 left-0 right-0 h-8 flex items-center justify-center cursor-move opacity-0 hover:opacity-100 transition-opacity"
                            // Removed global cable drag
                            >
                                <div className="w-12 h-1 bg-white/20 rounded-full" />
                            </div>

                            {relevantCables.length === 0 ? (
                                <div className="w-[300px] h-64 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center p-8 text-center group select-none">
                                    <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                        <Unplug className="w-8 h-8 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-2">{t('no_cables_linked')}</h3>
                                    <p className="text-sm text-slate-500 mb-6">{t('link_cables_help')}</p>
                                    {onUpdateDio && (
                                        <button
                                            onClick={() => setIsLinkModalOpen(true)}
                                            className="px-6 py-2 bg-sky-600/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/50 rounded-full text-sm font-bold hover:scale-105 transition-all w-full"
                                        >
                                            {t('link_cables')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                relevantCables.map((cable, cIdx) => {
                                    const looseTubeCount = cable.looseTubeCount || 1;
                                    const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);
                                    const offset = cablePanelOffsets[cable.id] || { x: 0, y: 0 };

                                    return (
                                        <div
                                            key={cable.id}
                                            className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl w-[220px] z-20 flex flex-col overflow-hidden ring-1 ring-black/50"
                                            style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
                                        >
                                            {/* Cable Header */}
                                            <div
                                                className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-white/5 py-3 px-4 flex items-center justify-between cursor-move"
                                                onMouseDown={(e) => handlePanelDragStart(e, 'cablePanel', cable.id)}
                                            >
                                                <div className="min-w-0 select-none">
                                                    <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-0.5">{t('cable')}</span>
                                                    <span className="text-sm font-bold text-white truncate block" title={cable.name}>{cable.name}</span>
                                                </div>
                                                <div className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-white/5 rounded">
                                                    <GripHorizontal className="w-4 h-4 text-slate-600" />
                                                </div>
                                            </div>

                                            <div className="p-3 space-y-3">
                                                {Array.from({ length: looseTubeCount }).map((_, tubeIdx) => {
                                                    const tubeColor = getFiberColor(tubeIdx, cable.colorStandard);
                                                    // Added 3 (White) and 10 (Gray) to black text indices
                                                    const isLight = [1, 2, 3, 8, 10, 11, 12].includes((tubeIdx % 12) + 1);

                                                    const startFiberIndex = tubeIdx * fibersPerTube;
                                                    const endFiberIndex = Math.min(startFiberIndex + fibersPerTube, cable.fiberCount);
                                                    const tubeFibersCount = Math.max(0, endFiberIndex - startFiberIndex);

                                                    return (
                                                        <div key={tubeIdx} className="rounded-xl border border-white/5 bg-slate-950/50 overflow-hidden shadow-inner">
                                                            <div
                                                                className={`px-3 py-1.5 text-[10px] font-bold uppercase flex justify-between items-center ${isLight ? 'text-slate-900' : 'text-white'}`}
                                                                style={{ backgroundColor: tubeColor }}
                                                            >
                                                                <span className="opacity-90">{t('tube')} {tubeIdx + 1}</span>
                                                                <span className="opacity-60 text-[9px]">{tubeFibersCount}F</span>
                                                            </div>
                                                            <div className="p-1.5 space-y-1">
                                                                {Array.from({ length: tubeFibersCount }).map((__, fOffset) => {
                                                                    const fiberIndex = startFiberIndex + fOffset;

                                                                    const fiberId = `${cable.id}-fiber-${fiberIndex}`;
                                                                    const color = getFiberColor(fOffset, cable.colorStandard); // Fiber colors cycle 1-12 relative to TUBE

                                                                    const fusion = fiberFusionsMap.get(fiberId);
                                                                    const isConnected = !!fusion;
                                                                    const isLit = litPorts.has(fiberId);

                                                                    let activeOltInfo: string | null = null;
                                                                    if (fusion) {
                                                                        const dioPortId = fusion.sourceId === fiberId ? fusion.targetId : fusion.sourceId;
                                                                        activeOltInfo = getConnectedOltInfo(dioPortId);
                                                                    }

                                                                    return (
                                                                        <div key={fiberId} className="flex items-center justify-between group relative pl-1 pr-0.5">
                                                                            <div className="text-[10px] font-mono text-slate-500 w-5 select-none">{fiberIndex + 1}</div>
                                                                            <div className="flex-1 h-[1px] bg-slate-800 mx-2 relative">
                                                                                {/* Active line indicator */}
                                                                                {isLit && <div className="absolute inset-0 bg-red-500 shadow-[0_0_8px_#ef4444] opacity-100 h-[2px]"></div>}
                                                                                {!isLit && activeOltInfo && <div className="absolute inset-0 bg-emerald-500 shadow-[0_0_8px_#10b981] opacity-100 h-[2px]"></div>}
                                                                            </div>

                                                                            {/* Fiber Node Interaction */}
                                                                            <div
                                                                                id={fiberId}
                                                                                onClick={(e) => handleFiberClick(e, fiberId)}
                                                                                onMouseEnter={() => setHoveredPortId(fiberId)}
                                                                                onMouseLeave={() => setHoveredPortId(null)}
                                                                                className={`
                                                                               w-6 h-6 rounded-full cursor-pointer 
                                                                               flex items-center justify-center transition-all relative z-10 duration-200
                                                                               ${isConnected
                                                                                        ? 'border-0 scale-100 shadow-lg'
                                                                                        : 'border-2 bg-slate-900 border-slate-700 hover:border-white scale-90 hover:scale-110'
                                                                                    }
                                                                               ${hoveredPortId === fiberId ? 'ring-2 ring-white scale-110 z-20' : ''}
                                                                               ${isLit ? 'ring-2 ring-red-500 border-red-500 shadow-[0_0_15px_#ef4444]' : ''}
                                                                           `}
                                                                                style={{
                                                                                    backgroundColor: isConnected ? color : (hoveredPortId === fiberId ? color : 'transparent'),
                                                                                    borderColor: isConnected ? 'transparent' : (hoveredPortId === fiberId ? color : color),
                                                                                    opacity: isConnected ? 1 : 0.8
                                                                                }}
                                                                                title={isConnected ? t('click_to_manage') : t('click_to_connect')}
                                                                            >
                                                                                {isConnected && <Check className="w-3.5 h-3.5 text-black/60 font-black" />}
                                                                            </div>

                                                                            {activeOltInfo && !isLit && hoveredPortId === fiberId && (
                                                                                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-900/90 backdrop-blur text-white p-2 rounded-lg border border-emerald-500/50 shadow-2xl shadow-black/50 whitespace-nowrap z-[100] animate-in slide-in-from-left-2 zoom-in-95 duration-200">
                                                                                    <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider mb-1">
                                                                                        <Zap className="w-3 h-3" /> Signal Active
                                                                                    </div>
                                                                                    <div className="text-xs font-medium">{activeOltInfo}</div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* --- RIGHT SIDE: DIO Back View --- */}
                        <div
                            className="absolute top-20 right-40 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-20 w-[600px] flex flex-col ring-1 ring-black/50 overflow-hidden"
                            style={{ transform: `translate(${trayPanelOffset.x}px, ${trayPanelOffset.y}px)` }}
                        >
                            <div
                                className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-white/5 py-4 px-5 flex items-center justify-between shrink-0 cursor-move"
                                onMouseDown={(e) => handlePanelDragStart(e, 'trayPanel')}
                            >
                                <div>
                                    <h3 className="font-bold text-white text-base leading-tight flex items-center gap-2 select-none">
                                        <Layers className="w-4 h-4 text-sky-400" />
                                        {t('splice_trays')}
                                    </h3>
                                    <div className="text-xs text-slate-400 mt-0.5 select-none">{totalTrays} {t('trays', { count: totalTrays })} • {dio.portIds.length} {t('dio_ports')}</div>
                                </div>
                            </div>

                            <div className="p-4 space-y-4">
                                {Array.from({ length: totalTrays }).map((_, trayIndex) => {
                                    const startIdx = trayIndex * PORTS_PER_TRAY;
                                    const trayPorts = dio.portIds.slice(startIdx, startIdx + PORTS_PER_TRAY);
                                    const trayId = `tray-${trayIndex}`;

                                    return (
                                        <div key={trayId} className="bg-slate-950/50 border border-white/5 rounded-xl p-3 shadow-inner">
                                            <div className="flex items-center justify-between mb-3 px-1 select-none">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                    {t('tray')} {trayIndex + 1}
                                                </span>
                                                <span className="text-[9px] text-slate-600 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-white/5">
                                                    {startIdx + 1}-{Math.min(startIdx + PORTS_PER_TRAY, dio.portIds.length)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-12 gap-y-4 gap-x-2">
                                                {trayPorts.map((pid, idx) => {
                                                    const absoluteIndex = startIdx + idx;
                                                    const connectedOltInfo = getConnectedOltInfo(pid);
                                                    const isActive = !!connectedOltInfo;
                                                    const isLit = litPorts.has(pid);
                                                    const isFiberConnected = dioPortIsFiberConnSet.has(pid);

                                                    let bgClass = 'bg-slate-900 hover:bg-slate-800';
                                                    let borderClass = 'border-slate-700/50 hover:border-slate-500';
                                                    let icon = null;

                                                    if (isLit) {
                                                        bgClass = 'bg-red-500/20';
                                                        borderClass = 'border-red-500 animate-pulse';
                                                    } else if (isActive) {
                                                        bgClass = 'bg-emerald-500/20';
                                                        borderClass = 'border-emerald-500';
                                                    } else if (isFiberConnected) {
                                                        bgClass = 'bg-sky-500/10';
                                                        borderClass = 'border-sky-500/50';
                                                    }

                                                    return (
                                                        <div key={pid} className="flex flex-col items-center gap-1.5 group relative">
                                                            <div
                                                                id={pid}
                                                                onMouseDown={(e) => handlePortMouseDown(e, pid)}
                                                                onMouseEnter={() => setHoveredPortId(pid)}
                                                                onMouseLeave={() => setHoveredPortId(null)}
                                                                className={`
                                                                w-6 h-6 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all relative z-10
                                                                ${bgClass} ${borderClass}
                                                                ${isLit ? 'shadow-[0_0_10px_#ef4444]' : (isActive ? 'shadow-[0_0_10px_#10b981]' : '')}
                                                                ${hoveredPortId === pid ? 'scale-125 ring-2 ring-white border-white z-20 shadow-lg' : ''}
                                                            `}
                                                            >
                                                                {isLit ? (
                                                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                                                ) : isActive ? (
                                                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_5px_#34d399]" />
                                                                ) : isFiberConnected ? (
                                                                    <div className="w-1.5 h-1.5 bg-sky-400 rounded-full opacity-50" />
                                                                ) : (
                                                                    <div className="w-1 h-1 bg-slate-700 rounded-full group-hover:bg-slate-500" />
                                                                )}
                                                            </div>
                                                            <span className={`text-[9px] font-mono leading-none select-none ${isLit ? 'text-red-400 font-bold' : (isActive ? 'text-emerald-400 font-bold' : 'text-slate-500')}`}>
                                                                {(absoluteIndex % 12) + 1}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Legend / Helper */}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-none">
                            <div className="bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full border border-white/10 shadow-lg flex items-center gap-3 select-none">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
                                    <span className="text-[10px] uppercase font-bold text-slate-300">{t('legend_active_signal')}</span>
                                </div>
                                <div className="w-[1px] h-3 bg-white/10"></div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444] animate-pulse"></div>
                                    <span className="text-[10px] uppercase font-bold text-slate-300">{t('legend_vfl_source')}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* OTDR INPUT MODAL */}
                {otdrTargetPort && (
                    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOtdrTargetPort(null)}>
                        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-[350px] shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                                    <Ruler className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div className="select-none">
                                    <h3 className="text-white font-bold text-lg leading-tight">{t('otdr_title')}</h3>
                                    <p className="text-xs text-slate-400 mt-1">{t('otdr_trace_msg')}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1 select-none">{t('otdr_distance_lbl')} (m)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={otdrDistance}
                                            onChange={(e) => setOtdrDistance(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">{t('unit_meters')}</div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setOtdrTargetPort(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-colors">{t('cancel')}</button>
                                    <button onClick={handleOtdrSubmit} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all transform hover:translate-y-[-1px] active:translate-y-[0px]">{t('otdr_locate')}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- SELECT DIO PORT MODAL (Click-to-Connect) --- */}
                {configuringFiberId && (
                    <div className="absolute inset-0 z-[2300] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setConfiguringFiberId(null)}>
                        <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-[900px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/10" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="h-16 bg-gradient-to-r from-slate-900 to-slate-800 px-6 flex items-center justify-between border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-8 h-8 rounded-full border-4 border-slate-800 shadow-lg"
                                        style={{
                                            backgroundColor: (() => {
                                                if (!configuringFiberId) return '#ccc';
                                                const cable = incomingCables.find(c => configuringFiberId.startsWith(c.id));
                                                const parts = configuringFiberId.split('-fiber-');
                                                const idx = parseInt(parts[1]);
                                                if (cable) return getFiberColor(idx % 12, cable.colorStandard);
                                                return getFiberColor(idx, 'ABNT');
                                            })()
                                        }}
                                    />
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('connect_fiber_tray')}</h3>
                                        <p className="text-white text-base font-bold">{t('select_target_port_dio', { name: dio.name })}</p>
                                    </div>
                                </div>
                                <button onClick={() => setConfiguringFiberId(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                            </div>

                            {/* Modal Content - Trays Grid */}
                            <div className="p-6 flex-1 overflow-y-auto max-h-[60vh] space-y-6 bg-slate-950/80 custom-scrollbar">
                                {/* Connection Status of current fiber */}
                                {(() => {
                                    const existingConn = fiberFusionsMap.get(configuringFiberId);
                                    if (existingConn) {
                                        const portId = existingConn.sourceId === configuringFiberId ? existingConn.targetId : existingConn.sourceId;
                                        const match = portId.match(/-p-(\d+)$/);
                                        const portNum = match ? parseInt(match[1]) + 1 : '?';
                                        return (
                                            <div className="flex items-center justify-between bg-slate-900/80 p-4 rounded-xl border border-white/5 mb-2 relative overflow-hidden group">
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                        <Link2 className="w-4 h-4 text-emerald-500" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">{t('currently_connected')}</div>
                                                        <div className="text-white font-medium">{t('connected_to_port', { port: portNum })}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleDisconnectFiber}
                                                    className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                                                >
                                                    <Unplug className="w-3.5 h-3.5" /> {t('disconnect')}
                                                </button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-2 italic bg-slate-900/50 rounded-lg border border-white/5 border-dashed">
                                            <ArrowRight className="w-4 h-4 animate-pulse" />
                                            {t('select_tray_port_help')}
                                        </div>
                                    );
                                })()}

                                <div className="grid grid-cols-1 gap-4">
                                    {Array.from({ length: totalTrays }).map((_, trayIndex) => {
                                        const startIdx = trayIndex * PORTS_PER_TRAY;
                                        const trayPorts = dio.portIds.slice(startIdx, startIdx + PORTS_PER_TRAY);

                                        return (
                                            <div key={trayIndex} className="bg-slate-900 border border-white/5 rounded-xl p-3 shadow-sm hover:border-white/10 transition-colors">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center justify-between px-1">
                                                    <span>{t('tray')} {trayIndex + 1}</span>
                                                    <Layers className="w-3 h-3 opacity-50" />
                                                </div>
                                                <div className="grid grid-cols-12 gap-2">
                                                    {trayPorts.map((pid, idx) => {
                                                        const absoluteIndex = startIdx + idx;

                                                        const existingConns = currentConnections.filter(c => c.sourceId === pid || c.targetId === pid);

                                                        const isOccupiedByMe = existingConns.some(c => c.sourceId === configuringFiberId || c.targetId === configuringFiberId);
                                                        const occupiedByOtherFiber = dioPortIsFiberConnSet.has(pid) && !isOccupiedByMe;

                                                        // Patch cord check (occupied by OLT?)
                                                        const occupiedByOLT = oltInfoMap.has(pid);

                                                        let btnClass = 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-slate-500';
                                                        if (isOccupiedByMe) {
                                                            btnClass = 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_10px_#10b981] ring-1 ring-emerald-400';
                                                        } else if (occupiedByOtherFiber) {
                                                            btnClass = 'bg-slate-800/50 border-slate-800 text-slate-700 cursor-not-allowed opacity-50';
                                                        } else if (occupiedByOLT) {
                                                            // Can connect (it's a patch cord), but maybe show visual indicator?
                                                            btnClass = 'bg-slate-800 border-slate-600 text-slate-300 ring-1 ring-sky-500/50';
                                                        }

                                                        return (
                                                            <button
                                                                key={pid}
                                                                onClick={() => !occupiedByOtherFiber && handleSelectDioPort(pid)}
                                                                disabled={occupiedByOtherFiber}
                                                                className={`
                                                                aspect-square rounded-lg border flex items-center justify-center text-xs font-mono font-bold transition-all relative
                                                                ${btnClass}
                                                            `}
                                                                title={occupiedByOtherFiber ? t('port_occupied_splice') : (occupiedByOLT ? t('port_has_patch_cord') : t('port_available'))}
                                                            >
                                                                {(absoluteIndex % 12) + 1}
                                                                {occupiedByOLT && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-sky-500 rounded-full" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ADD NEW CABLE MODAL --- */}
                {isLinkModalOpen && (
                    <div className="absolute inset-0 z-[2400] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsLinkModalOpen(false)}>
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
