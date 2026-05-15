import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { POPData, CableData, CTOData, FiberConnection, OLT, DIO, SwitchData, SwitchPort, Splitter, ActiveEquipmentType, getFiberColor, ElementLayout } from '../types';
import type { SplitterCatalogItem } from '../services/catalogService';
import { ZoomIn, ZoomOut, GripHorizontal, Pencil, Maximize, AlertTriangle, Loader2, Save, Box, X, Link, Trash2, FileText } from 'lucide-react';
import { Button } from './common/Button';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import { DIOEditor } from './DIOEditor';
import { SwitchEditor } from './SwitchEditor';

import { PopHeader } from './pop-editor/PopHeader';
import { PopToolbar } from './pop-editor/PopToolbar';
import { OLTUnit } from './pop-editor/OLTUnit';
import { DIOUnit } from './pop-editor/DIOUnit';
import { SwitchUnit } from './pop-editor/SwitchUnit';
import { computeSwitchPortLedStates } from '../utils/switchFiber';
import { LogicalPatchingView } from './pop-editor/LogicalPatchingView';
import { AddEquipmentModals } from './pop-editor/modals/AddEquipmentModals';
import { EditEquipmentModals } from './pop-editor/modals/EditEquipmentModals';
import { ConfirmationDialog } from './pop-editor/modals/ConfirmationDialog';
import { PatchPanelModal } from './pop-editor/modals/PatchPanelModal';
import { LinkCablesModal } from './pop-editor/modals/LinkCablesModal';

interface POPEditorProps {
    pop: POPData;
    incomingCables: CableData[];
    /** Todos os POPs do projeto — usado pelo SwitchEditor pra rastrear peer na outra ponta do cabo. */
    allPops?: POPData[];
    /** Todos os CTOs/CEOs do projeto — pra atravessar sangrias no trace do peer. */
    allCtos?: CTOData[];
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
    // Disconnect/Delete Cable
    onDisconnectCable?: (cableId: string, popId: string) => void;
    onDeleteCable?: (cableId: string) => void;
    userRole?: string | null;
    readOnly?: boolean;
    readOnlyLabel?: string;
    onGoToParentProject?: () => void;
    isSidebarCollapsed?: boolean;
}

type DragMode = 'view' | 'element' | 'modal_olt' | 'modal_dio';

export const POPEditor: React.FC<POPEditorProps> = ({ pop, incomingCables, allPops, allCtos, onClose, onSave, litPorts, vflSource, onToggleVfl, onOtdrTrace, onHoverCable, onEditCable, onDisconnectCable, onDeleteCable, userRole, readOnly = false, readOnlyLabel, onGoToParentProject, isSidebarCollapsed = false }) => {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const canEdit = !readOnly && userRole !== 'MEMBER';
    const [localPOP, setLocalPOP] = useState<POPData>(JSON.parse(JSON.stringify(pop)));

    // Viewport State
    const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
    const [isSnapping, setIsSnapping] = useState(true);
    const [viewMode, setViewMode] = useState<'canvas' | 'logical'>('canvas');

    // Equipment Creation State & Position
    const [showAddOLTModal, setShowAddOLTModal] = useState(false);
    const [oltModalPos, setOltModalPos] = useState({ x: 100, y: 100 });
    const [newOLTConfig, setNewOLTConfig] = useState({ slots: 1, portsPerSlot: 8 });

    const [showAddDIOModal, setShowAddDIOModal] = useState(false);
    const [dioModalPos, setDioModalPos] = useState({ x: 150, y: 150 });
    const [newDIOConfig, setNewDIOConfig] = useState({ ports: 24 });

    const [showAddActiveModal, setShowAddActiveModal] = useState(false);
    const [activeModalPos, setActiveModalPos] = useState({ x: 200, y: 200 });
    const [newActiveConfig, setNewActiveConfig] = useState<{ type: ActiveEquipmentType; portCount: number; name?: string }>({
        type: 'SWITCH',
        portCount: 8,
        name: '',
    });


    // Equipment EDITING State
    const [editingOLT, setEditingOLT] = useState<OLT | null>(null);
    const [editingDIO, setEditingDIO] = useState<{ id: string, name: string, ports: number, portIds: string[], portLabels: Record<string, string> } | null>(null);
    const [editingSwitchId, setEditingSwitchId] = useState<string | null>(null);
    const [editingSwitchPortId, setEditingSwitchPortId] = useState<string | null>(null);

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

    // Cable Context Menu & Removal
    const [cableContextMenu, setCableContextMenu] = useState<{ x: number; y: number; cableId: string } | null>(null);
    const [cableToRemove, setCableToRemove] = useState<string | null>(null);
    const [cableToDelete, setCableToDelete] = useState<string | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Auto-patch modal state
    const [showAutoPatchModal, setShowAutoPatchModal] = useState(false);
    const [autoPatchSourceId, setAutoPatchSourceId] = useState<string>('');
    const [autoPatchTargetId, setAutoPatchTargetId] = useState<string>('');

    const GRID_SIZE = 20;
    // Largura padrão = OLT com 16 portas (slot 44 + pad 24 + 16 * (26+2) = 516).
    // Equipamentos menores são "preenchidos" até esse tamanho sem esticar as portas.
    const EQUIPMENT_WIDTH = 516;

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
    const dragLinksRef = useRef<{ dioId: string; cableId: string; dioLayout: ElementLayout; cableLayout: ElementLayout; isDio: boolean; isCable: boolean }[]>([]);

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

    // --- Prune orphan fiber splices ---
    // Quando um cabo é removido upstream e re-adicionado com outro id (mesmo nome
    // mas id novo), splices `<oldCable>-fiber-N ↔ port` ficam órfãs. As bandejas
    // continuam mostrando ports laranja porque a conexão existe em `localPOP.connections`,
    // mesmo que o cabo card não as enxergue. Aqui descartamos splices que apontam
    // pra cabos inexistentes em `incomingCables`.
    useEffect(() => {
        const validCableIds = new Set(uniqueIncomingCables.map(c => c.id));
        const isOrphanFiberId = (id: string) => {
            const m = id.match(/^(.+)-fiber-\d+$/);
            return !!m && !validCableIds.has(m[1]);
        };
        setLocalPOP(prev => {
            const filtered = prev.connections.filter(c =>
                !isOrphanFiberId(c.sourceId) && !isOrphanFiberId(c.targetId)
            );
            if (filtered.length === prev.connections.length) return prev;
            return { ...prev, connections: filtered };
        });
    }, [uniqueIncomingCables]);

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

        // Clean existing for both ends — mas preserva fusões (fibers) E fusões internas
        // do splitter (porta DIO ↔ splitter.IN). Uma porta DIO pode ter simultaneamente:
        //   - 1 patch externo (manobra: port↔port com OLT/Switch)
        //   - 1 splice interno (fusão: port↔fiber ou port↔splitter.IN)
        // Recriar o patch externo NÃO deve apagar a fusão interna.
        const isSpliceConn = (c: FiberConnection) =>
            c.sourceId.includes('fiber') || c.targetId.includes('fiber') ||
            c.sourceId.startsWith('splitter-') || c.targetId.startsWith('splitter-');

        let cleanedConnections = localPOP.connections.filter(c => {
            if (isSpliceConn(c)) return true; // Keep all splice/fusion connections

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
            // Preserva fusões (fibers) E fusões internas do splitter — uma porta DIO pode
            // ter 1 patch externo + 1 splice interno simultaneamente.
            const isSplice = c.sourceId.includes('fiber') || c.targetId.includes('fiber') ||
                c.sourceId.startsWith('splitter-') || c.targetId.startsWith('splitter-');
            if (isSplice) return true;

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
            connections: prev.connections.filter(c => {
                const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber');
                if (isFiber) return true;
                return c.sourceId !== configuringOltPortId && c.targetId !== configuringOltPortId;
            })
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
            const fiberPrefix = `${cableId}-fiber-`;
            const cleanFiberConns = () => prev.connections.filter(c =>
                !c.sourceId.startsWith(fiberPrefix) && !c.targetId.startsWith(fiberPrefix)
            );

            let newCables;
            let newConnections = prev.connections;
            if (currentCables.includes(cableId)) {
                newCables = currentCables.filter(c => c !== cableId);
                newConnections = cleanFiberConns();
            } else {
                const assignedToOther = prev.dios.find(d => d.id !== dioId && d.inputCableIds?.includes(cableId));
                if (assignedToOther) return prev;
                newCables = [...currentCables, cableId];
                // Defesa: limpa splices órfãs do cabo antes de re-anexar — caso
                // algum caminho anterior tenha deixado entradas zumbi.
                newConnections = cleanFiberConns();
            }

            const newDios = [...prev.dios];
            newDios[dioIndex] = { ...dio, inputCableIds: newCables };
            return { ...prev, dios: newDios, connections: newConnections };
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

    const handleUpdateConnections = (updatedConnections: FiberConnection[]) => {
        setLocalPOP(prev => ({
            ...prev,
            connections: updatedConnections
        }));
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

    // --- Cable Context Menu ---
    const handleCableContextMenu = useCallback((e: React.MouseEvent, cableId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setCableContextMenu({ x: e.clientX, y: e.clientY, cableId });
    }, []);

    useEffect(() => {
        if (!cableContextMenu) return;
        const handleClick = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setCableContextMenu(null);
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [cableContextMenu]);

    const handleRemoveCableFromPOP = useCallback((cableId: string) => {
        // Remove cable from POP inputCableIds, all DIOs inputCableIds, and associated fiber connections
        const fiberPrefix = `${cableId}-fiber-`;
        setLocalPOP(prev => ({
            ...prev,
            inputCableIds: prev.inputCableIds.filter(id => id !== cableId),
            dios: prev.dios.map(d => ({
                ...d,
                inputCableIds: d.inputCableIds?.filter(id => id !== cableId)
            })),
            connections: prev.connections.filter(c =>
                !c.sourceId.startsWith(fiberPrefix) && !c.targetId.startsWith(fiberPrefix)
            )
        }));
        if (onDisconnectCable) {
            onDisconnectCable(cableId, localPOP.id);
        }
    }, [onDisconnectCable, localPOP.id]);

    // --- Event Handlers (Drag & View) ---

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.clickable-element')) return;

        if (e.button === 0) {
            setDragState({ mode: 'view', startX: e.clientX, startY: e.clientY });
        }
    };

    const handleElementDragStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();

        // Pre-compute which SVG links need updating during drag
        const links: typeof dragLinksRef.current = [];
        localPOP.dios.forEach(dio => {
            if (!dio.inputCableIds || dio.inputCableIds.length === 0) return;
            dio.inputCableIds.forEach(cableId => {
                const cable = uniqueIncomingCables.find(c => c.id === cableId);
                if (!cable) return;
                const isDio = id === dio.id;
                const isCable = id === cable.id;
                if (!isDio && !isCable) return;
                links.push({
                    dioId: dio.id,
                    cableId: cable.id,
                    dioLayout: getLayout(dio.id),
                    cableLayout: getLayout(cable.id),
                    isDio,
                    isCable
                });
            });
        });
        dragLinksRef.current = links;

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

            // Update SVG connection lines in real-time using pre-computed cache
            for (let i = 0; i < dragLinksRef.current.length; i++) {
                const link = dragLinksRef.current[i];

                let p2x = link.dioLayout.x;
                let p2y = link.dioLayout.y + 40;
                let p1x = link.cableLayout.x + 112;
                let p1y = link.cableLayout.y + 30;

                if (link.isDio) { p2x = newX; p2y = newY + 40; }
                if (link.isCable) { p1x = newX + 112; p1y = newY + 30; }

                const cx = (p1x + p2x) / 2;
                const pathEl = document.getElementById(`conn-${link.cableId}-${link.dioId}-path`);
                const c1El = document.getElementById(`conn-${link.cableId}-${link.dioId}-c1`);
                const c2El = document.getElementById(`conn-${link.cableId}-${link.dioId}-c2`);
                if (pathEl) pathEl.setAttribute('d', `M ${p1x} ${p1y} C ${cx} ${p1y}, ${cx} ${p2y}, ${p2x} ${p2y}`);
                if (c1El) { c1El.setAttribute('cx', String(p1x)); c1El.setAttribute('cy', String(p1y)); }
                if (c2El) { c2El.setAttribute('cx', String(p2x)); c2El.setAttribute('cy', String(p2y)); }
            }
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
        const { slots, portsPerSlot, uplinkPorts, slotNames } = newOLTConfig as any;
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

        const numUplinks = uplinkPorts ?? 2;
        const uplinkPortIds: string[] = [];
        for (let i = 1; i <= numUplinks; i++) {
            uplinkPortIds.push(`${id}-uplink-${i}`);
        }

        const newOLT: OLT = {
            id,
            name: (newOLTConfig as any).modelName
                ? `${(newOLTConfig as any).modelName} ${localPOP.olts.length + 1}`
                : `${t('type_olt') || 'OLT'} ${localPOP.olts.length + 1}`,
            // Link canônico com o catálogo: garante que resolveOLTPower puxe a
            // potência correta mesmo quando o usuário renomear a instância pra
            // algo que não bate com o nome do catálogo (ex: "vsol_1_final_da_linha").
            catalogId: (newOLTConfig as any).catalogId,
            ports: totalPorts,
            portIds,
            status: 'PLANNED',
            type: 'OLT',
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
        const { id, name, type, structure, uplinkPorts, catalogId } = editingOLT as OLT;
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
                catalogId, // pode ser undefined (usuário desvinculou) — preserva intenção do form
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

    /**
     * Adiciona um splitter dentro de um DIO específico (chamado da LogicalSplicingView).
     * Splitters em POP vivem sempre dentro de um DIO (vinculados via `dioId`).
     */
    const handleAddSplitterToDio = useCallback((catalogItem: SplitterCatalogItem, dioId: string) => {
        const id = `splitter-${Date.now()}`;
        const outputs = Math.max(1, catalogItem.outputs || 0);
        const newSplitter: Splitter = {
            id,
            name: `${catalogItem.name} ${(localPOP.splitters?.length || 0) + 1}`,
            type: catalogItem.type || `1x${outputs}`,
            catalogId: catalogItem.id,
            inputPortId: `${id}-in`,
            outputPortIds: Array.from({ length: outputs }).map((_, i) => `${id}-out-${i}`),
            connectorType: catalogItem.connectorType,
            polishType: catalogItem.polishType,
            allowCustomConnections: catalogItem.allowCustomConnections,
            dioId,
        };

        setLocalPOP(prev => ({
            ...prev,
            splitters: [...(prev.splitters || []), newSplitter],
        }));
    }, [localPOP.splitters]);

    const handleDeleteSplitter = useCallback((id: string) => {
        setLocalPOP(prev => {
            const splitter = (prev.splitters || []).find(s => s.id === id);
            if (!splitter) return prev;
            const allPortIds = new Set<string>([splitter.inputPortId, ...splitter.outputPortIds]);
            const newConnections = prev.connections.filter(c =>
                !allPortIds.has(c.sourceId) && !allPortIds.has(c.targetId)
            );
            return {
                ...prev,
                splitters: (prev.splitters || []).filter(s => s.id !== id),
                connections: newConnections,
            };
        });
    }, []);

    const handleRenameSplitter = useCallback((id: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        setLocalPOP(prev => ({
            ...prev,
            splitters: (prev.splitters || []).map(s => s.id === id ? { ...s, name: trimmed } : s)
        }));
    }, []);

    const handleSaveEditedDIO = () => {
        if (!editingDIO) return;
        const { id, name, ports, portLabels } = editingDIO;
        const newPortIds = Array.from({ length: ports }).map((_, i) => `${id}-p-${i}`);

        // Keep only labels for surviving portIds, and drop empty strings
        const cleanedLabels: Record<string, string> = {};
        for (const pid of newPortIds) {
            const label = portLabels?.[pid]?.trim();
            if (label) cleanedLabels[pid] = label;
        }

        setLocalPOP(prev => {
            const updatedDios = prev.dios.map(d => d.id === id ? {
                ...d,
                name,
                ports,
                portIds: newPortIds,
                portLabels: Object.keys(cleanedLabels).length > 0 ? cleanedLabels : undefined,
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

    // --- Active Ethernet Equipment (Switch / Router / Server / Other) ---

    const handleOpenAddActive = () => {
        const w = 380;
        const h = 360;
        const containerW = containerRef.current?.clientWidth || window.innerWidth;
        const containerH = containerRef.current?.clientHeight || window.innerHeight;
        setActiveModalPos({ x: (containerW - w) / 2, y: (containerH - h) / 2 });
        setNewActiveConfig({ type: 'SWITCH', portCount: 8, name: '' });
        setShowAddActiveModal(true);
    };

    const defaultNameForType = (type: ActiveEquipmentType): string => {
        const count = (localPOP.switches || []).filter(s => (s.type ?? 'SWITCH') === type).length + 1;
        const label: Record<ActiveEquipmentType, string> = {
            SWITCH: 'Switch',
            ROUTER: 'Roteador',
            SERVER: 'Servidor',
            OTHER: 'Ativo',
        };
        return `${label[type]} ${count}`;
    };

    const handleAddActive = () => {
        const { type, portCount, name } = newActiveConfig;
        const id = `switch-${Date.now()}`;
        const finalPortCount = Math.max(1, portCount);
        // Usamos o prefixo 'swp-' em cada port ID pra que o DIOUnit reconheça a
        // conexão e renderize a porta do DIO como ocupada (ver DIOUnit.tsx).
        const ports: SwitchPort[] = Array.from({ length: finalPortCount }, (_, i) => ({
            id: `swp-${id}-${i + 1}`,
            label: `P${i + 1}`,
        }));
        const newActive: SwitchData = {
            id,
            name: (name && name.trim()) ? name.trim() : defaultNameForType(type),
            portCount: finalPortCount,
            ports,
            status: 'PLANNED',
            type,
        };

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
            switches: [...(prev.switches || []), newActive],
            layout: { ...prev.layout, [id]: { x: finalX, y: finalY, rotation: 0 } },
        }));
        setShowAddActiveModal(false);
        setEditingSwitchPortId(null);
        setEditingSwitchId(id);
    };

    const handleSaveSwitch = (updated: SwitchData) => {
        setLocalPOP(prev => {
            const prevSwitch = (prev.switches || []).find(s => s.id === updated.id);
            // Aplica o updated. Depois, propaga direct links mutualmente.
            let switches = (prev.switches || []).map(s => (s.id === updated.id ? updated : s));

            // 1) DIRECT LINKS — sincroniza mutualidade entre peers.
            //    a) Para cada port no updated que TEM directLink, escreve o reverso no peer.
            //    b) Para cada port no prevSwitch que TINHA directLink mas updated não tem,
            //       remove o reverso do peer anterior.
            type RevOp = { switchId: string; portId: string; remove: boolean; peer?: DirectLinkPair };
            interface DirectLinkPair { peerSwitchId: string; peerPortId: string }
            const ops: RevOp[] = [];

            for (const port of updated.ports) {
                const prevPort = prevSwitch?.ports.find(p => p.id === port.id);
                const hadLink = prevPort?.directLink;
                const hasLink = port.directLink;
                const changed = JSON.stringify(hadLink) !== JSON.stringify(hasLink);
                if (!changed) continue;

                // Só propaga mutualmente quando o peer é OUTRO switch — OLT não
                // armazena directLink (a conexão vive só em FiberConnection).
                const hadKind = hadLink?.peerKind ?? 'switch';
                const hasKind = hasLink?.peerKind ?? 'switch';

                if (hadLink && hadKind === 'switch') {
                    ops.push({
                        switchId: hadLink.peerSwitchId,
                        portId: hadLink.peerPortId,
                        remove: true,
                    });
                }
                if (hasLink && hasKind === 'switch') {
                    ops.push({
                        switchId: hasLink.peerSwitchId,
                        portId: hasLink.peerPortId,
                        remove: false,
                        peer: { peerSwitchId: updated.id, peerPortId: port.id },
                    });
                }
            }

            // Aplica as operações nas switches peers
            for (const op of ops) {
                const idx = switches.findIndex(s => s.id === op.switchId);
                if (idx < 0) continue;
                const peerSwitch = switches[idx];
                const updatedPorts = peerSwitch.ports.map(p => {
                    if (p.id !== op.portId) return p;
                    if (op.remove) {
                        const { directLink, ...rest } = p;
                        return rest;
                    }
                    return {
                        ...p,
                        directLink: op.peer,
                        // Se estava alocado em DIO, limpa — direct e DIO são mutuamente exclusivos
                        allocation: undefined,
                    };
                });
                switches[idx] = { ...peerSwitch, ports: updatedPorts };
            }

            // 2) FIBER CONNECTIONS — recomputa TUDO relacionado a switches (DIO + direct)
            //    Coleta todos os port IDs de switches afetados (o updated + peers mutados)
            const affectedSwitchIds = new Set<string>([updated.id, ...ops.map(o => o.switchId)]);
            const affectedPortIds = new Set<string>();
            for (const s of switches) {
                if (affectedSwitchIds.has(s.id)) {
                    for (const p of s.ports) affectedPortIds.add(p.id);
                }
            }

            const filtered = prev.connections.filter(c =>
                !affectedPortIds.has(c.sourceId) && !affectedPortIds.has(c.targetId)
            );

            const fresh: FiberConnection[] = [];
            for (const sw of switches) {
                if (!affectedSwitchIds.has(sw.id)) continue;
                for (const port of sw.ports) {
                    // DIO mode
                    const a = port.allocation;
                    if (a?.txDioPortId) {
                        fresh.push({
                            id: `sw-conn-${port.id}-tx`,
                            sourceId: port.id,
                            targetId: a.txDioPortId,
                            color: '#0ea5e9',
                        });
                        if (a.rxDioPortId && a.rxDioPortId !== a.txDioPortId) {
                            fresh.push({
                                id: `sw-conn-${port.id}-rx`,
                                sourceId: port.id,
                                targetId: a.rxDioPortId,
                                color: '#0ea5e9',
                            });
                        }
                    }
                    // Direct mode — cria FiberConnection entre switch port e peer port.
                    // Pra switch↔switch, dedupe pelo menor ID (só um lado cria).
                    // Pra switch↔OLT uplink, sempre cria do lado do switch
                    // (OLT não tem directLink próprio, então não duplica).
                    const d = port.directLink;
                    if (d && d.peerSwitchId && d.peerPortId) {
                        const kind = d.peerKind ?? 'switch';
                        const shouldCreate = kind === 'olt' || port.id < d.peerPortId;
                        if (shouldCreate) {
                            fresh.push({
                                id: `sw-direct-${port.id}`,
                                sourceId: port.id,
                                targetId: d.peerPortId,
                                color: '#38bdf8',
                            });
                        }
                    }
                }
            }

            return { ...prev, switches, connections: [...filtered, ...fresh] };
        });
        setEditingSwitchId(null);
    };

    const handleDeleteSwitch = (id: string) => {
        setLocalPOP(prev => {
            const sw = (prev.switches || []).find(s => s.id === id);
            const switchPortIds = new Set(sw?.ports.map(p => p.id) ?? []);

            // 1) Remove o switch do array
            // 2) Varre OUTROS switches e limpa directLink que apontava pra este
            //    (evita referências órfãs pro peer deletado)
            // 3) Remove FiberConnections que envolviam portas deste switch
            const remaining = (prev.switches || [])
                .filter(s => s.id !== id)
                .map(s => {
                    let touched = false;
                    const ports = s.ports.map(p => {
                        if (p.directLink?.peerSwitchId === id) {
                            touched = true;
                            const { directLink, ...rest } = p;
                            return rest;
                        }
                        return p;
                    });
                    return touched ? { ...s, ports } : s;
                });

            return {
                ...prev,
                switches: remaining,
                connections: prev.connections.filter(c =>
                    !switchPortIds.has(c.sourceId) && !switchPortIds.has(c.targetId)
                ),
            };
        });
    };

    const confirmDeleteEquipment = () => {
        if (!itemToDelete) return;

        if (itemToDelete.type === 'OLT') {
            setLocalPOP(prev => {
                const o = prev.olts.find(x => x.id === itemToDelete.id);
                if (!o) return prev;
                // Coleta todas as portas da OLT (GPON + uplinks) pra limpar referências cruzadas
                const deletedPortIds = new Set<string>([
                    ...(o.portIds || []),
                    ...(o.uplinkPortIds || []),
                ]);
                // Switch ports podem ter directLink.peerKind='olt' apontando pra uplink desta OLT — limpar
                const switches = (prev.switches || []).map(sw => {
                    let touched = false;
                    const ports = sw.ports.map(p => {
                        if (p.directLink
                            && p.directLink.peerKind === 'olt'
                            && p.directLink.peerSwitchId === itemToDelete.id) {
                            touched = true;
                            const { directLink, ...rest } = p;
                            return rest;
                        }
                        return p;
                    });
                    return touched ? { ...sw, ports } : sw;
                });
                return {
                    ...prev,
                    olts: prev.olts.filter(x => x.id !== itemToDelete.id),
                    switches,
                    connections: prev.connections.filter(c =>
                        !deletedPortIds.has(c.sourceId) && !deletedPortIds.has(c.targetId)
                    )
                };
            });
        } else {
            setLocalPOP(prev => {
                const d = prev.dios.find(x => x.id === itemToDelete.id);
                if (!d) return prev;
                const deletedPortIds = new Set<string>(d.portIds || []);
                // Switch ports com allocation.dioId === deleted DIO → limpar (fica órfão senão)
                const switches = (prev.switches || []).map(sw => {
                    let touched = false;
                    const ports = sw.ports.map(p => {
                        if (p.allocation?.dioId === itemToDelete.id) {
                            touched = true;
                            const { allocation, ...rest } = p;
                            return rest;
                        }
                        return p;
                    });
                    return touched ? { ...sw, ports } : sw;
                });
                return {
                    ...prev,
                    dios: prev.dios.filter(x => x.id !== itemToDelete.id),
                    switches,
                    connections: prev.connections.filter(c =>
                        !deletedPortIds.has(c.sourceId) && !deletedPortIds.has(c.targetId)
                    )
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
                if (canEdit) handleCloseRequest();
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
        setEditingDIO({
            id: dio.id,
            name: dio.name,
            ports: dio.ports,
            portIds: dio.portIds || [],
            portLabels: { ...(dio.portLabels || {}) },
        });
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

    // Helper: Get connection info for a port (used for tooltips).
    // Resolve o OTHER END da FiberConnection pra um rótulo legível por tipo:
    //   - OLT (porta GPON ou uplink) → "NomeOLT (s1-p3)" / "NomeOLT (uplink-1)"
    //   - DIO                         → "NomeDIO (P5)"
    //   - Switch/Router/etc           → "NomeSwitch (P1)"
    //   - Fibra de cabo               → "NomeCabo · fibra N"
    //   - fallback                    → undefined (deixa o caller decidir)
    const getPortConnectionInfo = useCallback((portId: string): string | undefined => {
        const conn = localPOP.connections.find(c => c.sourceId === portId || c.targetId === portId);
        if (!conn) return undefined;
        const otherEnd = conn.sourceId === portId ? conn.targetId : conn.sourceId;

        // OLT (GPON ports ou uplinks)
        for (const olt of localPOP.olts) {
            if (olt.portIds?.includes(otherEnd)) {
                const portLabel = otherEnd.split('-').slice(-2).join('-');
                return `${olt.name} (${portLabel})`;
            }
            if (olt.uplinkPortIds?.includes(otherEnd)) {
                const idx = olt.uplinkPortIds.indexOf(otherEnd) + 1;
                return `${olt.name} (uplink ${idx})`;
            }
        }
        // DIO
        for (const dio of localPOP.dios) {
            if (dio.portIds?.includes(otherEnd)) {
                const idx = dio.portIds.indexOf(otherEnd) + 1;
                return `${dio.name} (P${idx})`;
            }
        }
        // Switch/Router/Server/Other
        for (const sw of localPOP.switches || []) {
            const port = sw.ports.find(p => p.id === otherEnd);
            if (port) {
                return `${sw.name} (${port.label || `P${sw.ports.indexOf(port) + 1}`})`;
            }
        }
        // Splitter (POP)
        for (const sp of localPOP.splitters || []) {
            if (sp.inputPortId === otherEnd) {
                return `${sp.name} (IN)`;
            }
            const outIdx = sp.outputPortIds.indexOf(otherEnd);
            if (outIdx !== -1) {
                return `${sp.name} (OUT ${outIdx + 1})`;
            }
        }
        // Fibra de cabo (splice): cableId-fiber-N
        const fiberMatch = otherEnd.match(/^(.+)-fiber-(\d+)$/);
        if (fiberMatch) {
            const cable = uniqueIncomingCables.find(c => c.id === fiberMatch[1]);
            const cableName = cable?.name ?? 'cabo';
            return `${cableName} · fibra ${Number(fiberMatch[2]) + 1}`;
        }
        return undefined;
    }, [localPOP.connections, localPOP.olts, localPOP.dios, localPOP.switches, uniqueIncomingCables]);

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

            // Find already connected ports (only count patching connections, not fiber/splice)
            const patchedPorts = new Set<string>();
            prev.connections.forEach(c => {
                const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber');
                if (!isFiber) {
                    patchedPorts.add(c.sourceId);
                    patchedPorts.add(c.targetId);
                }
            });

            const freeOltPorts = oltPorts.filter(p => !patchedPorts.has(p));
            const freeDioPorts = dioPorts.filter(p => !patchedPorts.has(p));

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
        <div
            className="pop-editor-modal fixed top-0 bottom-0 right-0 z-[2000] bg-slate-200 dark:bg-black flex items-center justify-center transition-all duration-300"
            style={{ left: isSidebarCollapsed ? '80px' : '280px' }}
        >
            <div className="w-full h-full bg-white dark:bg-[#1a1d23] flex flex-col overflow-hidden relative">

                {/* 1. HEADER (Title + Close) */}
                <PopHeader
                    title={t('pop_editor_title', { name: pop.name })}
                    onClose={canEdit ? handleCloseRequest : onClose}
                    userRole={userRole}
                    readOnlyLabel={readOnlyLabel}
                />

                {/* 2. SECONDARY TOOLBAR */}
                <PopToolbar
                    onAddOLT={handleOpenAddOLT}
                    onAddDIO={handleOpenAddDIO}
                    onAddSwitch={canEdit ? handleOpenAddActive : undefined}
                    onViewModeChange={handleViewModeChange}
                    viewMode={viewMode}
                    onClearAll={handleShowClearConfirm}
                    onAutoPatch={handleOpenAutoPatch}
                    onSave={canEdit ? handleCloseRequest : onClose}
                    t={t}
                    userRole={userRole}
                    stats={useMemo(() => {
                        const totalPorts = localPOP.olts.reduce((a, o) => a + (o.portIds?.length || 0) + (o.uplinkPortIds?.length || 0), 0)
                            + localPOP.dios.reduce((a, d) => a + (d.portIds?.length || 0), 0)
                            + (localPOP.switches || []).reduce((a, s) => a + s.ports.length, 0);
                        const connectedPorts = new Set<string>();
                        localPOP.connections.forEach(c => { connectedPorts.add(c.sourceId); connectedPorts.add(c.targetId); });
                        return {
                            olts: localPOP.olts.length,
                            dios: localPOP.dios.length,
                            switches: (localPOP.switches || []).length,
                            connections: localPOP.connections.length,
                            totalPorts,
                            usedPorts: connectedPorts.size
                        };
                    }, [localPOP.olts, localPOP.dios, localPOP.switches, localPOP.connections])}
                    readOnly={readOnly}
                    onGoToParentProject={onGoToParentProject}
                />

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-slate-100 dark:bg-[#2c2f36] relative overflow-hidden"
                    onContextMenu={(e) => e.preventDefault()}
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{ cursor: dragState ? 'grabbing' : 'default' }}
                >
                    {/* Rack Rails */}
                    {viewMode !== 'logical' && (
                        <>
                            <div
                                className="absolute top-0 bottom-0 left-0 w-4 bg-slate-300 dark:bg-[#15171c] border-r border-slate-300 dark:border-slate-700/30 z-30 pointer-events-none"
                                style={{
                                    backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 36px, ${isDark ? '#2a2e38' : 'rgba(0,0,0,0.08)'} 36px, ${isDark ? '#2a2e38' : 'rgba(0,0,0,0.08)'} 40px)`,
                                    backgroundSize: '100% 40px'
                                }}
                            />
                            <div
                                className="absolute top-0 bottom-0 right-0 w-4 bg-slate-300 dark:bg-[#15171c] border-l border-slate-300 dark:border-slate-700/30 z-30 pointer-events-none"
                                style={{
                                    backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 36px, ${isDark ? '#2a2e38' : 'rgba(0,0,0,0.08)'} 36px, ${isDark ? '#2a2e38' : 'rgba(0,0,0,0.08)'} 40px)`,
                                    backgroundSize: '100% 40px'
                                }}
                            />
                        </>
                    )}

                    {/* Grid */}
                    {viewMode !== 'logical' && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: `radial-gradient(${isDark ? '#5a6270' : '#94a3b8'} 1.2px, transparent 1.2px)`,
                                backgroundSize: `${GRID_SIZE * viewState.zoom}px ${GRID_SIZE * viewState.zoom}px`,
                                backgroundPosition: `${viewState.x}px ${viewState.y}px`,
                                opacity: isDark ? 0.6 : 0.4
                            }}
                        />
                    )}

                    {viewMode === 'logical' ? (
                        <div className="absolute inset-0 z-10 bg-slate-100 dark:bg-[#2c2f36] overflow-hidden">
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
                                        className={`absolute w-28 bg-white dark:bg-[#1a1d23] border border-slate-300 dark:border-slate-700/50 ring-1 ring-black/10 dark:ring-black/20 rounded-lg shadow-xl z-20 flex flex-col hover:brightness-105 dark:hover:brightness-110 clickable-element select-none ${dragState?.targetId === cable.id ? '' : 'transition-[filter]'}`}
                                        onMouseEnter={() => onHoverCable && onHoverCable(cable.id)}
                                        onMouseLeave={() => onHoverCable && onHoverCable(null)}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            onEditCable && onEditCable(cable);
                                        }}
                                        onContextMenu={(e) => canEdit && handleCableContextMenu(e, cable.id)}
                                    >
                                        <div
                                            className="h-7 bg-slate-100 dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-700/50 px-2 flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-lg"
                                            onMouseDown={(e) => handleElementDragStart(e, cable.id)}
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-[0_0_4px_#0ea5e9] shrink-0" />
                                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1">{cable.name}</span>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditCable && onEditCable(cable);
                                                    }}
                                                    className="h-6 w-6 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                                    title={t('edit_cable') || "Editar Cabo"}
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </Button>
                                                <GripHorizontal className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                                            </div>
                                        </div>
                                        <div className="p-2 text-[10px] text-slate-500 dark:text-slate-500 text-center bg-slate-50 dark:bg-[#15171c] rounded-b-lg">
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


                            {/* Switch Units */}
                            {(localPOP.switches || []).map(sw => {
                                const layout = getLayout(sw.id);
                                const effectivePops = (allPops ?? [pop]).map(p => p.id === localPOP.id ? localPOP : p);
                                const ledStates = computeSwitchPortLedStates({
                                    sw,
                                    currentPop: localPOP,
                                    allPops: effectivePops,
                                    cables: uniqueIncomingCables,
                                    allCtos,
                                    // Catálogo é carregado sob demanda no SwitchEditor — LEDs no canvas
                                    // vão usar valores estimados até a porta ser editada/salva.
                                });
                                return (
                                    <SwitchUnit
                                        key={sw.id}
                                        sw={sw}
                                        position={{ x: layout.x, y: layout.y }}
                                        width={EQUIPMENT_WIDTH}
                                        connections={localPOP.connections}
                                        hoveredPortId={hoveredPortId}
                                        ledStates={ledStates}
                                        onDragStart={handleElementDragStart}
                                        onEdit={(e, s) => { e.stopPropagation(); setEditingSwitchPortId(null); setEditingSwitchId(s.id); }}
                                        onDelete={(e, s) => { e.stopPropagation(); handleDeleteSwitch(s.id); }}
                                        onPortClick={(e, portId) => {
                                            e.stopPropagation();
                                            setEditingSwitchPortId(portId);
                                            setEditingSwitchId(sw.id);
                                        }}
                                        onPortHover={setHoveredPortId}
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

                    showAddActive={showAddActiveModal}
                    activeModalPos={activeModalPos}
                    newActiveConfig={newActiveConfig}
                    setNewActiveConfig={setNewActiveConfig}
                    onAddActive={handleAddActive}
                    onCloseActive={() => setShowAddActiveModal(false)}

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

                {/* SWITCH EDITOR MODAL */}
                {editingSwitchId && (() => {
                    const sw = (localPOP.switches || []).find(s => s.id === editingSwitchId);
                    if (!sw) return null;
                    // Substitui o POP atual pela versão local (edições não salvas) no array completo
                    // pra o trace de peer refletir o estado real da UI.
                    const effectivePops = (allPops ?? [pop]).map(p => p.id === localPOP.id ? localPOP : p);
                    return (
                        <SwitchEditor
                            sw={sw}
                            allSwitches={localPOP.switches || []}
                            olts={localPOP.olts}
                            dios={localPOP.dios}
                            cables={uniqueIncomingCables}
                            connections={localPOP.connections}
                            allPops={effectivePops}
                            allCtos={allCtos}
                            currentPopId={localPOP.id}
                            onClose={() => { setEditingSwitchId(null); setEditingSwitchPortId(null); }}
                            onSave={handleSaveSwitch}
                            readOnly={!canEdit}
                            initialPortId={editingSwitchPortId ?? undefined}
                        />
                    );
                })()}

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
                            onUpdateConnections={handleUpdateConnections}
                            onAddSplitter={canEdit ? handleAddSplitterToDio : undefined}
                            onDeleteSplitter={canEdit ? handleDeleteSplitter : undefined}
                            onRenameSplitter={canEdit ? handleRenameSplitter : undefined}
                            litPorts={litPorts}
                            vflSource={vflSource}
                            onToggleVfl={onToggleVfl}
                            onOtdrTrace={onOtdrTrace}
                            isSidebarCollapsed={isSidebarCollapsed}
                        />
                    );
                })()}

                {/* Auto-Patch Modal */}
                {showAutoPatchModal && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAutoPatchModal(false)}>
                        <div
                            className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/50 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200 mb-1">{t('auto_patch')}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mb-5">{t('auto_patch_desc')}</p>

                            {/* Source: OLT */}
                            <div className="mb-4">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">{t('source') || 'Origem'} (OLT/Switch)</label>
                                <select
                                    value={autoPatchSourceId}
                                    onChange={e => setAutoPatchSourceId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600/50 bg-white dark:bg-[#22262e] text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">{t('select') || 'Selecione...'}</option>
                                    {localPOP.olts.map((olt: any) => {
                                        const patchedPorts = new Set<string>();
                                        localPOP.connections.forEach((c: any) => { const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber'); if (!isFiber) { patchedPorts.add(c.sourceId); patchedPorts.add(c.targetId); } });
                                        const free = (olt.portIds || []).filter((p: string) => !patchedPorts.has(p)).length;
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
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">{t('target') || 'Destino'} (DIO)</label>
                                <select
                                    value={autoPatchTargetId}
                                    onChange={e => setAutoPatchTargetId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600/50 bg-white dark:bg-[#22262e] text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="">{t('select') || 'Selecione...'}</option>
                                    {localPOP.dios.map((dio: any) => {
                                        const patchedPorts = new Set<string>();
                                        localPOP.connections.forEach((c: any) => { const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber'); if (!isFiber) { patchedPorts.add(c.sourceId); patchedPorts.add(c.targetId); } });
                                        const free = (dio.portIds || []).filter((p: string) => !patchedPorts.has(p)).length;
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
                                const patchedPorts = new Set<string>();
                                localPOP.connections.forEach((c: any) => { const isFiber = c.sourceId.includes('fiber') || c.targetId.includes('fiber'); if (!isFiber) { patchedPorts.add(c.sourceId); patchedPorts.add(c.targetId); } });
                                const freeOlt = (olt.portIds || []).filter((p: string) => !patchedPorts.has(p)).length;
                                const freeDio = (dio.portIds || []).filter((p: string) => !patchedPorts.has(p)).length;
                                const willConnect = Math.min(freeOlt, freeDio);
                                return (
                                    <div className="mb-5 p-3 bg-slate-50 dark:bg-[#22262e] rounded-lg border border-slate-200 dark:border-slate-600/50 text-center">
                                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{willConnect}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-500 ml-1.5">{t('connections_to_create') || 'conexões serão criadas'}</span>
                                    </div>
                                );
                            })()}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowAutoPatchModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600/50 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#22262e] transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleExecuteAutoPatch}
                                    disabled={!autoPatchSourceId || !autoPatchTargetId}
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors shadow-sm"
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

                {/* Cable Context Menu */}
                {cableContextMenu && (
                    <div
                        ref={contextMenuRef}
                        className="fixed z-[9999] bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 w-52 animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: cableContextMenu.y, left: cableContextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setCableToRemove(cableContextMenu.cableId);
                                setCableContextMenu(null);
                            }}
                            className="w-full !justify-start text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors gap-2 h-auto border-0"
                            icon={<Link className="w-3.5 h-3.5 rotate-45" />}
                        >
                            {t('ctx_remove_cable_pop')}
                        </Button>
                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                        <Button
                            variant="ghost"
                            onClick={() => {
                                const cable = incomingCables.find(c => c.id === cableContextMenu.cableId);
                                if (cable && onEditCable) {
                                    onEditCable(cable);
                                }
                                setCableContextMenu(null);
                            }}
                            className="w-full !justify-start text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors gap-2 h-auto border-0"
                            icon={<FileText className="w-3.5 h-3.5" />}
                        >
                            {t('properties')}
                        </Button>
                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setCableToDelete(cableContextMenu.cableId);
                                setCableContextMenu(null);
                            }}
                            className="w-full !justify-start text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors gap-2 h-auto border-0"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                            {t('delete')}
                        </Button>
                    </div>
                )}

                {/* Confirm Remove Cable from POP */}
                {cableToRemove && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0 border border-red-300 dark:border-red-500/30">
                                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('title_remove_cable')}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t('confirm_remove_cable_pop')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-row gap-3 mt-6">
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        handleRemoveCableFromPOP(cableToRemove);
                                        setCableToRemove(null);
                                    }}
                                    className="flex-1 font-bold shadow-lg"
                                    icon={<Link className="w-4 h-4 rotate-45" />}
                                >
                                    {t('action_remove')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setCableToRemove(null)}
                                    className="flex-1 font-medium"
                                >
                                    {t('cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Delete Cable */}
                {cableToDelete && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0 border border-red-300 dark:border-red-500/30">
                                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('confirm_delete_cable_msg').replace('{name}', incomingCables.find(c => c.id === cableToDelete)?.name || '')}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t('confirm_delete_cable')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-row gap-3 mt-6">
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        if (onDeleteCable) {
                                            handleRemoveCableFromPOP(cableToDelete);
                                            onDeleteCable(cableToDelete);
                                        }
                                        setCableToDelete(null);
                                    }}
                                    className="flex-1 font-bold shadow-lg"
                                    icon={<Trash2 className="w-4 h-4" />}
                                >
                                    {t('delete')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setCableToDelete(null)}
                                    className="flex-1 font-medium"
                                >
                                    {t('cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
