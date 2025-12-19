import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { CTOData, CableData, FiberConnection, Splitter, FusionPoint, FIBER_COLORS, ElementLayout, CTO_STATUS_COLORS } from '../types';
import { X, Save, Plus, Scissors, RotateCw, Trash2, ZoomIn, ZoomOut, GripHorizontal, Link, Magnet, Flashlight, Move, Ruler, ArrowRightLeft, FileDown, Image as ImageIcon, AlertTriangle, ChevronDown, Zap, Maximize, Box } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { FiberCableNode } from './editor/FiberCableNode';
import { FusionNode } from './editor/FusionNode';
import { SplitterNode } from './editor/SplitterNode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

    // VFL Props
    litPorts: Set<string>;
    vflSource: string | null;
    onToggleVfl: (portId: string) => void;

    // OTDR Prop
    onOtdrTrace: (portId: string, distance: number) => void;

    // Hover Highlight
    onHoverCable?: (cableId: string | null) => void;
}

type DragMode = 'view' | 'element' | 'connection' | 'point' | 'reconnect' | 'window';

export const CTOEditor: React.FC<CTOEditorProps> = ({ cto, projectName, incomingCables, onClose, onSave, litPorts, vflSource, onToggleVfl, onOtdrTrace, onHoverCable }) => {
    const { t } = useLanguage();
    const [localCTO, setLocalCTO] = useState<CTOData>(() => {
        const next = JSON.parse(JSON.stringify(cto)) as CTOData;
        if (!next.layout) next.layout = {};

        // Position Incoming Cables on the Left if missing
        incomingCables.forEach((cable, idx) => {
            if (!next.layout![cable.id]) {
                next.layout![cable.id] = { x: 42, y: 42 + (idx * 204), rotation: 0 };
            }
        });

        // Position Existing Splitters if missing
        next.splitters.forEach((split, idx) => {
            if (!next.layout![split.id]) {
                next.layout![split.id] = { x: 378, y: 78 + (idx * 120), rotation: 0 };
            }
        });

        // Position Existing Fusions if missing
        next.fusions.forEach((fusion, idx) => {
            if (!next.layout![fusion.id]) {
                next.layout![fusion.id] = { x: 582, y: 78 + (idx * 24), rotation: 0 };
            }
        });

        return next;
    });

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

        // Calculate best zoom to fit content, but max 1
        const zoomW = viewportW / contentW;
        const zoomH = viewportH / contentH;
        const targetZoom = Math.min(zoomW, zoomH, 1);

        return {
            x: (viewportW / 2) - ((minX + (maxX - minX) / 2) * targetZoom),
            y: (viewportH / 2) - ((minY + (maxY - minY) / 2) * targetZoom),
            zoom: targetZoom
        };
    };

    // Viewport State
    const [viewState, setViewState] = useState(() => getInitialViewState(localCTO));
    const [isSnapping, setIsSnapping] = useState(true); // Default to enabled

    // Window Position State
    const [windowPos, setWindowPos] = useState(() => {
        if (typeof window === 'undefined') return { x: 100, y: 50 };
        const SIDEBAR_WIDTH = 256;
        const MODAL_WIDTH = 1100;
        const MODAL_HEIGHT = 750;
        const availableWidth = window.innerWidth - SIDEBAR_WIDTH;
        let x = SIDEBAR_WIDTH + (availableWidth / 2) - (MODAL_WIDTH / 2);
        if (x < SIDEBAR_WIDTH + 20) x = SIDEBAR_WIDTH + 20;
        let y = (window.innerHeight - MODAL_HEIGHT) / 2;
        if (y < 20) y = 20;
        return { x, y };
    });

    const [isVflToolActive, setIsVflToolActive] = useState(false);
    const [isOtdrToolActive, setIsOtdrToolActive] = useState(false);
    const [otdrTargetPort, setOtdrTargetPort] = useState<string | null>(null);
    const [otdrDistance, setOtdrDistance] = useState<string>('');
    const [isAutoSpliceOpen, setIsAutoSpliceOpen] = useState(false);
    const [autoSourceId, setAutoSourceId] = useState<string>('');
    const [autoTargetId, setAutoTargetId] = useState<string>('');
    const [exportingType, setExportingType] = useState<'png' | 'pdf' | null>(null);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showSplitterDropdown, setShowSplitterDropdown] = useState(false);
    const [isSmartAlignMode, setIsSmartAlignMode] = useState(false);
    const GRID_SIZE = 12;
    const splitterDropdownRef = useRef<HTMLDivElement>(null);

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
    } | null>(null);
    const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const diagramContentRef = useRef<HTMLDivElement>(null);

    const [, setForceUpdate] = useState(0);
    useLayoutEffect(() => {
        setForceUpdate(n => n + 1);
    }, [viewState]);

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

                const currentPoints = c.points || [];
                const cornerA = { x: p2.x, y: p1.y }; // Horizontal then Vertical
                const cornerB = { x: p1.x, y: p2.y }; // Vertical then Horizontal

                // Snap points to grid for consistency
                cornerA.x = Math.round(cornerA.x / GRID_SIZE) * GRID_SIZE;
                cornerA.y = Math.round(cornerA.y / GRID_SIZE) * GRID_SIZE;
                cornerB.x = Math.round(cornerB.x / GRID_SIZE) * GRID_SIZE;
                cornerB.y = Math.round(cornerB.y / GRID_SIZE) * GRID_SIZE;

                const isAtA = currentPoints.length === 1 && Math.abs(currentPoints[0].x - cornerA.x) < 2 && Math.abs(currentPoints[0].y - cornerA.y) < 2;
                const isAtB = currentPoints.length === 1 && Math.abs(currentPoints[0].x - cornerB.x) < 2 && Math.abs(currentPoints[0].y - cornerB.y) < 2;

                if (currentPoints.length === 0) {
                    return { ...c, points: [cornerA] };
                } else if (isAtA) {
                    return { ...c, points: [cornerB] };
                } else {
                    return { ...c, points: [] };
                }
            })
        }));
    };

    const handleSmartAlignCable = (cableId: string) => {
        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.map(c => {
                if (!c.sourceId.startsWith(cableId) && !c.targetId.startsWith(cableId)) return c;
                const p1 = getPortCenter(c.sourceId);
                const p2 = getPortCenter(c.targetId);
                if (!p1 || !p2) return c;

                // For batch align, we use a simple heuristic:
                // if source is left/right of target, go horizontal first.
                // if source is above/below target, go vertical first.
                const dx = Math.abs(p2.x - p1.x);
                const dy = Math.abs(p2.y - p1.y);

                const point = dx > dy ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y };
                return { ...c, points: [point] };
            })
        }));
    };

    const getPortColor = (portId: string): string | null => {
        if (portId.includes('-fiber-')) {
            try {
                const parts = portId.split('-fiber-');
                const fiberIndex = parseInt(parts[1]);
                if (!isNaN(fiberIndex)) return FIBER_COLORS[fiberIndex % FIBER_COLORS.length];
            } catch (e) { return null; }
        }
        if (portId.includes('spl-')) return '#94a3b8';
        return null;
    };

    const removeConnection = (connId: string) => {
        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.filter(c => c.id !== connId)
        }));
    };

    const handleCloseRequest = () => {
        const hasChanges = JSON.stringify(localCTO) !== JSON.stringify(cto);
        if (hasChanges) setShowCloseConfirm(true);
        else onClose();
    };

    // --- View Centering ---
    const handleCenterView = () => {
        setViewState(getInitialViewState(localCTO));
    };

    const handleSaveAndClose = () => {
        onSave(localCTO);
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

            for (let i = 0; i < count; i++) {
                const sourceFiberId = `${sourceCable.id}-fiber-${i}`;
                const targetFiberId = `${targetCable.id}-fiber-${i}`;

                // Check latest state from 'prev'
                const isSourceOccupied = prev.connections.some(c => c.sourceId === sourceFiberId || c.targetId === sourceFiberId);
                const isTargetOccupied = prev.connections.some(c => c.sourceId === targetFiberId || c.targetId === targetFiberId);

                if (isSourceOccupied || isTargetOccupied) continue;

                const color = FIBER_COLORS[i % FIBER_COLORS.length];

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

    // --- Export Logic (Shared) ---
    const generateExportCanvas = async (): Promise<HTMLCanvasElement | null> => {
        if (!diagramContentRef.current) return null;

        // 1. Calculate Bounds of the Diagram Content
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        const checkBounds = (b: { minX: number, minY: number, maxX: number, maxY: number }) => {
            if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
            if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
        };

        if (localCTO.layout) {
            // 1. Check Cabes
            incomingCables.forEach(cable => {
                const l = localCTO.layout![cable.id];
                if (!l) return;
                const looseTubeCount = cable.looseTubeCount || 1;
                const totalHeight = 24 + (cable.fiberCount * 24) + ((looseTubeCount - 1) * 12);
                checkBounds(getElementBounds(l.x, l.y, 168 + 24, totalHeight, l.rotation || 0));
            });

            // 2. Check Splitters
            localCTO.splitters.forEach(split => {
                const l = localCTO.layout![split.id];
                if (!l) return;
                const width = split.outputPortIds.length * 24;
                checkBounds(getElementBounds(l.x, l.y, width, 72, l.rotation || 0));
            });

            // 3. Check Fusions
            localCTO.fusions.forEach(fusion => {
                const l = localCTO.layout![fusion.id];
                if (!l) return;
                checkBounds(getElementBounds(l.x, l.y, 48, 24, l.rotation || 0));
            });

            // 4. Check Connections
            localCTO.connections.forEach(c => {
                c.points?.forEach(p => {
                    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
                });
            });
        }

        // Defaults if empty
        if (minX === Infinity) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

        const padding = 100;
        const headerHeight = 170;

        // Actual Content Dimensions + Padding
        const contentWidth = (maxX - minX) + (padding * 2);
        const contentHeight = (maxY - minY) + (padding * 2) + headerHeight;

        // Ensure dimensions are at least respectable for the header
        const exportWidth = Math.max(contentWidth, 800);
        const exportHeight = Math.max(contentHeight, 600);

        // 2. Prepare Map URL
        const lat = localCTO.coordinates?.lat || cto.coordinates?.lat || 0;
        const lng = localCTO.coordinates?.lng || cto.coordinates?.lng || 0;

        // Yandex Static Maps URL: ll (center), z (zoom), pt (marker: lng,lat,style)
        // pm2rdm = Red marker, medium size.
        // l=sat = Satellite mode
        // Requesting a larger square image (300x300) to allow aggressive cropping of the watermark at the bottom.
        const mapUrl = `https://static-maps.yandex.ru/1.x/?ll=${lng.toFixed(6)},${lat.toFixed(6)}&z=16&l=sat&size=300,300&pt=${lng.toFixed(6)},${lat.toFixed(6)},pm2rdm&lang=pt_BR`;

        // Preload Map Image
        const mapBase64 = await preloadImage(mapUrl);

        const mapImgHtml = mapBase64
            ? `<div style="width: 100%; height: 100%; overflow: hidden; position: relative; border-radius: 8px;">
                 <img src="${mapBase64}" style="width: 100%; height: auto; position: absolute; top: 0; left: 0;" alt="Location" />
               </div>`
            : `<div style="width: 100%; height: 100%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 10px; font-weight: bold;">MAP UNAVAILABLE</div>`;

        // 3. Create Temporary Export Container (Hidden but visible to capture)
        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'fixed';
        exportContainer.style.left = '-10000px';
        exportContainer.style.top = '0px';
        exportContainer.style.width = `${exportWidth}px`;
        exportContainer.style.height = `${exportHeight}px`;
        exportContainer.style.backgroundColor = '#ffffff';
        exportContainer.style.fontFamily = 'sans-serif';
        exportContainer.style.display = 'flex';
        exportContainer.style.flexDirection = 'column';
        exportContainer.style.overflow = 'hidden';
        exportContainer.style.zIndex = '-9999';

        document.body.appendChild(exportContainer);

        // 4. Construct Content HTML with Force Light Mode CSS
        const statusColor = CTO_STATUS_COLORS[cto.status || 'PLANNED'];

        exportContainer.innerHTML = `
        <style>
            .export-diagram-layer * { vector-effect: non-scaling-stroke; }
            
            /* Root export container - Ensure white background but allow content to be transparent */
            #export-container-wrapper { 
                background-color: #ffffff !important; 
                color: #0f172a !important; 
                fill: #0f172a;
            }

            /* 1. Only force white background on the heavy components cards */
            #export-container-wrapper .bg-white,
            #export-container-wrapper .dark\\:bg-slate-900,
            #export-container-wrapper .dark\\:bg-slate-800,
            #export-container-wrapper .dark\\:bg-slate-950,
            #export-container-wrapper .bg-slate-900 { 
                background-color: #ffffff !important; 
                border-color: #cbd5e1 !important; /* Slightly darker border for contrast on white paper */
            }

            /* 2. PROTECT EVERYTHING WITH STYLE ATTR (Fibers, colored lines) */
            /* We do this by not having broad 'div' or 'span' overrides anymore */

            /* 3. Force dark text ONLY for classes that are typically white on dark */
            #export-container-wrapper .dark\\:text-white,
            #export-container-wrapper .text-white {
                color: #1e293b !important;
            }
            
            /* 4. Restore fiber port visibility (which uses white text on dark backgrounds) */
            #export-container-wrapper .rounded-full.text-white {
                color: #ffffff !important; /* Keep white text if it's a port circle */
            }

            /* 5. Visible Connections */
            #export-container-wrapper svg path {
                stroke-opacity: 1 !important;
            }
            
            /* Force visible borders for internal lines (cables tubes etc) */
            #export-container-wrapper .border-slate-300,
            #export-container-wrapper .dark\\:border-slate-600 {
                border-color: #94a3b8 !important;
            }
        </style>
        <div id="export-container-wrapper" class="light" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #ffffff;">
            <div id="export-diagram-area" style="flex: 1; position: relative; background: #ffffff; overflow: visible;">
                <div id="diagram-centering-wrapper" style="position: absolute; left: 0; top: 0; overflow: visible;"></div>
            </div>
            <div style="padding: 24px; border-top: 2px solid #e2e8f0; background: #ffffff; display: flex; justify-content: space-between; align-items: center; height: ${headerHeight}px; box-sizing: border-box; flex-shrink: 0;">
                <div style="box-sizing: border-box;">
                    <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; line-height: 1.2;">${localCTO.name}</h1>
                    <h2 style="font-size: 14px; font-weight: 600; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase;">${projectName}</h2>
                    <div style="margin-top: 12px; display: flex; gap: 16px; font-size: 12px; color: #475569;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-weight: 700;">Status:</span>
                            <span style="background: ${statusColor}; color: white !important; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 10px;">${cto.status || 'PLANNED'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-weight: 700;">Lat/Long:</span>
                            <span>${cto.coordinates.lat.toFixed(6)}, ${cto.coordinates.lng.toFixed(6)}</span>
                        </div>
                    </div>
                </div>
                <div style="width: 200px; height: 120px; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; background: #f1f5f9; box-sizing: border-box;">
                    ${mapImgHtml}
                </div>
            </div>
        </div>
        `;

        // Wait for styles and innerHTML to settle
        await new Promise(resolve => setTimeout(resolve, 50));

        // 5. Clone Diagram Content
        const diagramClone = diagramContentRef.current.cloneNode(true) as HTMLDivElement;

        const diagramAreaWidth = exportWidth;
        const diagramAreaHeight = exportHeight - headerHeight;
        const contentWidthOnly = maxX - minX;
        const contentHeightOnly = maxY - minY;

        // NEW Centering Strategic Logic:
        // 1. Move everything inside diagramClone so the content visual top-left (minX, minY) sits at 0,0
        // 2. Then move the centering-wrapper by 'padding' pixels, ensuring perfect positive gap.

        diagramClone.style.transform = `translate(${-minX}px, ${-minY}px)`;
        diagramClone.style.transformOrigin = '0 0';
        diagramClone.style.position = 'absolute';
        diagramClone.style.margin = '0';
        diagramClone.style.padding = '0';
        diagramClone.style.width = `${maxX - minX + 10}px`; // tight to content
        diagramClone.style.height = `${maxY - minY + 10}px`;
        diagramClone.style.overflow = 'visible';
        diagramClone.classList.add('export-diagram-layer');

        const wrapper = exportContainer.querySelector('#diagram-centering-wrapper') as HTMLDivElement;
        // Center the wrapper within the diagramArea
        const centerPaddingX = (diagramAreaWidth - contentWidthOnly) / 2;
        const centerPaddingY = (diagramAreaHeight - contentHeightOnly) / 2;
        wrapper.style.left = `${centerPaddingX}px`;
        wrapper.style.top = `${centerPaddingY}px`;
        wrapper.appendChild(diagramClone);

        // Final settle delay to ensure all nested components and SVG paths are fully layed out
        await new Promise(resolve => setTimeout(resolve, 200));

        // 6. Capture
        try {
            const canvas = await html2canvas(exportContainer, {
                backgroundColor: '#ffffff',
                useCORS: true,
                scale: 2, // 2x is enough for high quality without memory issues
                windowWidth: exportWidth,
                windowHeight: exportHeight,
                logging: false,
                allowTaint: true
            });
            if (document.body.contains(exportContainer)) {
                document.body.removeChild(exportContainer);
            }
            return canvas;
        } catch (error) {
            console.error("Canvas generation failed", error);
            if (document.body.contains(exportContainer)) {
                document.body.removeChild(exportContainer);
            }
            return null;
        }
    };

    const handleExportPDF = async () => {
        setExportingType('pdf');
        try {
            const canvas = await generateExportCanvas();
            if (!canvas) return;

            // 7. Generate PDF with Content Aspect Ratio
            const imgData = canvas.toDataURL('image/png');

            // Canvas dimensions are scaled by 2 (html2canvas scale), so divide by 2 for logical points
            const imgWidth = canvas.width / 2;
            const imgHeight = canvas.height / 2;

            // Dynamically set orientation based on aspect ratio
            const pdf = new jsPDF({
                orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [imgWidth, imgHeight] // Set page size exactly to image size
            });

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`CTO-${localCTO.name.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error("Export failed", error);
            alert("Failed to export PDF.");
        } finally {
            setExportingType(null);
        }
    };

    const handleExportPNG = async () => {
        setExportingType('png');
        try {
            const canvas = await generateExportCanvas();
            if (!canvas) return;

            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `CTO-${localCTO.name.replace(/\s+/g, '_')}.png`;
            link.href = imgData;
            link.click();
        } catch (error) {
            console.error("Export PNG failed", error);
            alert("Failed to export PNG.");
        } finally {
            setExportingType(null);
        }
    };

    // --- Event Handlers ---

    const handleWindowDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return; // Don't drag if clicking a button
        setDragState({
            mode: 'window',
            startX: e.clientX,
            startY: e.clientY,
            initialWindowPos: { ...windowPos }
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // If clicking background, start pan
        if (e.button === 0) { // Left click
            setDragState({
                mode: 'view',
                startX: e.clientX,
                startY: e.clientY
            });
        }
    };

    const handleElementDragStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (isVflToolActive || isOtdrToolActive) return; // Disable dragging in specialized modes

        setDragState({
            mode: 'element',
            targetId: id,
            startX: e.clientX,
            startY: e.clientY,
            initialLayout: getLayout(id)
        });
    };

    const handleRotateElement = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (isVflToolActive || isOtdrToolActive) return;

        setLocalCTO(prev => {
            const currentRot = prev.layout?.[id]?.rotation || 0;
            const newRot = (currentRot + 90) % 360;
            return {
                ...prev,
                layout: {
                    ...prev.layout,
                    [id]: { ...prev.layout![id], rotation: newRot }
                }
            };
        });
    };

    const handleMirrorElement = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (isVflToolActive || isOtdrToolActive) return;

        setLocalCTO(prev => ({
            ...prev,
            layout: {
                ...prev.layout,
                [id]: { ...prev.layout![id], mirrored: !prev.layout![id].mirrored }
            }
        }));
    };

    const handlePortMouseDown = (e: React.MouseEvent, portId: string) => {
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
        const existingConn = localCTO.connections.find(c => c.sourceId === portId || c.targetId === portId);

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
    };

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

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragState) return;

        // Immediate updates for visual-only drag states (drawing connections)
        if (dragState.mode === 'connection' || dragState.mode === 'reconnect') {
            let { x, y } = screenToCanvas(e.clientX, e.clientY);

            // OPTIONAL: Snap to straight lines (Orthogonal) when holding Ctrl
            if (e.ctrlKey) {
                const originId = dragState.mode === 'connection' ? dragState.portId : dragState.fixedPortId;
                const originPt = originId ? getPortCenter(originId) : null;
                if (originPt) {
                    const dx = Math.abs(x - originPt.x);
                    const dy = Math.abs(y - originPt.y);
                    if (dx > dy) {
                        y = originPt.y; // Snap to horizontal
                    } else {
                        x = originPt.x; // Snap to vertical
                    }
                }
            }

            setDragState(prev => prev ? ({ ...prev, currentMouseX: x, currentMouseY: y }) : null);
            return;
        }

        // Throttled updates for structural changes (moving elements/view)
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
        }

        rafIdRef.current = requestAnimationFrame(() => {
            if (dragState.mode === 'window' && dragState.initialWindowPos) {
                const dx = e.clientX - dragState.startX;
                const dy = e.clientY - dragState.startY;
                setWindowPos({
                    x: dragState.initialWindowPos.x + dx,
                    y: dragState.initialWindowPos.y + dy
                });
            }
            else if (dragState.mode === 'view') {
                const dx = e.clientX - dragState.startX;
                const dy = e.clientY - dragState.startY;
                setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
                setDragState(prev => prev ? ({ ...prev, startX: e.clientX, startY: e.clientY }) : null);
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
            }
            else if (dragState.mode === 'point' && dragState.connectionId && dragState.pointIndex !== undefined) {
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

            rafIdRef.current = null;
        });
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        // Handling New Connection Creation
        if (dragState?.mode === 'connection' && hoveredPortId && dragState.portId) {
            const source = dragState.portId;
            const target = hoveredPortId;

            if (source !== target) {
                const sourceColor = getPortColor(source);
                const targetColor = getPortColor(target);

                let connColor = '#22c55e'; // Default Green
                const isFiber = (id: string) => id.includes('-fiber-');

                if (isFiber(source) && sourceColor) connColor = sourceColor;
                else if (isFiber(target) && targetColor) connColor = targetColor;
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
                        // ENFORCE 1-TO-1: Purge any connection using the source OR target ports.
                        const filtered = prev.connections.filter(c =>
                            c.sourceId !== source && c.targetId !== source &&
                            c.sourceId !== target && c.targetId !== target
                        );
                        return {
                            ...prev,
                            connections: [...filtered, newConn]
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
                        // 1. Remove any other connection occupying the target port (ENFORCE 1-TO-1)
                        const otherConns = prev.connections.filter(c =>
                            c.id !== dragState.connectionId &&
                            c.sourceId !== targetPort &&
                            c.targetId !== targetPort
                        );

                        const updatedMyConn = prev.connections.find(c => c.id === dragState.connectionId);
                        if (!updatedMyConn) return { ...prev, connections: otherConns };

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
            }
            else if (!hoveredPortId) {
                removeConnection(dragState.connectionId);
            }
        }
        // Handling FUSION DROP ON FIBER (Auto-Splice)
        else if (dragState?.mode === 'element' && dragState.targetId?.startsWith('fus-')) {
            const fusionId = dragState.targetId;

            // CHECK IF FUSION IS ALREADY CONNECTED
            const isAlreadyConnected = localCTO.connections.some(c =>
                c.sourceId === `${fusionId}-a` || c.targetId === `${fusionId}-a` ||
                c.sourceId === `${fusionId}-b` || c.targetId === `${fusionId}-b`
            );

            if (!isAlreadyConnected) {
                const dx = (e.clientX - dragState.startX) / viewState.zoom;
                const dy = (e.clientY - dragState.startY) / viewState.zoom;

                let newX = dragState.initialLayout!.x + dx;
                let newY = dragState.initialLayout!.y + dy;

                if (isSnapping) {
                    newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                    newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
                }

                const fusionCenter = { x: newX + 16, y: newY + 6 };

                const hitConnection = localCTO.connections.find(conn => {
                    if (conn.sourceId.startsWith(fusionId) || conn.targetId.startsWith(fusionId)) return false;
                    const p1 = getPortCenter(conn.sourceId);
                    const p2 = getPortCenter(conn.targetId);
                    if (!p1 || !p2) return false;
                    const points = [p1, ...(conn.points || []), p2];
                    for (let i = 0; i < points.length - 1; i++) {
                        const dist = getDistanceFromSegment(fusionCenter, points[i], points[i + 1]);
                        if (dist < 25) return true;
                    }
                    return false;
                });

                if (hitConnection) {
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

                    setLocalCTO(prev => ({
                        ...prev,
                        // RUTHLESS ENFORCEMENT: Remove the cable being split AND any existing connections on THIS fusion's ports.
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
                }
            }
        }

        setDragState(null);
    };

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

    const handleAddSplitter = (e: React.MouseEvent, type: '1:8' | '1:16' | '1:2') => {
        const id = `spl-${Date.now()}`;
        const count = parseInt(type.split(':')[1]);
        const newSplitter: Splitter = {
            id,
            name: ` ${localCTO.splitters.length + 1}`,
            type,
            inputPortId: `${id}-in`,
            outputPortIds: Array.from({ length: count }).map((_, i) => `${id}-out-${i}`)
        };
        const { x: rx, y: ry } = screenToCanvas(e.clientX, e.clientY);
        const x = Math.round(rx / GRID_SIZE) * GRID_SIZE;
        const y = Math.round(ry / GRID_SIZE) * GRID_SIZE;
        const initialLayout = { x, y, rotation: 0 };

        setLocalCTO(prev => ({
            ...prev,
            splitters: [...prev.splitters, newSplitter],
            layout: { ...prev.layout, [id]: initialLayout }
        }));

        setDragState({
            mode: 'element',
            targetId: id,
            startX: e.clientX,
            startY: e.clientY,
            initialLayout: initialLayout
        });
    };

    const handleDeleteSplitter = (id: string) => {
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
    };

    const handleAddFusion = (e: React.MouseEvent) => {
        const id = `fus-${Date.now()}`;
        const newFusion: FusionPoint = {
            id,
            name: `F-${localCTO.fusions.length + 1}`
        };

        const { x: frx, y: fry } = screenToCanvas(e.clientX, e.clientY);
        const x = Math.round(frx / GRID_SIZE) * GRID_SIZE;
        const y = Math.round(fry / GRID_SIZE) * GRID_SIZE;
        const initialLayout = { x, y, rotation: 0 };

        setLocalCTO(prev => ({
            ...prev,
            fusions: [...prev.fusions, newFusion],
            layout: { ...prev.layout, [id]: initialLayout }
        }));

        setDragState({
            mode: 'element',
            targetId: id,
            startX: e.clientX,
            startY: e.clientY,
            initialLayout: initialLayout
        });
    };

    const handleDeleteFusion = (id: string) => {
        setLocalCTO(prev => {
            const portIds = [`${id}-a`, `${id}-b`];
            return {
                ...prev,
                fusions: prev.fusions.filter(f => f.id !== id),
                connections: prev.connections.filter(c => !portIds.includes(c.sourceId) && !portIds.includes(c.targetId))
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

    // Clear cache only on viewState change or localCTO change that might affect layout
    useLayoutEffect(() => {
        portCenterCache.current = {};
        containerRectCache.current = null;
    }, [viewState, localCTO.layout, localCTO.splitters, localCTO.fusions]);

    return (
        <div
            className="fixed z-[2000]"
            style={{ left: windowPos.x, top: windowPos.y }}
        >
            <div
                className={`w-[1100px] h-[750px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden backdrop-blur-sm ${isVflToolActive || isOtdrToolActive || isSmartAlignMode ? 'cursor-crosshair' : ''}`}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
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
                        <div className="flex gap-2 pointer-events-auto items-center">
                            <button onClick={handleCloseRequest} title={t('cancel')} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Line 2: All Tools and Exports */}
                    <div className="h-12 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                        <div className="flex gap-1.5 pointer-events-auto items-center">
                            {/* Construction */}
                            <div className="relative" ref={splitterDropdownRef}>
                                <button
                                    onClick={() => setShowSplitterDropdown(!showSplitterDropdown)}
                                    className={`px-2.5 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2 border border-slate-300 dark:border-slate-600 transition ${showSplitterDropdown ? 'ring-2 ring-sky-500' : ''}`}
                                    title={t('splitters')}
                                >
                                    <Plus className="w-3.5 h-3.5" /> {t('splitters')} <ChevronDown className={`w-3 h-3 transition-transform ${showSplitterDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showSplitterDropdown && (
                                    <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-[100] animate-in slide-in-from-top-1 duration-200">
                                        <button onClick={(e) => { handleAddSplitter(e, '1:2'); setShowSplitterDropdown(false); }} className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">SPL 1:2</button>
                                        <button onClick={(e) => { handleAddSplitter(e, '1:8'); setShowSplitterDropdown(false); }} className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">SPL 1:8</button>
                                        <button onClick={(e) => { handleAddSplitter(e, '1:16'); setShowSplitterDropdown(false); }} className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">SPL 1:16</button>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleAddFusion} title={t('add_fusion')} className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-700 dark:text-white flex items-center gap-2 border border-slate-300 dark:border-slate-600 transition">
                                <Link className="w-4 h-4" />
                            </button>

                            <button onClick={() => setIsAutoSpliceOpen(true)} title={t('auto_splice')} className="p-1.5 bg-sky-600 hover:bg-sky-500 rounded text-white flex items-center gap-2 border border-sky-700 transition shadow-sm">
                                <ArrowRightLeft className="w-4 h-4" />
                            </button>

                            <div className="w-[1px] h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>

                            {/* Testing Tools */}
                            <button
                                onClick={() => { setIsVflToolActive(!isVflToolActive); setIsOtdrToolActive(false); }}
                                className={`p-1.5 rounded border transition ${isVflToolActive ? 'bg-red-600 border-red-700 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                title={t('tool_vfl')}
                            >
                                <Flashlight className={`w-4 h-4 ${isVflToolActive ? 'fill-white animate-pulse' : ''}`} />
                            </button>

                            <button
                                onClick={() => { setIsOtdrToolActive(!isOtdrToolActive); setIsVflToolActive(false); setIsSmartAlignMode(false); }}
                                className={`p-1.5 rounded border transition ${isOtdrToolActive ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                title="OTDR Trace"
                            >
                                <Ruler className="w-4 h-4" />
                            </button>

                            <button
                                onClick={() => { setIsSmartAlignMode(!isSmartAlignMode); setIsVflToolActive(false); setIsOtdrToolActive(false); }}
                                className={`p-1.5 rounded border transition ${isSmartAlignMode ? 'bg-amber-500 border-amber-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                title={t('smart_align')}
                            >
                                <Zap className={`w-4 h-4 ${isSmartAlignMode ? 'fill-white animate-pulse' : ''}`} />
                            </button>

                            <button
                                onClick={() => setIsSnapping(!isSnapping)}
                                className={`p-1.5 rounded border transition ${isSnapping ? 'bg-sky-500 border-sky-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                                title="Snap to Grid"
                            >
                                <Magnet className="w-4 h-4" />
                            </button>

                            <button
                                onClick={() => setLocalCTO(prev => ({ ...prev, connections: [] }))}
                                className="p-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-red-500 rounded hover:bg-red-50 transition"
                                title={t('reset_connections')}
                            >
                                <Scissors className="w-4 h-4" />
                            </button>
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
                        </div>
                    </div>
                </div>

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-slate-200 dark:bg-slate-950 relative overflow-hidden"
                    style={{ cursor: isVflToolActive || isOtdrToolActive ? 'cursor-crosshair' : 'default' }}
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                >
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
                        className="absolute inset-0 pointer-events-none bg-[radial-gradient(#64748b_1px,transparent_1px)] dark:bg-[radial-gradient(#475569_1px,transparent_1px)] opacity-30 dark:opacity-20"
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
                                const finalColor = isLit ? '#ef4444' : conn.color;
                                const finalWidth = isLit ? 4 : 3;

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
                                            d={d}
                                            stroke={finalColor}
                                            strokeWidth={finalWidth}
                                            fill="none"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                            style={{ filter: isLit ? 'drop-shadow(0 0 4px #ef4444)' : 'none' }}
                                            className="hover:stroke-width-4 cursor-pointer transition-all"
                                            onClick={(e) => {
                                                if (dragState?.mode !== 'point') {
                                                    handleConnectionClick(e as any, conn.id);
                                                }
                                            }}
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

                            {dragState?.mode === 'connection' && dragState.currentMouseX && (
                                <path
                                    d={`M ${(getPortCenter(dragState.portId!)?.x || 0)} ${(getPortCenter(dragState.portId!)?.y || 0)} L ${dragState.currentMouseX} ${dragState.currentMouseY}`}
                                    stroke="#facc15"
                                    strokeWidth={2}
                                    strokeDasharray="5,5"
                                    fill="none"
                                    strokeLinecap="round"
                                />
                            )}

                            {dragState?.mode === 'reconnect' && dragState.currentMouseX && dragState.fixedPortId && (
                                <path
                                    d={`M ${(getPortCenter(dragState.fixedPortId!)?.x || 0)} ${(getPortCenter(dragState.fixedPortId!)?.y || 0)} L ${dragState.currentMouseX} ${dragState.currentMouseY}`}
                                    stroke="#facc15"
                                    strokeWidth={3}
                                    strokeDasharray="5,5"
                                    fill="none"
                                    strokeLinecap="round"
                                />
                            )}
                        </svg>

                        {incomingCables.map(cable => {
                            const layout = getLayout(cable.id);
                            return (
                                <FiberCableNode
                                    key={cable.id}
                                    cable={cable}
                                    layout={layout}
                                    connections={localCTO.connections}
                                    litPorts={litPorts}
                                    hoveredPortId={hoveredPortId}
                                    onDragStart={(e) => handleElementDragStart(e, cable.id)}
                                    onRotate={(e) => handleRotateElement(e, cable.id)}
                                    onMirror={(e) => handleMirrorElement(e, cable.id)}
                                    onPortMouseDown={handlePortMouseDown}
                                    onPortMouseEnter={(id) => setHoveredPortId(id)}
                                    onPortMouseLeave={() => setHoveredPortId(null)}
                                    onCableMouseEnter={() => onHoverCable && onHoverCable(cable.id)}
                                    onCableMouseLeave={() => onHoverCable && onHoverCable(null)}
                                    onCableClick={(e) => {
                                        if (isSmartAlignMode) {
                                            e.stopPropagation();
                                            handleSmartAlignCable(cable.id);
                                        }
                                    }}
                                />
                            );
                        })}

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
                                    onDragStart={(e) => handleElementDragStart(e, fusion.id)}
                                    onRotate={(e) => handleRotateElement(e, fusion.id)}
                                    onDelete={(e) => { e.stopPropagation(); handleDeleteFusion(fusion.id); }}
                                    onPortMouseDown={handlePortMouseDown}
                                    onPortMouseEnter={(id) => setHoveredPortId(id)}
                                    onPortMouseLeave={() => setHoveredPortId(null)}
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
                                    onDragStart={(e) => handleElementDragStart(e, splitter.id)}
                                    onRotate={(e) => handleRotateElement(e, splitter.id)}
                                    onDelete={(e) => { e.stopPropagation(); handleDeleteSplitter(splitter.id); }}
                                    onPortMouseDown={handlePortMouseDown}
                                    onPortMouseEnter={(id) => setHoveredPortId(id)}
                                    onPortMouseLeave={() => setHoveredPortId(null)}
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
                            onClick={handleCloseRequest}
                            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-sm transition"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={() => onSave(localCTO)}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 text-sm shadow-lg shadow-emerald-900/20 transition-all transform hover:scale-105 active:scale-95"
                        >
                            <Save className="w-4 h-4" /> {t('save')}
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
                            <div className="flex flex-col gap-2 mt-6">
                                <button
                                    onClick={handleSaveAndClose}
                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all"
                                >
                                    {t('save_and_close')}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-600 dark:hover:bg-red-900/30 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 hover:border-red-600 dark:hover:border-red-900/50 rounded-lg font-medium text-sm transition-all"
                                >
                                    {t('discard')}
                                </button>
                                <button
                                    onClick={() => setShowCloseConfirm(false)}
                                    className="w-full py-2 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-medium transition-colors"
                                >
                                    {t('cancel')}
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

            </div>
        </div>
    );
};