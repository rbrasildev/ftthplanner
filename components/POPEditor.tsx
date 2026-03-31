import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { POPData, CableData, FiberConnection, OLT, DIO, getFiberColor, ElementLayout } from '../types';
import { ZoomIn, ZoomOut, GripHorizontal, Pencil, Maximize, AlertTriangle, Loader2, Save, Box, X } from 'lucide-react';
import { Button } from './common/Button';
import { useLanguage } from '../LanguageContext';
import { DIOEditor } from './DIOEditor';

import { PopHeader } from './pop-editor/PopHeader';
import { PopToolbar } from './pop-editor/PopToolbar';
import { OLTUnit } from './pop-editor/OLTUnit';
import { DIOUnit } from './pop-editor/DIOUnit';
import { LogicalPatchingView } from './pop-editor/LogicalPatchingView';
import { AddEquipmentModals } from './pop-editor/modals/AddEquipmentModals';
import { EditEquipmentModals } from './pop-editor/modals/EditEquipmentModals';
import { ConfirmationDialog } from './pop-editor/modals/ConfirmationDialog';
import { PatchPanelModal } from './pop-editor/modals/PatchPanelModal';
import { LinkCablesModal } from './pop-editor/modals/LinkCablesModal';

interface POPEditorProps {
    pop: POPData;
    incomingCables: CableData[];
    onClose: () => void;
    onSave: (updatedPOP: POPData) => Promise<void> | void;

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
    userRole?: string | null;
}

type DragMode = 'view' | 'element' | 'modal_olt' | 'modal_dio';

export const POPEditor: React.FC<POPEditorProps> = ({ pop, incomingCables, onClose, onSave, litPorts, vflSource, onToggleVfl, onOtdrTrace, onHoverCable, onEditCable, userRole }) => {
    const { t } = useLanguage();
    const [localPOP, setLocalPOP] = useState<POPData>(JSON.parse(JSON.stringify(pop)));

    // Viewport State
    const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
    const [isSnapping, setIsSnapping] = useState(true);
    const [viewMode, setViewMode] = useState<'canvas' | 'logical'>('canvas');

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
    const [isSaving, setIsSaving] = useState(false);

    // Auto-patch modal state
    const [showAutoPatchModal, setShowAutoPatchModal] = useState(false);
    const [autoPatchSourceId, setAutoPatchSourceId] = useState<string>('');
    const [autoPatchTargetId, setAutoPatchTargetId] = useState<string>('');

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

        // Also include cables for better centering
        uniqueIncomingCables.forEach(c => expand(c.id, 112, 60));

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
    }, [localPOP.layout, localPOP.olts, localPOP.dios, viewMode, uniqueIncomingCables]);

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
    const getLayout = useCallback((id: string) => localPOP.layout?.[id] || { x: 0, y: 0, rotation: 0 }, [localPOP.layout]);

    const handleViewModeChange = (targetMode: 'canvas' | 'logical') => {
        setViewMode(targetMode);
    };



    // --- Safe Closing Logic ---


    // --- Patching Logic (Universal Canvas/Modal Selection) ---
    const handlePortClick = (e: React.MouseEvent, portId: string) => {
        e.stopPropagation();

        if (configuringOltPortId === portId) {
            setConfiguringOltPortId(null);
            return;
        }

        if (!configuringOltPortId) {
            setConfiguringOltPortId(portId);
            return;
        }

        // We have a selection, and clicked a different port
        const sourceId = configuringOltPortId;
        const targetId = portId;

        // Prevent self-connection (same equipment)
        const sourceEquipId = sourceId.split('-')[1]; // olt-123-s1-p1 -> 123
        const targetEquipId = targetId.split('-')[1];

        if (sourceEquipId === targetEquipId) {
            // Switch selection
            setConfiguringOltPortId(portId);
            return;
        }

        // Valid connection between different equipment
        // Determine color: follow DIO tray fiber if possible
        let slotColor = '#6366f1'; // Default Indigo
        const dio = localPOP.dios.find((d: any) => d.portIds.includes(sourceId) || d.portIds.includes(targetId));
        if (dio) {
            const pid = dio.portIds.includes(sourceId) ? sourceId : targetId;
            const pIdx = dio.portIds.indexOf(pid);
            const trayIdx = Math.floor(pIdx / 12);
            slotColor = getFiberColor(trayIdx, 'ABNT');
        } else {
            // Check if one is an Uplink to give a different default color if between actives
            if (sourceId.includes('uplink') || targetId.includes('uplink')) {
                slotColor = '#94a3b8'; // Slate/Silver for Uplink
            }
        }

        // Clean existing for both ends, but ONLY if they are not fibers
        let cleanedConnections = localPOP.connections.filter(c => {
            const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber');
            if (isFiber) return true; // Keep fibers

            const involvesSource = c.sourceId === sourceId || c.targetId === sourceId;
            const involvesTarget = c.sourceId === targetId || c.targetId === targetId;

            return !involvesSource && !involvesTarget;
        });

        const newConn: FiberConnection = {
            id: `patch-${Date.now()}`,
            sourceId,
            targetId,
            color: slotColor,
            points: []
        };

        setLocalPOP(prev => ({
            ...prev,
            connections: [...cleanedConnections, newConn]
        }));

        setConfiguringOltPortId(null);
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

        let cleanedConnections = localPOP.connections.filter(c => {
            const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber');
            if (isFiber) return true; // Keep fibers

            const involvesOltPort = c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId;
            const involvesDioPort = c.sourceId === targetDioPortId || c.targetId === targetDioPortId;

            return !involvesOltPort && !involvesDioPort;
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

    const handleUpdatePatchingLayout = (newLayout: { col1: string[]; col2: string[]; col3: string[] }) => {
        setLocalPOP(prev => ({
            ...prev,
            patchingLayout: newLayout
        }));

        // As with other handlers, this modifies localPOP which is then saved
        // when exiting or automatically if there's an auto-save
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

    const handleAddLogicalConnection = (sourceId: string, targetId: string) => {
        let slotColor = '#22c55e';
        const targetDio = localPOP.dios.find((d: any) => d.portIds.includes(targetId) || d.portIds.includes(sourceId));
        if (targetDio) {
            const isSourceDio = targetDio.portIds.includes(sourceId);
            const dioPort = isSourceDio ? sourceId : targetId;
            const portIndex = targetDio.portIds.indexOf(dioPort);
            const trayIndex = Math.floor(portIndex / 12);
            slotColor = getFiberColor(trayIndex, 'ABNT');
        }

        const newConn: FiberConnection = {
            id: `patch-${Date.now()}`,
            sourceId,
            targetId,
            color: slotColor,
            points: []
        };
        setLocalPOP(prev => ({ ...prev, connections: [...prev.connections, newConn] }));
    };

    const handleRemoveLogicalConnection = (sourceId: string, targetId: string) => {
        setLocalPOP(prev => ({
            ...prev,
            connections: prev.connections.filter(c =>
                !(c.sourceId === sourceId && c.targetId === targetId) &&
                !(c.sourceId === targetId && c.targetId === sourceId)
            )
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

        // Prevent dragging units in rack or logical mode
        if (dragState.mode === 'element' && viewMode !== 'canvas') {
            return;
        }

        if (dragState.mode === 'view') {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setDragState(prev => ({ ...prev!, startX: e.clientX, startY: e.clientY }));
        }
        else if (dragState.mode === 'element' && dragState.targetId && dragState.initialLayout) {
            // Direct DOM manipulation for smooth 60fps dragging (no React state updates)
            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;
            let newX = dragState.initialLayout.x + dx;
            let newY = dragState.initialLayout.y + dy;

            if (isSnapping) {
                newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            }

            const el = document.getElementById(dragState.targetId);
            if (el) {
                el.style.transform = `translate(${newX}px, ${newY}px)`;
            }

            // Update SVG connection lines in real-time during drag
            localPOP.dios.forEach(dio => {
                if (!dio.inputCableIds || dio.inputCableIds.length === 0) return;
                dio.inputCableIds.forEach(cableId => {
                    const cable = uniqueIncomingCables.find(c => c.id === cableId);
                    if (!cable) return;

                    const isDio = dragState.targetId === dio.id;
                    const isCable = dragState.targetId === cable.id;
                    if (!isDio && !isCable) return;

                    const dioLayout = getLayout(dio.id);
                    const cableLayout = getLayout(cable.id);

                    let p2x = dioLayout.x;
                    let p2y = dioLayout.y + 40;
                    let p1x = cableLayout.x + 112;
                    let p1y = cableLayout.y + 30;

                    if (isDio) { p2x = newX; p2y = newY + 40; }
                    if (isCable) { p1x = newX + 112; p1y = newY + 30; }

                    const cx = (p1x + p2x) / 2;
                    const pathEl = document.getElementById(`conn-${cable.id}-${dio.id}-path`);
                    const c1El = document.getElementById(`conn-${cable.id}-${dio.id}-c1`);
                    const c2El = document.getElementById(`conn-${cable.id}-${dio.id}-c2`);
                    if (pathEl) pathEl.setAttribute('d', `M ${p1x} ${p1y} C ${cx} ${p1y}, ${cx} ${p2y}, ${p2x} ${p2y}`);
                    if (c1El) { c1El.setAttribute('cx', String(p1x)); c1El.setAttribute('cy', String(p1y)); }
                    if (c2El) { c2El.setAttribute('cx', String(p2x)); c2El.setAttribute('cy', String(p2y)); }
                });
            });
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

    const handleMouseUp = (e: React.MouseEvent) => {
        // Commit element drag to React state (was only visual via DOM during drag)
        if (dragState?.mode === 'element' && dragState.targetId && dragState.initialLayout) {
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
        const { slots, portsPerSlot, type, uplinkPorts, slotNames } = newOLTConfig as any;
        const defaultSlotsConfig = Array.from({ length: slots || 1 }).map((_, i) => ({
            active: true,
            portCount: portsPerSlot || 16,
            name: slotNames?.[i] || undefined
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

        const isOLT = type === 'OLT' || !type;
        const numUplinks = isOLT ? (uplinkPorts ?? 2) : 0;
        const uplinkPortIds: string[] = [];
        for (let i = 1; i <= numUplinks; i++) {
            uplinkPortIds.push(`${id}-uplink-${i}`);
        }

        const newOLT: OLT = {
            id,
            name: (newOLTConfig as any).modelName
                ? `${(newOLTConfig as any).modelName} ${localPOP.olts.length + 1}`
                : `${t(`type_${type?.toLowerCase() || 'olt'}`)} ${localPOP.olts.length + 1}`,
            ports: totalPorts,
            portIds,
            status: 'PLANNED',
            type: type || 'OLT',
            uplinkPorts: numUplinks,
            uplinkPortIds,
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
        const { id, name, type, structure, uplinkPorts } = editingOLT as OLT;
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

        const isOLT = type === 'OLT' || !type;
        const numUplinks = isOLT ? (uplinkPorts ?? 2) : 0;
        const newUplinkPortIds: string[] = [];
        for (let i = 1; i <= numUplinks; i++) {
            newUplinkPortIds.push(`${id}-uplink-${i}`);
        }

        setLocalPOP(prev => {
            const updatedOlts = prev.olts.map(o => o.id === id ? {
                ...o,
                name,
                ports: totalPorts,
                portIds: newPortIds,
                type: type || 'OLT',
                uplinkPorts: numUplinks,
                uplinkPortIds: newUplinkPortIds,
                structure: { ...structure, slots, portsPerSlot } as any
            } : o);

            const allValidOLTPorts = [...newPortIds, ...newUplinkPortIds];

            const updatedConnections = prev.connections.filter(c => {
                const isSourceInOLT = c.sourceId.startsWith(id);
                const isTargetInOLT = c.targetId.startsWith(id);
                if (isSourceInOLT && !allValidOLTPorts.includes(c.sourceId)) return false;
                if (isTargetInOLT && !allValidOLTPorts.includes(c.targetId)) return false;
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
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Mouse position relative to container
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setViewState(prev => {
            const newZoom = Math.min(Math.max(0.1, prev.zoom * scale), 4);
            // Adjust translation so the point under the cursor stays fixed
            const newX = mouseX - (mouseX - prev.x) * (newZoom / prev.zoom);
            const newY = mouseY - (mouseY - prev.y) * (newZoom / prev.zoom);
            return { x: newX, y: newY, zoom: newZoom };
        });
    };

    const handleCloseRequest = () => {
        // Robust dirty check: exclude viewState and stabilize order
        const normalize = (data: POPData) => {
            const { layout, connections, ...rest } = JSON.parse(JSON.stringify(data));
            // Stabilize connections for comparison
            if (connections) {
                connections.sort((a: any, b: any) => a.id.localeCompare(b.id));
            }
            // Filter out default visual positions that might have been auto-added
            const cleanLayout: Record<string, any> = {};
            if (layout) {
                Object.keys(layout).forEach(key => {
                    // Only consider it a "change" if it's not a default-ish position
                    // but since layout is critical, we usually just compare it
                    cleanLayout[key] = layout[key];
                });
            }
            return { ...rest, connections, layout: cleanLayout };
        };

        const hasChanges = JSON.stringify(normalize(localPOP)) !== JSON.stringify(normalize(pop));
        if (hasChanges) setShowCloseConfirm(true);
        else onClose();
    };

    const handleSaveAndClose = async () => {
        setIsSaving(true);
        try {
            await onSave(localPOP);
            onClose();
        } catch (e) {
            console.error("Failed to save and close POP", e);
        } finally {
            setIsSaving(false);
        }
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

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

            // Ctrl+S - Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (userRole !== 'MEMBER') handleCloseRequest();
                return;
            }

            const key = e.key.toLowerCase();

            if (key === 'escape') {
                if (showAddOLTModal) { setShowAddOLTModal(false); return; }
                if (showAddDIOModal) { setShowAddDIOModal(false); return; }
                if (editingOLT) { setEditingOLT(null); return; }
                if (editingDIO) { setEditingDIO(null); return; }
                if (configuringOltPortId) { setConfiguringOltPortId(null); return; }
                if (configuringDioCablesId) { setConfiguringDioCablesId(null); return; }
                if (spliceDioId) { setSpliceDioId(null); return; }
                if (itemToDelete) { setItemToDelete(null); return; }
                if (showClearConfirm) { setShowClearConfirm(false); return; }
            }

            // O - Add OLT
            if (key === 'o' && !e.ctrlKey) {
                e.preventDefault();
                handleOpenAddOLT();
            }
            // D - Add DIO (only if not in delete confirm)
            else if (key === 'd' && !e.ctrlKey && !itemToDelete) {
                e.preventDefault();
                handleOpenAddDIO();
            }
            // C - Center view
            else if (key === 'c' && !e.ctrlKey) {
                e.preventDefault();
                handleCenterView();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showAddOLTModal, showAddDIOModal, editingOLT, editingDIO, configuringOltPortId, configuringDioCablesId, spliceDioId, itemToDelete, showClearConfirm, userRole]);

    // --- Stable callbacks for child components (prevents re-render on parent state change) ---
    const handleEditOLT = useCallback((e: React.MouseEvent, olt: any) => {
        e.stopPropagation();
        setEditingOLT(JSON.parse(JSON.stringify(olt)));
    }, []);

    const handleDeleteOLT = useCallback((e: React.MouseEvent, olt: any) => {
        e.stopPropagation();
        setItemToDelete({ type: 'OLT', id: olt.id, name: olt.name });
    }, []);

    const handleEditDIOCallback = useCallback((e: React.MouseEvent, dio: any) => {
        e.stopPropagation();
        setEditingDIO({ id: dio.id, name: dio.name, ports: dio.ports });
    }, []);

    const handleDeleteDIOCallback = useCallback((e: React.MouseEvent, dio: any) => {
        e.stopPropagation();
        setItemToDelete({ type: 'DIO', id: dio.id, name: dio.name });
    }, []);

    const handleLinkCablesCallback = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfiguringDioCablesId(id);
    }, []);

    const handleSpliceCallback = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSpliceDioId(id);
    }, []);

    // Helper: Get connection info for a port (used for tooltips)
    const getPortConnectionInfo = useCallback((portId: string): string | undefined => {
        const conn = localPOP.connections.find(c => c.sourceId === portId || c.targetId === portId);
        if (!conn) return undefined;
        const otherEnd = conn.sourceId === portId ? conn.targetId : conn.sourceId;

        // Try to find the equipment name
        for (const olt of localPOP.olts) {
            if (olt.portIds?.includes(otherEnd) || olt.uplinkPortIds?.includes(otherEnd)) {
                const portLabel = otherEnd.split('-').slice(-2).join('-'); // e.g. "s1-p3"
                return `${olt.name} (${portLabel})`;
            }
        }
        for (const dio of localPOP.dios) {
            if (dio.portIds?.includes(otherEnd)) {
                const idx = dio.portIds.indexOf(otherEnd) + 1;
                return `${dio.name} (P${idx})`;
            }
        }
        return otherEnd;
    }, [localPOP.connections, localPOP.olts, localPOP.dios]);

    const handlePortClickRef = useRef(handlePortClick);
    handlePortClickRef.current = handlePortClick;
    const handlePortClickCallback = useCallback((e: React.MouseEvent, portId: string) => {
        handlePortClickRef.current(e, portId);
    }, []);

    const handleShowClearConfirm = useCallback(() => setShowClearConfirm(true), []);

    // Auto-patch: open modal for user to select source OLT and target DIO
    const handleOpenAutoPatch = useCallback(() => {
        // Pre-select first OLT and first DIO if available
        setAutoPatchSourceId(localPOP.olts[0]?.id || '');
        setAutoPatchTargetId(localPOP.dios[0]?.id || '');
        setShowAutoPatchModal(true);
    }, [localPOP.olts, localPOP.dios]);

    const handleExecuteAutoPatch = useCallback(() => {
        if (!autoPatchSourceId || !autoPatchTargetId) return;

        setLocalPOP(prev => {
            const sourceOlt = prev.olts.find(o => o.id === autoPatchSourceId);
            const targetDio = prev.dios.find(d => d.id === autoPatchTargetId);
            if (!sourceOlt || !targetDio) return prev;

            const oltPorts: string[] = sourceOlt.portIds || [];
            const dioPorts: string[] = targetDio.portIds || [];

            if (oltPorts.length === 0 || dioPorts.length === 0) return prev;

            // Find already connected ports
            const connectedPorts = new Set<string>();
            prev.connections.forEach(c => {
                connectedPorts.add(c.sourceId);
                connectedPorts.add(c.targetId);
            });

            const freeOltPorts = oltPorts.filter(p => !connectedPorts.has(p));
            const freeDioPorts = dioPorts.filter(p => !connectedPorts.has(p));

            const count = Math.min(freeOltPorts.length, freeDioPorts.length);
            if (count === 0) return prev;

            const newConnections: FiberConnection[] = [];
            for (let i = 0; i < count; i++) {
                const dioPortId = freeDioPorts[i];
                const portIndex = targetDio.portIds.indexOf(dioPortId);
                const trayIndex = Math.floor(portIndex / 12);
                const color = getFiberColor(trayIndex, 'ABNT');

                newConnections.push({
                    id: `patch-${Date.now()}-${i}`,
                    sourceId: freeOltPorts[i],
                    targetId: dioPortId,
                    color,
                    points: []
                });
            }

            return { ...prev, connections: [...prev.connections, ...newConnections] };
        });

        setShowAutoPatchModal(false);
    }, [autoPatchSourceId, autoPatchTargetId]);

    const handleDeleteEquipmentFromLogical = useCallback((type: 'OLT' | 'DIO', id: string, name: string) => {
        setItemToDelete({ type, id, name });
    }, []);

    return (
        <div className="pop-editor-modal fixed inset-0 z-[2000] bg-black flex items-center justify-center">
            <div className="w-full h-full bg-[#1a1d23] flex flex-col overflow-hidden relative">

                {/* 1. HEADER (Title + Close) */}
                <PopHeader
                    title={t('pop_editor_title', { name: pop.name })}
                    onClose={userRole === 'MEMBER' ? onClose : handleCloseRequest}
                    userRole={userRole}
                />

                {/* 2. SECONDARY TOOLBAR */}
                <PopToolbar
                    onAddOLT={handleOpenAddOLT}
                    onAddDIO={handleOpenAddDIO}
                    onViewModeChange={handleViewModeChange}
                    viewMode={viewMode}
                    onClearAll={handleShowClearConfirm}
                    onAutoPatch={handleOpenAutoPatch}
                    onSave={userRole === 'MEMBER' ? onClose : handleCloseRequest}
                    t={t}
                    userRole={userRole}
                    stats={useMemo(() => {
                        const totalPorts = localPOP.olts.reduce((a, o) => a + (o.portIds?.length || 0) + (o.uplinkPortIds?.length || 0), 0)
                            + localPOP.dios.reduce((a, d) => a + (d.portIds?.length || 0), 0);
                        const connectedPorts = new Set<string>();
                        localPOP.connections.forEach(c => { connectedPorts.add(c.sourceId); connectedPorts.add(c.targetId); });
                        return {
                            olts: localPOP.olts.length,
                            dios: localPOP.dios.length,
                            connections: localPOP.connections.length,
                            totalPorts,
                            usedPorts: connectedPorts.size
                        };
                    }, [localPOP.olts, localPOP.dios, localPOP.connections])}
                />

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-[#2c2f36] relative overflow-hidden"
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{ cursor: dragState ? 'grabbing' : 'default' }}
                >
                    {/* Rack Rails */}
                    {viewMode !== 'logical' && (
                        <>
                            <div className="absolute top-0 bottom-0 left-0 w-4 bg-[#15171c] border-r border-slate-700/30 z-30 pointer-events-none"
                                style={{ backgroundImage: 'repeating-linear-gradient(180deg, transparent 0px, transparent 36px, #2a2e38 36px, #2a2e38 40px)', backgroundSize: '100% 40px' }} />
                            <div className="absolute top-0 bottom-0 right-0 w-4 bg-[#15171c] border-l border-slate-700/30 z-30 pointer-events-none"
                                style={{ backgroundImage: 'repeating-linear-gradient(180deg, transparent 0px, transparent 36px, #2a2e38 36px, #2a2e38 40px)', backgroundSize: '100% 40px' }} />
                        </>
                    )}

                    {/* Grid */}
                    {viewMode !== 'logical' && (
                        <div
                            className="absolute inset-0 pointer-events-none opacity-20"
                            style={{
                                backgroundImage: `radial-gradient(#3a3d44 0.8px, transparent 0.8px)`,
                                backgroundSize: `${GRID_SIZE * viewState.zoom}px ${GRID_SIZE * viewState.zoom}px`,
                                backgroundPosition: `${viewState.x}px ${viewState.y}px`
                            }}
                        />
                    )}

                    {viewMode === 'logical' ? (
                        <div className="absolute inset-0 z-10 bg-[#2c2f36] overflow-hidden">
                            <LogicalPatchingView
                                localPOP={localPOP}
                                onAddConnection={handleAddLogicalConnection}
                                onRemoveConnection={handleRemoveLogicalConnection}
                                onManageFusions={setSpliceDioId}
                                onUpdatePatchingLayout={handleUpdatePatchingLayout}
                                onDeleteEquipment={handleDeleteEquipmentFromLogical}
                            />
                        </div>
                    ) : (
                        <div
                            style={{
                                transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`,
                                transformOrigin: '0 0',
                                width: '100%',
                                height: '100%'
                            }}
                        >
                            {/* Visual Connections (Cables -> DIOs) */}
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
                                                    id={`conn-${cable.id}-${dio.id}-path`}
                                                    d={`M ${p1.x} ${p1.y} C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`}
                                                    stroke="#0ea5e9"
                                                    strokeWidth={3}
                                                    fill="none"
                                                    opacity={0.5}
                                                />
                                                <circle id={`conn-${cable.id}-${dio.id}-c1`} cx={p1.x} cy={p1.y} r={3} fill="#0ea5e9" />
                                                <circle id={`conn-${cable.id}-${dio.id}-c2`} cx={p2.x} cy={p2.y} r={3} fill="#0ea5e9" />
                                            </g>
                                        );
                                    });
                                })}
                            </svg>


                            {/* Incoming Cables */}
                            {uniqueIncomingCables.map(cable => {
                                const layout = getLayout(cable.id);
                                return (
                                    <div
                                        id={cable.id}
                                        key={cable.id}
                                        style={{ transform: `translate(${layout.x}px, ${layout.y}px)` }}
                                        className="absolute w-28 bg-[#1a1d23] border border-slate-700/50 ring-1 ring-black/20 rounded-lg shadow-xl z-20 flex flex-col hover:brightness-110 transition-all clickable-element select-none"
                                        onMouseEnter={() => onHoverCable && onHoverCable(cable.id)}
                                        onMouseLeave={() => onHoverCable && onHoverCable(null)}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            onEditCable && onEditCable(cable);
                                        }}
                                    >
                                        <div
                                            className="h-7 bg-[#22262e] border-b border-slate-700/50 px-2 flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-lg"
                                            onMouseDown={(e) => handleElementDragStart(e, cable.id)}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_4px_#0ea5e9] shrink-0" />
                                            <span className="text-[10px] font-bold text-slate-300 truncate flex-1">{cable.name}</span>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditCable && onEditCable(cable);
                                                    }}
                                                    className="h-6 w-6 text-slate-400 hover:text-white"
                                                    title={t('edit_cable') || "Editar Cabo"}
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </Button>
                                                <GripHorizontal className="w-3 h-3 text-slate-600" />
                                            </div>
                                        </div>
                                        <div className="p-2 text-[10px] text-slate-500 text-center bg-[#15171c] rounded-b-lg">
                                            {t('backbone_cable')}<br />({t('splice_inside_dio')})
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
                                        onEdit={handleEditOLT}
                                        onDelete={handleDeleteOLT}
                                        onPortClick={handlePortClickCallback}
                                        onPortHover={setHoveredPortId}
                                        getFiberColor={getFiberColor}
                                        getPortConnectionInfo={getPortConnectionInfo}
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
                                        onLinkCables={handleLinkCablesCallback}
                                        onSplice={handleSpliceCallback}
                                        onEdit={handleEditDIOCallback}
                                        onDelete={handleDeleteDIOCallback}
                                        onPortClick={handlePortClickCallback}
                                        onHoverPort={setHoveredPortId}
                                        getPortConnectionInfo={getPortConnectionInfo}
                                    />
                                );
                            })}

                        </div>
                    )}


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

                {/* Auto-Patch Modal */}
                {showAutoPatchModal && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-[#1a1d23] border border-slate-700/50 p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-lg font-bold text-slate-200 mb-1">{t('auto_patch')}</h3>
                            <p className="text-xs text-slate-500 mb-5">{t('auto_patch_desc')}</p>

                            {/* Source: OLT */}
                            <div className="mb-4">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{t('source') || 'Origem'} (OLT/Switch)</label>
                                <select
                                    value={autoPatchSourceId}
                                    onChange={e => setAutoPatchSourceId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-600/50 bg-[#22262e] text-sm font-medium text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">{t('select') || 'Selecione...'}</option>
                                    {localPOP.olts.map((olt: any) => {
                                        const connectedPorts = new Set<string>();
                                        localPOP.connections.forEach((c: any) => { connectedPorts.add(c.sourceId); connectedPorts.add(c.targetId); });
                                        const free = (olt.portIds || []).filter((p: string) => !connectedPorts.has(p)).length;
                                        return (
                                            <option key={olt.id} value={olt.id}>
                                                {olt.name} ({free} {t('available') || 'livres'})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Target: DIO */}
                            <div className="mb-6">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{t('target') || 'Destino'} (DIO)</label>
                                <select
                                    value={autoPatchTargetId}
                                    onChange={e => setAutoPatchTargetId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-600/50 bg-[#22262e] text-sm font-medium text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="">{t('select') || 'Selecione...'}</option>
                                    {localPOP.dios.map((dio: any) => {
                                        const connectedPorts = new Set<string>();
                                        localPOP.connections.forEach((c: any) => { connectedPorts.add(c.sourceId); connectedPorts.add(c.targetId); });
                                        const free = (dio.portIds || []).filter((p: string) => !connectedPorts.has(p)).length;
                                        return (
                                            <option key={dio.id} value={dio.id}>
                                                {dio.name} ({free} {t('available') || 'livres'})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Preview */}
                            {autoPatchSourceId && autoPatchTargetId && (() => {
                                const olt = localPOP.olts.find((o: any) => o.id === autoPatchSourceId);
                                const dio = localPOP.dios.find((d: any) => d.id === autoPatchTargetId);
                                if (!olt || !dio) return null;
                                const connectedPorts = new Set<string>();
                                localPOP.connections.forEach((c: any) => { connectedPorts.add(c.sourceId); connectedPorts.add(c.targetId); });
                                const freeOlt = (olt.portIds || []).filter((p: string) => !connectedPorts.has(p)).length;
                                const freeDio = (dio.portIds || []).filter((p: string) => !connectedPorts.has(p)).length;
                                const willConnect = Math.min(freeOlt, freeDio);
                                return (
                                    <div className="mb-5 p-3 bg-[#22262e] rounded-lg border border-slate-600/50 text-center">
                                        <span className="text-2xl font-black text-indigo-400">{willConnect}</span>
                                        <span className="text-xs text-slate-500 ml-1.5">{t('connections_to_create') || 'conexões serão criadas'}</span>
                                    </div>
                                );
                            })()}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowAutoPatchModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-600/50 text-sm font-bold text-slate-400 hover:bg-[#22262e] transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleExecuteAutoPatch}
                                    disabled={!autoPatchSourceId || !autoPatchTargetId}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold transition-colors shadow-sm"
                                >
                                    {t('auto_patch')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                    title={t('confirm_clear_title')}
                    message={t('confirm_clear_msg')}
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
                    isLoading={isSaving}
                    onConfirm={handleSaveAndClose}
                    onCancel={() => setShowCloseConfirm(false)}
                    onSecondaryAction={onClose}
                />

            </div>
        </div>
    );
};
