
import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { POPData, CableData, FiberConnection, FIBER_COLORS, DIO } from '../types';
import { X, Save, ZoomIn, ZoomOut, GripHorizontal, Zap, Cable as CableIcon, AlertCircle, Link2, Check, Layers, Unplug, Router, Flashlight, Ruler } from 'lucide-react';
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

type DragMode = 'view' | 'connection' | 'reconnect';

export const DIOEditor: React.FC<DIOEditorProps> = ({ dio, pop, incomingCables, onClose, onSave, onUpdateDio, litPorts, vflSource, onToggleVfl, onOtdrTrace }) => {
    const { t } = useLanguage();

    // Local state only tracks the connections relevant to THIS DIO
    const [currentConnections, setCurrentConnections] = useState<FiberConnection[]>(pop.connections);

    // Viewport State
    const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);

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
            newCables = [...currentCables, cableId];
        }

        onUpdateDio({ ...dio, inputCableIds: newCables });
    };

    // --- Signal Logic ---
    const getConnectedOltInfo = (dioPortId: string): string | null => {
        const conn = pop.connections.find(c => {
            const isTarget = c.targetId === dioPortId;
            const isSource = c.sourceId === dioPortId;
            if (!isTarget && !isSource) return false;
            const partnerId = isTarget ? c.sourceId : c.targetId;
            return partnerId.includes('olt');
        });

        if (!conn) return null;

        const oltPortId = conn.sourceId === dioPortId ? conn.targetId : conn.sourceId;
        const olt = pop.olts.find(o => oltPortId.startsWith(o.id));
        const oltName = olt ? olt.name : 'OLT';
        const match = oltPortId.match(/-s(\d+)-p(\d+)$/);
        if (match) {
            return `${oltName}: S${match[1]} / P${match[2]}`;
        }
        return oltName;
    };

    const isPortActive = (dioPortId: string) => !!getConnectedOltInfo(dioPortId);

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
        <div className={`fixed inset-0 z-[2200] bg-black/90 flex items-center justify-center backdrop-blur-sm ${isVflToolActive || isOtdrToolActive ? 'cursor-crosshair' : ''}`}>
            <div className="w-[95vw] h-[95vh] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden relative">

                {/* Toolbar */}
                <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 shrink-0 z-50">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <h2 className="font-bold text-white text-lg flex items-center gap-2 whitespace-nowrap truncate min-w-0">
                            <CableIcon className="w-5 h-5 text-yellow-400 shrink-0" />
                            <span className="truncate">{t('splicing_title', { name: dio.name })}</span>
                        </h2>
                        {onUpdateDio && (
                            <button
                                onClick={() => setIsLinkModalOpen(true)}
                                className="px-2 py-1 bg-slate-700 hover:bg-sky-600 rounded text-xs font-medium text-white flex items-center gap-2 border border-slate-600 transition-colors ml-4 shrink-0"
                            >
                                <Link2 className="w-3 h-3" /> {t('link_cables')}
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {/* VFL BUTTON */}
                        <button
                            onClick={() => { setIsVflToolActive(!isVflToolActive); setIsOtdrToolActive(false); }}
                            className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold border transition ${isVflToolActive ? 'bg-red-900/50 border-red-500 text-red-400 animate-pulse' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                            title={t('tool_vfl')}
                        >
                            <Flashlight className={`w-3 h-3 ${isVflToolActive ? 'fill-red-400' : ''}`} /> {t('tool_vfl')}
                        </button>
                        {/* OTDR BUTTON */}
                        <button
                            onClick={() => { setIsOtdrToolActive(!isOtdrToolActive); setIsVflToolActive(false); }}
                            className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold border transition ${isOtdrToolActive ? 'bg-indigo-900/50 border-indigo-500 text-indigo-400' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
                            title="OTDR"
                        >
                            <Ruler className="w-3 h-3" /> OTDR
                        </button>
                        <div className="w-[1px] h-6 bg-slate-600 mx-2"></div>
                        <button onClick={() => setViewState(s => ({ ...s, zoom: s.zoom + 0.1 }))} className="p-2 text-slate-400 hover:bg-slate-700 rounded"><ZoomIn className="w-4 h-4" /></button>
                        <button onClick={() => setViewState(s => ({ ...s, zoom: Math.max(0.1, s.zoom - 0.1) }))} className="p-2 text-slate-400 hover:bg-slate-700 rounded"><ZoomOut className="w-4 h-4" /></button>
                        <div className="w-[1px] h-6 bg-slate-600 mx-2"></div>
                        <button onClick={() => onSave(currentConnections)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center gap-2 text-sm"><Save className="w-4 h-4" /> {t('save')}</button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"><X className="w-5 h-5" /></button>
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
                >
                    {/* VFL Info Banner */}
                    {isVflToolActive && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-4 py-2 rounded-full border border-red-500 shadow-xl z-50 text-xs font-bold flex items-center gap-2 pointer-events-none">
                            <Flashlight className="w-4 h-4 animate-pulse" />
                            {t('vfl_active_msg')}
                        </div>
                    )}

                    {/* OTDR Info Banner */}
                    {isOtdrToolActive && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-900/90 text-white px-4 py-2 rounded-full border border-indigo-500 shadow-xl z-50 text-xs font-bold flex items-center gap-2 pointer-events-none">
                            <Ruler className="w-4 h-4" />
                            {t('otdr_instruction_banner')}
                        </div>
                    )}

                    {/* Background Grid */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                            backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`,
                            backgroundSize: `${20 * viewState.zoom}px ${20 * viewState.zoom}px`,
                            backgroundPosition: `${viewState.x}px ${viewState.y}px`
                        }}
                    />

                    <div
                        style={{
                            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`,
                            transformOrigin: '0 0',
                            width: '100%',
                            height: '100%'
                        }}
                    >
                        {/* SVG Connections Layer */}
                        <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible z-10">
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

                                const lineColor = isLit ? '#ef4444' : (activeSignal ? '#22c55e' : '#64748b');
                                const lineWidth = isLit ? 4 : (activeSignal ? 3 : 2);

                                const distX = Math.abs(p2.x - p1.x);
                                const controlOffset = Math.max(distX * 0.5, 50);

                                return (
                                    <g key={conn.id} className="pointer-events-auto">
                                        <path
                                            d={`M ${p1.x} ${p1.y} C ${p1.x + controlOffset} ${p1.y}, ${p2.x - controlOffset} ${p2.y}, ${p2.x} ${p2.y}`}
                                            stroke={lineColor}
                                            strokeWidth={lineWidth}
                                            fill="none"
                                            style={{ filter: isLit ? 'drop-shadow(0 0 4px #ef4444)' : 'none' }}
                                            className="transition-colors duration-300"
                                        />
                                        <circle cx={p1.x} cy={p1.y} r={3} fill={lineColor} />
                                        <circle cx={p2.x} cy={p2.y} r={3} fill={lineColor} />
                                    </g>
                                );
                            })}

                            {(dragState?.mode === 'connection' || dragState?.mode === 'reconnect') && dragState.currentMouseX && (
                                <path
                                    d={`M ${(getPortCoordinates(dragState.portId || dragState.fixedPortId!)?.x || 0)} ${(getPortCoordinates(dragState.portId || dragState.fixedPortId!)?.y || 0)} 
                                    L ${dragState.currentMouseX} ${dragState.currentMouseY}`}
                                    stroke="#facc15"
                                    strokeWidth={2}
                                    strokeDasharray="4,4"
                                    fill="none"
                                />
                            )}
                        </svg>

                        {/* --- LEFT SIDE: Incoming Cables (Filtered by Assignment) --- */}
                        <div className="absolute top-20 left-20 flex flex-col gap-10">
                            {relevantCables.length === 0 ? (
                                <div className="w-64 bg-slate-900 border border-slate-700 rounded-lg p-6 flex flex-col items-center text-center shadow-xl">
                                    <AlertCircle className="w-10 h-10 text-slate-600 mb-3" />
                                    <h3 className="text-white font-bold mb-1">{t('no_cables_linked')}</h3>
                                    <p className="text-xs text-slate-400 mb-4">{t('link_cables_help')}</p>
                                    {onUpdateDio && (
                                        <button onClick={() => setIsLinkModalOpen(true)} className="px-3 py-1.5 bg-sky-600 text-white rounded text-xs font-bold hover:bg-sky-500 transition">
                                            {t('link_cables')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                relevantCables.map((cable, cIdx) => {
                                    const looseTubeCount = cable.looseTubeCount || 1;
                                    const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);

                                    return (
                                        <div key={cable.id} className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-48 z-20 flex flex-col">
                                            <div className="h-6 bg-slate-800 border-b border-slate-700 px-2 flex items-center justify-between rounded-t-lg">
                                                <span className="text-[10px] font-bold text-slate-200 truncate">{cable.name}</span>
                                                <GripHorizontal className="w-3 h-3 text-slate-600" />
                                            </div>
                                            <div className="p-2 space-y-2">
                                                {Array.from({ length: looseTubeCount }).map((_, tubeIdx) => {
                                                    const tubeColor = FIBER_COLORS[tubeIdx % FIBER_COLORS.length];
                                                    // Added 3 (White) and 10 (Gray) to black text indices
                                                    const isLight = [1, 2, 3, 8, 10, 11, 12].includes((tubeIdx % 12) + 1);

                                                    const startFiberIndex = tubeIdx * fibersPerTube;
                                                    const endFiberIndex = Math.min(startFiberIndex + fibersPerTube, cable.fiberCount);
                                                    const tubeFibersCount = Math.max(0, endFiberIndex - startFiberIndex);

                                                    return (
                                                        <div key={tubeIdx} className="rounded border bg-slate-950/30 overflow-hidden" style={{ borderColor: tubeColor }}>
                                                            <div
                                                                className={`px-2 py-0.5 text-[9px] font-bold uppercase flex justify-between items-center ${isLight ? 'text-slate-900' : 'text-white'}`}
                                                                style={{ backgroundColor: tubeColor }}
                                                            >
                                                                <span>{t('tube')} {tubeIdx + 1}</span>
                                                            </div>
                                                            <div className="p-1 space-y-1">
                                                                {Array.from({ length: tubeFibersCount }).map((__, fOffset) => {
                                                                    const fiberIndex = startFiberIndex + fOffset;

                                                                    const fiberId = `${cable.id}-fiber-${fiberIndex}`;
                                                                    const color = FIBER_COLORS[fOffset % FIBER_COLORS.length]; // Fiber colors cycle 1-12 relative to TUBE

                                                                    const fusion = currentConnections.find(c => c.sourceId === fiberId || c.targetId === fiberId);
                                                                    const isConnected = !!fusion;
                                                                    const isLit = litPorts.has(fiberId);

                                                                    let activeOltInfo: string | null = null;
                                                                    if (fusion) {
                                                                        const dioPortId = fusion.sourceId === fiberId ? fusion.targetId : fusion.sourceId;
                                                                        activeOltInfo = getConnectedOltInfo(dioPortId);
                                                                    }

                                                                    return (
                                                                        <div key={fiberId} className="flex items-center justify-between group relative">
                                                                            <div className="text-[9px] text-slate-500 w-4 select-none">{fiberIndex + 1}</div>
                                                                            <div className="w-full h-[1px] bg-slate-700 mx-2 relative opacity-20">
                                                                                {isLit && <div className="absolute inset-0 bg-red-500 shadow-[0_0_5px_#ef4444] opacity-100"></div>}
                                                                                {!isLit && activeOltInfo && <div className="absolute inset-0 bg-green-500 shadow-[0_0_5px_#22c55e] opacity-100"></div>}
                                                                            </div>

                                                                            {/* Fiber Node Interaction */}
                                                                            <div
                                                                                id={fiberId}
                                                                                onClick={(e) => handleFiberClick(e, fiberId)}
                                                                                onMouseEnter={() => setHoveredPortId(fiberId)}
                                                                                onMouseLeave={() => setHoveredPortId(null)}
                                                                                className={`
                                                                               w-5 h-5 rounded-full cursor-pointer 
                                                                               flex items-center justify-center transition-all relative z-10
                                                                               ${isConnected
                                                                                        ? 'border-0 scale-100 shadow-md'
                                                                                        : 'border-2 bg-slate-900 scale-90 hover:scale-110'
                                                                                    }
                                                                               ${hoveredPortId === fiberId ? 'ring-2 ring-white' : ''}
                                                                               ${isLit ? 'ring-2 ring-red-500 border-red-500 shadow-[0_0_10px_#ef4444]' : ''}
                                                                           `}
                                                                                style={{
                                                                                    backgroundColor: isConnected ? color : 'transparent',
                                                                                    borderColor: color
                                                                                }}
                                                                                title={isConnected ? 'Connected (Click to change)' : 'Click to Connect'}
                                                                            >
                                                                                {isConnected && <Link2 className="w-3 h-3 text-black/70 font-bold" />}
                                                                            </div>

                                                                            {activeOltInfo && !isLit && hoveredPortId === fiberId && (
                                                                                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-green-900 text-green-100 text-[10px] px-2 py-1 rounded border border-green-700 whitespace-nowrap z-50 pointer-events-none">
                                                                                    <div className="font-bold flex items-center gap-1"><Zap className="w-3 h-3" /> Signal Active</div>
                                                                                    <div>{activeOltInfo}</div>
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
                        <div className="absolute top-20 right-40 bg-slate-800 border-2 border-slate-600 rounded-lg shadow-2xl z-20 w-80 flex flex-col max-h-[80vh]">
                            <div className="h-8 bg-slate-700 border-b border-slate-600 px-3 flex items-center justify-between shrink-0">
                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                    <CableIcon className="w-4 h-4" /> {dio.name}
                                </span>
                                <span className="text-[10px] text-slate-400">{totalTrays} {t('trays', { count: totalTrays })}</span>
                            </div>

                            <div className="p-3 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                                {Array.from({ length: totalTrays }).map((_, trayIndex) => {
                                    const startIdx = trayIndex * PORTS_PER_TRAY;
                                    const trayPorts = dio.portIds.slice(startIdx, startIdx + PORTS_PER_TRAY);
                                    const trayId = `tray-${trayIndex}`;

                                    return (
                                        <div key={trayId} className="bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 shadow-sm">
                                            <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                                    <Layers className="w-3 h-3 text-sky-600" />
                                                    {t('tray')} {trayIndex + 1}
                                                </span>
                                                <span className="text-[9px] text-slate-600 font-mono">
                                                    {startIdx + 1}-{Math.min(startIdx + PORTS_PER_TRAY, dio.portIds.length)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-6 gap-y-3 gap-x-2">
                                                {trayPorts.map((pid, idx) => {
                                                    const absoluteIndex = startIdx + idx;
                                                    const connectedOltInfo = getConnectedOltInfo(pid);
                                                    const isActive = !!connectedOltInfo;
                                                    const isLit = litPorts.has(pid);
                                                    const isFiberConnected = currentConnections.some(c => {
                                                        const isLinked = c.sourceId === pid || c.targetId === pid;
                                                        if (!isLinked) return false;
                                                        const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                        return partner.includes('fiber');
                                                    });

                                                    let bgColor = 'bg-slate-900';
                                                    let borderColor = 'border-slate-700';

                                                    if (isLit) {
                                                        bgColor = 'bg-red-500';
                                                        borderColor = 'border-red-400';
                                                    } else if (isActive) {
                                                        bgColor = 'bg-green-500';
                                                        borderColor = 'border-green-400';
                                                    } else if (isFiberConnected) {
                                                        bgColor = 'bg-slate-700';
                                                        borderColor = 'border-slate-500';
                                                    }

                                                    return (
                                                        <div key={pid} className="flex flex-col items-center gap-1 group relative">
                                                            <div
                                                                id={pid}
                                                                onMouseDown={(e) => handlePortMouseDown(e, pid)}
                                                                onMouseEnter={() => setHoveredPortId(pid)}
                                                                onMouseLeave={() => setHoveredPortId(null)}
                                                                className={`
                                                                w-4 h-4 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all relative z-10
                                                                ${bgColor} ${borderColor}
                                                                ${isLit ? 'shadow-[0_0_8px_#ef4444]' : (isActive ? 'shadow-[0_0_8px_#22c55e]' : '')}
                                                                ${hoveredPortId === pid ? 'scale-125 ring-1 ring-white border-white' : ''}
                                                            `}
                                                            >
                                                                {isActive && !isLit && <div className="w-1 h-1 bg-white rounded-full animate-pulse" />}
                                                            </div>
                                                            <span className={`text-[8px] font-mono leading-none select-none ${isLit ? 'text-red-400 font-bold' : (isActive ? 'text-green-400 font-bold' : 'text-slate-500')}`}>
                                                                {absoluteIndex + 1}
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

                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-slate-800/80 px-4 py-2 rounded-full text-xs text-slate-300 pointer-events-none flex items-center gap-2 border border-slate-700">
                            <Zap className="w-3 h-3 text-green-400" />
                            <span>{t('green_light_help')}</span>
                        </div>

                    </div>
                </div>

                {/* OTDR INPUT MODAL */}
                {otdrTargetPort && (
                    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOtdrTargetPort(null)}>
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-80 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <Ruler className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg">{t('otdr_title')}</h3>
                                    <p className="text-xs text-slate-400">{t('otdr_trace_msg')}</p>
                                </div>
                            </div>

                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t('otdr_distance_lbl')}</label>
                            <input
                                type="number"
                                value={otdrDistance}
                                onChange={(e) => setOtdrDistance(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none mb-4"
                                placeholder="e.g. 1250"
                                autoFocus
                            />

                            <div className="flex gap-2">
                                <button onClick={() => setOtdrTargetPort(null)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium">{t('cancel')}</button>
                                <button onClick={handleOtdrSubmit} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg">{t('otdr_locate')}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- SELECT DIO PORT MODAL (Click-to-Connect) --- */}
                {configuringFiberId && (
                    <div className="absolute inset-0 z-[2300] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setConfiguringFiberId(null)}>
                        <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-[500px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="h-12 bg-slate-700 px-4 flex items-center justify-between border-b border-slate-600">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-4 h-4 rounded-full border border-white/50"
                                        style={{
                                            backgroundColor: (() => {
                                                const parts = configuringFiberId.split('-fiber-');
                                                const idx = parseInt(parts[1]);
                                                return FIBER_COLORS[idx % FIBER_COLORS.length] || '#ccc';
                                            })()
                                        }}
                                    />
                                    <h3 className="text-sm font-bold text-white">{t('connect_fiber_tray')}</h3>
                                </div>
                                <button onClick={() => setConfiguringFiberId(null)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                            </div>

                            {/* Modal Content - Trays Grid */}
                            <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] space-y-4 bg-slate-900">
                                {/* Connection Status of current fiber */}
                                {(() => {
                                    const existingConn = currentConnections.find(c => c.sourceId === configuringFiberId || c.targetId === configuringFiberId);
                                    if (existingConn) {
                                        const portId = existingConn.sourceId === configuringFiberId ? existingConn.targetId : existingConn.sourceId;
                                        const match = portId.match(/-p-(\d+)$/);
                                        const portNum = match ? parseInt(match[1]) + 1 : '?';
                                        return (
                                            <div className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700 mb-4">
                                                <div className="text-xs text-slate-300">
                                                    {t('connected_to_port', { port: portNum })}
                                                </div>
                                                <button
                                                    onClick={handleDisconnectFiber}
                                                    className="px-3 py-1.5 bg-red-900/40 text-red-400 border border-red-900 rounded text-xs hover:bg-red-900 hover:text-white transition flex items-center gap-2"
                                                >
                                                    <Unplug className="w-3 h-3" /> {t('disconnect')}
                                                </button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="text-xs text-slate-500 mb-2 italic text-center">{t('select_tray_port_help')}</div>
                                    );
                                })()}

                                <div className="grid grid-cols-2 gap-3">
                                    {Array.from({ length: totalTrays }).map((_, trayIndex) => {
                                        const startIdx = trayIndex * PORTS_PER_TRAY;
                                        const trayPorts = dio.portIds.slice(startIdx, startIdx + PORTS_PER_TRAY);

                                        return (
                                            <div key={trayIndex} className="bg-slate-800/50 border border-slate-700 rounded p-2">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-700/50 pb-1">
                                                    {t('tray')} {trayIndex + 1}
                                                </div>
                                                <div className="grid grid-cols-6 gap-2">
                                                    {trayPorts.map((pid, idx) => {
                                                        const absoluteIndex = startIdx + idx;

                                                        const existingConns = currentConnections.filter(c => c.sourceId === pid || c.targetId === pid);

                                                        const isOccupiedByMe = existingConns.some(c => c.sourceId === configuringFiberId || c.targetId === configuringFiberId);
                                                        const occupiedByOtherFiber = existingConns.some(c => {
                                                            if (c.sourceId === configuringFiberId || c.targetId === configuringFiberId) return false;
                                                            const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                            return partner.includes('fiber');
                                                        });
                                                        const hasOltPatch = existingConns.some(c => {
                                                            const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                            return partner.includes('olt');
                                                        });

                                                        return (
                                                            <button
                                                                key={pid}
                                                                disabled={occupiedByOtherFiber}
                                                                onClick={() => handleSelectDioPort(pid)}
                                                                className={`
                                                                 aspect-square rounded border text-[9px] font-mono font-bold transition-all flex flex-col items-center justify-center relative select-none
                                                                 ${isOccupiedByMe
                                                                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/50 scale-110 ring-2 ring-emerald-400/30'
                                                                        : occupiedByOtherFiber
                                                                            ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed opacity-50'
                                                                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-sky-600 hover:text-white hover:border-sky-400 hover:scale-105'
                                                                    }
                                                             `}
                                                            >
                                                                {absoluteIndex + 1}
                                                                {isOccupiedByMe && <Check className="w-3 h-3 mt-0.5" />}
                                                                {hasOltPatch && !isOccupiedByMe && !occupiedByOtherFiber && (
                                                                    <Router className="w-3 h-3 text-yellow-500 absolute -top-1 -right-1" />
                                                                )}
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

                {/* --- LINK CABLES MODAL (Internal) --- */}
                {isLinkModalOpen && (
                    <div className="absolute inset-0 z-[2300] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setIsLinkModalOpen(false)}>
                        <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="h-10 bg-slate-700 px-4 flex items-center justify-between border-b border-slate-600">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-sky-400" />
                                    {t('link_cables')}
                                </h3>
                                <button onClick={() => setIsLinkModalOpen(false)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                            </div>
                            <div className="p-4 space-y-2">
                                <p className="text-xs text-slate-400 mb-2">{t('link_cables_help')}</p>
                                {incomingCables.length === 0 && <div className="text-center text-xs text-slate-500 py-4">No cables available in this POP.</div>}
                                {incomingCables.map(cable => {
                                    const isLinked = dio.inputCableIds?.includes(cable.id);
                                    const assignedToOther = pop.dios.find(d => d.id !== dio.id && d.inputCableIds?.includes(cable.id));

                                    return (
                                        <button
                                            key={cable.id}
                                            disabled={!!assignedToOther}
                                            onClick={() => handleToggleCableLink(cable.id)}
                                            className={`
                                             w-full flex items-center justify-between p-2 rounded border text-xs font-medium transition-all
                                             ${isLinked ? 'bg-sky-900/40 border-sky-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}
                                             ${assignedToOther ? 'opacity-50 cursor-not-allowed bg-slate-950' : ''}
                                         `}
                                        >
                                            <span className="flex items-center gap-2">
                                                <CableIcon className="w-3 h-3" />
                                                {cable.name}
                                            </span>
                                            {isLinked && <Check className="w-3 h-3 text-sky-400" />}
                                            {assignedToOther && <span className="text-[9px] text-red-400">Linked to {assignedToOther.name}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div >
    );
};
