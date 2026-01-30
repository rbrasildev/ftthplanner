import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { POPData, CableData, FiberConnection, OLT, DIO, getFiberColor, ElementLayout } from '../types';
import { ZoomIn, ZoomOut, GripHorizontal, Pencil, Maximize, AlertTriangle, Loader2, Save, Box } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { DIOEditor } from './DIOEditor';

import { PopHeader } from './pop-editor/PopHeader';
import { PopToolbar } from './pop-editor/PopToolbar';
import { OLTUnit } from './pop-editor/OLTUnit';
import { DIOUnit } from './pop-editor/DIOUnit';
import { AddEquipmentModals } from './pop-editor/modals/AddEquipmentModals';
import { EditEquipmentModals } from './pop-editor/modals/EditEquipmentModals';
import { ConfirmationDialog } from './pop-editor/modals/ConfirmationDialog';
import { PatchPanelModal } from './pop-editor/modals/PatchPanelModal';
import { LinkCablesModal } from './pop-editor/modals/LinkCablesModal';

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
    // Edit Cable
    onEditCable?: (cable: CableData) => void;
}

type DragMode = 'view' | 'element' | 'modal_olt' | 'modal_dio';

export const POPEditor: React.FC<POPEditorProps> = ({ pop, incomingCables, onClose, onSave, litPorts, vflSource, onToggleVfl, onOtdrTrace, onHoverCable, onEditCable }) => {
    const { t } = useLanguage();
    const [localPOP, setLocalPOP] = useState<POPData>(JSON.parse(JSON.stringify(pop)));

    // Viewport State
    const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
    const [isSnapping, setIsSnapping] = useState(true);
    const [isRackMode, setIsRackMode] = useState(false);

    // Equipment Creation State & Position
    const [showAddOLTModal, setShowAddOLTModal] = useState(false);
    const [oltModalPos, setOltModalPos] = useState({ x: 100, y: 100 });
    const [newOLTConfig, setNewOLTConfig] = useState({ slots: 1, portsPerSlot: 8, type: 'SWITCH' as any });

    const [showAddDIOModal, setShowAddDIOModal] = useState(false);
    const [dioModalPos, setDioModalPos] = useState({ x: 150, y: 150 });
    const [newDIOConfig, setNewDIOConfig] = useState({ ports: 24 });

    // Equipment EDITING State
    const [editingOLT, setEditingOLT] = useState<OLT | null>(null);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // --- View Centering Logic ---
    const handleCenterView = useCallback(() => {
        if (!containerRef.current) return;

        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        if (containerW === 0 || containerH === 0) return;

        // Calculate Bounding Box of all content
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let count = 0;

        // Helper to expand bounds
        const expand = (id: string, width = EQUIPMENT_WIDTH, height = 150) => {
            const l = localPOP.layout?.[id];
            if (l) {
                if (l.x < minX) minX = l.x;
                if (l.y < minY) minY = l.y;
                if (l.x + width > maxX) maxX = l.x + width;
                if (l.y + height > maxY) maxY = l.y + height;
                count++;
            }
        };

        localPOP.olts.forEach(o => expand(o.id));
        localPOP.dios.forEach(d => expand(d.id));

        // Also include cables in non-rack mode for better centering
        if (!isRackMode) {
            uniqueIncomingCables.forEach(c => expand(c.id, 112, 60));
        }

        if (count > 0 && minX !== Infinity) {
            const PADDING = 60;
            const contentCenterX = (minX + maxX) / 2;
            const contentCenterY = (minY + maxY) / 2;

            const contentW = maxX - minX + (PADDING * 2);
            const contentH = maxY - minY + (PADDING * 2);

            // Fit to viewport zoom
            const zoomW = containerW / contentW;
            const zoomH = containerH / contentH;
            const targetZoom = Math.max(0.2, Math.min(zoomW, zoomH, 1));

            setViewState({
                x: (containerW / 2) - (contentCenterX * targetZoom),
                y: (containerH / 2) - (contentCenterY * targetZoom),
                zoom: targetZoom
            });
        } else {
            // Default Fallback
            setViewState({ x: 50, y: 50, zoom: 1 });
        }
    }, [localPOP.layout, localPOP.olts, localPOP.dios, isRackMode, uniqueIncomingCables]);

    // Initial Center View Effect
    const hasCentered = useRef(false);
    useEffect(() => {
        if (hasCentered.current) return;

        // Wait until we have some layout elements initialized
        const hasItems = localPOP.olts.length > 0 || localPOP.dios.length > 0;
        const hasLayout = localPOP.layout && Object.keys(localPOP.layout).length >= (localPOP.olts.length + localPOP.dios.length);

        if (hasItems && hasLayout && containerRef.current) {
            // Small delay to ensure browser layout is stable
            const timer = setTimeout(() => {
                handleCenterView();
                hasCentered.current = true;
            }, 100);
            return () => clearTimeout(timer);
        }

        // If no items, consider it "centered" (empty)
        if (!hasItems && containerRef.current) {
            hasCentered.current = true;
        }
    }, [localPOP.layout, localPOP.olts.length, localPOP.dios.length, handleCenterView]);

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


    // --- Patching Logic (New Modal Based) ---

    const handleOltPortClick = (e: React.MouseEvent, portId: string) => {
        e.stopPropagation();
        setConfiguringOltPortId(portId);
    };

    const handleConnectPort = (targetDioPortId: string) => {
        if (!configuringOltPortId) return;

        // User requested color based on DIO Tray sequence
        const targetDio = localPOP.dios.find((d: any) => d.portIds.includes(targetDioPortId));
        let slotColor = '#22c55e'; // Default Green (Tray 1)
        if (targetDio) {
            const portIndex = targetDio.portIds.indexOf(targetDioPortId);
            const trayIndex = Math.floor(portIndex / 12);
            slotColor = getFiberColor(trayIndex, 'ABNT');
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
    const handleOpenAddOLT = () => {
        const w = 320;
        const h = 480; // Estimated OLT modal height with catalog list
        const containerW = containerRef.current?.clientWidth || window.innerWidth;
        const containerH = containerRef.current?.clientHeight || window.innerHeight;
        setOltModalPos({ x: (containerW - w) / 2, y: (containerH - h) / 2 });
        setShowAddOLTModal(true);
    };

    const handleOpenAddDIO = () => {
        const w = 320;
        const h = 250; // Estimated DIO modal height
        const containerW = containerRef.current?.clientWidth || window.innerWidth;
        const containerH = containerRef.current?.clientHeight || window.innerHeight;
        setDioModalPos({ x: (containerW - w) / 2, y: (containerH - h) / 2 });
        setShowAddDIOModal(true);
    };

    const handleAddOLT = () => {
        const id = `olt-${Date.now()}`;
        const { slots, portsPerSlot, type } = newOLTConfig;
        const defaultSlotsConfig = Array.from({ length: slots || 1 }).map(() => ({
            active: true,
            portCount: portsPerSlot || 16
        }));

        let totalPorts = 0;
        const portIds: string[] = [];
        defaultSlotsConfig.forEach((slot, sIdx) => {
            if (slot.active) {
                for (let p = 1; p <= slot.portCount; p++) {
                    portIds.push(`${id}-s${sIdx + 1}-p${p}`);
                    totalPorts++;
                }
            }
        });

        const newOLT: OLT = {
            id,
            name: (newOLTConfig as any).modelName
                ? `${(newOLTConfig as any).modelName} ${localPOP.olts.length + 1}`
                : `${t(`type_${type?.toLowerCase() || 'olt'}`)} ${localPOP.olts.length + 1}`,
            ports: totalPorts,
            portIds,
            status: 'PLANNED',
            type: type || 'OLT',
            structure: {
                slots: slots || 1,
                portsPerSlot: portsPerSlot || 16,
                slotsConfig: defaultSlotsConfig
            }
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
        const { id, name, type, structure } = editingOLT as OLT;
        const slots = structure?.slots || 1;
        const portsPerSlot = structure?.portsPerSlot || 16;

        let newPortIds: string[] = [];
        let totalPorts = 0;

        if (structure?.slotsConfig && (type === 'OLT' || type === undefined)) {
            structure.slotsConfig.forEach((slot, sIdx) => {
                if (slot.active) {
                    for (let p = 1; p <= slot.portCount; p++) {
                        newPortIds.push(`${id}-s${sIdx + 1}-p${p}`);
                        totalPorts++;
                    }
                }
            });
        } else {
            totalPorts = slots * portsPerSlot;
            for (let s = 1; s <= slots; s++) {
                for (let p = 1; p <= portsPerSlot; p++) {
                    newPortIds.push(`${id}-s${s}-p${p}`);
                }
            }
        }

        setLocalPOP(prev => {
            const updatedOlts = prev.olts.map(o => o.id === id ? {
                ...o,
                name,
                ports: totalPorts,
                portIds: newPortIds,
                type: type || 'OLT',
                structure: { ...structure, slots, portsPerSlot } as any
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

    // --- View Helpers ---
    // handleCenterView is now defined above with Bounding Box logic

    const handleWheel = (e: React.WheelEvent) => {
        const scale = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(0.1, viewState.zoom * scale), 4);
        setViewState(prev => ({ ...prev, zoom: newZoom }));
    };

    const handleCloseRequest = () => {
        // Simple dirty check could proceed here if needed
        const hasChanges = JSON.stringify(localPOP) !== JSON.stringify(pop);
        if (hasChanges) setShowCloseConfirm(true);
        else onClose();
    };

    const handleSaveAndClose = () => {
        onSave(localPOP);
        onClose();
    };

    const handleConfirmClearConnections = () => {
        setLocalPOP(prev => ({ ...prev, connections: [] }));
        setShowClearConfirm(false);
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
            <div className="w-[95vw] h-[95vh] bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden relative">

                {/* 1. HEADER (Title + Close) */}
                <PopHeader
                    title={t('pop_editor_title', { name: pop.name })}
                    onClose={handleCloseRequest}
                />

                {/* 2. SECONDARY TOOLBAR */}
                <PopToolbar
                    onAddOLT={handleOpenAddOLT}
                    onAddDIO={handleOpenAddDIO}
                    onToggleRackMode={organizeRackLayout}
                    isRackMode={isRackMode}
                    onClearAll={() => setShowClearConfirm(true)} // Reusing boolean for confirmation dialog
                    t={t}
                />

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-slate-200 dark:bg-slate-950 relative overflow-hidden"
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{ cursor: dragState ? 'grabbing' : 'default' }}
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
                                    className="absolute w-28 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 flex flex-col opacity-50 hover:opacity-100 transition-opacity clickable-element select-none"
                                    onMouseEnter={() => onHoverCable && onHoverCable(cable.id)}
                                    onMouseLeave={() => onHoverCable && onHoverCable(null)}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        onEditCable && onEditCable(cable);
                                    }}
                                >
                                    <div
                                        className="h-6 bg-slate-800 border-b border-slate-700 px-2 flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-lg"
                                        onMouseDown={(e) => handleElementDragStart(e, cable.id)}
                                    >
                                        <span className="text-[10px] font-bold text-slate-200 truncate flex-1">{cable.name}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditCable && onEditCable(cable);
                                                }}
                                                className="text-slate-400 hover:text-white p-0.5"
                                                title={t('edit_cable') || "Editar Cabo"}
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                            <GripHorizontal className="w-3 h-3 text-slate-600" />
                                        </div>
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
                            return (
                                <OLTUnit
                                    key={olt.id}
                                    olt={olt}
                                    position={{ x: layout.x, y: layout.y }}
                                    width={EQUIPMENT_WIDTH}
                                    connections={localPOP.connections}
                                    configuringOltPortId={configuringOltPortId}
                                    hoveredPortId={hoveredPortId}
                                    onDragStart={handleElementDragStart}
                                    onEdit={(e, olt) => { e.stopPropagation(); setEditingOLT(JSON.parse(JSON.stringify(olt))); }}
                                    onDelete={(e, olt) => { e.stopPropagation(); setItemToDelete({ type: 'OLT', id: olt.id, name: olt.name }); }}
                                    onPortClick={(e, portId) => handleOltPortClick(e, portId)}
                                    onPortHover={setHoveredPortId}
                                    getFiberColor={getFiberColor}
                                />
                            );
                        })}

                        {/* DIO Units */}
                        {localPOP.dios.map(dio => {
                            const layout = getLayout(dio.id);
                            const linkedCables = uniqueIncomingCables.filter(c => dio.inputCableIds?.includes(c.id));
                            return (
                                <DIOUnit
                                    key={dio.id}
                                    dio={dio}
                                    position={{ x: layout.x, y: layout.y }}
                                    width={EQUIPMENT_WIDTH}
                                    linkedCables={linkedCables}
                                    connections={localPOP.connections}
                                    configuringOltPortId={configuringOltPortId}
                                    onDragStart={handleElementDragStart}
                                    onLinkCables={(e, id) => { e.stopPropagation(); setConfiguringDioCablesId(id); }}
                                    onSplice={(e, id) => { e.stopPropagation(); setSpliceDioId(id); }}
                                    onEdit={(e, dio) => { e.stopPropagation(); setEditingDIO({ id: dio.id, name: dio.name, ports: dio.ports }); }}
                                    onDelete={(e, dio) => { e.stopPropagation(); setItemToDelete({ type: 'DIO', id: dio.id, name: dio.name }); }}
                                    onHoverPort={setHoveredPortId}
                                />
                            );
                        })}


                    </div>

                    {/* Footer (Floating) */}
                    {/* Floating Navigation Controls */}
                    <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">

                        {/* Zoom & Center Panel */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-1.5 flex flex-col gap-2 pointer-events-auto">
                            <button
                                onClick={() => setViewState(s => ({ ...s, zoom: Math.min(4, s.zoom + 0.1) }))}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition rounded-md flex items-center justify-center"
                                title={t('zoom_in')}
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewState(s => ({ ...s, zoom: Math.max(0.1, s.zoom - 0.1) }))}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition rounded-md flex items-center justify-center"
                                title={t('zoom_out')}
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleCenterView}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition rounded-md flex items-center justify-center"
                                title={t('show_all')}
                            >
                                <Box className="w-5 h-5" />
                            </button>
                            <div className="h-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
                            <button
                                onClick={() => setViewState({ x: 50, y: 50, zoom: 1 })}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition rounded-md flex items-center justify-center"
                                title={t('center_view')}
                            >
                                <Maximize className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSaveAndClose}
                            className="px-6 py-2 pointer-events-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 text-sm shadow-lg shadow-emerald-900/20 transition-all transform hover:scale-105 active:scale-95"
                        >
                            <Save className="w-4 h-4" /> {t('save_or_done') || 'Concluir'}
                        </button>
                    </div>

                </div> {/* End Canvas */}

                {/* --- MODALS (Overlay Level) --- */}

                <AddEquipmentModals
                    showAddOLT={showAddOLTModal}
                    oltModalPos={oltModalPos}
                    newOLTConfig={newOLTConfig}
                    setNewOLTConfig={setNewOLTConfig}
                    onAddOLT={handleAddOLT}
                    onCloseOLT={() => setShowAddOLTModal(false)}

                    showAddDIO={showAddDIOModal}
                    dioModalPos={dioModalPos}
                    newDIOConfig={newDIOConfig}
                    setNewDIOConfig={setNewDIOConfig}
                    onAddDIO={handleAddDIO}
                    onCloseDIO={() => setShowAddDIOModal(false)}
                />

                <EditEquipmentModals
                    editingOLT={editingOLT}
                    setEditingOLT={setEditingOLT}
                    handleSaveEditedOLT={handleSaveEditedOLT}
                    editingDIO={editingDIO}
                    setEditingDIO={setEditingDIO}
                    handleSaveEditedDIO={handleSaveEditedDIO}
                />

                <PatchPanelModal
                    configuringOltPortId={configuringOltPortId}
                    setConfiguringOltPortId={setConfiguringOltPortId}
                    localPOP={localPOP}
                    handleDisconnectPort={handleDisconnectPort}
                    handleConnectPort={handleConnectPort}
                />

                <LinkCablesModal
                    configuringDioCablesId={configuringDioCablesId}
                    setConfiguringDioCablesId={setConfiguringDioCablesId}
                    uniqueIncomingCables={uniqueIncomingCables}
                    localPOP={localPOP}
                    handleToggleCableLink={handleToggleCableLink}
                    t={t}
                />

                {/* SPLICE EDITOR MODAL */}
                {spliceDioId && (() => {
                    const dioToSplice = localPOP.dios.find(d => d.id === spliceDioId);
                    if (!dioToSplice) return null;
                    return (
                        <DIOEditor
                            dio={dioToSplice}
                            pop={localPOP}
                            incomingCables={uniqueIncomingCables}
                            onClose={() => setSpliceDioId(null)}
                            onSave={handleDIOSave}
                            onUpdateDio={handleUpdateDIO}
                            litPorts={litPorts}
                            vflSource={vflSource}
                            onToggleVfl={onToggleVfl}
                            onOtdrTrace={onOtdrTrace}
                        />
                    );
                })()}

                {/* Confirmations */}
                <ConfirmationDialog
                    isOpen={!!itemToDelete}
                    title={t('confirm_delete')}
                    message={t('confirm_delete_equip_msg', { name: itemToDelete?.name })}
                    subMessage={t('delete_warning_msg', { type: itemToDelete?.type })}
                    confirmLabel={t('delete')}
                    type="danger"
                    onConfirm={confirmDeleteEquipment}
                    onCancel={() => setItemToDelete(null)}
                />

                <ConfirmationDialog
                    isOpen={showClearConfirm}
                    title={t('confirm_clear_title') || "Confirm Clear"}
                    message={t('confirm_clear_msg') || "Are you sure you want to remove all connections?"}
                    confirmLabel={t('confirm_clear')}
                    type="danger"
                    onConfirm={handleConfirmClearConnections}
                    onCancel={() => setShowClearConfirm(false)}
                />

                <ConfirmationDialog
                    isOpen={showCloseConfirm}
                    title={t('unsaved_changes')}
                    message={t('unsaved_changes_msg')}
                    confirmLabel={t('save_and_close')}
                    secondaryActionLabel={t('discard')}
                    type="warning"
                    onConfirm={handleSaveAndClose}
                    onCancel={() => setShowCloseConfirm(false)}
                    onSecondaryAction={onClose}
                />

            </div>
        </div>
    );
};
