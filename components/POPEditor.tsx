
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { POPData, CableData, FiberConnection, OLT, DIO, getFiberColor, ElementLayout } from '../types';
import { X, Save, Scissors, ZoomIn, ZoomOut, GripHorizontal, Server, Router, Magnet, AlignJustify, Settings2, Trash2, Cable as CableIcon, Plug, Link2, Link2Off, Check, Pencil, AlertTriangle, Move, Box } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { DIOEditor } from './DIOEditor';

interface POPEditorProps {
    pop: POPData;
    incomingCables: CableData[];
    onClose: () => void;
    onSave: (updatedPOP: POPData) => void;

    // VFL Props
    litPorts: Set<string>;
    vflSource: string | null;
    onToggleVfl: (portId: string) => void;

    // OTDR Prop
    onOtdrTrace: (portId: string, distance: number) => void;

    // Hover Highlight
    onHoverCable?: (cableId: string | null) => void;
}

type DragMode = 'view' | 'element' | 'modal_olt' | 'modal_dio';

export const POPEditor: React.FC<POPEditorProps> = ({ pop, incomingCables, onClose, onSave, litPorts, vflSource, onToggleVfl, onOtdrTrace, onHoverCable }) => {
    const { t } = useLanguage();
    const [localPOP, setLocalPOP] = useState<POPData>(JSON.parse(JSON.stringify(pop)));

    // Viewport State
    const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
    const [isSnapping, setIsSnapping] = useState(true);
    const [isRackMode, setIsRackMode] = useState(false);

    // Equipment Creation State & Position
    const [showAddOLTModal, setShowAddOLTModal] = useState(false);
    const [oltModalPos, setOltModalPos] = useState({ x: 100, y: 100 });
    const [newOLTConfig, setNewOLTConfig] = useState({ slots: 1, portsPerSlot: 8 });

    const [showAddDIOModal, setShowAddDIOModal] = useState(false);
    const [dioModalPos, setDioModalPos] = useState({ x: 150, y: 150 });
    const [newDIOConfig, setNewDIOConfig] = useState({ ports: 24 });

    // Equipment EDITING State
    const [editingOLT, setEditingOLT] = useState<{ id: string, name: string, slots: number, portsPerSlot: number } | null>(null);
    const [editingDIO, setEditingDIO] = useState<{ id: string, name: string, ports: number } | null>(null);

    // Deletion State
    const [itemToDelete, setItemToDelete] = useState<{ type: 'OLT' | 'DIO', id: string, name: string } | null>(null);

    // Patching State (New Modal Based)
    const [configuringOltPortId, setConfiguringOltPortId] = useState<string | null>(null);

    // Cable Linking State
    const [configuringDioCablesId, setConfiguringDioCablesId] = useState<string | null>(null);

    // DIO Splicing State
    const [spliceDioId, setSpliceDioId] = useState<string | null>(null);

    // Confirmation States
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    const GRID_SIZE = 20;
    const EQUIPMENT_WIDTH = 340; // Standard visual width for OLT/DIO

    // Interaction State
    const [dragState, setDragState] = useState<{
        mode: DragMode;
        targetId?: string;
        startX: number;
        startY: number;
        initialLayout?: ElementLayout; // For elements
        initialPos?: { x: number, y: number }; // For modals
    } | null>(null);

    const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [, setForceUpdate] = useState(0);
    useLayoutEffect(() => {
        setForceUpdate(n => n + 1);
    }, [viewState]);

    // --- Initialization ---
    useEffect(() => {
        setLocalPOP(prev => {
            const next = { ...prev };
            let changed = false;
            if (!next.layout) { next.layout = {}; changed = true; }

            // Position Incoming Cables on the Left
            incomingCables.forEach((cable, idx) => {
                if (!next.layout![cable.id]) {
                    next.layout![cable.id] = { x: 40, y: 40 + (idx * 300), rotation: 0 };
                    changed = true;
                }
            });

            // Position Existing OLTs
            next.olts.forEach((olt, idx) => {
                if (!next.layout![olt.id]) {
                    next.layout![olt.id] = { x: 400, y: 80 + (idx * 250), rotation: 0 };
                    changed = true;
                }
            });

            // Position Existing DIOs
            next.dios.forEach((dio, idx) => {
                if (!next.layout![dio.id]) {
                    next.layout![dio.id] = { x: 400, y: 400 + (idx * 200), rotation: 0 };
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [incomingCables.length, localPOP.olts.length, localPOP.dios.length]);


    // --- Deduplicate Incoming Cables (Protect against state errors) ---
    const uniqueIncomingCables = useMemo(() => {
        const seen = new Set();
        return incomingCables.filter(c => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
    }, [incomingCables]);

    // --- Helpers ---
    const getLayout = (id: string) => localPOP.layout?.[id] || { x: 0, y: 0, rotation: 0 };

    const organizeRackLayout = () => {
        if (isRackMode) {
            setIsRackMode(false);
            return;
        }

        const containerW = containerRef.current?.clientWidth || 800;
        // Inverse transform to find center in Canvas Space
        const centerX = (-viewState.x + containerW / 2) / viewState.zoom;
        const startY = (-viewState.y + 80) / viewState.zoom;

        // Align Rack to Grid
        const RACK_X = Math.round((centerX - EQUIPMENT_WIDTH / 2) / GRID_SIZE) * GRID_SIZE;
        const START_Y = Math.round(startY / GRID_SIZE) * GRID_SIZE;

        let currentY = START_Y;

        setLocalPOP(prev => {
            const newLayout = { ...prev.layout };

            // 1. Stack OLTs
            prev.olts.forEach(olt => {
                newLayout[olt.id] = { x: RACK_X, y: currentY, rotation: 0 };

                // Calculate precise height based on render logic
                const slots = olt.structure?.slots || 1;
                // Header (32px) + Body Padding (12px) + Slots * (approx 34px per slot row + gap) + bottom padding
                const estimatedHeight = 32 + 12 + (slots * 38) + 12;

                currentY += estimatedHeight + 10; // 10px Gap between units
            });

            // 2. Gap between OLTs and DIOs (Cable Management Space)
            currentY += 20;

            // 3. Stack DIOs
            prev.dios.forEach(dio => {
                newLayout[dio.id] = { x: RACK_X, y: currentY, rotation: 0 };

                // Calculate precise height
                // Header (32px) + Body Padding (12px) + Rows * (approx 24px per row) + bottom
                // 12 ports per row
                const rows = Math.ceil(dio.ports / 12);
                // Base height + rows * row_height + linked_cables_header (variable)
                const estimatedHeight = 32 + 12 + (rows * 28) + 50;

                currentY += estimatedHeight + 10;
            });

            return { ...prev, layout: newLayout };
        });
        setIsRackMode(true);
    };

    // Find the rack vertical bounds to draw rails
    const rackBounds = useMemo(() => {
        if (!isRackMode) return null;
        let minY = Infinity;
        let maxY = -Infinity;
        let rackX = 0;
        let count = 0;

        [...localPOP.olts, ...localPOP.dios].forEach(item => {
            const layout = localPOP.layout?.[item.id];
            if (layout) {
                if (layout.y < minY) minY = layout.y;
                // Approximate max Y based on standard unit height
                if (layout.y > maxY) maxY = layout.y + 200;
                rackX = layout.x;
                count++;
            }
        });

        if (count === 0) return null;
        // Add padding for the "Cabinet" look
        return { x: rackX, top: minY - 40, bottom: maxY + 100 };
    }, [localPOP, isRackMode]);


    // --- Safe Closing Logic ---
    const handleCloseRequest = () => {
        const hasChanges = JSON.stringify(localPOP) !== JSON.stringify(pop);
        if (hasChanges) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    };

    const handleConfirmClearConnections = () => {
        setLocalPOP(prev => ({ ...prev, connections: [] }));
        setShowClearConfirm(false);
    };

    const handleSaveAndClose = () => {
        onSave(localPOP);
        onClose();
    };

    // --- Patching Logic (New Modal Based) ---

    const handleOltPortClick = (e: React.MouseEvent, portId: string) => {
        e.stopPropagation();
        setConfiguringOltPortId(portId);
    };

    const handleConnectPort = (targetDioPortId: string) => {
        if (!configuringOltPortId) return;

        let slotColor = '#facc15';
        const slotMatch = configuringOltPortId.match(/-s(\d+)-/);
        if (slotMatch) {
            const slotIndex = parseInt(slotMatch[1]) - 1;
            slotColor = getFiberColor(slotIndex, 'ABNT');
        }

        let cleanedConnections = localPOP.connections.filter(c =>
            c.sourceId !== configuringOltPortId && c.targetId !== configuringOltPortId
        );

        cleanedConnections = cleanedConnections.filter(c => {
            if (c.sourceId === targetDioPortId || c.targetId === targetDioPortId) {
                const partner = c.sourceId === targetDioPortId ? c.targetId : c.sourceId;
                if (partner.includes('olt')) return false;
                return true;
            }
            return true;
        });

        const newConn: FiberConnection = {
            id: `patch-${Date.now()}`,
            sourceId: configuringOltPortId,
            targetId: targetDioPortId,
            color: slotColor,
            points: []
        };

        setLocalPOP(prev => ({
            ...prev,
            connections: [...cleanedConnections, newConn]
        }));
        setConfiguringOltPortId(null);
    };

    const handleDisconnectPort = () => {
        if (!configuringOltPortId) return;
        setLocalPOP(prev => ({
            ...prev,
            connections: prev.connections.filter(c => c.sourceId !== configuringOltPortId && c.targetId !== configuringOltPortId)
        }));
        setConfiguringOltPortId(null);
    };

    // --- Cable Linking Logic ---
    const handleToggleCableLink = (dioId: string, cableId: string) => {
        setLocalPOP(prev => {
            const dioIndex = prev.dios.findIndex(d => d.id === dioId);
            if (dioIndex === -1) return prev;

            const dio = prev.dios[dioIndex];
            const currentCables = dio.inputCableIds || [];

            let newCables;
            if (currentCables.includes(cableId)) {
                newCables = currentCables.filter(c => c !== cableId);
            } else {
                // Validate if assigned to another DIO
                const assignedToOther = prev.dios.find(d => d.id !== dioId && d.inputCableIds?.includes(cableId));
                if (assignedToOther) return prev;
                newCables = [...currentCables, cableId];
            }

            const newDios = [...prev.dios];
            newDios[dioIndex] = { ...dio, inputCableIds: newCables };
            return { ...prev, dios: newDios };
        });
    };

    const handleDIOSave = (updatedConnections: FiberConnection[]) => {
        setLocalPOP(prev => ({
            ...prev,
            connections: updatedConnections
        }));
        setSpliceDioId(null);
    };

    const handleUpdateDIO = (updatedDio: DIO) => {
        setLocalPOP(prev => ({
            ...prev,
            dios: prev.dios.map(d => d.id === updatedDio.id ? updatedDio : d)
        }));
    };

    // --- Event Handlers (Drag & View) ---

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.clickable-element')) return;

        if (e.button === 0) {
            setDragState({ mode: 'view', startX: e.clientX, startY: e.clientY });
        }
    };

    const handleElementDragStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDragState({
            mode: 'element',
            targetId: id,
            startX: e.clientX,
            startY: e.clientY,
            initialLayout: getLayout(id)
        });
    };

    // Generic handler for dragging modals
    const handleModalDragStart = (e: React.MouseEvent, type: 'modal_olt' | 'modal_dio') => {
        e.stopPropagation();
        const currentPos = type === 'modal_olt' ? oltModalPos : dioModalPos;
        setDragState({
            mode: type,
            startX: e.clientX,
            startY: e.clientY,
            initialPos: currentPos
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragState) return;

        if (dragState.mode === 'view') {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setDragState(prev => ({ ...prev!, startX: e.clientX, startY: e.clientY }));
        }
        else if (dragState.mode === 'element' && dragState.targetId && dragState.initialLayout) {
            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;
            let newX = dragState.initialLayout.x + dx;
            let newY = dragState.initialLayout.y + dy;

            if (isSnapping) {
                newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            }

            setLocalPOP(prev => ({
                ...prev,
                layout: { ...prev.layout, [dragState.targetId!]: { ...dragState.initialLayout!, x: newX, y: newY } }
            }));
        }
        else if (dragState.mode === 'modal_olt' && dragState.initialPos) {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            setOltModalPos({ x: dragState.initialPos.x + dx, y: dragState.initialPos.y + dy });
        }
        else if (dragState.mode === 'modal_dio' && dragState.initialPos) {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            setDioModalPos({ x: dragState.initialPos.x + dx, y: dragState.initialPos.y + dy });
        }
    };

    const handleMouseUp = () => {
        setDragState(null);
    };

    // --- Equipment Management ---

    const handleAddOLT = () => {
        const id = `olt-${Date.now()}`;
        const { slots, portsPerSlot } = newOLTConfig;
        const totalPorts = slots * portsPerSlot;
        const portIds: string[] = [];
        for (let s = 1; s <= slots; s++) {
            for (let p = 1; p <= portsPerSlot; p++) {
                portIds.push(`${id}-s${s}-p${p}`);
            }
        }
        const newOLT: OLT = {
            id,
            name: `OLT ${localPOP.olts.length + 1}`,
            ports: totalPorts,
            portIds,
            status: 'PLANNED',
            structure: { slots, portsPerSlot }
        };

        // Calculate Safe Position
        const containerW = containerRef.current?.clientWidth || 800;
        const containerH = containerRef.current?.clientHeight || 600;

        const centerX = (-viewState.x + containerW / 2) / (viewState.zoom || 1);
        const centerY = (-viewState.y + containerH / 2) / (viewState.zoom || 1);

        // Ensure values are numbers
        const finalX = isSnapping
            ? Math.round((isNaN(centerX) ? 100 : centerX) / GRID_SIZE) * GRID_SIZE
            : (isNaN(centerX) ? 100 : centerX);

        const finalY = isSnapping
            ? Math.round((isNaN(centerY) ? 100 : centerY) / GRID_SIZE) * GRID_SIZE
            : (isNaN(centerY) ? 100 : centerY);

        setLocalPOP(prev => ({
            ...prev,
            olts: [...prev.olts, newOLT],
            layout: { ...prev.layout, [id]: { x: finalX, y: finalY, rotation: 0 } }
        }));
        setShowAddOLTModal(false);
    };

    const handleSaveEditedOLT = () => {
        if (!editingOLT) return;

        const { id, name, slots, portsPerSlot } = editingOLT;
        const totalPorts = slots * portsPerSlot;

        const newPortIds: string[] = [];
        for (let s = 1; s <= slots; s++) {
            for (let p = 1; p <= portsPerSlot; p++) {
                newPortIds.push(`${id}-s${s}-p${p}`);
            }
        }

        setLocalPOP(prev => {
            const updatedOlts = prev.olts.map(o => o.id === id ? {
                ...o,
                name,
                ports: totalPorts,
                portIds: newPortIds,
                structure: { slots, portsPerSlot }
            } : o);

            const updatedConnections = prev.connections.filter(c => {
                const isSourceInOLT = c.sourceId.startsWith(id);
                const isTargetInOLT = c.targetId.startsWith(id);
                if (isSourceInOLT && !newPortIds.includes(c.sourceId)) return false;
                if (isTargetInOLT && !newPortIds.includes(c.targetId)) return false;
                return true;
            });

            return {
                ...prev,
                olts: updatedOlts,
                connections: updatedConnections
            };
        });

        setEditingOLT(null);
    };

    const handleAddDIO = () => {
        const id = `dio-${Date.now()}`;
        const size = newDIOConfig.ports;
        const newDIO: DIO = {
            id,
            name: `DIO ${localPOP.dios.length + 1}`,
            ports: size,
            portIds: Array.from({ length: size }).map((_, i) => `${id}-p-${i}`),
            status: 'PLANNED',
            inputCableIds: []
        };

        // Calculate Safe Position
        const containerW = containerRef.current?.clientWidth || 800;
        const containerH = containerRef.current?.clientHeight || 600;

        const centerX = (-viewState.x + containerW / 2) / (viewState.zoom || 1);
        const centerY = (-viewState.y + containerH / 2) / (viewState.zoom || 1);

        const finalX = isSnapping
            ? Math.round((isNaN(centerX) ? 100 : centerX) / GRID_SIZE) * GRID_SIZE
            : (isNaN(centerX) ? 100 : centerX);

        const finalY = isSnapping
            ? Math.round((isNaN(centerY) ? 100 : centerY) / GRID_SIZE) * GRID_SIZE
            : (isNaN(centerY) ? 100 : centerY);

        setLocalPOP(prev => ({
            ...prev,
            dios: [...prev.dios, newDIO],
            layout: { ...prev.layout, [id]: { x: finalX, y: finalY, rotation: 0 } }
        }));
        setShowAddDIOModal(false);
    };

    const handleSaveEditedDIO = () => {
        if (!editingDIO) return;
        const { id, name, ports } = editingDIO;
        const newPortIds = Array.from({ length: ports }).map((_, i) => `${id}-p-${i}`);

        setLocalPOP(prev => {
            const updatedDios = prev.dios.map(d => d.id === id ? {
                ...d,
                name,
                ports,
                portIds: newPortIds
            } : d);

            const updatedConnections = prev.connections.filter(c => {
                const isSourceInDIO = c.sourceId.startsWith(id);
                const isTargetInDIO = c.targetId.startsWith(id);
                if (isSourceInDIO && !newPortIds.includes(c.sourceId)) return false;
                if (isTargetInDIO && !newPortIds.includes(c.targetId)) return false;
                return true;
            });

            return { ...prev, dios: updatedDios, connections: updatedConnections };
        });
        setEditingDIO(null);
    };

    const confirmDeleteEquipment = () => {
        if (!itemToDelete) return;

        if (itemToDelete.type === 'OLT') {
            setLocalPOP(prev => {
                const o = prev.olts.find(x => x.id === itemToDelete.id);
                if (!o) return prev;
                return {
                    ...prev,
                    olts: prev.olts.filter(x => x.id !== itemToDelete.id),
                    connections: prev.connections.filter(c => !o.portIds.includes(c.sourceId) && !o.portIds.includes(c.targetId))
                };
            });
        } else {
            setLocalPOP(prev => {
                const d = prev.dios.find(x => x.id === itemToDelete.id);
                if (!d) return prev;
                return {
                    ...prev,
                    dios: prev.dios.filter(x => x.id !== itemToDelete.id),
                    connections: prev.connections.filter(c => !d.portIds.includes(c.sourceId) && !d.portIds.includes(c.targetId))
                };
            });
        }
        setItemToDelete(null);
    };

    return (
        <div className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center backdrop-blur-sm">
            <div className="w-[95vw] h-[95vh] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden relative">

                {/* Toolbar */}
                <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 shrink-0 z-50">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <h2 className="font-bold text-white text-lg flex items-center gap-2 whitespace-nowrap truncate min-w-0">
                            <Box className="w-5 h-5 text-indigo-400 shrink-0" />
                            <span className="truncate">{t('pop_editor_title', { name: pop.name })}</span>
                        </h2>
                        <div className="w-[1px] h-6 bg-slate-600 shrink-0"></div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowAddOLTModal(true)} className="px-3 py-1.5 bg-slate-700 hover:bg-sky-600 text-white rounded text-xs font-bold border border-slate-600 flex items-center gap-2 transition-colors">
                                <Router className="w-3 h-3" /> {t('add_olt')}
                            </button>
                            <button onClick={() => setShowAddDIOModal(true)} className="px-3 py-1.5 bg-slate-700 hover:bg-sky-600 text-white rounded text-xs font-bold border border-slate-600 flex items-center gap-2 transition-colors">
                                <Server className="w-3 h-3" /> {t('add_dio')}
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={organizeRackLayout} className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-bold transition ${isRackMode ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                            <AlignJustify className="w-3 h-3" /> {t('rack_view')}
                        </button>
                        <div className="w-[1px] h-6 bg-slate-600 mx-2"></div>
                        <button onClick={() => setIsSnapping(!isSnapping)} className={`p-2 rounded transition ${isSnapping ? 'text-sky-400 bg-sky-900/30 ring-1 ring-sky-500' : 'text-slate-400 hover:bg-slate-700'}`}>
                            <Magnet className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewState(s => ({ ...s, zoom: s.zoom + 0.1 }))} className="p-2 text-slate-400 hover:bg-slate-700 rounded"><ZoomIn className="w-4 h-4" /></button>
                        <button onClick={() => setViewState(s => ({ ...s, zoom: Math.max(0.1, s.zoom - 0.1) }))} className="p-2 text-slate-400 hover:bg-slate-700 rounded"><ZoomOut className="w-4 h-4" /></button>

                        <button onClick={() => setShowClearConfirm(true)} className="p-2 text-red-400 hover:bg-red-900/20 rounded"><Scissors className="w-4 h-4" /></button>
                        <div className="w-[1px] h-6 bg-slate-600 mx-2"></div>
                        <button onClick={() => onSave(localPOP)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center gap-2 text-sm"><Save className="w-4 h-4" /> {t('save')}</button>
                        <button onClick={handleCloseRequest} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-slate-950 relative overflow-hidden cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    {/* Grid */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                            backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`,
                            backgroundSize: `${GRID_SIZE * viewState.zoom}px ${GRID_SIZE * viewState.zoom}px`,
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
                        {/* Visual Connections (Cables -> DIOs) */}
                        {!isRackMode && (
                            <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible z-10">
                                {localPOP.dios.map(dio => {
                                    if (!dio.inputCableIds || dio.inputCableIds.length === 0) return null;
                                    const dioLayout = getLayout(dio.id);
                                    const p2 = { x: dioLayout.x, y: dioLayout.y + 40 };

                                    return dio.inputCableIds.map(cableId => {
                                        const cable = uniqueIncomingCables.find(c => c.id === cableId);
                                        if (!cable) return null;
                                        const cableLayout = getLayout(cable.id);
                                        const p1 = { x: cableLayout.x + 112, y: cableLayout.y + 30 };

                                        const cx = (p1.x + p2.x) / 2;
                                        const cy = (p1.y + p2.y) / 2;

                                        return (
                                            <g key={`${cable.id}-${dio.id}`}>
                                                <path
                                                    d={`M ${p1.x} ${p1.y} C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`}
                                                    stroke="#0ea5e9"
                                                    strokeWidth={3}
                                                    fill="none"
                                                    opacity={0.5}
                                                />
                                                <circle cx={p1.x} cy={p1.y} r={3} fill="#0ea5e9" />
                                                <circle cx={p2.x} cy={p2.y} r={3} fill="#0ea5e9" />
                                            </g>
                                        );
                                    });
                                })}
                            </svg>
                        )}

                        {/* Rack Background Rails */}
                        {isRackMode && rackBounds && (
                            <div
                                className="absolute pointer-events-none z-10"
                                style={{
                                    left: rackBounds.x - 20,
                                    top: rackBounds.top,
                                    width: EQUIPMENT_WIDTH + 40,
                                    height: rackBounds.bottom - rackBounds.top
                                }}
                            >
                                {/* Left Rail */}
                                <div className="absolute top-0 bottom-0 left-0 w-4 bg-slate-800 border-r border-slate-600 flex flex-col items-center py-2 gap-4">
                                    {Array.from({ length: Math.floor((rackBounds.bottom - rackBounds.top) / 20) }).map((_, i) => (
                                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-black/50"></div>
                                    ))}
                                </div>
                                {/* Right Rail */}
                                <div className="absolute top-0 bottom-0 right-0 w-4 bg-slate-800 border-l border-slate-600 flex flex-col items-center py-2 gap-4">
                                    {Array.from({ length: Math.floor((rackBounds.bottom - rackBounds.top) / 20) }).map((_, i) => (
                                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-black/50"></div>
                                    ))}
                                </div>
                                {/* Header Label */}
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-slate-500 font-bold text-xs bg-slate-900 px-2 py-1 rounded border border-slate-700">
                                    19" RACK
                                </div>
                            </div>
                        )}

                        {/* Incoming Cables */}
                        {!isRackMode && uniqueIncomingCables.map(cable => {
                            const layout = getLayout(cable.id);
                            return (
                                <div
                                    key={cable.id}
                                    style={{ transform: `translate(${layout.x}px, ${layout.y}px)` }}
                                    className="absolute w-28 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 flex flex-col opacity-50 hover:opacity-100 transition-opacity clickable-element"
                                    onMouseEnter={() => onHoverCable && onHoverCable(cable.id)}
                                    onMouseLeave={() => onHoverCable && onHoverCable(null)}
                                >
                                    <div
                                        className="h-6 bg-slate-800 border-b border-slate-700 px-2 flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-lg"
                                        onMouseDown={(e) => handleElementDragStart(e, cable.id)}
                                    >
                                        <span className="text-[10px] font-bold text-slate-200 truncate">{cable.name}</span>
                                        <GripHorizontal className="w-3 h-3 text-slate-600" />
                                    </div>
                                    <div className="p-2 text-[10px] text-slate-500 text-center">
                                        Backbone Cable<br />(Splice inside DIO)
                                    </div>
                                </div>
                            );
                        })}

                        {/* OLT Units */}
                        {localPOP.olts.map(olt => {
                            const layout = getLayout(olt.id);
                            const width = EQUIPMENT_WIDTH;
                            const slots = olt.structure?.slots || 1;
                            const portsPerSlot = olt.structure?.portsPerSlot || 8;

                            return (
                                <div
                                    key={olt.id}
                                    style={{ transform: `translate(${layout.x}px, ${layout.y}px)`, width }}
                                    className="absolute bg-slate-800 border-2 border-slate-600 rounded shadow-2xl z-20 flex flex-col group clickable-element"
                                >
                                    <div
                                        className="h-8 bg-sky-900 border-b border-sky-800 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
                                        onMouseDown={(e) => handleElementDragStart(e, olt.id)}
                                    >
                                        <span className="text-xs font-bold text-white flex items-center gap-2"><Router className="w-3 h-3" /> {olt.name}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingOLT({ id: olt.id, name: olt.name, slots, portsPerSlot }); }}
                                                className="text-sky-300 hover:text-white p-0.5"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'OLT', id: olt.id, name: olt.name }); }}
                                                className="text-red-400 hover:text-white p-0.5"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-slate-900 space-y-2">
                                        {Array.from({ length: slots }).map((_, sIdx) => {
                                            const slotColor = getFiberColor(sIdx, 'ABNT');
                                            return (
                                                <div key={sIdx} className="flex items-center gap-2 bg-slate-950 p-1.5 rounded border border-slate-800">
                                                    <div className="w-6 text-[9px] font-mono text-center font-bold" style={{ color: slotColor }}>S{sIdx + 1}</div>
                                                    <div className="flex-1 grid grid-cols-8 gap-1">
                                                        {Array.from({ length: portsPerSlot }).map((_, pIdx) => {
                                                            const portId = `${olt.id}-s${sIdx + 1}-p${pIdx + 1}`;
                                                            const existingConn = localPOP.connections.find(c => c.sourceId === portId || c.targetId === portId);
                                                            const isConnected = !!existingConn;
                                                            const isBeingConfigured = configuringOltPortId === portId;

                                                            return (
                                                                <div
                                                                    key={portId}
                                                                    id={portId}
                                                                    onMouseDown={(e) => handleOltPortClick(e, portId)}
                                                                    onMouseEnter={() => setHoveredPortId(portId)}
                                                                    onMouseLeave={() => setHoveredPortId(null)}
                                                                    className={`
                                                                aspect-square rounded border cursor-pointer select-none flex items-center justify-center text-[8px] font-mono transition-all
                                                                ${isBeingConfigured ? 'ring-2 ring-white scale-110 z-10' : ''}
                                                                ${hoveredPortId === portId ? 'scale-125 border-white z-10' : ''}
                                                            `}
                                                                    style={{
                                                                        backgroundColor: isConnected ? slotColor : 'rgba(15, 23, 42, 0.5)',
                                                                        borderColor: isConnected ? slotColor : 'rgb(51, 65, 85)',
                                                                        color: isConnected ? '#000' : 'rgb(100, 116, 139)',
                                                                        boxShadow: isConnected ? `0 0 5px ${slotColor}` : 'none'
                                                                    }}
                                                                >
                                                                    {pIdx + 1}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {/* DIO Units */}
                        {localPOP.dios.map(dio => {
                            const layout = getLayout(dio.id);
                            const width = EQUIPMENT_WIDTH;
                            const linkedCables = uniqueIncomingCables.filter(c => dio.inputCableIds?.includes(c.id));

                            return (
                                <div
                                    key={dio.id}
                                    style={{ transform: `translate(${layout.x}px, ${layout.y}px)`, width }}
                                    className="absolute bg-slate-800 border-2 border-slate-600 rounded shadow-2xl z-20 flex flex-col group clickable-element"
                                >
                                    <div
                                        className="h-8 bg-slate-700 border-b border-slate-600 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
                                        onMouseDown={(e) => handleElementDragStart(e, dio.id)}
                                    >
                                        <span className="text-xs font-bold text-white flex items-center gap-2"><Server className="w-3 h-3" /> {dio.name}</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfiguringDioCablesId(dio.id); }}
                                                className="p-1 text-slate-300 hover:text-white hover:bg-slate-600 rounded"
                                                title="Link Cables"
                                            >
                                                <Link2 className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSpliceDioId(dio.id); }}
                                                className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 rounded text-[9px] font-bold text-white flex items-center gap-1"
                                            >
                                                <Plug className="w-3 h-3" /> Fusões
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingDIO({ id: dio.id, name: dio.name, ports: dio.ports }); }}
                                                className="text-sky-300 hover:text-white p-0.5"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setItemToDelete({ type: 'DIO', id: dio.id, name: dio.name }); }}
                                                className="text-red-400 hover:text-white p-0.5"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-slate-900">
                                        {/* Linked Cables Display */}
                                        <div className="mb-3 px-2 py-1 bg-slate-950 border border-slate-800 rounded">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Cables</span>
                                            {linkedCables.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {linkedCables.map(c => (
                                                        <span key={c.id} className="text-[9px] bg-sky-900 text-sky-200 px-1 rounded border border-sky-800">{c.name}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-[9px] text-slate-600 italic">No cables linked</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-12 gap-1.5">
                                            {dio.portIds.map((pid, idx) => {
                                                const existingConns = localPOP.connections.filter(c => c.sourceId === pid || c.targetId === pid);
                                                const patchConn = existingConns.find(c => {
                                                    const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                    return partner.includes('olt');
                                                });

                                                const isConnected = !!patchConn;

                                                let highlightForActiveOLT = false;
                                                if (configuringOltPortId) {
                                                    if (patchConn && (patchConn.sourceId === configuringOltPortId || patchConn.targetId === configuringOltPortId)) {
                                                        highlightForActiveOLT = true;
                                                    }
                                                }

                                                const portColor = patchConn ? patchConn.color : null;

                                                return (
                                                    <div
                                                        key={pid}
                                                        id={pid}
                                                        onMouseEnter={() => setHoveredPortId(pid)}
                                                        onMouseLeave={() => setHoveredPortId(null)}
                                                        className={`
                                                        aspect-square rounded-full border flex items-center justify-center text-[8px] font-mono transition-all select-none
                                                        ${highlightForActiveOLT ? 'ring-4 ring-white scale-125 z-50 animate-pulse' : ''}
                                                        ${hoveredPortId === pid ? 'scale-125 border-white z-10' : ''}
                                                        ${!isConnected ? 'bg-slate-950 border-slate-700 text-slate-500' : ''}
                                                    `}
                                                        style={isConnected ? {
                                                            backgroundColor: portColor!,
                                                            borderColor: portColor!,
                                                            color: '#000',
                                                            boxShadow: highlightForActiveOLT ? `0 0 15px ${portColor}` : `0 0 8px ${portColor}`
                                                        } : {}}
                                                        title={`Port ${idx + 1}`}
                                                    >
                                                        {idx + 1}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                    </div>
                </div>

                {/* --- MODALS --- */}

                {/* CONFIRM DELETE EQUIPMENT */}
                {itemToDelete && (
                    <div className="absolute inset-0 z-[2500] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center shrink-0 border border-red-500/30">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{t('confirm_delete')}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        {t('confirm_delete_equip_msg', { name: itemToDelete.name })}
                                        <br /><br />
                                        <span className="text-red-400 font-bold">{t('delete_warning_msg', { type: itemToDelete.type })}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => setItemToDelete(null)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-lg transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={confirmDeleteEquipment}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-900/20 transition-all active:scale-95"
                                >
                                    {t('delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONFIRM CLEAR CONNECTIONS */}
                {showClearConfirm && (
                    <div className="absolute inset-0 z-[2500] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center shrink-0 border border-red-500/30">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{t('confirm_delete')}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        {t('clear_connections_confirm')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-lg transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmClearConnections}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-900/20 transition-all active:scale-95"
                                >
                                    {t('clear_all')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* CONFIRM UNSAVED CHANGES */}
                {showCloseConfirm && (
                    <div className="absolute inset-0 z-[2500] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-amber-900/30 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30">
                                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{t('unsaved_changes')}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        {t('unsaved_changes_msg')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 mt-6">
                                <button
                                    onClick={handleSaveAndClose}
                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all"
                                >
                                    {t('save_and_close')}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full py-2 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-900/50 rounded-lg font-medium text-sm transition-colors"
                                >
                                    {t('discard')}
                                </button>
                                <button
                                    onClick={() => setShowCloseConfirm(false)}
                                    className="w-full py-2 text-slate-500 hover:text-white text-xs font-medium transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- DRAGGABLE ADD MODALS --- */}

                {/* Add OLT Modal */}
                {showAddOLTModal && (
                    <div
                        className="absolute z-[2200] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-64 overflow-hidden pointer-events-auto"
                        style={{ left: oltModalPos.x, top: oltModalPos.y }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div
                            className="h-8 bg-slate-700 px-3 flex items-center justify-between cursor-move select-none"
                            onMouseDown={(e) => handleModalDragStart(e, 'modal_olt')}
                        >
                            <h3 className="text-xs font-bold text-white flex items-center gap-2"><Move className="w-3 h-3" /> New OLT</h3>
                            <button onClick={() => setShowAddOLTModal(false)} className="text-slate-400 hover:text-white"><X className="w-3 h-3" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-xs text-slate-400">Slots</label>
                                <input type="number" min="1" max="16" value={newOLTConfig.slots} onChange={e => setNewOLTConfig({ ...newOLTConfig, slots: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Ports per Slot</label>
                                <input type="number" min="8" max="16" step="8" value={newOLTConfig.portsPerSlot} onChange={e => setNewOLTConfig({ ...newOLTConfig, portsPerSlot: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={handleAddOLT} className="w-full py-1.5 bg-sky-600 text-xs text-white font-bold rounded hover:bg-sky-500 transition">Create OLT</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add DIO Modal */}
                {showAddDIOModal && (
                    <div
                        className="absolute z-[2200] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-64 overflow-hidden pointer-events-auto"
                        style={{ left: dioModalPos.x, top: dioModalPos.y }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div
                            className="h-8 bg-slate-700 px-3 flex items-center justify-between cursor-move select-none"
                            onMouseDown={(e) => handleModalDragStart(e, 'modal_dio')}
                        >
                            <h3 className="text-xs font-bold text-white flex items-center gap-2"><Move className="w-3 h-3" /> New DIO</h3>
                            <button onClick={() => setShowAddDIOModal(false)} className="text-slate-400 hover:text-white"><X className="w-3 h-3" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="text-xs text-slate-400">Total Ports</label>
                                <select value={newDIOConfig.ports} onChange={e => setNewDIOConfig({ ...newDIOConfig, ports: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white">
                                    <option value="12">12 Ports</option>
                                    <option value="24">24 Ports</option>
                                    <option value="36">36 Ports</option>
                                    <option value="48">48 Ports</option>
                                    <option value="72">72 Ports</option>
                                    <option value="144">144 Ports</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={handleAddDIO} className="w-full py-1.5 bg-sky-600 text-xs text-white font-bold rounded hover:bg-sky-500 transition">Create DIO</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* EDIT OLT MODAL */}
                {editingOLT && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setEditingOLT(null)}>
                        <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-80 p-4" onClick={e => e.stopPropagation()}>
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit OLT</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-400">Name</label>
                                    <input type="text" value={editingOLT.name} onChange={e => setEditingOLT({ ...editingOLT, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-400">Slots</label>
                                        <input type="number" min="1" max="16" value={editingOLT.slots} onChange={e => setEditingOLT({ ...editingOLT, slots: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400">Ports/Slot</label>
                                        <input type="number" min="8" max="16" step="8" value={editingOLT.portsPerSlot} onChange={e => setEditingOLT({ ...editingOLT, portsPerSlot: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                                    </div>
                                </div>
                                <div className="bg-amber-900/20 border border-amber-900/50 p-2 rounded flex gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <p className="text-[10px] text-amber-400">Reducing slots/ports will remove existing connections on deleted ports.</p>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => setEditingOLT(null)} className="px-3 py-1 bg-slate-700 text-xs text-white rounded">Cancel</button>
                                    <button onClick={handleSaveEditedOLT} className="px-3 py-1 bg-sky-600 text-xs text-white font-bold rounded">Save Changes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* EDIT DIO MODAL */}
                {editingDIO && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setEditingDIO(null)}>
                        <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-80 p-4" onClick={e => e.stopPropagation()}>
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit DIO</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-400">Name</label>
                                    <input type="text" value={editingDIO.name} onChange={e => setEditingDIO({ ...editingDIO, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Total Ports</label>
                                    <select value={editingDIO.ports} onChange={e => setEditingDIO({ ...editingDIO, ports: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white">
                                        <option value="12">12 Ports</option>
                                        <option value="24">24 Ports</option>
                                        <option value="36">36 Ports</option>
                                        <option value="48">48 Ports</option>
                                        <option value="72">72 Ports</option>
                                        <option value="144">144 Ports</option>
                                    </select>
                                </div>
                                <div className="bg-amber-900/20 border border-amber-900/50 p-2 rounded flex gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <p className="text-[10px] text-amber-400">Reducing ports will remove existing connections on deleted ports.</p>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => setEditingDIO(null)} className="px-3 py-1 bg-slate-700 text-xs text-white rounded">Cancel</button>
                                    <button onClick={handleSaveEditedDIO} className="px-3 py-1 bg-sky-600 text-xs text-white font-bold rounded">Save Changes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CABLE LINKING MODAL */}
                {configuringDioCablesId && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setConfiguringDioCablesId(null)}>
                        <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="h-10 bg-slate-700 px-4 flex items-center justify-between border-b border-slate-600">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-sky-400" />
                                    {t('link_cables')}
                                </h3>
                                <button onClick={() => setConfiguringDioCablesId(null)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                            </div>
                            <div className="p-4 space-y-2">
                                <p className="text-xs text-slate-400 mb-2">{t('link_cables_help')}</p>
                                {uniqueIncomingCables.length === 0 && <div className="text-center text-xs text-slate-500 py-4">No cables available in this POP.</div>}
                                {uniqueIncomingCables.map(cable => {
                                    const dio = localPOP.dios.find(d => d.id === configuringDioCablesId);
                                    const isLinked = dio?.inputCableIds?.includes(cable.id);
                                    const assignedToOther = localPOP.dios.find(d => d.id !== configuringDioCablesId && d.inputCableIds?.includes(cable.id));

                                    return (
                                        <button
                                            key={cable.id}
                                            disabled={!!assignedToOther}
                                            onClick={() => handleToggleCableLink(configuringDioCablesId, cable.id)}
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

                {/* PATCHING CONNECTION MODAL (Already uses existing logic, no string changes needed for this part) */}
                {configuringOltPortId && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setConfiguringOltPortId(null)}>
                        {/* ... (Existing OLT Patching Modal - No string changes requested here, keeping it as is) ... */}
                        <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-96 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="h-10 bg-slate-700 px-4 flex items-center justify-between border-b border-slate-600">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Router className="w-4 h-4 text-sky-400" />
                                    Connection for Slot/Port
                                </h3>
                                <button onClick={() => setConfiguringOltPortId(null)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                            </div>

                            <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] space-y-4">
                                {/* Current Status */}
                                <div className="bg-slate-900 rounded p-3 border border-slate-700">
                                    {localPOP.connections.find(c => c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId) ? (
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs text-green-400 font-bold flex items-center gap-2">
                                                <Link2 className="w-4 h-4" /> Connected
                                            </div>
                                            <button onClick={handleDisconnectPort} className="px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-white rounded text-xs border border-red-900/50 flex items-center gap-1 transition">
                                                <Link2Off className="w-3 h-3" /> Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
                                            <Link2Off className="w-4 h-4" /> Not Connected
                                        </div>
                                    )}
                                </div>

                                {/* Available DIOs */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Select DIO Port</h4>
                                    <div className="space-y-3">
                                        {localPOP.dios.map(dio => (
                                            <div key={dio.id} className="bg-slate-900/50 rounded border border-slate-700/50">
                                                <div className="px-3 py-2 bg-slate-800 text-xs font-bold text-slate-300 border-b border-slate-700/50 flex items-center gap-2">
                                                    <Server className="w-3 h-3" /> {dio.name}
                                                </div>
                                                <div className="p-2 grid grid-cols-6 gap-1">
                                                    {dio.portIds.map((pid, idx) => {
                                                        // LOGIC CHANGE: Check if occupied by OTHER OLT port.
                                                        const existingConns = localPOP.connections.filter(c => c.sourceId === pid || c.targetId === pid);

                                                        const isConnectedToSelf = existingConns.some(c => c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId);

                                                        const occupiedByOtherOLT = existingConns.some(c => {
                                                            if (c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId) return false;
                                                            const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                            return partner.includes('olt');
                                                        });

                                                        const hasBackboneLink = existingConns.some(c => {
                                                            const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                            return partner.includes('fiber');
                                                        });

                                                        return (
                                                            <button
                                                                key={pid}
                                                                disabled={occupiedByOtherOLT}
                                                                onClick={() => handleConnectPort(pid)}
                                                                className={`
                                                               aspect-square rounded text-[9px] font-mono flex items-center justify-center border transition-all relative
                                                               ${isConnectedToSelf ? 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-emerald-400/50 font-bold scale-110' : ''}
                                                               ${occupiedByOtherOLT ? 'bg-slate-950 border-slate-800 text-slate-700 cursor-not-allowed' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-sky-600 hover:text-white hover:border-sky-400'}
                                                           `}
                                                            >
                                                                {idx + 1}
                                                                {hasBackboneLink && !isConnectedToSelf && !occupiedByOtherOLT && (
                                                                    <CableIcon className="w-3 h-3 text-sky-500 absolute -top-1 -right-1" />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* DIO Splicing Editor Overlay */}
                {spliceDioId && (
                    <DIOEditor
                        dio={localPOP.dios.find(d => d.id === spliceDioId)!}
                        pop={localPOP}
                        incomingCables={uniqueIncomingCables}
                        litPorts={litPorts}
                        vflSource={vflSource}
                        onToggleVfl={onToggleVfl}
                        onClose={() => setSpliceDioId(null)}
                        onSave={handleDIOSave}
                        onUpdateDio={handleUpdateDIO}
                        onOtdrTrace={onOtdrTrace}
                    />
                )}

            </div>
        </div>
    );
};
