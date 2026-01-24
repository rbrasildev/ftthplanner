import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { CTOData, CableData, FiberConnection, Splitter, FusionPoint, getFiberColor, ElementLayout, CTO_STATUS_COLORS, CTOStatus } from '../types';
import { X, Save, Plus, Scissors, RotateCw, Trash2, ZoomIn, ZoomOut, GripHorizontal, Link, Magnet, Flashlight, Move, Ruler, ArrowRightLeft, FileDown, Image as ImageIcon, AlertTriangle, ChevronDown, Zap, Maximize, Minimize2, Box, Eraser, AlignCenter, Triangle, Pencil, Loader2, ArrowRight, Activity, ExternalLink, Settings } from 'lucide-react';
// ... (lines 5-520 preserved by context logic of replace_file_content if targeted correctly, but here I am targeting start of file for import and then specific block for function?)
// No, replace_file_content is single block. I have to do multiple edits or one large edit.
// Let's do imports first, then function body.
// Wait, I can use multi_replace_file_content.
// But first let me check line numbers again from view_file.

// Line 2: imports.
// Line 534: FIBER_COLORS usage.
// Line 601: FIBER_COLORS usage (likely).

// I will use multi_replace_file_content.

import { useLanguage } from '../LanguageContext';
import { FiberCableNode } from './editor/FiberCableNode';
import { FusionNode } from './editor/FusionNode';
import { SplitterNode } from './editor/SplitterNode';
import { generateCTOSVG, exportToPNG, exportToPDF } from './CTOExporter';
import {
    SplitterCatalogItem,
    BoxCatalogItem,
    FusionCatalogItem,
    CableCatalogItem,
    getSplitters,
    getBoxes,
    getCables,
    getFusions,
    getOLTs,
    OLTCatalogItem
} from '../services/catalogService';
import { OpticalPowerModal } from './modals/OpticalPowerModal';
import { traceOpticalPath, OpticalPathResult } from '../utils/opticalUtils';
import { NetworkState } from '../types';

// Helper function to find distance from point P to segment AB
function getDistanceFromSegment(p: { x: number, y: number }, a: { x: number, y: number }, b: { x: number, y: number }) {
    const A = p.x - a.x;
    const B = p.y - a.y;
    const C = b.x - a.x;
    const D = b.y - a.y;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) // in case of 0 length line
        param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = a.x;
        yy = a.y;
    }
    else if (param > 1) {
        xx = b.x;
        yy = b.y;
    }
    else {
        xx = a.x + param * C;
        yy = a.y + param * D;
    }

    const dx = p.x - xx;
    const dy = p.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// Helper to preload image for canvas
const preloadImage = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            // Draw to canvas to get data URL (bypass potential CORS display issues if tainted, though crossorigin should fix)
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                try {
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (e) {
                    // Canvas tainted
                    console.warn("Canvas tainted by map image, skipping map in PDF.");
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        };
        img.onerror = () => {
            console.warn("Failed to load map image for PDF.");
            resolve(null);
        };
        img.src = url;
    });
};

interface CTOEditorProps {
    cto: CTOData;
    projectName: string;
    incomingCables: CableData[];
    onClose: () => void;
    onSave: (updatedCTO: CTOData) => void;
    onEditCable: (cable: CableData) => void;

    // VFL Props
    litPorts: Set<string>;
    vflSource: string | null;
    onToggleVfl: (portId: string) => void;

    // OTDR Prop
    onOtdrTrace: (portId: string, distance: number) => void;

    // Hover Highlight
    onHoverCable?: (cableId: string | null) => void;
    onDisconnectCable?: (cableId: string) => void;
    onSelectNextNode?: (cableId: string) => void;

    // Plan Props for Gatekeeping
    userPlan?: string;
    subscriptionExpiresAt?: string | null;
    onShowUpgrade?: () => void;
    network: NetworkState;
}

type DragMode = 'view' | 'element' | 'connection' | 'point' | 'reconnect' | 'window';

export const CTOEditor: React.FC<CTOEditorProps> = ({
    cto, projectName, incomingCables, onClose, onSave, onEditCable,
    litPorts, vflSource, onToggleVfl, onOtdrTrace, onHoverCable, onDisconnectCable, onSelectNextNode,
    userPlan, subscriptionExpiresAt, onShowUpgrade, network
}) => {
    const { t } = useLanguage();
    const [isApplying, setIsApplying] = useState(false);
    const [localCTO, setLocalCTO] = useState<CTOData>(() => {
        const next = JSON.parse(JSON.stringify(cto)) as CTOData;
        if (!next.layout) next.layout = {};

        // Position Incoming Cables on the Left if missing (Stacking with 10px gap)
        let currentCableY = 42;
        incomingCables.forEach((cable) => {
            const looseTubeCount = cable.looseTubeCount || 1;
            const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);
            const fibersHeight = 6 + (looseTubeCount * 12) + (cable.fiberCount * 12); // Base height approx
            const remainder = fibersHeight % 24;
            const totalHeight = fibersHeight + (remainder > 0 ? 24 - remainder : 0);

            if (!next.layout![cable.id]) {
                next.layout![cable.id] = { x: 42, y: currentCableY, rotation: 0 };
            }
            // Update currentCableY for the NEXT cable in the iteration
            const finalLayout = next.layout![cable.id];
            currentCableY = Math.max(currentCableY, finalLayout.y + totalHeight + 10);
        });

        // Position Existing Splitters if missing
        next.splitters.forEach((split, idx) => {
            if (!next.layout![split.id]) {
                next.layout![split.id] = { x: 378, y: 78 + (idx * 120), rotation: 0 };
            }
        });

        // --- FIX PERSISTENCE BUG: RECONCILE ORPHAN LAYOUTS ---
        // When saving, backend replaces Temp IDs with UUIDs, but Layout keys might remain as Temp IDs.
        // We must map these orphans to the new IDs to restore position.

        // 1. Reconcile Fusions
        const fusionLayoutKeys = Object.keys(next.layout).filter(k => k.includes('fusion-'));
        const fusionsWithoutLayout = next.fusions.filter(f => !next.layout![f.id]);

        // Find orphan keys (layout entries that don't match any current fusion ID)
        const orphanFusionKeys = fusionLayoutKeys.filter(k => !next.fusions.some(f => f.id === k));

        if (fusionsWithoutLayout.length > 0 && orphanFusionKeys.length > 0) {
            // Simple Heuristic: If counts match (or even if not), try to map sequentially?
            // Better: If we have orphans, assign them to missing fusions. 
            // Since we can't be 100% sure of mapping, we map by index if counts are small, or just take first available.
            // Given the bug description (single fusion jumping), 1:1 mapping is the most common case.

            fusionsWithoutLayout.forEach((fusion, idx) => {
                if (idx < orphanFusionKeys.length) {
                    const orphanKey = orphanFusionKeys[idx];
                    next.layout![fusion.id] = next.layout![orphanKey];
                    delete next.layout![orphanKey]; // Remove orphan
                    console.log(`[Layout Repair] Restored fusion position: ${orphanKey} -> ${fusion.id}`);
                }
            });
        }

        // 2. Reconcile Splitters (Same logic)
        const splitterLayoutKeys = Object.keys(next.layout).filter(k => k.includes('splitter-'));
        const splittersWithoutLayout = next.splitters.filter(s => !next.layout![s.id]);
        const orphanSplitterKeys = splitterLayoutKeys.filter(k => !next.splitters.some(s => s.id === k));

        if (splittersWithoutLayout.length > 0 && orphanSplitterKeys.length > 0) {
            splittersWithoutLayout.forEach((split, idx) => {
                if (idx < orphanSplitterKeys.length) {
                    const orphanKey = orphanSplitterKeys[idx];
                    next.layout![split.id] = next.layout![orphanKey];
                    delete next.layout![orphanKey];
                    console.log(`[Layout Repair] Restored splitter position: ${orphanKey} -> ${split.id}`);
                }
            });
        }

        // Position Existing Fusions if missing (Fallback)
        next.fusions.forEach((fusion, idx) => {
            if (!next.layout![fusion.id]) {
                next.layout![fusion.id] = { x: 500, y: 100 + (idx * 50), rotation: 0 };
            }
        });

        return next;
    });

    // SYNC LOCAL STATE WHEN PROP UPDATES (e.g. after Save)
    useEffect(() => {
        const next = JSON.parse(JSON.stringify(cto)) as CTOData;

        // Preserve layout if missing in new prop (though save should have persisted it)
        if (!next.layout) next.layout = {};

        // RE-APPLY DEFAULTS to ensure consistency
        incomingCables.forEach((cable, idx) => {
            if (!next.layout![cable.id]) {
                next.layout![cable.id] = { x: 42, y: 42 + (idx * 204), rotation: 0 };
            }
        });
        next.splitters.forEach((split, idx) => {
            if (!next.layout![split.id]) {
                next.layout![split.id] = { x: 378, y: 78 + (idx * 120), rotation: 0 };
            }
        });
        next.fusions.forEach((fusion, idx) => {
            if (!next.layout![fusion.id]) {
                next.layout![fusion.id] = { x: 500, y: 100 + (idx * 50), rotation: 0 };
            }
        });

        // Only update if actually different to avoid render loops (though JSON stringify is heavy, it's safe here)
        setLocalCTO(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(next)) return next;
            return prev;
        });
    }, [cto]);

    // SYNC REF for performance-critical handlers
    const localCTORef = useRef(localCTO);
    useLayoutEffect(() => {
        localCTORef.current = localCTO;
    }, [localCTO]);

    // --- View Centering Logic (Pure Math) ---
    const getElementBounds = (x: number, y: number, w: number, h: number, rotation: number) => {
        const rad = (rotation * Math.PI) / 180;
        const cx = x + w / 2;
        const cy = y + h / 2;
        // The 4 corners relative to element's top-left (0,0)
        const corners = [
            { px: 0, py: 0 },
            { px: w, py: 0 },
            { px: 0, py: h },
            { px: w, py: h }
        ];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        corners.forEach(p => {
            // 1. Move point to center-relative
            const dx = p.px - w / 2;
            const dy = p.py - h / 2;
            // 2. Rotate
            const rx = (dx * Math.cos(rad)) - (dy * Math.sin(rad));
            const ry = (dx * Math.sin(rad)) + (dy * Math.cos(rad));
            // 3. Move back to absolute position
            const fx = cx + rx;
            const fy = cy + ry;
            if (fx < minX) minX = fx; if (fy < minY) minY = fy;
            if (fx > maxX) maxX = fx; if (fy > maxY) maxY = fy;
        });
        return { minX, minY, maxX, maxY };
    };

    const getInitialViewState = (data: CTOData) => {
        let minX = Infinity, minY = Infinity, maxY = -Infinity, maxX = -Infinity;
        const checkPoint = (px: number, py: number) => {
            if (px < minX) minX = px; if (py < minY) minY = py;
            if (px > maxX) maxX = px; if (py > maxY) maxY = py;
        };

        if (data.layout) {
            // 1. Check Cabes
            incomingCables.forEach(cable => {
                const l = data.layout![cable.id];
                if (!l) return;
                const looseTubeCount = cable.looseTubeCount || 1;
                const totalHeight = 24 + (cable.fiberCount * 24) + ((looseTubeCount - 1) * 12);
                const b = getElementBounds(l.x, l.y, 168 + 24, totalHeight, l.rotation || 0);
                if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
                if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
            });

            // 2. Check Splitters
            data.splitters.forEach(split => {
                const l = data.layout![split.id];
                if (!l) return;
                const width = split.outputPortIds.length * 24;
                const b = getElementBounds(l.x, l.y, width, 72, l.rotation || 0);
                if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
                if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
            });

            // 3. Check Fusions
            data.fusions.forEach(fusion => {
                const l = data.layout![fusion.id];
                if (!l) return;
                const b = getElementBounds(l.x, l.y, 48, 24, l.rotation || 0);
                if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
                if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
            });

            // 4. Check Connections
            data.connections.forEach(c => {
                c.points?.forEach(p => {
                    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
                });
            });
        }

        if (minX === Infinity) return { x: 40, y: 40, zoom: 1 };

        const PADDING = 80;
        const contentW = maxX - minX + (PADDING * 2);
        const contentH = maxY - minY + (PADDING * 2);

        const viewportW = 1100;
        const viewportH = 750 - 56; // Minus header height

        // Calculate best zoom to fit content, but max 1 and min 0.2 to avoid "deformed" tiny view
        const zoomW = viewportW / contentW;
        const zoomH = viewportH / contentH;
        const targetZoom = Math.max(0.2, Math.min(zoomW, zoomH, 1));

        return {
            x: (viewportW / 2) - ((minX + (maxX - minX) / 2) * targetZoom),
            y: (viewportH / 2) - ((minY + (maxY - minY) / 2) / 2) * targetZoom,
            zoom: targetZoom
        };
    };

    // Viewport State
    const [viewState, setViewState] = useState(() => {
        if (localCTO.viewState &&
            !isNaN(localCTO.viewState.x) &&
            !isNaN(localCTO.viewState.y) &&
            !isNaN(localCTO.viewState.zoom)) {
            return localCTO.viewState;
        }
        return getInitialViewState(localCTO);
    });

    // Track if we have used the initial persisted state so we don't overwrite it with auto-calc
    // unless it was missing.
    const viewInitializedRef = useRef(!!localCTO.viewState);

    // Initial View Center on Data Load (Only if no persisted state existed)
    useEffect(() => {
        if (!viewInitializedRef.current) {
            const hasContent = incomingCables.length > 0 || localCTO.splitters.length > 0 || localCTO.fusions.length > 0;
            if (hasContent) {
                setViewState(getInitialViewState(localCTO));
                viewInitializedRef.current = true;
            }
        }
    }, [localCTO.splitters.length, localCTO.fusions.length, incomingCables.length]); // Dep check optimized

    // Update localCTO viewState when view changes (debounced or just reference for save)
    useEffect(() => {
        localCTORef.current.viewState = viewState;
        // visual update not needed for this, just ref sync for save
    }, [viewState]);

    const [isSnapping, setIsSnapping] = useState(true); // Default to enabled

    // Window Position State
    const [windowPos, setWindowPos] = useState(() => {
        if (typeof window === 'undefined') return { x: 100, y: 50 };
        const MODAL_WIDTH = 1100;
        const MODAL_HEIGHT = 750;

        let x = (window.innerWidth - MODAL_WIDTH) / 2;
        let y = (window.innerHeight - MODAL_HEIGHT) / 2;

        // Safety bounds to prevent checking out of screen
        if (x < 20) x = 20;
        if (y < 20) y = 20;

        return { x, y };
    });

    const [isMaximized, setIsMaximized] = useState(false);
    const [savedWindowPos, setSavedWindowPos] = useState(windowPos);

    const toggleMaximize = () => {
        if (!isMaximized) {
            setSavedWindowPos(windowPos);
            setIsMaximized(true);
        } else {
            setIsMaximized(false);
            setWindowPos(savedWindowPos);
        }
        // Force re-center after layout settles
        setTimeout(() => handleCenterView(), 100);
    };

    const [isVflToolActive, setIsVflToolActive] = useState(false);
    const [isOtdrToolActive, setIsOtdrToolActive] = useState(false);
    const [otdrTargetPort, setOtdrTargetPort] = useState<string | null>(null);
    const [otdrDistance, setOtdrDistance] = useState<string>('');
    const [isAutoSpliceOpen, setIsAutoSpliceOpen] = useState(false);
    const [autoSourceId, setAutoSourceId] = useState<string>('');
    const [autoTargetId, setAutoTargetId] = useState<string>('');
    const [exportingType, setExportingType] = useState<'png' | 'pdf' | null>(null);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showPropertiesModal, setShowPropertiesModal] = useState(false);
    const [propertiesName, setPropertiesName] = useState('');
    const [propertiesStatus, setPropertiesStatus] = useState<CTOStatus>('PLANNED');

    const handleOpenProperties = () => {
        setPropertiesName(localCTO.name);
        setPropertiesStatus((localCTO.status as CTOStatus) || 'PLANNED');
        setShowPropertiesModal(true);
    };

    const handleSaveProperties = () => {
        setLocalCTO(prev => ({
            ...prev,
            name: propertiesName,
            status: propertiesStatus
        }));
        setShowPropertiesModal(false);
    };

    const [showSplitterDropdown, setShowSplitterDropdown] = useState(false);
    const [isSmartAlignMode, setIsSmartAlignMode] = useState(false);
    const [isRotateMode, setIsRotateMode] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);

    // FUSION TOOL STATE
    const [isFusionToolActive, setIsFusionToolActive] = useState(false);
    const [selectedFusionTypeId, setSelectedFusionTypeId] = useState<string | null>(null);
    const [showFusionTypeModal, setShowFusionTypeModal] = useState(false);
    const [cursorPosition, setCursorPosition] = useState<{ x: number, y: number } | null>(null);

    const GRID_SIZE = 6; // Reduced from 12 for finer granule control
    const splitterDropdownRef = useRef<HTMLDivElement>(null);

    // --- CATALOG INTEGRATION ---
    const [availableCables, setAvailableCables] = useState<CableCatalogItem[]>([]);
    const [availableFusions, setAvailableFusions] = useState<FusionCatalogItem[]>([]);
    const [availableOLTs, setAvailableOLTs] = useState<OLTCatalogItem[]>([]);
    const [availableSplitters, setAvailableSplitters] = useState<SplitterCatalogItem[]>([]);
    const [availableBoxes, setAvailableBoxes] = useState<BoxCatalogItem[]>([]);

    // Optical Power Calculation State
    const [isOpticalModalOpen, setIsOpticalModalOpen] = useState(false);
    const [opticalResult, setOpticalResult] = useState<OpticalPathResult | null>(null);
    const [selectedSplitterName, setSelectedSplitterName] = useState('');

    useEffect(() => {
        const loadCatalogs = async () => {
            try {
                const [splitters, fusions, cables, boxes, olts] = await Promise.all([
                    getSplitters(),
                    getFusions(),
                    getCables(),
                    getBoxes(),
                    getOLTs()
                ]);
                setAvailableSplitters(splitters);
                setAvailableFusions(fusions);
                setAvailableCables(cables);
                setAvailableBoxes(boxes);
                setAvailableOLTs(olts);
            } catch (err) {
                console.error("Failed to load catalogs", err);
            }
        };
        loadCatalogs();
    }, []);

    // NEW: Clean up connections if a cable is removed from incomingCables
    useEffect(() => {
        setLocalCTO(prev => {
            const currentCableIds = new Set(incomingCables.map(c => c.id));
            const validConnections = prev.connections.filter(c => {
                // Check Source
                if (c.sourceId.includes('-fiber-')) {
                    const cableId = c.sourceId.split('-fiber-')[0];
                    if (!currentCableIds.has(cableId)) return false;
                }
                // Check Target
                if (c.targetId.includes('-fiber-')) {
                    const cableId = c.targetId.split('-fiber-')[0];
                    if (!currentCableIds.has(cableId)) return false;
                }
                return true;
            });

            if (validConnections.length !== prev.connections.length) {
                return { ...prev, connections: validConnections };
            }
            return prev;
        });
    }, [incomingCables]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (splitterDropdownRef.current && !splitterDropdownRef.current.contains(event.target as Node)) {
                setShowSplitterDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [dragState, setDragState] = useState<{
        mode: DragMode;
        targetId?: string;
        portId?: string;
        connectionId?: string;
        fixedPortId?: string;
        movingSide?: 'source' | 'target';
        pointIndex?: number;
        startX: number;
        startY: number;
        initialLayout?: ElementLayout;
        currentMouseX?: number;
        currentMouseY?: number;
        initialWindowPos?: { x: number, y: number };
        // Optimization: Cache initial connection points for delta calculation
        initialConnectionPoints?: { x: number, y: number }[];
    } | null>(null);
    const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
    // Generic Context Menu State: { x, y, id, type }
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string, type: 'cable' | 'splitter' } | null>(null);

    // Close menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleCableContextMenu = useCallback((e: React.MouseEvent, cableId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            id: cableId,
            type: 'cable'
        });
    }, []);

    const handleSplitterContextMenu = useCallback((e: React.MouseEvent, splitterId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            id: splitterId,
            type: 'splitter'
        });
    }, []);


    const connectionRefs = useRef<Record<string, SVGPathElement | null>>({});
    const connectionPointRefs = useRef<Record<string, SVGCircleElement | null>>({});
    const dragLineRef = useRef<SVGPathElement | null>(null);


    // Cable Editing State - REMOVED (Handled Globally)

    // Derived state for layout calculation
    const containerRef = useRef<HTMLDivElement>(null);
    const diagramContentRef = useRef<HTMLDivElement>(null);

    const [, setForceUpdate] = useState(0);
    useLayoutEffect(() => {
        setForceUpdate(n => n + 1);
    }, [viewState]);

    // FIX: Force re-calculation after mount to ensure getBoundingClientRect is correct
    // The Modal animation (zoom-in) causes initial rects to be invalid.
    // FIX: Force re-calculation after mount and use opacity transition to mask initial glitch
    // --- ESCAPE KEY HANDLER ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Cancel all active tools
                setIsRotateMode(false);
                setIsDeleteMode(false);
                setIsSmartAlignMode(false);
                setIsVflToolActive(false);
                setIsOtdrToolActive(false);

                // Cancel Fusion Tool
                setIsFusionToolActive(false);
                setShowFusionTypeModal(false);
                setCursorPosition(null);

                // If dragging something, cancel it
                setDragState(null);

                // Close dropdowns
                setShowSplitterDropdown(false);

                // Clear selections if needed (Optional: user asked to "forget selection")
                // setSelectedSplitterName(''); 
                // However, "selection" usually refers to the active Tool.
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const [isContentReady, setIsContentReady] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => {
            portCenterCache.current = {};
            containerRectCache.current = null;
            setForceUpdate(n => n + 1);
            setIsContentReady(true);
        }, 350); // Wait for animate-in duration
        return () => clearTimeout(timer);
    }, []);

    const litConnections = useMemo(() => {
        const lit = new Set<string>();
        localCTO.connections.forEach(conn => {
            if (litPorts.has(conn.sourceId) || litPorts.has(conn.targetId)) {
                lit.add(conn.id);
            }
        });
        return lit;
    }, [litPorts, localCTO.connections]);

    const getLayout = (id: string) => localCTO.layout?.[id] || { x: 0, y: 0, rotation: 0 };

    const screenToCanvas = (sx: number, sy: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (sx - rect.left - viewState.x) / viewState.zoom,
            y: (sy - rect.top - viewState.y) / viewState.zoom
        };
    };

    const portCenterCache = useRef<Record<string, { x: number, y: number }>>({});
    const containerRectCache = useRef<DOMRect | null>(null);

    const getPortCenter = (portId: string): { x: number, y: number } | null => {
        if (portCenterCache.current[portId]) return portCenterCache.current[portId];

        const el = document.getElementById(portId);
        if (el && containerRef.current) {
            if (!containerRectCache.current) {
                containerRectCache.current = containerRef.current.getBoundingClientRect();
            }
            const rect = el.getBoundingClientRect();
            const containerRect = containerRectCache.current;
            const relX = rect.left + rect.width / 2 - containerRect.left;
            const relY = rect.top + rect.height / 2 - containerRect.top;
            const result = {
                x: (relX - viewState.x) / viewState.zoom,
                y: (relY - viewState.y) / viewState.zoom
            };
            portCenterCache.current[portId] = result;
            return result;
        }
        return null;
    };

    const handleSmartAlignConnection = (connId: string) => {
        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.map(c => {
                if (c.id !== connId) return c;
                const p1 = getPortCenter(c.sourceId);
                const p2 = getPortCenter(c.targetId);
                if (!p1 || !p2) return c;

                // 1. Sanitize/Clean Current Points First (Hybrid Logic)
                // If the user manually dragged points, they might be off-grid or slightly skewed.
                // We want to "fix" them first (preserve shape) before cycling to a completely new shape.

                const sanitize = (pts: { x: number, y: number }[]) => {
                    if (!pts || pts.length === 0) return [];

                    // Start from P1
                    let prevRef = { x: Math.round(p1.x / GRID_SIZE) * GRID_SIZE, y: Math.round(p1.y / GRID_SIZE) * GRID_SIZE };

                    const cleanPts = pts.map(p => {
                        let nx = Math.round(p.x / GRID_SIZE) * GRID_SIZE;
                        let ny = Math.round(p.y / GRID_SIZE) * GRID_SIZE;

                        // Orthogonalize
                        const THRESHOLD = GRID_SIZE * 1.5;
                        const dx = Math.abs(nx - prevRef.x);
                        const dy = Math.abs(ny - prevRef.y);

                        if (dx < THRESHOLD && dy >= THRESHOLD) nx = prevRef.x; // Snap Vertical
                        else if (dy < THRESHOLD && dx >= THRESHOLD) ny = prevRef.y; // Snap Horizontal

                        // If both are small (duplicate) or both large (diagonal), just grid snap.
                        // But for diagonal, we might forcing L-shape? No, keep diagonal if intentional?
                        // User wants "small adjustment". Let's assume strict orthogonal preferred.
                        // If diagonal, force one axis?
                        // Let's stick to simple grid snap + proximity snap.

                        prevRef = { x: nx, y: ny };
                        return { x: nx, y: ny };
                    });

                    // Filter duplicates
                    return cleanPts.filter((p, i) => {
                        if (i === 0) return true;
                        return !(p.x === cleanPts[i - 1].x && p.y === cleanPts[i - 1].y);
                    });
                };

                const currentPoints = c.points || [];
                const sanitizedPoints = sanitize(currentPoints);

                // Helper: Compare point arrays
                const arePointsDifferent = (a: { x: number, y: number }[], b: { x: number, y: number }[]) => {
                    if (a.length !== b.length) return true;
                    for (let i = 0; i < a.length; i++) {
                        if (Math.abs(a[i].x - b[i].x) > 1 || Math.abs(a[i].y - b[i].y) > 1) return true;
                    }
                    return false;
                };

                // CHECK: Is current messy?
                // If sanitized is different from current -> APPLY SANITIZED (Fix manual drag)
                // But we must check if "current" is empty.
                if (currentPoints.length > 0 && arePointsDifferent(currentPoints, sanitizedPoints)) {
                    return { ...c, points: sanitizedPoints };
                }

                // IF ALREADY CLEAN (or empty), CYCLE CANDIDATES
                // Shape 0: Horizontal First (L) -> |__
                const shape0 = [{ x: p2.x, y: p1.y }];

                // Shape 1: Vertical First (L) -> __|
                const shape1 = [{ x: p1.x, y: p2.y }];

                // Shape 2: Mid-Point Horizontal (Z) -> --|--
                const midX = (p1.x + p2.x) / 2;
                const shape2 = [{ x: midX, y: p1.y }, { x: midX, y: p2.y }];

                // Shape 3: Mid-Point Vertical (Z) -> |__|
                const midY = (p1.y + p2.y) / 2;
                const shape3 = [{ x: p1.x, y: midY }, { x: p2.x, y: midY }];

                const candidates = [shape0, shape1, shape2, shape3];

                const normalize = (pts: { x: number, y: number }[]) =>
                    JSON.stringify(pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })));

                const currentStr = normalize(currentPoints);

                let matchIndex = -1;
                candidates.forEach((cand, idx) => {
                    const candStr = normalize(cand.map(p => ({
                        x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
                        y: Math.round(p.y / GRID_SIZE) * GRID_SIZE
                    })));
                    if (candStr === currentStr) matchIndex = idx;
                });

                // Cycle
                const nextIndex = (matchIndex + 1) % candidates.length;
                const nextShape = candidates[nextIndex];

                const finalPoints = nextShape.map(p => ({
                    x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
                    y: Math.round(p.y / GRID_SIZE) * GRID_SIZE
                }));

                return { ...c, points: finalPoints };
            })
        }));
    };

    const handleSmartAlignCable = (cableId: string) => {
        setLocalCTO(prev => {
            // 1. Determine Action based on Representative
            let action: 'SANITIZE' | 'CYCLE' = 'CYCLE'; // Default
            let nextShapeIdx = 0;

            const relevantConnections = prev.connections.filter(c =>
                c.sourceId.startsWith(cableId + '-') || c.targetId.startsWith(cableId + '-') ||
                c.sourceId === cableId || c.targetId === cableId
            );

            if (relevantConnections.length > 0) {
                const representative = relevantConnections[0];
                const p1Rep = getPortCenter(representative.sourceId);
                const p2Rep = getPortCenter(representative.targetId);

                if (p1Rep && p2Rep) {
                    const currentPoints = representative.points || [];

                    // Helper: Sanitize Logic
                    const sanitizeHelpers = (pts: { x: number, y: number }[], startP: { x: number, y: number }) => {
                        if (!pts || pts.length === 0) return [];
                        let prevRef = { x: Math.round(startP.x / GRID_SIZE) * GRID_SIZE, y: Math.round(startP.y / GRID_SIZE) * GRID_SIZE };
                        return pts.map(p => {
                            let nx = Math.round(p.x / GRID_SIZE) * GRID_SIZE;
                            let ny = Math.round(p.y / GRID_SIZE) * GRID_SIZE;
                            const THRESHOLD = GRID_SIZE * 1.5;
                            const dx = Math.abs(nx - prevRef.x);
                            const dy = Math.abs(ny - prevRef.y);
                            if (dx < THRESHOLD && dy >= THRESHOLD) nx = prevRef.x;
                            else if (dy < THRESHOLD && dx >= THRESHOLD) ny = prevRef.y;
                            prevRef = { x: nx, y: ny };
                            return { x: nx, y: ny };
                        }).filter((p, i, arr) => i === 0 || !(p.x === arr[i - 1].x && p.y === arr[i - 1].y));
                    };

                    const sanitizedPoints = sanitizeHelpers(currentPoints, p1Rep);

                    const arePointsDifferent = (a: any[], b: any[]) => {
                        if (a.length !== b.length) return true;
                        for (let i = 0; i < a.length; i++) if (Math.abs(a[i].x - b[i].x) > 1 || Math.abs(a[i].y - b[i].y) > 1) return true;
                        return false;
                    };

                    if (currentPoints.length > 0 && arePointsDifferent(currentPoints, sanitizedPoints)) {
                        action = 'SANITIZE';
                    } else {
                        // Determine Cycle Index
                        const shape0 = [{ x: p2Rep.x, y: p1Rep.y }];
                        const shape1 = [{ x: p1Rep.x, y: p2Rep.y }];
                        const midX = (p1Rep.x + p2Rep.x) / 2;
                        const shape2 = [{ x: midX, y: p1Rep.y }, { x: midX, y: p2Rep.y }];
                        const midY = (p1Rep.y + p2Rep.y) / 2;
                        const shape3 = [{ x: p1Rep.x, y: midY }, { x: p2Rep.x, y: midY }];
                        const candidates = [shape0, shape1, shape2, shape3];
                        const normalize = (pts: any[]) => JSON.stringify(pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })));
                        const currentStr = normalize(currentPoints);

                        let matchIndex = -1;
                        candidates.forEach((cand, idx) => {
                            const candStr = normalize(cand.map(p => ({ x: Math.round(p.x / GRID_SIZE) * GRID_SIZE, y: Math.round(p.y / GRID_SIZE) * GRID_SIZE })));
                            if (candStr === currentStr) matchIndex = idx;
                        });
                        nextShapeIdx = (matchIndex + 1) % candidates.length;
                    }
                }
            }

            // 2. Apply Action to ALL relevant connections
            const updatedConnections = prev.connections.map(c => {
                const isSourceRelated = c.sourceId === cableId || c.sourceId.startsWith(cableId + '-');
                const isTargetRelated = c.targetId === cableId || c.targetId.startsWith(cableId + '-');
                if (!isSourceRelated && !isTargetRelated) return c;

                const p1 = getPortCenter(c.sourceId);
                const p2 = getPortCenter(c.targetId);
                if (!p1 || !p2) return c;

                if (action === 'SANITIZE') {
                    // Inline sanitize logic (reused)
                    const sanitize = (pts: any[]) => {
                        if (!pts || pts.length === 0) return [];
                        // Need startP from this connection, NOT representative
                        let prevRef = { x: Math.round(p1.x / GRID_SIZE) * GRID_SIZE, y: Math.round(p1.y / GRID_SIZE) * GRID_SIZE };
                        return pts.map(p => {
                            let nx = Math.round(p.x / GRID_SIZE) * GRID_SIZE;
                            let ny = Math.round(p.y / GRID_SIZE) * GRID_SIZE;
                            const THRESHOLD = GRID_SIZE * 1.5;
                            const dx = Math.abs(nx - prevRef.x);
                            const dy = Math.abs(ny - prevRef.y);
                            if (dx < THRESHOLD && dy >= THRESHOLD) nx = prevRef.x;
                            else if (dy < THRESHOLD && dx >= THRESHOLD) ny = prevRef.y;
                            prevRef = { x: nx, y: ny };
                            return { x: nx, y: ny };
                        }).filter((p, i, arr) => i === 0 || !(p.x === arr[i - 1].x && p.y === arr[i - 1].y));
                    };
                    return { ...c, points: sanitize(c.points || []) };
                } else {
                    // APPLY CYCLE SHAPE
                    const shape0 = [{ x: p2.x, y: p1.y }];
                    const shape1 = [{ x: p1.x, y: p2.y }];
                    const midX = (p1.x + p2.x) / 2;
                    const shape2 = [{ x: midX, y: p1.y }, { x: midX, y: p2.y }];
                    const midY = (p1.y + p2.y) / 2;
                    const shape3 = [{ x: p1.x, y: midY }, { x: p2.x, y: midY }];

                    const candidates = [shape0, shape1, shape2, shape3];
                    const targetShape = candidates[nextShapeIdx];

                    const finalPoints = targetShape.map(p => ({
                        x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
                        y: Math.round(p.y / GRID_SIZE) * GRID_SIZE
                    }));

                    return { ...c, points: finalPoints };
                }
            });

            return { ...prev, connections: updatedConnections };
        });
    };

    const getPortColor = (portId: string): string | null => {
        if (portId.includes('-fiber-')) {
            try {
                // Find cable to check loose tube settings
                const activeCable = incomingCables.find(c => portId.startsWith(c.id + '-'));
                const parts = portId.split('-fiber-');
                const fiberIndex = parseInt(parts[1]);

                if (!isNaN(fiberIndex)) {
                    if (activeCable) {
                        const looseTubeCount = activeCable.looseTubeCount || 1;
                        const fibersPerTube = Math.ceil(activeCable.fiberCount / looseTubeCount);
                        const pos = fiberIndex % fibersPerTube;
                        return getFiberColor(pos, activeCable.colorStandard);
                    }
                    // Fallback if cable not found
                    return getFiberColor(fiberIndex, 'ABNT');
                }
            } catch (e) { return null; }
        }
        if (portId.includes('spl-')) return '#0f172a'; // Black/Dark for splitter pigtails
        return null;
    };

    const removeConnection = (connId: string) => {
        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.filter(c => c.id !== connId)
        }));
    };

    const handleApply = async () => {
        setIsApplying(true);
        const finalCTO = { ...localCTO, viewState: viewState };
        onSave(finalCTO);
        // Fake delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsApplying(false);
    };

    const handleCloseRequest = () => {
        // Exclude viewState from dirty check
        const stripViewState = (data: CTOData) => {
            const { viewState, ...rest } = data;
            return rest;
        };
        const hasChanges = JSON.stringify(stripViewState(localCTO)) !== JSON.stringify(stripViewState(cto));
        if (hasChanges) setShowCloseConfirm(true);
        else onClose();
    };

    // --- View Centering ---
    const handleCenterView = () => {
        setViewState(getInitialViewState(localCTO));
    };

    const handleSaveAndClose = () => {
        const finalCTO = { ...localCTO, viewState: viewState };

        // SAFEGUARD: Ensure all fusions have a layout entry before saving
        // This prevents "reset to defaults" on next load if valid positions were somehow missing
        if (!finalCTO.layout) finalCTO.layout = {};
        finalCTO.fusions.forEach((f, idx) => {
            if (!finalCTO.layout![f.id]) {
                finalCTO.layout![f.id] = { x: 500, y: 100 + (idx * 50), rotation: 0 };
            }
        });

        onSave(finalCTO);
        onClose();
    };

    // --- Auto Pass-Through Logic ---
    const performAutoSplice = () => {
        if (!autoSourceId || !autoTargetId || autoSourceId === autoTargetId) return;

        const sourceCable = incomingCables.find(c => c.id === autoSourceId);
        const targetCable = incomingCables.find(c => c.id === autoTargetId);
        if (!sourceCable || !targetCable) return;

        setLocalCTO(prev => {
            const count = Math.min(sourceCable.fiberCount, targetCable.fiberCount);
            const newConnections: FiberConnection[] = [];

            const srcTubes = sourceCable.looseTubeCount || 1;
            const srcFPT = Math.ceil(sourceCable.fiberCount / srcTubes);

            for (let i = 0; i < count; i++) {
                const sourceFiberId = `${sourceCable.id}-fiber-${i}`;
                const targetFiberId = `${targetCable.id}-fiber-${i}`;

                // Check latest state from 'prev'
                const isSourceOccupied = prev.connections.some(c => c.sourceId === sourceFiberId || c.targetId === sourceFiberId);
                const isTargetOccupied = prev.connections.some(c => c.sourceId === targetFiberId || c.targetId === targetFiberId);

                if (isSourceOccupied || isTargetOccupied) continue;

                // FIXED: Use reset color logic for auto-splice connections
                const pos = i % srcFPT;
                const color = getFiberColor(pos, sourceCable.colorStandard);

                newConnections.push({
                    id: `conn-pass-${Date.now()}-${i}`,
                    sourceId: sourceFiberId,
                    targetId: targetFiberId,
                    color: color,
                    points: []
                });
            }

            return {
                ...prev,
                connections: [...prev.connections, ...newConnections]
            };
        });

        setIsAutoSpliceOpen(false);
        setAutoSourceId('');
        setAutoTargetId('');
    };

    const getElementCenter = (id: string): { x: number, y: number } | null => {
        const el = document.getElementById(id); // Cables use ID as ID? FiberCableNode doesn't set ID on root div.
        // We need to ensure components have IDs.
        // Wait, FiberCableNode doesn't set ID on the root div!
        // We need to query selector? Or Update Components to set ID?
        // Updating components is risky/forbidden refactor?
        // Note: The Port has ID. The Node has ports.
        // We can find the parent of a port?
        // Better: We can loop through layout keys and try to find element.
        // But we don't know the DOM ID of the Node.

        // WORKAROUND: Use the input port of the cable/splitter/fusion to find the parent node?
        // Cable input port? Cables act as inputs/outputs.
        // Cable usually has fibers. Fiber ID: `${cable.id}-fiber-0`
        // We can find fiber 0, then traverse up to the main container.
        // Or updated Components to have `id={cable.id}`.
        // User said "NO Refactoring existing SVG". But Components are HTML.
        // Adding an ID to a div is safe.

        // Actually, let's try to harvest via the known port IDs which are inside the nodes.
        return null;
    };

    // Instead of complex DOM traversal, I'll update the node components to simply have an ID.
    // This is a minimal, safe change.
    const handleExportPDF = async () => {
        // --- GATEKEEPING: Block Export for Trial or Free Users ---
        // Trial Users have an expiration date. Free Users have 'Plano Grátis'.
        // Only Paid Permanent Users (or maybe we allow Trial but Block? User said "Implement Block")
        // User Request: "se ele importar o projeto... em 15 dias ele vai usar sem pagar". -> BLOCK TRIAL.

        // Logic Update: subscriptionExpiresAt exists for ALL plans.
        // We only want to block if "Plano Grátis".
        // Assuming "Plano Ilimitado" implies paid/allowed.

        const isFree = userPlan === 'Plano Grátis';

        if (isFree) {
            // Trigger Upgrade Modal if passed, or just Alert
            if (onShowUpgrade) {
                onShowUpgrade();
                // Optional: Show specific toast explaining why
                // alert("Recurso disponível apenas para assinantes. (Trial não exporta)");
            } else {
                alert("Exportação disponível apenas para planos pagos.");
            }
            return;
        }

        setExportingType('pdf');
        try {
            // Harvest Port Positions
            const portPositions: Record<string, { x: number, y: number }> = {};
            localCTO.connections.forEach(c => {
                const s = getPortCenter(c.sourceId);
                if (s) portPositions[c.sourceId] = s;
                const t = getPortCenter(c.targetId);
                if (t) portPositions[c.targetId] = t;
            });

            // Harvest Node Metrics (REMOVED - Using accurate math in Exporter now)

            // Prepare Footer Data
            const now = new Date();
            const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const footerData = {
                projectName: projectName || '',
                boxName: localCTO.name,
                date: dateStr,
                lat: localCTO.coordinates.lat.toFixed(6),
                lng: localCTO.coordinates.lng.toFixed(6),
                status: 'Implantada',
                level: 'CTO',
                pole: '-',
                obs: '',
                mapImage: '' // Placeholder
            };

            // Loading Map Image (Static OpenStreetMap/Carto)
            // Using a public static map generator or tile stitching is hard without API.
            // Alternative: Use a generic map marker image or try to fetch a single tile?
            // Tile URL: https://tile.openstreetmap.org/{z}/{x}/{y}.png
            // We need to convert Lat/Lng to Tile X/Y.

            try {
                // Simple APPROXIMATION using a static map service if allowed,
                // OR construct a URL from a free service that returns an image.
                // Mapbox/Google require keys. 
                // Let's use a reliable placeholder or a free static service if one exists.
                // 'https://static-maps.yandex.ru/1.x/?lang=en_US&ll=' + lng + ',' + lat + '&z=16&l=map&size=450,300&pt=' + lng + ',' + lat + ',pm2rdm';
                // Note: Yandex Static Maps is often free/open.

                const lat = localCTO.coordinates.lat;
                const lng = localCTO.coordinates.lng;
                const mapUrl = `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lng},${lat}&z=17&l=sat&size=650,450&pt=${lng},${lat},pm2rdm`;

                // Preload
                const mapBase64 = await preloadImage(mapUrl);
                if (mapBase64) footerData.mapImage = mapBase64;
            } catch (e) {
                console.warn("Could not load static map", e);
            }

            const svg = generateCTOSVG(localCTO, incomingCables, litPorts, portPositions, footerData);
            await exportToPDF(svg, `CTO-${localCTO.name.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error("Export failed", error);
            alert("Failed to export PDF.");
        } finally {
            setExportingType(null);
        }
    };

    const handleExportPNG = async () => {
        // --- GATEKEEPING ---
        // --- GATEKEEPING ---
        // Logic Update: subscriptionExpiresAt exists for ALL plans (Trial and Paid).
        // We only want to block if it's "Plano Grátis" or explicitly a generic restricted trial (if applicable).
        // But "Plano Ilimitado" is paid, so it should pass.

        const isFree = userPlan === 'Plano Grátis';
        // If it's not free, we assume it's paid (Ilimitado, Advanced, etc) or a valid Trial that allows export?
        // Actually, Trial might NOT allow export.
        // But the user has "Plano Ilimitado".

        // Strict check: Block ONLY if Free.
        // If we want to block Trial too, we should check userPlan === 'Trial' or similar.
        // Assuming "Plano Ilimitado" implies paid/allowed.

        if (isFree) {
            if (onShowUpgrade) onShowUpgrade();
            else alert("Exportação disponível apenas para planos pagos.");
            return;
        }

        setExportingType('png');
        try {
            // Harvest Port Positions
            const portPositions: Record<string, { x: number, y: number }> = {};
            localCTO.connections.forEach(c => {
                const s = getPortCenter(c.sourceId);
                if (s) portPositions[c.sourceId] = s;
                const t = getPortCenter(c.targetId);
                if (t) portPositions[c.targetId] = t;
            });

            // Prepare Footer Data
            const now = new Date();
            const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const footerData = {
                projectName: projectName || '',
                boxName: localCTO.name,
                date: dateStr,
                lat: localCTO.coordinates.lat.toFixed(6),
                lng: localCTO.coordinates.lng.toFixed(6),
                status: 'Implantada',
                level: 'CTO',
                pole: '-',
                obs: '',
                mapImage: ''
            };

            try {
                const lat = localCTO.coordinates.lat;
                const lng = localCTO.coordinates.lng;
                const mapUrl = `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lng},${lat}&z=19&l=map&size=450,300&pt=${lng},${lat},pm2rdm`;
                const mapBase64 = await preloadImage(mapUrl);
                if (mapBase64) footerData.mapImage = mapBase64;
            } catch (e) {
                console.warn("Could not load static map", e);
            }

            const svg = generateCTOSVG(localCTO, incomingCables, litPorts, portPositions, footerData);
            await exportToPNG(svg, `CTO-${localCTO.name.replace(/\s+/g, '_')}.png`);
        } catch (error) {
            console.error("Export PNG failed", error);
            alert("Failed to export PNG.");
        } finally {
            setExportingType(null);
        }
    };

    // --- OPTICAL POWER CALCULATION HANDLER ---
    const handleSplitterDoubleClick = (splitterId: string) => {
        console.log("Double click detected on splitter:", splitterId);
        const splitter = localCTO.splitters.find(s => s.id === splitterId);
        if (!splitter) {
            console.error("Splitter not found in localCTO:", splitterId);
            return;
        }

        try {
            // Catalogs Dictionary
            const catalogs = {
                splitters: availableSplitters,
                fusions: availableFusions,
                cables: availableCables,
                olts: availableOLTs
            };

            console.log("Tracing path for:", splitter.name);
            const result = traceOpticalPath(splitterId, cto.id, network, catalogs, localCTO);
            console.log("Trace result:", result);
            setOpticalResult(result);
            setSelectedSplitterName(splitter.name);
            setIsOpticalModalOpen(true);
        } catch (error) {
            console.error("Error calculating optical path:", error);
            alert(`Erro: ${(error as Error).message}`);
        }
    };


    // --- Event Handlers ---

    const handleWindowDragStart = (e: React.MouseEvent) => {
        if (isMaximized) return; // Prevent dragging while maximized
        if ((e.target as HTMLElement).closest('button')) return; // Don't drag if clicking a button
        setDragState({
            mode: 'window',
            startX: e.clientX,
            startY: e.clientY,
            initialWindowPos: { ...windowPos }
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // If we are already dragging something (like a new sticky element), don't start panning!
        if (dragState) return;

        // FUSION TOOL: Create Fusion on Click
        if (isFusionToolActive && e.button === 0) {
            e.stopPropagation();
            createFusionAtCursor(e);
            return;
        }

        // If clicking background, start pan
        if (e.button === 0) { // Left click
            setDragState({
                mode: 'view',
                startX: e.clientX,
                startY: e.clientY
            });
        }
    };

    const handleElementDragStart = useCallback((e: React.MouseEvent, id: string) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (isVflToolActive || isOtdrToolActive || isDeleteMode || isRotateMode || isSmartAlignMode) return;

        // HYBRID INITIAL POS: Use DOM if available to prevent "jumps"
        let initialX = 0;
        let initialY = 0;
        let initialRot = 0;
        const domEl = document.getElementById(id);

        if (domEl) {
            // Read current visual transform
            const style = window.getComputedStyle(domEl);
            const matrix = new WebKitCSSMatrix(style.transform);
            initialX = matrix.m41;
            initialY = matrix.m42;
            initialX = matrix.m41;
            initialY = matrix.m42;

            // Extract rotation from matrix to prevent reset to 0
            // matrix(a, b, c, d, tx, ty)
            // Rotation = atan2(b, a)
            const angle = Math.round(Math.atan2(matrix.m12, matrix.m11) * (180 / Math.PI));
            initialRot = angle;
        } else {
            // Fallback to state
            const l = getLayout(id);
            initialX = l.x;
            initialY = l.y;
            initialRot = l.rotation || 0;
        }

        // Check for mirrored state from storage (DOM doesn't help here easily)
        const storedLayout = localCTORef.current.layout?.[id];
        const isMirrored = storedLayout?.mirrored || false;

        setDragState({
            mode: 'element',
            targetId: id,
            startX: e.clientX,
            startY: e.clientY,
            initialLayout: {
                x: initialX,
                y: initialY,
                rotation: initialRot,
                mirrored: isMirrored
            }
        });
    }, [isVflToolActive, isOtdrToolActive, isDeleteMode, isRotateMode, isSmartAlignMode]);

    const handleDeleteSplitter = useCallback((id: string) => {
        setLocalCTO(prev => {
            const s = prev.splitters.find(x => x.id === id);
            if (!s) return prev;
            const portIds = [s.inputPortId, ...s.outputPortIds];
            return {
                ...prev,
                splitters: prev.splitters.filter(x => x.id !== id),
                connections: prev.connections.filter(c => !portIds.includes(c.sourceId) && !portIds.includes(c.targetId))
            };
        });
    }, []);

    const handleDeleteFusion = useCallback((id: string) => {
        setLocalCTO(prev => {
            const portIds = [`${id}-a`, `${id}-b`];
            return {
                ...prev,
                fusions: prev.fusions.filter(f => f.id !== id),
                connections: prev.connections.filter(c => !portIds.includes(c.sourceId) && !portIds.includes(c.targetId))
            };
        });
    }, []);

    const handleElementAction = useCallback((e: React.MouseEvent, id: string, type: 'splitter' | 'fusion' | 'cable') => {
        e.stopPropagation();
        if (isVflToolActive || isOtdrToolActive) return;

        if (isRotateMode) {
            setLocalCTO(prev => {
                const existingLayout = prev.layout?.[id];
                if (!existingLayout) return prev; // Safety check

                const currentRot = existingLayout.rotation || 0;
                const newRot = (currentRot + 90) % 360;
                return {
                    ...prev,
                    layout: {
                        ...prev.layout,
                        [id]: { ...existingLayout, rotation: newRot }
                    }
                };
            });
        } else if (isDeleteMode) {
            if (type === 'splitter') {
                handleDeleteSplitter(id);
            } else if (type === 'fusion') {
                handleDeleteFusion(id);
            }
            // Cable deletion not requested, but safe to ignore or add later
        }
    }, [isVflToolActive, isOtdrToolActive, isRotateMode, isDeleteMode, handleDeleteSplitter, handleDeleteFusion]);

    const handleMirrorElement = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (isVflToolActive || isOtdrToolActive) return;

        setLocalCTO(prev => {
            let layout = prev.layout?.[id];

            // FALLBACK: If layout is missing (unsaved new cable), recover from DOM
            if (!layout) {
                const domEl = document.getElementById(id);
                if (domEl) {
                    const style = window.getComputedStyle(domEl);
                    const matrix = new WebKitCSSMatrix(style.transform);
                    const currentRot = Math.round(Math.atan2(matrix.m12, matrix.m11) * (180 / Math.PI));
                    layout = {
                        x: matrix.m41,
                        y: matrix.m42,
                        rotation: currentRot,
                        mirrored: false
                    };
                } else {
                    return prev;
                }
            }

            return {
                ...prev,
                layout: {
                    ...prev.layout,
                    [id]: { ...layout, mirrored: !layout.mirrored }
                }
            };
        });
    }, [isVflToolActive, isOtdrToolActive]);

    const handlePortMouseDown = useCallback((e: React.MouseEvent, portId: string) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        // VFL MODE LOGIC
        if (isVflToolActive) {
            onToggleVfl(portId);
            return;
        }

        // OTDR MODE LOGIC
        if (isOtdrToolActive) {
            setOtdrTargetPort(portId);
            return;
        }

        const { x, y } = screenToCanvas(e.clientX, e.clientY);

        // CHECK IF PORT HAS EXISTING CONNECTION
        const existingConn = localCTORef.current.connections.find(c => c.sourceId === portId || c.targetId === portId);

        if (existingConn) {
            // RECONNECT MODE
            const isSource = existingConn.sourceId === portId;
            // We are dragging the 'movingSide', anchoring to the 'fixedPortId'
            setDragState({
                mode: 'reconnect',
                connectionId: existingConn.id,
                fixedPortId: isSource ? existingConn.targetId : existingConn.sourceId,
                movingSide: isSource ? 'source' : 'target',
                startX: e.clientX,
                startY: e.clientY,
                currentMouseX: x,
                currentMouseY: y
            });
        } else {
            // NEW CONNECTION MODE
            setDragState({
                mode: 'connection',
                portId: portId,
                startX: e.clientX,
                startY: e.clientY,
                currentMouseX: x,
                currentMouseY: y
            });
        }
    }, [isVflToolActive, isOtdrToolActive, onToggleVfl, setOtdrTargetPort, viewState]);

    const handlePortMouseLeave = useCallback(() => setHoveredPortId(null), []);

    const handleCableMouseEnter = useCallback((id: string) => onHoverCable && onHoverCable(id), [onHoverCable]);
    const handleCableMouseLeave = useCallback((id: string) => onHoverCable && onHoverCable(null), [onHoverCable]);

    // Optimize handleCableClick explicitly to avoid re-renders during drag
    const smartAlignFnRef = useRef(handleSmartAlignCable);
    useLayoutEffect(() => { smartAlignFnRef.current = handleSmartAlignCable; });

    const handleCableClick = useCallback((e: React.MouseEvent, id: string) => {
        if (isSmartAlignMode) {
            e.stopPropagation();
            smartAlignFnRef.current(id);
            return;
        }
        if (isRotateMode) {
            e.stopPropagation();
            setLocalCTO(prev => {
                const currentRot = prev.layout?.[id]?.rotation || 0;
                const newRot = (currentRot + 90) % 360;
                return {
                    ...prev,
                    layout: {
                        ...prev.layout,
                        [id]: { ...(prev.layout?.[id] || { x: 0, y: 0, rotation: 0 }), rotation: newRot }
                    }
                };
            });
            return;
        }
    }, [isSmartAlignMode, isRotateMode]);

    const handleCableEditClick = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const cable = incomingCables.find(c => c.id === id);
        if (cable) onEditCable(cable);
    }, [incomingCables, onEditCable]);

    const handleRotateElement = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setLocalCTO(prev => {
            let layout = prev.layout?.[id];

            // FALLBACK: If layout is missing (unsaved new cable), recover from DOM
            if (!layout) {
                const domEl = document.getElementById(id);
                if (domEl) {
                    const style = window.getComputedStyle(domEl);
                    const matrix = new WebKitCSSMatrix(style.transform);
                    const currentRot = Math.round(Math.atan2(matrix.m12, matrix.m11) * (180 / Math.PI));
                    layout = {
                        x: matrix.m41,
                        y: matrix.m42,
                        rotation: currentRot
                    };
                } else {
                    return prev;
                }
            }

            const currentRot = layout.rotation || 0;
            const newRot = (currentRot + 90) % 360;
            return {
                ...prev,
                layout: {
                    ...prev.layout,
                    [id]: { ...layout, rotation: newRot }
                }
            };
        });
    }, []);

    const handlePointMouseDown = (e: React.MouseEvent, connId: string, pointIndex: number) => {
        e.stopPropagation();
        if (isVflToolActive || isOtdrToolActive) return;
        setDragState({
            mode: 'point',
            connectionId: connId,
            pointIndex: pointIndex,
            startX: e.clientX,
            startY: e.clientY
        });
    };

    const handleConnectionClick = (e: React.MouseEvent, connId: string) => {
        e.stopPropagation();
        if (isSmartAlignMode) {
            handleSmartAlignConnection(connId);
            return;
        }
        const conn = localCTO.connections.find(c => c.id === connId);
        if (isVflToolActive || isOtdrToolActive) return;
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        const clickPt = { x, y };

        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.map(c => {
                if (c.id !== connId) return c;

                // Calculate Insertion Index to prevent "zig-zag" or line dragging behavior
                const sourcePos = getPortCenter(c.sourceId);
                const targetPos = getPortCenter(c.targetId);

                if (!sourcePos || !targetPos) {
                    const newPoints = c.points ? [...c.points, clickPt] : [clickPt];
                    return { ...c, points: newPoints };
                }

                const currentPoints = c.points || [];
                const fullPath: { x: number, y: number }[] = [sourcePos, ...currentPoints, targetPos];

                let minDistance = Infinity;
                let insertIndex = 0;

                for (let i = 0; i < fullPath.length - 1; i++) {
                    const pStart = fullPath[i];
                    const pEnd = fullPath[i + 1];
                    const dist = getDistanceFromSegment(clickPt, pStart, pEnd);

                    if (dist < minDistance) {
                        minDistance = dist;
                        insertIndex = i;
                    }
                }

                const newPoints = [...currentPoints];
                newPoints.splice(insertIndex, 0, clickPt);

                return { ...c, points: newPoints };
            })
        }));
    };


    // RAF throttling for mouse move
    const rafIdRef = useRef<number | null>(null);

    // OPTIMIZED: Direct DOM Manipulation for smooth 60FPS dragging
    const handleMouseMove = (e: React.MouseEvent) => {
        // Track Cursor for Fusion Ghost
        if (isFusionToolActive) {
            const { x, y } = screenToCanvas(e.clientX, e.clientY);
            // Snap logic for ghost
            const snapX = isSnapping ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
            const snapY = isSnapping ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;
            setCursorPosition({ x: snapX, y: snapY });
        }

        if (!dragState) return;

        // 1. WINDOW DRAG (Standard React State is fine, usually low frequency)
        if (dragState.mode === 'window' && dragState.initialWindowPos) {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            setWindowPos({
                x: dragState.initialWindowPos.x + dx,
                y: dragState.initialWindowPos.y + dy
            });
            return;
        }

        // 2. VIEW PAN (Direct DOM on Container)
        if (dragState.mode === 'view') {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;

            // Update React State immediately for view (it affects all calculations)
            // View panning is less heavy than re-rendering 500 connections individually
            // But we could optimize this too if needed. 
            // For now, let's stick to state for View, as it triggers 'screenToCanvas' recalcs which we need.
            setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setDragState(prev => prev ? ({ ...prev, startX: e.clientX, startY: e.clientY }) : null);
            return;
        }

        // 3. ELEMENT DRAG (Direct DOM)
        if (dragState.mode === 'element' && dragState.targetId && dragState.initialLayout) {
            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;

            let newX = dragState.initialLayout.x + dx;
            let newY = dragState.initialLayout.y + dy;

            if (isSnapping) {
                newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            }

            // A. Move the Element Itself
            const el = document.getElementById(dragState.targetId);
            if (el) {
                const rot = dragState.initialLayout.rotation || 0;
                // FUSION OFFSET FIX REMOVED: Now 1-to-1
                const visualY = newY;

                el.style.transform = `translate(${newX}px, ${visualY}px) rotate(${rot}deg)`;
            }

            // B. Move Connected Cables (Visual Only)
            // We need to find connections attached to this element.
            // This requires some heavy lifting to find ports.
            // STRATEGY: We know the delta (dx, dy). We can shift the endpoints of linked connections.
            // B. Move Connected Cables (Visual Only)
            // Use REF to avoid stale closures during rapid updates
            const deltaX = newX - (localCTORef.current.layout?.[dragState.targetId!]?.x || dragState.initialLayout.x);
            const deltaY = newY - (localCTORef.current.layout?.[dragState.targetId!]?.y || dragState.initialLayout.y);

            localCTORef.current.connections.forEach(conn => {
                // STRICT CHECK: Only move connections that are explicitly attached to the moving element
                const targetIsEl = conn.targetId === dragState.targetId! || conn.targetId.startsWith(dragState.targetId! + '-');
                const sourceIsEl = conn.sourceId === dragState.targetId! || conn.sourceId.startsWith(dragState.targetId! + '-');

                // If neither end is on this element, skip
                if (!targetIsEl && !sourceIsEl) return;

                const pathEl = connectionRefs.current[conn.id];
                if (!pathEl) return;

                // Get current visible points (cached or re-calculated)
                const p1 = getPortCenter(conn.sourceId);
                const p2 = getPortCenter(conn.targetId);
                if (!p1 || !p2) return;

                // Apply Delta to the side that is moving
                const start = sourceIsEl ? { x: p1.x + deltaX, y: p1.y + deltaY } : p1;
                const end = targetIsEl ? { x: p2.x + deltaX, y: p2.y + deltaY } : p2;

                let d = `M ${start.x} ${start.y} `;
                if (conn.points) {
                    conn.points.forEach(p => d += `L ${p.x} ${p.y} `);
                }
                d += `L ${end.x} ${end.y}`;

                pathEl.setAttribute('d', d);
            });

            return;
        }

        // 4. CONNECTION POINT DRAG (Direct DOM)
        if (dragState.mode === 'point' && dragState.connectionId && dragState.pointIndex !== undefined) {
            const { x, y } = screenToCanvas(e.clientX, e.clientY);

            const pathEl = connectionRefs.current[dragState.connectionId];
            if (pathEl) {
                const conn = localCTO.connections.find(c => c.id === dragState.connectionId);
                if (conn) {
                    const p1 = getPortCenter(conn.sourceId);
                    const p2 = getPortCenter(conn.targetId);
                    if (p1 && p2) {
                        let d = `M ${p1.x} ${p1.y} `;
                        conn.points?.forEach((p, i) => {
                            if (i === dragState.pointIndex) {
                                d += `L ${x} ${y} `;
                            } else {
                                d += `L ${p.x} ${p.y} `;
                            }
                        });
                        d += `L ${p2.x} ${p2.y}`;
                        pathEl.setAttribute('d', d);
                    }
                }
            }

            // Also move the handle circle itself
            const dotEl = connectionPointRefs.current[`${dragState.connectionId}-${dragState.pointIndex}`];
            if (dotEl) {
                dotEl.setAttribute('cx', String(x));
                dotEl.setAttribute('cy', String(y));
            }

            return;
        }

        // 5. NEW CONNECTION / RECONNECT (Visual Feedback Line)
        if (dragState.mode === 'connection' || dragState.mode === 'reconnect') {
            let { x, y } = screenToCanvas(e.clientX, e.clientY);
            // Grid Snapping logic...
            x = Math.round(x / GRID_SIZE) * GRID_SIZE;
            y = Math.round(y / GRID_SIZE) * GRID_SIZE;

            if (e.ctrlKey) {
                const originId = dragState.mode === 'connection' ? dragState.portId : dragState.fixedPortId;
                const originPt = originId ? getPortCenter(originId) : null;
                if (originPt) {
                    if (Math.abs(x - originPt.x) > Math.abs(y - originPt.y)) y = originPt.y;
                    else x = originPt.x;
                }
            }

            if (dragLineRef.current) {
                const originId = dragState.mode === 'connection' ? dragState.portId : dragState.fixedPortId;
                const start = originId ? getPortCenter(originId) : { x: 0, y: 0 };
                if (start) {
                    dragLineRef.current.setAttribute('d', `M ${start.x} ${start.y} L ${x} ${y}`);
                    dragLineRef.current.style.display = 'block';
                }
            }
            // Store current mouse for drop logic
            setDragState(prev => prev ? ({ ...prev, currentMouseX: x, currentMouseY: y }) : null);
        }
    };



    const handleMouseUp = (e: React.MouseEvent) => {
        // COMMIT DRAG CHANGES TO STATE
        if (dragState?.mode === 'element' && dragState.targetId && dragState.initialLayout && !dragState.targetId.startsWith('fus-')) {
            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;

            let newX = dragState.initialLayout.x + dx;
            let newY = dragState.initialLayout.y + dy;

            if (isSnapping) {
                newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            }

            setLocalCTO(prev => ({
                ...prev,
                layout: {
                    ...prev.layout,
                    [dragState.targetId!]: {
                        ...dragState.initialLayout!,
                        x: newX,
                        y: newY
                    }
                }
            }));
        } else if (dragState?.mode === 'point' && dragState.connectionId && dragState.pointIndex !== undefined) {
            const { x, y } = screenToCanvas(e.clientX, e.clientY);
            setLocalCTO(prev => ({
                ...prev,
                connections: prev.connections.map(c => {
                    if (c.id !== dragState.connectionId) return c;
                    const newPoints = [...(c.points || [])];
                    newPoints[dragState.pointIndex!] = { x, y };
                    return { ...c, points: newPoints };
                })
            }));
        }

        if (dragLineRef.current) {
            dragLineRef.current.style.display = 'none';
        }

        // Handling New Connection Creation
        if (dragState?.mode === 'connection' && hoveredPortId && dragState.portId) {
            const source = dragState.portId;
            const target = hoveredPortId;

            if (source !== target) {
                const sourceColor = getPortColor(source);
                const targetColor = getPortColor(target);

                let connColor = '#22c55e'; // Default Green
                const isFiber = (id: string) => id.includes('-fiber-');
                const isSplitter = (id: string) => id.includes('spl-');

                if (isFiber(source) && sourceColor) connColor = sourceColor;
                else if (isFiber(target) && targetColor) connColor = targetColor;
                else if (isSplitter(source) || isSplitter(target)) connColor = '#0f172a'; // Neutral if Splitter involved (and not Fiber)
                else if (sourceColor) connColor = sourceColor;
                else if (targetColor) connColor = targetColor;

                const newConn: FiberConnection = {
                    id: `conn-${Date.now()}`,
                    sourceId: source,
                    targetId: target,
                    color: connColor,
                    points: []
                };

                const exists = localCTO.connections.find(c =>
                    (c.sourceId === source && c.targetId === target) ||
                    (c.sourceId === target && c.targetId === source)
                );

                if (!exists) {
                    setLocalCTO(prev => {
                        // CHECK OCCUPANCY (User Request: Don't overwrite if occupied)
                        const isSourceOccupied = prev.connections.some(c => c.sourceId === source || c.targetId === source);
                        const isTargetOccupied = prev.connections.some(c => c.sourceId === target || c.targetId === target);

                        if (isSourceOccupied || isTargetOccupied) {
                            return prev; // Block connection
                        }

                        return {
                            ...prev,
                            connections: [...prev.connections, newConn]
                        };
                    });
                }
            }
        }
        // Handling Reconnection (Move existing fiber)
        else if (dragState?.mode === 'reconnect' && dragState.connectionId) {
            if (hoveredPortId && dragState.fixedPortId) {
                const targetPort = hoveredPortId;
                const fixedPort = dragState.fixedPortId;

                if (targetPort !== fixedPort) {
                    const fixedColor = getPortColor(fixedPort);
                    const targetColor = getPortColor(targetPort);

                    let newColor = '#22c55e';
                    const isFiber = (id: string) => id.includes('-fiber-');

                    if (isFiber(fixedPort) && fixedColor) newColor = fixedColor;
                    else if (isFiber(targetPort) && targetColor) newColor = targetColor;
                    else if (fixedColor) newColor = fixedColor;
                    else if (targetColor) newColor = targetColor;

                    setLocalCTO(prev => {
                        // CHECK OCCUPANCY for Target (User Request: Don't overwrite)
                        // Ignore current connection ID since we are moving IT.
                        const isTargetOccupied = prev.connections.some(c =>
                            c.id !== dragState.connectionId &&
                            (c.sourceId === targetPort || c.targetId === targetPort)
                        );

                        if (isTargetOccupied) {
                            return prev; // Block move
                        }

                        // Remove old version of self (implicitly done by map or replace)
                        // Actually original logic filtered 'otherConns'.
                        // We keep 'otherConns' (everyone else)
                        const otherConns = prev.connections.filter(c => c.id !== dragState.connectionId);

                        const updatedMyConn = prev.connections.find(c => c.id === dragState.connectionId);
                        if (!updatedMyConn) return prev;

                        const newMyConn = { ...updatedMyConn };
                        if (dragState.movingSide === 'source') {
                            newMyConn.sourceId = targetPort;
                        } else {
                            newMyConn.targetId = targetPort;
                        }
                        newMyConn.color = newColor;

                        return {
                            ...prev,
                            connections: [...otherConns, newMyConn]
                        };
                    });
                }
            } else if (!hoveredPortId) {
                // Disconnect (delete connection) if dropped in empty space
                removeConnection(dragState.connectionId);
            }
        }
        // Handling FUSION DROP ON FIBER (Auto-Splice)
        else if (dragState?.mode === 'element' && dragState.targetId?.startsWith('fus-')) {
            const fusionId = dragState.targetId;

            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;

            // RAW Coordinates (for magnetic detection)
            const rawX = dragState.initialLayout!.x + dx;
            const rawY = dragState.initialLayout!.y + dy;

            // Default to Grid Snap (if enabled)
            let newX = rawX;
            let newY = rawY;
            if (isSnapping) {
                newX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
                newY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
            }

            // CHECK IF FUSION IS ALREADY CONNECTED
            const isAlreadyConnected = localCTO.connections.some(c =>
                c.sourceId === `${fusionId}-a` || c.targetId === `${fusionId}-a` ||
                c.sourceId === `${fusionId}-b` || c.targetId === `${fusionId}-b`
            );

            if (!isAlreadyConnected) {

                // USE RAW FOR DETECTION (plus center offset +6)
                const fusionCenter = { x: rawX + 12, y: rawY + 6 };

                // FIND CLOSEST CONNECTION (PRECISION UPDATE)
                let closestConnection: FiberConnection | null = null;
                let minDistance = 5; // Tolerance - Reduced from 20 to 5 per user request

                localCTO.connections.forEach(conn => {
                    if (conn.sourceId.startsWith(fusionId) || conn.targetId.startsWith(fusionId)) return;

                    const p1 = getPortCenter(conn.sourceId);
                    const p2 = getPortCenter(conn.targetId);
                    if (!p1 || !p2) return;

                    const points = [p1, ...(conn.points || []), p2];
                    for (let i = 0; i < points.length - 1; i++) {
                        const dist = getDistanceFromSegment(fusionCenter, points[i], points[i + 1]);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestConnection = conn;
                        }
                    }
                });

                if (closestConnection) {
                    const hitConnection = closestConnection as FiberConnection;

                    // SNAP TO FIBER LOGIC
                    const p1_seg = getPortCenter(hitConnection.sourceId);
                    const p2_seg = getPortCenter(hitConnection.targetId);

                    if (p1_seg && p2_seg) {
                        const points = [p1_seg, ...(hitConnection.points || []), p2_seg];
                        for (let i = 0; i < points.length - 1; i++) {
                            if (getDistanceFromSegment(fusionCenter, points[i], points[i + 1]) < minDistance + 1) {
                                // Project onto segment
                                const A = fusionCenter.x - points[i].x;
                                const B = fusionCenter.y - points[i].y;
                                const C = points[i + 1].x - points[i].x;
                                const D = points[i + 1].y - points[i].y;
                                const dot = A * C + B * D;
                                const len_sq = C * C + D * D;
                                let param = -1;
                                if (len_sq !== 0) param = dot / len_sq;

                                let snapX, snapY;
                                if (param < 0) { snapX = points[i].x; snapY = points[i].y; }
                                else if (param > 1) { snapX = points[i + 1].x; snapY = points[i + 1].y; }
                                else {
                                    snapX = points[i].x + param * C;
                                    snapY = points[i].y + param * D;
                                }

                                newX = snapX - 12;
                                newY = snapY - 6;
                                break;
                            }
                        }
                    }

                    const portA = `${fusionId}-a`;
                    const portB = `${fusionId}-b`;

                    const conn1: FiberConnection = {
                        id: `conn-${Date.now()}-1`,
                        sourceId: hitConnection.sourceId,
                        targetId: portA,
                        color: hitConnection.color,
                        points: []
                    };

                    const conn2: FiberConnection = {
                        id: `conn-${Date.now()}-2`,
                        sourceId: portB,
                        targetId: hitConnection.targetId,
                        color: hitConnection.color,
                        points: []
                    };

                    // CALCULATE ROTATION
                    let rotation = 0;
                    if (p1_seg && p2_seg) {
                        const points = [p1_seg, ...(hitConnection.points || []), p2_seg];
                        for (let i = 0; i < points.length - 1; i++) {
                            const dx = points[i + 1].x - points[i].x;
                            const dy = points[i + 1].y - points[i].y;
                            if (Math.abs(dx) > Math.abs(dy)) rotation = dx > 0 ? 0 : 180;
                            else rotation = dy > 0 ? 90 : 270;
                            if (getDistanceFromSegment(fusionCenter, points[i], points[i + 1]) < 20) break;
                        }
                    }

                    // SMART VERTICAL SNAP (Highest Priority for Stacking)
                    // Apply after Fiber Snap to ensure we align X with neighbors even if Fiber Snap suggests otherwise.
                    // This allows "sliding" along horizontal fibers to match stack.
                    const VERTICAL_SNAP_THRESHOLD = 10;
                    const closestVerticalFusion = localCTO.fusions.find(f => {
                        if (f.id === fusionId) return false;
                        const layout = localCTO.layout[f.id];
                        if (!layout) return false;
                        return Math.abs(layout.x - newX) < VERTICAL_SNAP_THRESHOLD;
                    });

                    if (closestVerticalFusion) {
                        const layout = localCTO.layout[closestVerticalFusion.id];
                        if (layout) newX = layout.x; // Force X alignment
                    }

                    setLocalCTO(prev => ({
                        ...prev,
                        layout: {
                            ...prev.layout,
                            [fusionId]: {
                                ...prev.layout![fusionId],
                                rotation: rotation,
                                x: newX,
                                y: newY
                            }
                        },
                        connections: [
                            ...prev.connections.filter(c =>
                                c.id !== hitConnection.id &&
                                c.sourceId !== portA && c.targetId !== portA &&
                                c.sourceId !== portB && c.targetId !== portB
                            ),
                            conn1,
                            conn2
                        ]
                    }));
                } else {
                    // NO CONNECTION HIT

                    // Vertical Snap for free move
                    const VERTICAL_SNAP_THRESHOLD = 10;
                    const closestVerticalFusion = localCTO.fusions.find(f => {
                        if (f.id === fusionId) return false;
                        const layout = localCTO.layout[f.id];
                        if (!layout) return false;
                        return Math.abs(layout.x - newX) < VERTICAL_SNAP_THRESHOLD;
                    });

                    if (closestVerticalFusion) {
                        const layout = localCTO.layout[closestVerticalFusion.id];
                        if (layout) newX = layout.x;
                    }

                    setLocalCTO(prev => ({
                        ...prev,
                        layout: {
                            ...prev.layout,
                            [fusionId]: {
                                ...prev.layout![fusionId],
                                x: newX,
                                y: newY
                            }
                        }
                    }));
                }
            } else {
                // NO CONNECTION HIT - Just update position (with Grid/Vertical Snap only)
                // Logic here was missing in previous simplification implicitly, 
                // but `if (closestConnection)` block handles the SNAP. 
                // If NO snap, we still need to update position in the ELSE block or outside.
                // The original code seemingly ONLY updated position inside the `if (closestConnection)`.
                // Wait, if no connection is hit, the fusion should still move!
                // Looking at original code... ah, the `setLocalCTO` for pure move was seemingly missing or implicit?
                // No, line 2650+ handles standard dragging.
                // BUT here we are in `dragState.mode === 'element' && targetId.startswith('fus-')`.
                // This block handles AUTO-SPLICE.
                // If we DO NOT find a connection... do we fall back to normal drag?
                // Currently, if no `closestConnection` found, nothing happens inside this block.
                // BUT `handleMouseUp` usually falls through?
                // Let's check the logic flow.
                // The block `else if (dragState?.mode === 'element' ...)` is exclusive.
                // So if we don't find a connection, we MUST update the position manually here or it won't move.

                // Re-apply Vertical Snap for the free-floating case too
                const VERTICAL_SNAP_THRESHOLD = 10;
                const closestVerticalFusion = localCTO.fusions.find(f => {
                    if (f.id === fusionId) return false;
                    const layout = localCTO.layout[f.id];
                    if (!layout) return false;
                    return Math.abs(layout.x - newX) < VERTICAL_SNAP_THRESHOLD;
                });

                if (closestVerticalFusion) {
                    const layout = localCTO.layout[closestVerticalFusion.id];
                    if (layout) newX = layout.x;
                }

                setLocalCTO(prev => ({
                    ...prev,
                    layout: {
                        ...prev.layout,
                        [fusionId]: {
                            ...prev.layout![fusionId],
                            x: newX,
                            y: newY
                        }
                    }
                }));
            }
        }

        setDragState(null);
    };

    // --- GLOBAL EVENT LISTENERS FOR DRAG & TOOLS ---
    useEffect(() => {
        if (dragState || isFusionToolActive) {
            const onMove = (e: MouseEvent) => handleMouseMove(e as unknown as React.MouseEvent);
            const onUp = (e: MouseEvent) => handleMouseUp(e as unknown as React.MouseEvent);

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);

            return () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
        }
    }, [dragState, isFusionToolActive, handleMouseMove, handleMouseUp]);

    // Initialize local state from prop
    useEffect(() => {
        // MIGRATION: Auto-update legacy splitter connection colors (Gray -> Black)
        const migratedConnections = cto.connections.map(c => {
            if ((c.sourceId.includes('spl-') || c.targetId.includes('spl-')) && c.color === '#94a3b8') {
                return { ...c, color: '#0f172a' };
            }
            return c;
        });

        // Ensure we initialize viewState if saved, or calc default
        let vs = cto.viewState;
        if (!vs) {
            vs = getInitialViewState({ ...cto, connections: migratedConnections });
        }

        setLocalCTO({
            ...cto,
            connections: migratedConnections,
            viewState: vs
        });
        setViewState(vs);
    }, [cto]);

    const removePoint = (e: React.MouseEvent, connId: string, pointIndex: number) => {
        e.stopPropagation();
        if (isVflToolActive) return;
        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.map(c => {
                if (c.id !== connId || !c.points) return c;
                const newPoints = c.points.filter((_, i) => i !== pointIndex);
                return { ...c, points: newPoints };
            })
        }));
    };

    const handlePathMouseDown = (e: React.MouseEvent, connId: string) => {
        if (e.button !== 0) return;
        // Fix: If Fusion Tool is active, let the event bubble to container to create fusion (auto-splice)
        // Do not stop propagation.
        if (isFusionToolActive) return;

        e.stopPropagation(); // prevent window drag
        e.preventDefault();  // prevent text selection

        if (isVflToolActive || isOtdrToolActive || isSmartAlignMode) return;

        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        const clickPt = { x, y };

        // 1. Calculate New State
        let newConnections = [...localCTORef.current.connections];
        let insertedPointIndex = -1;

        newConnections = newConnections.map(c => {
            if (c.id !== connId) return c;

            const sourcePos = getPortCenter(c.sourceId);
            const targetPos = getPortCenter(c.targetId);
            if (!sourcePos || !targetPos) return c;

            const currentPoints = c.points || [];
            // Strategy: Find closest segment
            const fullPath = [sourcePos, ...currentPoints, targetPos];
            let minDistance = Infinity;
            let insertIndex = 0;

            for (let i = 0; i < fullPath.length - 1; i++) {
                const pStart = fullPath[i];
                const pEnd = fullPath[i + 1];
                const dist = getDistanceFromSegment(clickPt, pStart, pEnd);
                if (dist < minDistance) {
                    minDistance = dist;
                    insertIndex = i;
                }
            }

            const newPoints = [...currentPoints];
            newPoints.splice(insertIndex, 0, clickPt);
            insertedPointIndex = insertIndex;
            return { ...c, points: newPoints };
        });

        // 2. Optimistic Update (Manual Ref Patch)
        // This makes `handleMouseMove` see the point INSTANTLY before React renders
        localCTORef.current.connections = newConnections;

        // 3. Trigger React Update
        setLocalCTO(prev => ({ ...prev, connections: newConnections }));

        // 4. Start Dragging Immediately
        if (insertedPointIndex !== -1) {
            setDragState({
                mode: 'point',
                connectionId: connId,
                pointIndex: insertedPointIndex,
                startX: e.clientX,
                startY: e.clientY
            });
        }
    };

    const handleAddSplitter = (e: React.MouseEvent, catalogItem: SplitterCatalogItem) => {
        const id = `spl-${Date.now()}`;
        const count = catalogItem.outputs;

        const outputIds: string[] = [];
        for (let i = 0; i < count; i++) {
            outputIds.push(`${id}-out-${i}`);
        }

        const newSplitter: Splitter = {
            id,
            name: `${localCTO.splitters.length + 1}`,
            type: catalogItem.name,
            inputPortId: `${id}-in`,
            outputPortIds: outputIds
        };

        const { x: rx, y: ry } = screenToCanvas(e.clientX, e.clientY);

        // Center the splitter under cursor
        // Logic matches SplitterNode sizing
        const width = count * 12;
        const height = 72;
        const size = Math.max(width, height);
        const halfSize = size / 2;

        const x = Math.round((rx - halfSize) / GRID_SIZE) * GRID_SIZE;
        const y = Math.round((ry - halfSize) / GRID_SIZE) * GRID_SIZE;
        const initialLayout = { x, y, rotation: 270 };

        setLocalCTO(prev => ({
            ...prev,
            splitters: [...prev.splitters, newSplitter],
            layout: { ...prev.layout, [id]: initialLayout }
        }));

        // START DRAGGING IMMEDIATELY (UX REQUEST: Sticky Drag)
        setDragState({
            mode: 'element',
            targetId: id,
            startX: e.clientX,
            startY: e.clientY,
            initialLayout: initialLayout
        });
    };



    const handleAddFusion = (e: React.MouseEvent) => {
        e.stopPropagation();

        // LOGIC UPDATE: Check for Fusion Types
        const fusionTypes = availableFusions.length > 0 ? availableFusions : (network.fusionTypes || []);

        if (fusionTypes.length > 1) {
            setShowFusionTypeModal(true);
        } else {
            // Default behavior: Activate tool immediately
            const defaultType = fusionTypes.length === 1 ? fusionTypes[0].id : null;
            activateFusionTool(defaultType);
        }
    };

    const activateFusionTool = (typeId: string | null) => {
        setIsFusionToolActive(true);
        setSelectedFusionTypeId(typeId);
        // Reset others
        setIsDeleteMode(false);
        setIsRotateMode(false);
        setIsSmartAlignMode(false);
        setIsVflToolActive(false);
        setIsOtdrToolActive(false);
        setShowFusionTypeModal(false);
    };

    const createFusionAtCursor = (e: React.MouseEvent) => {
        // Helper to resolve fiber color from Port ID
        const resolvePortColor = (portId: string): string | null => {
            // Priority 1: Fiber Port
            const match = portId.match && portId.match(/(.*)-fiber-(\d+)$/);
            if (match) {
                const cableId = match[1];
                const fiberGlobalIndex = parseInt(match[2], 10);
                const cable = incomingCables.find(c => c.id === cableId);
                if (cable) {
                    const looseTubeCount = cable.looseTubeCount || 1;
                    const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);
                    const positionInTube = fiberGlobalIndex % fibersPerTube;
                    return getFiberColor(positionInTube, cable.colorStandard);
                }
            }
            // Priority 2: Splitter Port (Neutral)
            if (portId.includes('spl-')) {
                return '#0f172a'; // Neutral Color
            }
            return null;
        };

        const id = `fus-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        // Note: FusionPoint interface might not have 'typeId'. Checking types.ts previously.
        // FusionPoint { id, name, type?: 'generic' | 'tray' }
        // It seems 'type' is enum, but user wants to use configured types.
        // If `network.fusionTypes` exists, we should probably store the ID reference?
        // User Requirements: "modal com os tipos fusão".
        // Let's store it in `catalogId` or `type`? 
        // Looking at types.ts: FusionPoint has type?: 'generic'|'tray'.
        // PoleData has catalogId. CableData has catalogId.
        // FusionPoint interface in types.ts (Line 54) seems limited.
        // "type?: 'generic' | 'tray'".
        // However, I must not break code. I can add a new property if TS allows or coerce it.
        // Or maybe the user *means* `type` as the name?
        // The user said: "modal com os tipos fusão".
        // If I look at FusionType interface: { id, name, attenuation }.
        // Use `catalogId` is safe pattern if I can extend the type, but I can't change types.ts easily without verify.
        // Let's assume for now we use `type` field if compatible, or just add `catalogId` loosely (JS).
        // But TS will complain.
        // Let's check `FusionPoint` in types.ts line 54 again.
        // export interface FusionPoint { id: string; name: string; type?: 'generic'|'tray'; }
        // It is restrictive.
        // I will suppress TS error for now or abuse `type` if string. 
        // Actually `type` is string literal union? No, line 57 says `type?: 'generic' | 'tray'`.
        // Wait, I should double check types.ts.
        // Accessing memory: Line 57: `type?: 'generic' | 'tray';`
        // So I cannot store the ID there easily. 
        // I might need to cast or add a property.
        // "NÃO quebrar código existente".
        // I will add `catalogId` and cast as `any` when creating if necessary, or just rely on the name matching?
        // Usually `catalogId` is the pattern.
        // I'll add `catalogId` to the object and `as any` to bypass strict check for this feature.

        const newFusion: FusionPoint & { catalogId?: string } = {
            id,
            name: `F-${localCTO.fusions.length + 1}`,
            type: 'generic' // Default valid value
        };

        if (selectedFusionTypeId) {
            newFusion.catalogId = selectedFusionTypeId;
        }

        const { x: rx, y: ry } = screenToCanvas(e.clientX, e.clientY);

        // RAW Calculation for Detection
        const rawX = rx - 12;
        const rawY = ry - 6;

        // Default Snapping
        let x = isSnapping ? Math.round(rx / GRID_SIZE) * GRID_SIZE : rx;
        let y = isSnapping ? Math.round(ry / GRID_SIZE) * GRID_SIZE : ry;
        x -= 12;
        y -= 6;

        // SMART VERTICAL SNAP (User Request: Align with existing fusions)
        // Check if we are close to another fusion's vertical axis
        const VERTICAL_SNAP_THRESHOLD = 10;
        const closestVerticalFusion = localCTO.fusions.find(f => {
            // Compare with fusion's layout X
            const layout = localCTO.layout[f.id];
            if (!layout) return false;
            return Math.abs(layout.x - x) < VERTICAL_SNAP_THRESHOLD;
        });

        if (closestVerticalFusion) {
            const layout = localCTO.layout[closestVerticalFusion.id];
            if (layout) {
                x = layout.x; // Snap to exact X of usage
            }
        }

        const initialLayout = { x, y, rotation: 0 };

        setLocalCTO(prev => {
            // AUTO-SPLICE LOGIC ON CREATION (Using RAW coordinates)
            // Center based on visual mouse position (raw)
            const fusionCenter = { x: rawX + 12, y: rawY + 6 };
            const SNAP_RADIUS = 20; // Increased tolerance (was 10)

            let intersectedConnection: FiberConnection | null = null;
            let splitPoint: { x: number, y: number } | null = null;
            let minDistance = SNAP_RADIUS; // Track best distance

            // Helper to get point geometry (Duplicated from handleMouseUp logic implicitly)
            const getPortCenterHelper = (portId: string, currentLayout: Record<string, ElementLayout>) => {
                return getPortCenter(portId);
            };

            // PASS 1: Find Closest Connection
            for (const conn of prev.connections) {
                // Ignore if not a fiber/cable connection (e.g. dont splice internal links if any)
                if (conn.sourceId.startsWith('fus-') || conn.targetId.startsWith('fus-')) continue;

                const p1 = getPortCenter(conn.sourceId);
                const p2 = getPortCenter(conn.targetId);

                if (p1 && p2) {
                    const points = [p1, ...(conn.points || []), p2];
                    for (let i = 0; i < points.length - 1; i++) {
                        const dist = getDistanceFromSegment(fusionCenter, points[i], points[i + 1]);
                        if (dist < minDistance) {
                            minDistance = dist;
                            intersectedConnection = conn;
                            // We don't break here, we look for BETTER matches
                        }
                    }
                }
            }

            // PASS 2: Calculate Projection on Winner
            if (intersectedConnection) {
                const conn = intersectedConnection as FiberConnection;
                const p1 = getPortCenter(conn.sourceId);
                const p2 = getPortCenter(conn.targetId);

                if (p1 && p2) {
                    const points = [p1, ...(conn.points || []), p2];
                    for (let i = 0; i < points.length - 1; i++) {
                        // Re-verify segment for projection (add tolerance for float)
                        if (getDistanceFromSegment(fusionCenter, points[i], points[i + 1]) <= minDistance + 0.1) {
                            // PROJECT
                            const A = fusionCenter.x - points[i].x;
                            const B = fusionCenter.y - points[i].y;
                            const C = points[i + 1].x - points[i].x;
                            const D = points[i + 1].y - points[i].y;
                            const dot = A * C + B * D;
                            const len_sq = C * C + D * D;
                            let param = -1;
                            if (len_sq !== 0) param = dot / len_sq;

                            let snapX, snapY;
                            if (param < 0) { snapX = points[i].x; snapY = points[i].y; }
                            else if (param > 1) { snapX = points[i + 1].x; snapY = points[i + 1].y; }
                            else {
                                snapX = points[i].x + param * C;
                                snapY = points[i].y + param * D;
                            }

                            // Override default grid snap with fiber snap
                            let rx = snapX - 12;
                            let ry = snapY - 6;

                            initialLayout.x = rx;
                            initialLayout.y = ry;

                            // Rotational Logic
                            const dx = points[i + 1].x - points[i].x;
                            const dy = points[i + 1].y - points[i].y;
                            if (Math.abs(dx) > Math.abs(dy)) initialLayout.rotation = dx > 0 ? 0 : 180;
                            else initialLayout.rotation = dy > 0 ? 90 : 270;

                            splitPoint = { x: snapX, y: snapY };
                            break;
                        }
                    }
                }
            }

            let updatedConnections = [...prev.connections];
            const newFusions = [...prev.fusions, newFusion];

            if (intersectedConnection && splitPoint) {
                // SPLICE IT
                const connToSplit = intersectedConnection;
                // 1. Remove original
                updatedConnections = updatedConnections.filter(c => c.id !== connToSplit.id);

                // 2. Create Left Side (Source -> Fusion A)
                updatedConnections.push({
                    id: `conn-${Date.now()}-1`,
                    sourceId: connToSplit.sourceId,
                    targetId: `${id}-a`,
                    color: resolvePortColor(connToSplit.sourceId) || connToSplit.color,
                    points: []
                });

                // 3. Create Right Side (Fusion B -> Target)
                updatedConnections.push({
                    id: `conn-${Date.now()}-2`,
                    sourceId: `${id}-b`,
                    targetId: connToSplit.targetId,
                    color: resolvePortColor(connToSplit.targetId) || connToSplit.color,
                    points: []
                });
            }

            // RE-APPLY VERTICAL SNAP (Highest Priority for Stacking)
            // Ensure creation also respects vertical alignment even after fiber snap
            const VERTICAL_SNAP_THRESHOLD = 10;
            const closestVerticalFusion = prev.fusions.find(f => {
                const layout = prev.layout[f.id];
                if (!layout) return false;
                return Math.abs(layout.x - initialLayout.x) < VERTICAL_SNAP_THRESHOLD;
            });

            if (closestVerticalFusion) {
                const layout = prev.layout[closestVerticalFusion.id];
                if (layout) initialLayout.x = layout.x;
            }

            return {
                ...prev,
                fusions: newFusions,
                connections: updatedConnections,
                layout: { ...prev.layout, [id]: initialLayout }
            };
        });
    };




    const handleWheel = (e: React.WheelEvent) => {
        const scale = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(0.1, viewState.zoom * scale), 4);
        setViewState(prev => ({ ...prev, zoom: newZoom }));
    };

    const handleOtdrSubmit = () => {
        if (!otdrTargetPort || !otdrDistance) return;
        const dist = parseFloat(otdrDistance);
        if (isNaN(dist)) return;

        onOtdrTrace(otdrTargetPort, dist);
        setOtdrTargetPort(null);
        setIsOtdrToolActive(false);
    };

    // Clear cache AND force update on layout change to ensure connections sync with new DOM transforms
    useLayoutEffect(() => {
        portCenterCache.current = {};
        containerRectCache.current = null;
        // Force re-render specifically when layout changes (rotation/mirror) so getPortCenter reads updated DOM
        // This fixes the "delay" or "stale line" issue when rotating elements.
        setForceUpdate(n => n + 1);
    }, [viewState, localCTO.layout, localCTO.splitters, localCTO.fusions]);

    return (
        <div
            className={`fixed z-[2000] ${!dragState || dragState.mode !== 'window' ? 'transition-all duration-300' : ''} ${isMaximized ? 'inset-4 w-auto h-auto' : ''}`}
            style={isMaximized ? {} : { left: windowPos.x, top: windowPos.y }}
        >
            {dragState && (
                <style>{`
                    body, body * { cursor: grabbing !important; }
                    ${dragState.targetId ? `[id="${dragState.targetId}"] { pointer-events: none !important; }` : ''}
                `}</style>
            )}
            <div
                onContextMenu={(e) => e.preventDefault()}
                className={`cto-editor-container relative ${isMaximized ? 'w-full h-full' : 'w-[1100px] h-[750px]'} bg-white dark:bg-slate-900 rounded-xl border-[1px] border-slate-300 dark:border-slate-600 shadow-sm flex flex-col overflow-hidden ${isVflToolActive || isOtdrToolActive || isSmartAlignMode || isRotateMode || isDeleteMode ? 'cursor-crosshair' : ''}`}
            >

                {/* Toolbar / Draggable Header */}
                <div
                    className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col shrink-0 z-50 cursor-move"
                    onMouseDown={handleWindowDragStart}
                >
                    {/* Line 1: Title and Main Actions */}
                    <div className="h-14 flex items-center justify-between px-6">
                        <div className="flex items-center gap-4 pointer-events-none min-w-0 flex-1">
                            <h2 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2 whitespace-nowrap truncate min-w-0">
                                <Box className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
                                <span className="truncate">{t('splicing_title', { name: cto.name })}</span>
                            </h2>
                        </div>
                        <div className="flex gap-1 pointer-events-auto items-center">
                            <button
                                onClick={toggleMaximize}
                                title={isMaximized ? t('restore') : t('maximize')}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                            >
                                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                            </button>
                            <button onClick={handleCloseRequest} title={t('cancel')} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Line 2: All Tools and Exports */}
                    <div className="h-12 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                        <div className="flex gap-1.5 pointer-events-auto items-center">

                            {/* GROUP 1: EDIT MODES */}
                            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-300 dark:border-slate-600">
                                <button
                                    onClick={() => { setIsRotateMode(!isRotateMode); setIsDeleteMode(false); setIsVflToolActive(false); setIsOtdrToolActive(false); setIsSmartAlignMode(false); setIsFusionToolActive(false); }}
                                    className={`p-1.5 rounded border transition ${isRotateMode ? 'bg-sky-500 border-sky-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                    title={t('rotate_mode') || "Rotate Mode"}
                                >
                                    <RotateCw className={`w-4 h-4 ${isRotateMode ? 'animate-spin-slow' : ''}`} />
                                </button>
                                <button
                                    onClick={() => { setIsDeleteMode(!isDeleteMode); setIsRotateMode(false); setIsVflToolActive(false); setIsOtdrToolActive(false); setIsSmartAlignMode(false); setIsFusionToolActive(false); }}
                                    className={`p-1.5 rounded border transition ${isDeleteMode ? 'bg-red-500 border-red-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                    title="Delete Mode"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* GROUP 2: CREATION */}
                            <div className="flex items-center gap-1.5 px-2 border-r border-slate-300 dark:border-slate-600">
                                <button
                                    onClick={() => setShowSplitterDropdown(true)}
                                    className={`p-1.5 rounded border transition ${showSplitterDropdown ? 'bg-sky-500 border-sky-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                    title={t('splitters')}
                                >
                                    <Triangle className="w-4 h-4 -rotate-90" />
                                </button>
                                <button
                                    onClick={handleAddFusion}
                                    title={t('add_fusion')}
                                    className={`p-1.5 rounded border transition ${isFusionToolActive ? 'bg-yellow-500 border-yellow-600 text-white shadow-sm ring-2 ring-yellow-400' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                >
                                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="6" stroke="currentColor" fill="none" />
                                        <circle cx="6" cy="12" r="3" fill="currentColor" stroke="none" />
                                        <circle cx="18" cy="12" r="3" fill="currentColor" stroke="none" />
                                    </svg>
                                </button>
                            </div>

                            {/* GROUP 3: CONNECTIONS */}
                            <div className="flex items-center gap-1.5 px-2 border-r border-slate-300 dark:border-slate-600">
                                <button
                                    onClick={() => setIsAutoSpliceOpen(true)}
                                    title={t('auto_splice')}
                                    className={`p-1.5 rounded border transition ${isAutoSpliceOpen ? 'bg-sky-500 border-sky-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                </button>
                                <button

                                    onClick={() => { setIsSmartAlignMode(!isSmartAlignMode); setIsVflToolActive(false); setIsOtdrToolActive(false); setIsRotateMode(false); setIsDeleteMode(false); setIsFusionToolActive(false); }}
                                    className={`p-1.5 rounded border transition ${isSmartAlignMode ? 'bg-amber-500 border-amber-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                    title={t('smart_align')}
                                >
                                    <AlignCenter className={`w-4 h-4 ${isSmartAlignMode ? 'fill-white animate-pulse' : ''}`} />
                                </button>

                                <button
                                    onClick={() => {
                                        if (window.confirm(t('clear_connections_confirm'))) {
                                            setLocalCTO(prev => ({ ...prev, connections: [] }));
                                        }
                                    }}
                                    className="p-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-red-500 rounded hover:bg-red-50 transition"
                                    title={t('reset_connections')}
                                >
                                    <Eraser className="w-4 h-4" />
                                </button>
                            </div>

                            {/* GROUP 4: ANALYSIS */}
                            <div className="flex items-center gap-1.5 px-2 border-r border-slate-300 dark:border-slate-600">
                                <button

                                    onClick={() => { setIsVflToolActive(!isVflToolActive); setIsOtdrToolActive(false); setIsRotateMode(false); setIsDeleteMode(false); setIsSmartAlignMode(false); setIsFusionToolActive(false); }}
                                    className={`p-1.5 rounded border transition ${isVflToolActive ? 'bg-red-600 border-red-700 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                    title={t('tool_vfl')}
                                >
                                    <Flashlight className={`w-4 h-4 ${isVflToolActive ? 'fill-white animate-pulse' : ''}`} />
                                </button>
                                <button

                                    onClick={() => { setIsOtdrToolActive(!isOtdrToolActive); setIsVflToolActive(false); setIsSmartAlignMode(false); setIsRotateMode(false); setIsDeleteMode(false); setIsFusionToolActive(false); }}
                                    className={`p-1.5 rounded border transition ${isOtdrToolActive ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                    title="OTDR Trace"
                                >
                                    <Ruler className="w-4 h-4" />
                                </button>
                            </div>

                            {/* GROUP 5: VIEW */}
                            <div className="flex items-center gap-1.5 pl-2">
                                <button
                                    onClick={() => setIsSnapping(!isSnapping)}
                                    className={`p-1.5 rounded border transition ${isSnapping ? 'bg-sky-500 border-sky-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                    title="Snap to Grid"
                                >
                                    <Magnet className="w-4 h-4" />
                                </button>
                            </div>

                        </div>

                        <div className="flex gap-2 pointer-events-auto items-center">
                            <button onClick={handleExportPNG} disabled={!!exportingType} className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded flex items-center gap-1.5 text-[11px] border border-slate-300 dark:border-slate-600 transition">
                                {exportingType === 'png' ? <span className="animate-spin w-3 h-3 border-2 border-slate-400 border-t-slate-800 rounded-full"></span> : <ImageIcon className="w-3.5 h-3.5" />}
                                PNG
                            </button>

                            <button onClick={handleExportPDF} disabled={!!exportingType} className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded flex items-center gap-1.5 text-[11px] border border-slate-300 dark:border-slate-600 transition">
                                {exportingType === 'pdf' ? <span className="animate-spin w-3 h-3 border-2 border-slate-400 border-t-slate-800 rounded-full"></span> : <FileDown className="w-3.5 h-3.5" />}
                                PDF
                            </button>

                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 mx-1" />

                            <button
                                onClick={handleOpenProperties}
                                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title={t('properties')}
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-[#E6E6E6] dark:bg-slate-950 relative overflow-hidden"
                    style={{ cursor: isVflToolActive || isOtdrToolActive ? 'cursor-crosshair' : 'default' }}
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                >
                    {/* LOADING OVERLAY - Masks initial layout calculation */}
                    {!isContentReady && (
                        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-bl-xl">
                            <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-3" />
                            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm animate-pulse">{t('loading_diagram') || 'Carregando diagrama...'}</p>
                        </div>
                    )}

                    {/* FUSION GHOST / CURSOR */}
                    {/* FUSION GHOST / CURSOR */}
                    {isFusionToolActive && cursorPosition && (
                        <div
                            className="absolute pointer-events-none z-[50] flex items-center justify-center opacity-80"
                            style={{
                                left: 0,
                                top: 0,
                                width: '24px',
                                height: '12px',
                                transform: `translate(${viewState.x + (cursorPosition.x - 12) * viewState.zoom}px, ${viewState.y + (cursorPosition.y - 6) * viewState.zoom}px) scale(${viewState.zoom})`,
                                transformOrigin: 'top left'
                            }}
                        >
                            {/* Center Body - Compact Circle (Standard Fusion Style) */}
                            <div className="w-2.5 h-2.5 rounded-full border border-black z-20 shadow-sm bg-slate-400" />

                            {/* Left Port - Edge */}
                            <div className="w-2 h-2 rounded-full bg-black border border-black z-30 absolute left-[2px]" />

                            {/* Right Port - Edge */}
                            <div className="w-2 h-2 rounded-full bg-black border border-black z-30 absolute right-[2px]" />
                        </div>
                    )}

                    {/* FUSION TOOL BANNER */}
                    {isFusionToolActive && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-full border border-yellow-600 shadow-xl z-50 text-xs font-bold flex items-center gap-2 pointer-events-none animate-bounce">
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="6" stroke="currentColor" fill="none" />
                                <circle cx="6" cy="12" r="3" fill="currentColor" stroke="none" />
                                <circle cx="18" cy="12" r="3" fill="currentColor" stroke="none" />
                            </svg>
                            {t('fusion_tool_active')}
                        </div>
                    )}

                    {/* VFL Info Banner */}
                    {isVflToolActive && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 dark:bg-red-900/90 text-white px-4 py-2 rounded-full border border-red-400 dark:border-red-500 shadow-xl z-50 text-xs font-bold flex items-center gap-2 pointer-events-none">
                            <Flashlight className="w-4 h-4 animate-pulse" />
                            {t('vfl_active_msg')}
                        </div>
                    )}

                    {/* OTDR Info Banner */}
                    {isOtdrToolActive && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600 dark:bg-indigo-900/90 text-white px-4 py-2 rounded-full border border-indigo-400 dark:border-indigo-500 shadow-xl z-50 text-xs font-bold flex items-center gap-2 pointer-events-none">
                            <Ruler className="w-4 h-4" />
                            {t('otdr_instruction_banner')}
                        </div>
                    )}

                    {/* Grid Pattern - Adapts to Theme */}
                    <div
                        className="absolute inset-0 pointer-events-none bg-[radial-gradient(#64748b_1px,transparent_1px)] dark:bg-[radial-gradient(#475569_1px,transparent_1px)] opacity-30"
                        style={{
                            backgroundSize: `${GRID_SIZE * viewState.zoom}px ${GRID_SIZE * viewState.zoom}px`,
                            backgroundPosition: `${viewState.x}px ${viewState.y}px`
                        }}
                    />

                    {/* Bottom Right Floating Controls */}
                    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-3 pointer-events-auto">
                        {/* Navigation Panel (Zoom & Center) */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-1.5 flex flex-col gap-2">
                            <button
                                onClick={() => setViewState(s => ({ ...s, zoom: s.zoom + 0.1 }))}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition rounded-md flex items-center justify-center"
                                title={t('zoom_in')}
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewState(s => ({ ...s, zoom: Math.max(0.1, s.zoom - 0.1) }))}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition rounded-md flex items-center justify-center"
                                title={t('zoom_out')}
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>
                            <div className="h-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
                            <button
                                onClick={handleCenterView}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition rounded-md flex items-center justify-center"
                                title={t('center_view') || "Center View"}
                            >
                                <Maximize className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Transform Container */}
                    <div
                        ref={diagramContentRef}
                        style={{
                            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`,
                            transformOrigin: '0 0',
                            width: '100%',
                            height: '100%'
                        }}
                    >
                        {/* SVG Connections Layer */}
                        <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible z-10">
                            {localCTO.connections.map(conn => {
                                if (dragState?.mode === 'reconnect' && dragState.connectionId === conn.id) return null;

                                const p1 = getPortCenter(conn.sourceId);
                                const p2 = getPortCenter(conn.targetId);
                                if (!p1 || !p2) return null;

                                const isLit = litConnections.has(conn.id);

                                // THEME AWARE SPLITTER COLOR:
                                // If it matches the default 'Black' or legacy 'Gray' splitter color, use CSS classes instead of inline stroke.
                                const isSplitterConn = conn.sourceId.includes('spl-') || conn.targetId.includes('spl-');
                                const isDefaultSplitterColor = conn.color === '#0f172a' || conn.color === '#94a3b8';
                                const useThemeColor = isSplitterConn && isDefaultSplitterColor && !isLit;

                                const finalColor = isLit ? '#ef4444' : (useThemeColor ? undefined : conn.color);
                                const finalWidth = isLit ? 4 : 2.5;

                                let d = `M ${p1.x} ${p1.y} `;
                                if (conn.points && conn.points.length > 0) {
                                    conn.points.forEach(p => {
                                        d += `L ${p.x} ${p.y} `;
                                    });
                                }
                                d += `L ${p2.x} ${p2.y}`;

                                return (
                                    <g key={conn.id} className="pointer-events-auto group">
                                        <path
                                            ref={el => { connectionRefs.current[conn.id] = el; }}
                                            d={d}

                                            stroke={finalColor}
                                            strokeWidth={finalWidth}
                                            fill="none"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                            style={{ filter: isLit ? 'drop-shadow(0 0 4px #ef4444)' : 'none' }}
                                            className={`hover:stroke-width-4 cursor-pointer transition-colors duration-150 ${useThemeColor ? 'stroke-slate-900 dark:stroke-white' : ''}`}
                                            onClick={(e) => {
                                                if (isSmartAlignMode) handleSmartAlignConnection(conn.id);
                                            }}
                                            onMouseDown={(e) => handlePathMouseDown(e, conn.id)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                removeConnection(conn.id);
                                            }}
                                            onDoubleClick={() => removeConnection(conn.id)}
                                        />
                                        {!isVflToolActive && !isOtdrToolActive && conn.points?.map((pt, idx) => {
                                            const isDraggingThisConnection = dragState?.mode === 'point' && dragState.connectionId === conn.id;
                                            return (
                                                <circle
                                                    key={idx}
                                                    ref={el => { connectionPointRefs.current[`${conn.id}-${idx}`] = el; }}
                                                    cx={pt.x}

                                                    cy={pt.y}
                                                    r={5}
                                                    fill="#fff"
                                                    stroke={conn.color}
                                                    strokeWidth={2}
                                                    className={`cursor-move hover:r-6 transition-opacity duration-200 ${isDraggingThisConnection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                    onMouseDown={(e) => handlePointMouseDown(e as any, conn.id, idx)}
                                                    onDoubleClick={(e) => removePoint(e as any, conn.id, idx)}
                                                />
                                            );
                                        })}
                                    </g>
                                );
                            })}

                            <path
                                ref={dragLineRef}
                                stroke="#facc15"
                                strokeWidth={2}
                                strokeDasharray="5,5"
                                fill="none"
                                strokeLinecap="round"
                                style={{ display: 'none' }}
                            />


                        </svg>

                        {(() => {
                            let currentEmergencyY = 42;
                            return incomingCables.map((cable) => {
                                const savedLayout = getLayout(cable.id);

                                // Calculate Dynamic Height (Sync with FiberCableNode logic)
                                const looseTubeCount = cable.looseTubeCount || 1;
                                const fibersHeight = 6 + (looseTubeCount * 12) + (cable.fiberCount * 12);
                                const remainder = fibersHeight % 24;
                                const totalHeight = fibersHeight + (remainder > 0 ? 24 - remainder : 0);

                                // --- EMERGENCY SYSTEM: If layout is lost or in invalid state (0,0), calc on-the-fly ---
                                // Using 10px gap as requested
                                const emergencyPos = { x: 42, y: currentEmergencyY, rotation: 0 };
                                const layout = (savedLayout.x !== 0 || savedLayout.y !== 0)
                                    ? savedLayout
                                    : emergencyPos;

                                // Advance Y for the next iteration INDEPENDENTLY of whether this cable was moved
                                // This prevents "magnetic" behavior where dragging one cable pulls the uninitialized ones below it.
                                currentEmergencyY += totalHeight + 10;

                                return (
                                    <FiberCableNode
                                        key={cable.id}
                                        cable={cable}
                                        layout={layout}
                                        connections={localCTO.connections}
                                        litPorts={litPorts}
                                        hoveredPortId={hoveredPortId}
                                        onDragStart={handleElementDragStart}
                                        onRotate={handleRotateElement}
                                        onMirror={handleMirrorElement}
                                        onPortMouseDown={handlePortMouseDown}
                                        onPortMouseEnter={setHoveredPortId}
                                        onPortMouseLeave={handlePortMouseLeave}
                                        onCableMouseEnter={handleCableMouseEnter}
                                        onCableMouseLeave={handleCableMouseLeave}
                                        onCableClick={handleCableClick}
                                        onEdit={handleCableEditClick}
                                        onContextMenu={handleCableContextMenu}
                                    />
                                );
                            });
                        })()}

                        {localCTO.fusions.map(fusion => {
                            const layout = getLayout(fusion.id);
                            return (
                                <FusionNode
                                    key={fusion.id}
                                    fusion={fusion}
                                    layout={layout}
                                    connections={localCTO.connections}
                                    litPorts={litPorts}
                                    hoveredPortId={hoveredPortId}

                                    onDragStart={handleElementDragStart}
                                    onAction={(e) => handleElementAction(e, fusion.id, 'fusion')}
                                    onPortMouseDown={handlePortMouseDown}
                                    onPortMouseEnter={setHoveredPortId}
                                    onPortMouseLeave={handlePortMouseLeave}
                                />
                            );
                        })}

                        {localCTO.splitters.map(splitter => {
                            const layout = getLayout(splitter.id);
                            return (
                                <SplitterNode
                                    key={splitter.id}
                                    splitter={splitter}
                                    layout={layout}
                                    connections={localCTO.connections}
                                    litPorts={litPorts}
                                    hoveredPortId={hoveredPortId}

                                    onDragStart={handleElementDragStart}
                                    onAction={(e) => handleElementAction(e, splitter.id, 'splitter')}
                                    onPortMouseDown={handlePortMouseDown}
                                    onPortMouseEnter={setHoveredPortId}
                                    onPortMouseLeave={handlePortMouseLeave}
                                    onDoubleClick={handleSplitterDoubleClick}
                                    onContextMenu={handleSplitterContextMenu}
                                />
                            );
                        })}

                    </div>
                </div>

                {/* Footer: Help text and Save Button */}
                <div className="h-16 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-50">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 italic text-[13px]">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>{t('general_help')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleApply}
                            disabled={isApplying}
                            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg flex items-center gap-2 text-sm shadow-lg shadow-sky-900/20 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed"
                        >
                            {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : ""}
                            {t('apply') || 'Aplicar'}
                        </button>
                        <button
                            onClick={handleCloseRequest}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 text-sm shadow-lg shadow-emerald-900/20 transition-all transform hover:scale-105 active:scale-95"
                        >
                            <Save className="w-4 h-4" /> {t('save_or_done') || 'Salvar / Sair'}
                        </button>
                    </div>
                </div>

                {/* CONFIRM UNSAVED CHANGES MODAL */}
                {showCloseConfirm && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center shrink-0 border border-amber-300 dark:border-amber-500/30">
                                    <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('unsaved_changes')}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t('unsaved_changes_msg')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-row gap-2 mt-6">
                                <button
                                    onClick={handleSaveAndClose}
                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all"
                                >
                                    {t('save_and_close')}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-600 dark:hover:bg-red-900/30 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 hover:border-red-600 dark:hover:border-red-900/50 rounded-lg font-medium text-sm transition-all"
                                >
                                    {t('discard')}
                                </button>
                                <button
                                    onClick={() => setShowCloseConfirm(false)}
                                    className="flex-1 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-medium transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FUSION TYPE SELECTION MODAL */}
                {showFusionTypeModal && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 max-w-xs w-full shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                            <div className="flex items-center justify-between mb-2 px-2">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {t('select_fusion_type')}
                                </h3>
                                <button
                                    onClick={() => setShowFusionTypeModal(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {(availableFusions.length > 0 ? availableFusions : network.fusionTypes)?.map((ft: any) => (
                                    <button
                                        key={ft.id}
                                        onClick={() => activateFusionTool(ft.id)}
                                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex justify-between items-center group transition-colors"
                                    >
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-sky-400">
                                            {ft.name}
                                        </span>
                                        {ft.attenuation && (
                                            <span className="text-xs text-slate-400 font-mono">
                                                {ft.attenuation}dB
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* SPLITTER SELECTION MODAL */}
                {showSplitterDropdown && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] pointer-events-auto">
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 max-w-xs w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-2 px-2">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {t('select_splitter')}
                                </h3>
                                <button
                                    onClick={() => setShowSplitterDropdown(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {availableSplitters.length === 0 ? (
                                    <div className="px-4 py-4 text-center text-xs text-slate-500 italic">
                                        {t('no_templates') || 'No templates available'}
                                    </div>
                                ) : (
                                    availableSplitters.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={(e) => { handleAddSplitter(e, item); setShowSplitterDropdown(false); }}
                                            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex justify-between items-center group transition-colors"
                                        >
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-sky-400">
                                                {item.name}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">
                                                {item.outputs} {t('outputs') || 'outputs'}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* PROPERTIES MODAL */}
                {showPropertiesModal && (
                    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-[400px] border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-indigo-500" />
                                    {t('properties')}
                                </h3>
                                <button onClick={() => setShowPropertiesModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('name')}
                                    </label>
                                    <input
                                        type="text"
                                        value={propertiesName}
                                        onChange={(e) => setPropertiesName(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('model')}
                                    </label>
                                    <select
                                        value={localCTO.catalogId || ''}
                                        onChange={(e) => {
                                            const selectedId = e.target.value;
                                            setLocalCTO(prev => {
                                                const box = availableBoxes.find(b => b.id === selectedId);
                                                return {
                                                    ...prev,
                                                    catalogId: selectedId,
                                                    type: box?.type || prev.type // Update type (CTO/CEO)
                                                };
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    >
                                        <option value="">{t('select_box_model') || 'Select Model...'}</option>
                                        {availableBoxes.map(box => (
                                            <option key={box.id} value={box.id}>
                                                {box.name} ({box.brand})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('status')}
                                    </label>
                                    <select
                                        value={propertiesStatus}
                                        onChange={(e) => setPropertiesStatus(e.target.value as CTOStatus)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    >
                                        <option value="PLANNED">{t('status_PLANNED')}</option>
                                        <option value="NOT_DEPLOYED">{t('status_NOT_DEPLOYED')}</option>
                                        <option value="DEPLOYED">{t('status_DEPLOYED')}</option>
                                        <option value="CERTIFIED">{t('status_CERTIFIED')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => setShowPropertiesModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleSaveProperties}
                                    className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-200 dark:shadow-none transition-all transform active:scale-95"
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* AUTO SPLICE MODAL */}
                {isAutoSpliceOpen && (
                    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsAutoSpliceOpen(false)}>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 w-96 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center">
                                    <ArrowRightLeft className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('auto_splice')}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Select cables to connect fiber-to-fiber (1-1, 2-2...).</p>
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('source_cable')}</label>
                                    <select
                                        value={autoSourceId}
                                        onChange={(e) => setAutoSourceId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-sky-500 focus:outline-none transition-colors"
                                    >
                                        <option value="">Select Cable...</option>
                                        {incomingCables.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.fiberCount} FO)</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('target_cable')}</label>
                                    <select
                                        value={autoTargetId}
                                        onChange={(e) => setAutoTargetId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-sky-500 focus:outline-none transition-colors"
                                    >
                                        <option value="">Select Cable...</option>
                                        {incomingCables.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.fiberCount} FO)</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => setIsAutoSpliceOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition">{t('cancel')}</button>
                                <button
                                    onClick={performAutoSplice}
                                    disabled={!autoSourceId || !autoTargetId || autoSourceId === autoTargetId}
                                    className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg transition"
                                >
                                    {t('perform_splice')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* OTDR INPUT MODAL */}
                {otdrTargetPort && (
                    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOtdrTargetPort(null)}>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 w-80 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <Ruler className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('otdr_title')}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('otdr_trace_msg')}</p>
                                </div>
                            </div>

                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('otdr_distance_lbl')}</label>
                            <input
                                type="number"
                                value={otdrDistance}
                                onChange={(e) => setOtdrDistance(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono focus:border-indigo-500 focus:outline-none mb-4 transition-colors"
                                placeholder="e.g. 1250"
                                autoFocus
                            />

                            <div className="flex gap-2">
                                <button onClick={() => setOtdrTargetPort(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition">{t('cancel')}</button>
                                <button onClick={handleOtdrSubmit} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg transition">{t('otdr_locate')}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* OPTICAL POWER MODAL */}
                <OpticalPowerModal
                    isOpen={isOpticalModalOpen}
                    onClose={() => setIsOpticalModalOpen(false)}
                    result={opticalResult}
                    splitterName={selectedSplitterName}
                />

                {/* CONTEXT MENU */}
                {contextMenu && (
                    <div
                        className="fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {contextMenu.type === 'cable' ? (
                            <>
                                <button
                                    onClick={() => {
                                        if (onDisconnectCable) {
                                            onDisconnectCable(contextMenu.id);
                                            setContextMenu(null);
                                        }
                                    }}
                                    className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2"
                                >
                                    <Link className="w-3.5 h-3.5 rotate-45" />
                                    {t('ctx_remove_cable')}
                                </button>
                                <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1"></div>
                                <button
                                    onClick={() => {
                                        const cable = incomingCables.find(c => c.id === contextMenu.id);
                                        if (cable) {
                                            onEditCable(cable);
                                            setContextMenu(null);
                                        }
                                    }}
                                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-2"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    {t('ctx_edit_cable')}
                                </button>

                                <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1"></div>
                                <button
                                    onClick={(e) => {
                                        // Trigger Mirror Action manually
                                        handleMirrorElement(e, contextMenu.id);
                                        setContextMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-2"
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    {t('action_flip')}
                                </button>

                                <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1"></div>
                                <button
                                    onClick={() => {
                                        if (onSelectNextNode) {
                                            onSelectNextNode(contextMenu.id);
                                            setContextMenu(null);
                                        }
                                    }}
                                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-2"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    {t('ctx_next_box')}
                                </button>
                            </>
                        ) : (
                            <>
                                {/* SPLITTER ACTIONS */}
                                <button
                                    onClick={() => {
                                        handleSplitterDoubleClick(contextMenu.id); // Reusing existing double-click logic for "Details"
                                        setContextMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-2"
                                >
                                    <Activity className="w-3.5 h-3.5" />
                                    {t('ctx_details')}
                                </button>
                            </>
                        )}
                    </div>
                )}

            </div>
        </div >
    );
};