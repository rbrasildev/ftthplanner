import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CTOData, CableData, FiberConnection, Splitter, FusionPoint, getFiberColor, ElementLayout, CTO_STATUS_COLORS, CTOStatus, Note, DIOInline } from '../types';
import { makeDIOPortId } from '../utils/dioPortId';
import { X, Save, Plus, Scissors, RotateCw, Trash2, ZoomIn, ZoomOut, GripHorizontal, Link, Magnet, Move, Ruler, ArrowRightLeft, FileDown, Image as ImageIcon, AlertTriangle, ChevronDown, ChevronUp, Zap, Maximize, Minimize2, Box, Eraser, AlignCenter, Triangle, Pencil, Loader2, ArrowRight, Activity, ExternalLink, Check, ChevronLeft, ChevronRight, QrCode, Printer, Keyboard, CircleHelp, StickyNote } from 'lucide-react';
import { Button } from './common/Button';
import { useLanguage } from '../LanguageContext';
import { hasPermission } from '../shared/permissions';
import { CustomSelect } from './common/CustomSelect';
import { CTOEditorToolbar } from './editor/CTOEditorToolbar';
import { NotesLayer } from './editor/NotesLayer';
import { CableRenderer } from './editor/CableRenderer';
import { FusionRenderer } from './editor/FusionRenderer';
import { SplitterRenderer } from './editor/SplitterRenderer';
import { DIORenderer } from './editor/DIORenderer';
import { DIOAddModal } from './editor/modals/DIOAddModal';
import { FusionTypeModal } from './editor/modals/FusionTypeModal';
import { ConnectorTypeModal } from './editor/modals/ConnectorTypeModal';
import { SplitterSelectionModal } from './editor/modals/SplitterSelectionModal';
import { AutoSpliceModal } from './editor/modals/AutoSpliceModal';
import { OtdrInputModal } from './editor/modals/OtdrInputModal';
import { CableRemoveModal } from './editor/modals/CableRemoveModal';
import { generateCTOSVG, exportToPNG, FooterData } from './CTOExporter';
import {
    SplitterCatalogItem,
    FusionCatalogItem,
    CableCatalogItem,
    getSplitters,
    getCables,
    getFusions,
    getOLTs,
    OLTCatalogItem
} from '../services/catalogService';
import { OpticalPowerModal } from './modals/OpticalPowerModal';
import { QRCodeModal } from './modals/QRCodeModal';
import { traceOpticalPath, tracePortPower, OpticalPathResult } from '../utils/opticalUtils';
import { findSplitterCatalog, formatSplitterDisplayName } from '../utils/splitterUtils';
import { NetworkState, Customer } from '../types';
import { getCustomers } from '../services/customerService';
import { useCTOEditorState } from '../hooks/useCTOEditorState';
import { useGlobalDragListeners } from '../hooks/useGlobalDragListeners';
import { useToolModes } from '../hooks/useToolModes';
import { useCanvasKeyboardShortcuts } from '../hooks/useCanvasKeyboardShortcuts';
import { useAltKeyHeld } from '../hooks/useAltKeyHeld';
import { getCableStreetNames } from '../utils/geocodingUtils';
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

// Helper to preload image for canvas (with CORS support)
const preloadImage = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
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
                    console.warn("Canvas tainted, skipping image.");
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        };
        img.onerror = () => {
            console.warn("Failed to load image:", url.substring(0, 80));
            resolve(null);
        };
        img.src = url;
    });
};

// Generate a static map by stitching OSM tiles (CORS-friendly)
const generateStaticMap = (lat: number, lng: number, zoom: number, width: number, height: number): Promise<string | null> => {
    return new Promise(async (resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }

        // Fill background
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(0, 0, width, height);

        // Convert lat/lng to tile coordinates
        const n = Math.pow(2, zoom);
        const centerTileX = ((lng + 180) / 360) * n;
        const centerTileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

        const tileSize = 256;
        const tilesX = Math.ceil(width / tileSize) + 2;
        const tilesY = Math.ceil(height / tileSize) + 2;

        // Offset within the center tile
        const offsetX = (centerTileX % 1) * tileSize;
        const offsetY = (centerTileY % 1) * tileSize;

        const startTileX = Math.floor(centerTileX) - Math.floor(tilesX / 2);
        const startTileY = Math.floor(centerTileY) - Math.floor(tilesY / 2);

        const baseDrawX = width / 2 - offsetX - (Math.floor(centerTileX) - startTileX) * tileSize;
        const baseDrawY = height / 2 - offsetY - (Math.floor(centerTileY) - startTileY) * tileSize;

        // Load a single tile with retry
        const loadTile = (tileXi: number, tileYi: number, retries = 2): Promise<HTMLImageElement | null> => {
            return new Promise((res) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => res(img);
                img.onerror = () => {
                    if (retries > 0) {
                        setTimeout(() => loadTile(tileXi, tileYi, retries - 1).then(res), 300);
                    } else {
                        res(null);
                    }
                };
                img.src = `https://tile.openstreetmap.org/${zoom}/${tileXi}/${tileYi}.png`;
            });
        };

        // Load all tiles in parallel
        const tileJobs: { tx: number; ty: number; promise: Promise<HTMLImageElement | null> }[] = [];
        for (let tx = 0; tx < tilesX; tx++) {
            for (let ty = 0; ty < tilesY; ty++) {
                tileJobs.push({ tx, ty, promise: loadTile(startTileX + tx, startTileY + ty) });
            }
        }

        // Wait for all, then draw in order
        const results = await Promise.all(tileJobs.map(async (job) => {
            const img = await job.promise;
            return { ...job, img };
        }));

        for (const { tx, ty, img } of results) {
            if (img) {
                ctx.drawImage(img, baseDrawX + tx * tileSize, baseDrawY + ty * tileSize);
            }
        }

        // Draw center marker
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        try {
            resolve(canvas.toDataURL('image/png'));
        } catch {
            resolve(null);
        }
    });
};

// Compare two point arrays after snapping to the grid — replaces
// `JSON.stringify(snap(a)) === JSON.stringify(snap(b))`. Avoids allocating
// 10+ temporary strings per smart-align click.
const arePointsSnappedEqual = (
    a: { x: number; y: number }[],
    b: { x: number; y: number }[],
    gridSize: number,
): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const ax = Math.round(a[i].x / gridSize) * gridSize;
        const ay = Math.round(a[i].y / gridSize) * gridSize;
        const bx = Math.round(b[i].x / gridSize) * gridSize;
        const by = Math.round(b[i].y / gridSize) * gridSize;
        if (ax !== bx || ay !== by) return false;
    }
    return true;
};

interface CTOEditorProps {
    cto: CTOData;
    projectName: string;
    incomingCables: CableData[];
    onClose: () => void;
    onSave: (updatedCTO: CTOData) => Promise<void> | void;
    onEditCable: (cable: CableData) => void;

    // VFL Props
    litPorts: Set<string>;
    vflSource: string | null;
    vflDirection: 'both' | 'upstream' | 'downstream';
    onChangeVflDirection: (direction: 'both' | 'upstream' | 'downstream') => void;
    onToggleVfl: (portId: string) => void;

    // OTDR Prop
    onOtdrTrace: (portId: string, distance: number) => void;

    // Hover Highlight
    onHoverCable?: (cableId: string | null) => void;
    onDisconnectCable?: (cableId: string, nodeId: string) => void;
    onSelectNextNode?: (cableId: string) => void;

    // Cable street name persistence
    onUpdateCableStreetNames?: (updates: Map<string, string>) => void;

    // Plan Props for Gatekeeping
    userPlan?: string;
    subscriptionExpiresAt?: string | null;
    onShowUpgrade?: () => void;
    userRole?: string | null;
    userPermissions?: string[];
    network: NetworkState;
    projectId?: string;
    companyLogo?: string | null;
    saasLogo?: string | null;
    autoDownload?: boolean; // NEW: To trigger export on load
    readOnly?: boolean;
    readOnlyLabel?: string;
    onGoToParentProject?: () => void;
    showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type DragMode = 'view' | 'element' | 'connection' | 'point' | 'reconnect' | 'window' | 'note' | 'resize';


// --- COMPONENT: ConnectionsLayer (Memoized with custom areEqual to prevent SVG re-renders) ---
interface ConnectionsLayerProps {
    connections: FiberConnection[];
    litConnections: Set<string>;
    hoveredPortId: string | null;
    isVflToolActive: boolean;
    isOtdrToolActive: boolean;
    dragState: any;
    cacheVersion: number;
    getPortCenter: (portId: string) => { x: number; y: number } | null;
    resolveFiberPortColor: (portId: string) => string | null;
    handleSmartAlignConnection: (connId: string) => void;
    onDisconnectConnection?: (connId: string) => void;
    handlePathMouseDown: (e: React.MouseEvent, connId: string) => void;
    handlePointMouseDown: (e: React.MouseEvent, connId: string, idx: number) => void;
    removeConnection: (connId: string) => void;
    removePoint: (e: React.MouseEvent, connId: string, idx: number) => void;
    connectionRefs: React.MutableRefObject<Record<string, SVGPathElement | null>>;
    connectionPointRefs: React.MutableRefObject<Record<string, SVGCircleElement | null>>;
    isSmartAlignMode: boolean;
    onHoverConnection?: (id: string | null) => void;
}

const ConnectionsLayer = React.memo(({
    connections,
    litConnections,
    hoveredPortId,
    isVflToolActive,
    isOtdrToolActive,
    dragState,
    getPortCenter,
    resolveFiberPortColor,
    handleSmartAlignConnection,
    handlePathMouseDown,
    handlePointMouseDown,
    removeConnection,
    removePoint,
    connectionRefs,
    connectionPointRefs,
    isSmartAlignMode,
    onHoverConnection
}: ConnectionsLayerProps) => {
    return (
        <>
            {connections.map((conn) => {
                if (dragState?.mode === 'reconnect' && dragState.connectionId === conn.id) return null;

                const p1 = getPortCenter(conn.sourceId);
                const p2 = getPortCenter(conn.targetId);
                if (!p1 || !p2) return null;

                const isLit = litConnections.has(conn.id);

                // THEME AWARE SPLITTER COLOR:
                const isSplitterConn = conn.sourceId.includes('spl-') || conn.targetId.includes('spl-');
                const isDefaultSplitterColor = conn.color === '#0f172a' || conn.color === '#94a3b8';
                const useThemeColor = isSplitterConn && isDefaultSplitterColor && !isLit;

                // Live fiber color lookup — keeps line color in sync with bolinha even when
                // the connection's stored `color` is stale (created before palette tweaks).
                const liveFiberColor = resolveFiberPortColor(conn.sourceId) || resolveFiberPortColor(conn.targetId);
                const baseColor = liveFiberColor || conn.color;

                const finalColor = isLit ? '#f87171' : (useThemeColor ? undefined : baseColor);
                const finalWidth = 2.5;

                let d = `M ${p1.x} ${p1.y} `;
                if (conn.points && conn.points.length > 0) {
                    conn.points.forEach((p: any) => {
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
                            style={{ filter: isLit ? 'drop-shadow(0 0 2.5px rgba(248,113,113,0.6))' : 'none' }}
                            className={`hover:stroke-width-4 cursor-pointer transition-colors duration-150 ${useThemeColor ? 'stroke-slate-900 dark:stroke-white' : ''}`}
                            onClick={(e) => {
                                if (isSmartAlignMode) handleSmartAlignConnection(conn.id);
                            }}
                            onMouseDown={(e) => handlePathMouseDown(e, conn.id)}
                            onMouseEnter={() => onHoverConnection && onHoverConnection(conn.id)}
                            onMouseLeave={() => onHoverConnection && onHoverConnection(null)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeConnection(conn.id);
                            }}
                            onDoubleClick={() => removeConnection(conn.id)}
                        />
                        {!isVflToolActive && !isOtdrToolActive && conn.points?.map((pt: any, idx: number) => {
                            const isDraggingThisConnection = dragState?.mode === 'point' && dragState.connectionId === conn.id;
                            return (
                                <circle
                                    key={idx}
                                    ref={el => { connectionPointRefs.current[`${conn.id}-${idx}`] = el; }}
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={5}
                                    fill="#fff"
                                    stroke={baseColor}
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
        </>
    );
}, (prev, next) => {
    // Custom areEqual — only re-render when data that affects visual output changes.
    // Callbacks are stable (useCallback) or read via refs, so skip comparing them.
    return prev.cacheVersion === next.cacheVersion
        && prev.connections === next.connections
        && prev.litConnections === next.litConnections
        && prev.hoveredPortId === next.hoveredPortId
        && prev.dragState === next.dragState
        && prev.isSmartAlignMode === next.isSmartAlignMode
        && prev.isVflToolActive === next.isVflToolActive
        && prev.isOtdrToolActive === next.isOtdrToolActive;
});

export const CTOEditor: React.FC<CTOEditorProps> = ({
    cto, projectName, incomingCables, onClose, onSave, onEditCable,
    litPorts: incomingLitPorts, vflSource, vflDirection, onChangeVflDirection, onToggleVfl, onOtdrTrace, onHoverCable, onDisconnectCable, onSelectNextNode, onUpdateCableStreetNames,
    userPlan, subscriptionExpiresAt, onShowUpgrade, network, userRole, userPermissions = [],
    projectId, companyLogo, saasLogo,
    autoDownload, readOnly = false, readOnlyLabel, onGoToParentProject, showToast
}) => {
    const { t } = useLanguage();
    const canEdit = !readOnly && (hasPermission(userPermissions, 'map:edit') || userRole === 'OWNER');

    // Fallback: se showToast não foi passado, cai pra alert. Mantém o comportamento
    // pré-existente em chamadores que não atualizaram a prop ainda.
    const notify = (msg: string, type: 'success' | 'info' | 'error' = 'info') => {
        if (showToast) showToast(msg, type);
        else alert(msg);
    };

    // Modal de confirmação destrutiva (substitui window.confirm pro "limpar conexões").
    const [destructiveConfirm, setDestructiveConfirm] = useState<null | {
        title: string;
        message: string;
        confirmLabel?: string;
        onConfirm: () => void;
    }>(null);

    // --- CTO STATE MANAGEMENT (extracted hook) ---
    const {
        localCTO, setLocalCTO, localCTORef,
        savingAction,
        showCloseConfirm, setShowCloseConfirm,
        handleApply: _handleApply,
        handleSaveAndClose: _handleSaveAndClose,
        handleCloseRequest,
    } = useCTOEditorState({ cto, incomingCables, onSave, onClose });

    const [ctoCustomers, setCtoCustomers] = useState<Customer[]>([]);
    const [litPorts, setLitPorts] = useState<Set<string>>(incomingLitPorts);
    const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);

    // Auto-download logic for deep links (ref assigned after handleExportPNG is defined)
    const handleExportPNGRef = useRef<() => void>(() => { });

    useEffect(() => {
        if (autoDownload) {
            console.log("[CTOEditor] Auto-download triggered via deep link");
            const timer = setTimeout(() => {
                handleExportPNGRef.current();
            }, 3000); // 3 seconds to be safe with all renders
            return () => clearTimeout(timer);
        }
    }, [autoDownload]);

    // Nota: o sync `setLitPorts(incomingLitPorts)` quando o set entra novo de App.tsx
    // é feito pelo useLayoutEffect abaixo (que combina sync + filtro direcional).
    // Ter os dois separados causava race: o BFS de App.tsx retorna novo Set toda
    // vez que vflDirection muda, e o `useEffect` antigo sobrescrevia o resultado
    // filtrado pelo useLayoutEffect.

    useEffect(() => {
        if (cto.id) {
            getCustomers({ ctoId: cto.id, projectId }).then(setCtoCustomers).catch(console.error);
        }
    }, [cto.id, projectId]);

    // Auto-fetch street names for cables that don't have one yet
    const cableStreetNamesRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        if (!cto.id || incomingCables.length === 0) return;
        const cablesWithoutStreet = incomingCables.filter(c => !c.streetName && c.coordinates?.length >= 2);
        if (cablesWithoutStreet.length === 0) return;

        getCableStreetNames(incomingCables, cto.id).then(streetMap => {
            if (streetMap.size === 0) return;

            // Store in ref for immediate display
            cableStreetNamesRef.current = streetMap;
            forceRender(n => n + 1);

            // Persist to network/database via callback (only new ones)
            const newStreetNames = new Map<string, string>();
            streetMap.forEach((name, cableId) => {
                const cable = incomingCables.find(c => c.id === cableId);
                if (cable && !cable.streetName) {
                    newStreetNames.set(cableId, name);
                }
            });
            if (newStreetNames.size > 0 && onUpdateCableStreetNames) {
                onUpdateCableStreetNames(newStreetNames);
            }
        }).catch(err => console.warn('[CTOEditor] Street name fetch failed:', err));
    }, [cto.id, incomingCables.length]);

    // (withDefaults moved to useCTOEditorState hook)

    // (reconcileOrphans, localCTO state, sync logic, localCTORef, snapshot — all in useCTOEditorState hook)

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

    const getInitialViewState = (data: CTOData, vw?: number, vh?: number) => {
        let minX = Infinity, minY = Infinity, maxY = -Infinity, maxX = -Infinity;

        if (data.layout) {
            incomingCables.forEach(cable => {
                const l = data.layout![cable.id];
                if (!l) return;
                const looseTubeCount = cable.looseTubeCount || 1;
                const totalHeight = 24 + (cable.fiberCount * 24) + ((looseTubeCount - 1) * 12);
                const b = getElementBounds(l.x, l.y, 168 + 24, totalHeight, l.rotation || 0);
                if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
                if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
            });

            data.splitters.forEach(split => {
                const l = data.layout![split.id];
                if (!l) return;
                const width = split.outputPortIds.length * 24;
                const b = getElementBounds(l.x, l.y, width, 72, l.rotation || 0);
                if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
                if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
            });

            data.fusions.forEach(fusion => {
                const l = data.layout![fusion.id];
                if (!l) return;
                const b = getElementBounds(l.x, l.y, 48, 24, l.rotation || 0);
                if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
                if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
            });

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

        const viewportW = vw ?? 1100;
        const viewportH = (vh ?? 750) - 56;

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
    const viewStateRef = useRef(viewState);
    useLayoutEffect(() => { viewStateRef.current = viewState; }, [viewState]);

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

    // Holding Alt temporarily disables snap during drag — same UX as Figma/Illustrator.
    // `effectiveSnapping` is what handlers check; the raw `isSnapping` is the user's
    // persistent preference shown on the toolbar toggle.
    const isAltHeld = useAltKeyHeld();
    const effectiveSnapping = isSnapping && !isAltHeld;

    // Centralized tool mode state — see hooks/useToolModes.ts
    // Only the setters used externally (bypassing toggleToolMode) are destructured.
    const {
        isVflToolActive, isOtdrToolActive, isSmartAlignMode, isRotateMode,
        isDeleteMode, isFusionToolActive, showSplitterDropdown,
        setIsOtdrToolActive, setIsFusionToolActive, setShowSplitterDropdown,
        toolModesRef,
        clearAllToolModes, toggleToolMode,
    } = useToolModes(effectiveSnapping);

    // Quando o usuário desativa o modo VFL pelo botão da toolbar, limpa também
    // a porta-fonte (apaga o laser). Sem isso, a fonte ficava persistente e o
    // mapa/outros editores continuavam mostrando o feixe aceso mesmo depois de
    // fechar a ferramenta. `onToggleVflRef` evita disparar o efeito quando o
    // callback troca de referência (ex: editingCTO mudou).
    const onToggleVflRef = useRef(onToggleVfl);
    useEffect(() => { onToggleVflRef.current = onToggleVfl; });
    const prevVflActiveRef = useRef(isVflToolActive);
    useEffect(() => {
        if (prevVflActiveRef.current && !isVflToolActive && vflSource) {
            onToggleVflRef.current(vflSource); // toggle off (prev === vflSource → null)
        }
        prevVflActiveRef.current = isVflToolActive;
    }, [isVflToolActive, vflSource]);

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

    const DEFAULT_WIDTH = 1100;
    const DEFAULT_HEIGHT = 750;
    const MIN_WIDTH = 600;
    const MIN_HEIGHT = 400;

    const [modalSize, setModalSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
    const [isMaximized, setIsMaximized] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [savedWindowPos, setSavedWindowPos] = useState(windowPos);
    const [savedModalSize, setSavedModalSize] = useState(modalSize);

    const toggleMaximize = () => {
        if (!isMaximized) {
            setSavedWindowPos(windowPos);
            setSavedModalSize(modalSize);
            setIsMaximized(true);
            setIsCollapsed(false);
        } else {
            setIsMaximized(false);
            setWindowPos(savedWindowPos);
            setModalSize(savedModalSize);
        }
        // Force re-center after layout settles
        setTimeout(() => handleCenterView(), 100);
    };

    const [otdrTargetPort, setOtdrTargetPort] = useState<string | null>(null);
    const [otdrDistance, setOtdrDistance] = useState<string>('');
    const [isAutoSpliceOpen, setIsAutoSpliceOpen] = useState(false);
    const [autoSourceId, setAutoSourceId] = useState<string>('');
    const [autoTargetId, setAutoTargetId] = useState<string>('');
    const [exportingType, setExportingType] = useState<'png' | 'pdf' | null>(null);
    // (showCloseConfirm from useCTOEditorState hook)
    const [propertiesName, setPropertiesName] = useState('');
    const [propertiesStatus, setPropertiesStatus] = useState<CTOStatus>('PLANNED');
    const [cableToRemove, setCableToRemove] = useState<string | null>(null);
    const [splitterRename, setSplitterRename] = useState<{ id: string; value: string } | null>(null);

    // Sync properties states with localCTO when it changes (initial load)
    useEffect(() => {
        setPropertiesName(localCTO.name);
        setPropertiesStatus((localCTO.status as CTOStatus) || 'PLANNED');
    }, [localCTO.id]);


    const [splitterFilter, setSplitterFilter] = useState<'Balanced' | 'Unbalanced'>('Balanced');

    // FUSION TOOL STATE (isFusionToolActive is managed by useToolModes above)
    const [selectedFusionTypeId, setSelectedFusionTypeId] = useState<string | null>(null);
    const [showFusionTypeModal, setShowFusionTypeModal] = useState(false);

    // CONNECTOR TOOL STATE (reuses fusion tool internally, just tracks which type is selected)
    const [showConnectorTypeModal, setShowConnectorTypeModal] = useState(false);
    const [availableConnectors, setAvailableConnectors] = useState<FusionCatalogItem[]>([]);
    // Connector tool is active when fusion tool is active AND the selected type is a connector
    const isConnectorToolActive = isFusionToolActive && availableConnectors.some(c => c.id === selectedFusionTypeId);
    // cursorPosition removed — fusion ghost is now positioned via cursorGhostRef (direct DOM)

    // --- CATALOG INTEGRATION (declared early so toggleToolMode can reference loadCatalogsOnDemand) ---
    const [availableCables, setAvailableCables] = useState<CableCatalogItem[]>([]);
    const [availableFusions, setAvailableFusions] = useState<FusionCatalogItem[]>([]);
    const [availableOLTs, setAvailableOLTs] = useState<OLTCatalogItem[]>([]);
    const [availableSplitters, setAvailableSplitters] = useState<SplitterCatalogItem[]>([]);
    // Load catalogs on mount (splitters, fusions, cables, OLTs).
    // Box catalog is not loaded here — model selection lives in the CTO Properties panel.
    useEffect(() => {
        const loadCatalogs = async () => {
            try {
                const [splitters, fusions, connectors, cables, olts] = await Promise.all([
                    getSplitters(),
                    getFusions('fusion'),
                    getFusions('connector'),
                    getCables(),
                    getOLTs()
                ]);
                setAvailableSplitters(splitters);
                setAvailableFusions(fusions);
                setAvailableConnectors(connectors);
                setAvailableCables(cables);
                setAvailableOLTs(olts);
            } catch (err) {
                console.error("Failed to load catalogs", err);
            }
        };
        loadCatalogs();
    }, []);

    // Tool mode management (clearAllToolModes, toggleToolMode, toolModesRef)
    // has moved to the useToolModes hook at the top of this component.

    const GRID_SIZE = 6; // Reduced from 12 for finer granule control
    const splitterDropdownRef = useRef<HTMLDivElement>(null);

    // Optical Power Calculation State
    const [isOpticalModalOpen, setIsOpticalModalOpen] = useState(false);
    const [opticalResult, setOpticalResult] = useState<OpticalPathResult | null>(null);
    const [selectedSplitterName, setSelectedSplitterName] = useState('');
    const [selectedSplitterForModal, setSelectedSplitterForModal] = useState<Splitter | null>(null);

    // UNIFIED CACHE CLEAR
    // Clears geometric caches when structure changes (NOT on pan/zoom — ports don't move relative to canvas).
    // forceRender is needed so ConnectionsLayer can measure port positions after DOM paints.
    // cacheVersion is passed to ConnectionsLayer so the custom areEqual doesn't block the re-render.
    const [cacheVersion, forceRender] = useState(0);

    useLayoutEffect(() => {
        portCenterCache.current = {};
        containerRectCache.current = null;
        forceRender(n => n + 1);
    // `isCollapsed` invalidates the cache too: while collapsed the canvas is `display:none`,
    // so getBoundingClientRect() returns zeros. Without this, expanding the modal would
    // reuse poisoned 0,0 port positions, making connections originate from the top-left corner.
    // `localCTO.dios` is intentionally NOT in deps: every DIO add/remove also mutates
    // `localCTO.layout`, so port-position cache invalidation already happens via that dep.
    // Including the array would invalidate on every prop sync (deep clone produces a new ref).
    }, [incomingCables, localCTO.connections, localCTO.layout, localCTO.splitters, localCTO.fusions, isMaximized, modalSize, isCollapsed]);


    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsAutoSpliceOpen(false);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

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
        initialWindowPos?: { x: number, y: number };
        offsetX?: number;
        offsetY?: number;
        // Optimization: Cache initial connection points for delta calculation
        initialConnectionPoints?: { x: number, y: number }[];
    } | null>(null);
    const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
    const [hoveredElement, setHoveredElement] = useState<{ id: string, type: 'cable' | 'connection' | 'splitter' | 'fusion' | 'dio' } | null>(null);
    const [showDIOModal, setShowDIOModal] = useState(false);
    // Ref mirror of dragState — used by stable hover callbacks to suppress
    // re-renders during element drag (direct-DOM transforms would otherwise
    // be overwritten by React's re-render, causing the element/fibers to jitter).
    const dragStateRef = useRef(dragState);
    dragStateRef.current = dragState;
    const [showHotkeys, setShowHotkeys] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const diagramRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const hotkeysRef = useRef<HTMLDivElement>(null);
    // Generic Context Menu State: { x, y, id, type }
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string, type: 'cable' | 'splitter' } | null>(null);

    // Close menu on click elsewhere
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            // IF clicking inside context menu, don't close it (let the button handlers do it)
            if (contextMenuRef.current && contextMenuRef.current.contains(e.target as Node)) {
                return;
            }

            setContextMenu(null);
            if (showHotkeys && hotkeysRef.current && !hotkeysRef.current.contains(e.target as Node)) {
                setShowHotkeys(false);
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [showHotkeys]);

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


    // Derived state for layout calculation
    const containerRef = useRef<HTMLDivElement>(null);
    const diagramContentRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const cursorGhostRef = useRef<HTMLDivElement>(null);

    // (Force-update logic unified above)
    // --- ESCAPE KEY HANDLER ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Cancel all active tools
                clearAllToolModes();
                setShowFusionTypeModal(false);
                if (cursorGhostRef.current) cursorGhostRef.current.style.display = 'none';

                // If dragging something, cancel it
                setDragState(null);

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
            forceRender(n => n + 1);
            setIsContentReady(true);
        }, 350); // Wait for animate-in duration
        return () => clearTimeout(timer);
    }, []);

    // --- Auto-connect pass-through cables (sangria pairs) ---
    // A pass-through pair is: one cable arriving (toNodeId === cto.id)
    // and one cable leaving (fromNodeId === cto.id), both originating
    // from the same split (same base name without last (A)/(B) suffix).
    const autoConnectedRef = useRef(false);
    useEffect(() => {
        if (!isContentReady || autoConnectedRef.current || incomingCables.length < 2) return;
        autoConnectedRef.current = true;

        const ctoId = cto.id;

        // Separate cables by direction relative to this CTO
        const arriving = incomingCables.filter(c => c.toNodeId === ctoId);
        const leaving = incomingCables.filter(c => c.fromNodeId === ctoId);

        if (arriving.length === 0 || leaving.length === 0) return;

        // Match pairs by base name (strip last parenthetical suffix)
        const getBaseName = (name: string) => name.replace(/\s*\([A-Za-z]\)\s*$/, '').trim();

        const pairs: [CableData, CableData][] = [];
        const usedLeaving = new Set<string>();

        arriving.forEach(arrCable => {
            const arrBase = getBaseName(arrCable.name);
            const match = leaving.find(lCable =>
                !usedLeaving.has(lCable.id) &&
                getBaseName(lCable.name) === arrBase &&
                lCable.fiberCount === arrCable.fiberCount
            );
            if (match) {
                pairs.push([arrCable, match]);
                usedLeaving.add(match.id);
            }
        });

        if (pairs.length === 0) return;

        setLocalCTO(prev => {
            let allNew: FiberConnection[] = [];

            pairs.forEach(([source, target]) => {
                // Skip if ANY fiber of either cable already has a connection
                // (means user already managed this pair — don't override)
                const hasAnyConnection = prev.connections.some(c =>
                    c.sourceId.startsWith(source.id + '-') || c.targetId.startsWith(source.id + '-') ||
                    c.sourceId.startsWith(target.id + '-') || c.targetId.startsWith(target.id + '-')
                );
                if (hasAnyConnection) return;

                const count = Math.min(source.fiberCount, target.fiberCount);
                const srcTubes = source.looseTubeCount || 1;
                const srcFPT = Math.ceil(source.fiberCount / srcTubes);

                for (let i = 0; i < count; i++) {
                    const sourceFiberId = `${source.id}-fiber-${i}`;
                    const targetFiberId = `${target.id}-fiber-${i}`;

                    const isOccupied = prev.connections.some(c =>
                        c.sourceId === sourceFiberId || c.targetId === sourceFiberId ||
                        c.sourceId === targetFiberId || c.targetId === targetFiberId
                    ) || allNew.some(c =>
                        c.sourceId === sourceFiberId || c.targetId === sourceFiberId ||
                        c.sourceId === targetFiberId || c.targetId === targetFiberId
                    );
                    if (isOccupied) continue;

                    allNew.push({
                        id: `conn-auto-${Date.now()}-${i}`,
                        sourceId: sourceFiberId,
                        targetId: targetFiberId,
                        color: getFiberColor(i % srcFPT, source.colorStandard),
                        points: []
                    });
                }
            });

            if (allNew.length === 0) return prev;
            return { ...prev, connections: [...prev.connections, ...allNew] };
        });
    }, [isContentReady, incomingCables, cto.id]);

    const litConnections = useMemo(() => {
        const lit = new Set<string>();
        localCTO.connections.forEach(conn => {
            // Exige AMBOS os endpoints em litPorts. Antes era `||`, o que fazia
            // toda conexão da porta-fonte acender automaticamente — quebrando o
            // filtro direcional (fonte está sempre em litPorts).
            if (litPorts.has(conn.sourceId) && litPorts.has(conn.targetId)) {
                lit.add(conn.id);
            }
        });
        return lit;
    }, [litPorts, localCTO.connections]);

    // All fiber ports in incoming cables PLUS any locally-connected non-fiber ports.
    // We trace every fiber (not just connected ones) so a fiber whose cable still carries
    // OLT signal lights up even after its local connection is removed — meanwhile the
    // OTHER end of a removed splice naturally goes dark because its cable doesn't reach OLT.
    const tracedPorts = useMemo(() => {
        const set = new Set<string>();
        incomingCables.forEach(cable => {
            for (let i = 0; i < cable.fiberCount; i++) {
                set.add(`${cable.id}-fiber-${i}`);
            }
        });
        localCTO.connections.forEach(conn => {
            if (!conn.sourceId.includes('-fiber-')) set.add(conn.sourceId);
            if (!conn.targetId.includes('-fiber-')) set.add(conn.targetId);
        });
        return set;
    }, [incomingCables, localCTO.connections]);

    // Pre-computed power + flow direction per port. Memo depends on the network
    // topology pieces that influence power, not on layout drags, to avoid retracing
    // on every mouse move.
    // Fusions e Connectors são listas separadas no catálogo (getFusions('fusion') vs
    // getFusions('connector')), mas ambas são FusionCatalogItem e ambas podem ser
    // referenciadas como `fusion.catalogId` (CTOEditor.createFusionAtCursor procura nas
    // duas). O trace precisa enxergar a UNIÃO; do contrário fusões cadastradas como
    // conector caem no fallback "sem catálogo" e ficam com perda 0.
    const allFusionCatalogs = useMemo(
        () => [...availableFusions, ...availableConnectors],
        [availableFusions, availableConnectors]
    );

    // Objeto compartilhado entre os 3 sites que invocam tracePortPower / traceOpticalPath
    // (portPowerMap, exportação PNG, modal de orçamento óptico). Antes a montagem era
    // duplicada inline e divergiu (cada site precisava lembrar de incluir allFusionCatalogs).
    const tracingCatalogs = useMemo(() => ({
        splitters: availableSplitters,
        fusions: allFusionCatalogs,
        cables: availableCables,
        olts: availableOLTs,
    }), [availableSplitters, allFusionCatalogs, availableCables, availableOLTs]);

    const portPowerMap = useMemo(() => {
        const map = new Map<string, { power: number | null; direction: 'fromCable' | 'fromPort' | null }>();
        const catalogs = tracingCatalogs;
        tracedPorts.forEach(portId => {
            try {
                map.set(portId, tracePortPower(portId, cto.id, network, catalogs, localCTO));
            } catch {
                map.set(portId, { power: null, direction: null });
            }
        });
        return map;
    }, [tracedPorts, localCTO.splitters, localCTO.fusions, localCTO.dios, cto.id, network, tracingCatalogs]);

    const getPortPower = useCallback((portId: string): number | null => {
        return portPowerMap.get(portId)?.power ?? null;
    }, [portPowerMap]);

    const getPortDirection = useCallback((portId: string): 'fromCable' | 'fromPort' | null => {
        return portPowerMap.get(portId)?.direction ?? null;
    }, [portPowerMap]);

    // Resolve the live fiber color for a given fiber port id. Used by the connection
    // renderer so SVG line color always matches the bolinha (overrides any stale color
    // baked into the FiberConnection at creation time).
    const resolveFiberPortColor = useCallback((portId: string): string | null => {
        const match = portId.match(/(.*)-fiber-(\d+)$/);
        if (!match) return null;
        const cableId = match[1];
        const fiberGlobalIndex = parseInt(match[2], 10);
        const cable = incomingCables.find(c => c.id === cableId);
        if (!cable) return null;
        const looseTubeCount = cable.looseTubeCount || 1;
        const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);
        const positionInTube = fiberGlobalIndex % fibersPerTube;
        return getFiberColor(positionInTube, cable.colorStandard);
    }, [incomingCables]);

    // Ports that actually carry OLT signal — derived from the power map. A fiber
    // is "lit" only when there's a finite power reaching it (not merely connected).
    const poweredPorts = useMemo(() => {
        const set = new Set<string>();
        portPowerMap.forEach((entry, portId) => {
            if (entry.power !== null && isFinite(entry.power)) set.add(portId);
        });
        return set;
    }, [portPowerMap]);

    // Pre-computed customer lookups to avoid O(n) scans per render of each splitter/fusion.
    // Keyed by splitter id → port index → customer info, and by connector id → customer info.
    const customersBySplitterPort = useMemo(() => {
        const map = new Map<string, Map<number, { name: string; status?: string }>>();
        for (const c of ctoCustomers) {
            if (c.splitterId && c.splitterPortIndex !== null && c.splitterPortIndex !== undefined) {
                let inner = map.get(c.splitterId);
                if (!inner) {
                    inner = new Map();
                    map.set(c.splitterId, inner);
                }
                inner.set(c.splitterPortIndex, { name: c.name, status: c.connectionStatus });
            }
        }
        return map;
    }, [ctoCustomers]);

    const customersByConnector = useMemo(() => {
        const map = new Map<string, { name: string; status?: string }>();
        for (const c of ctoCustomers) {
            if (c.connectorId) {
                map.set(c.connectorId, { name: c.name, status: c.connectionStatus });
            }
        }
        return map;
    }, [ctoCustomers]);

    const getLayout = (id: string) => localCTO.layout?.[id] || { x: 0, y: 0, rotation: 0 };

    // Viewport culling — skip rendering off-screen elements to reduce DOM nodes.
    // At high zoom (>1.5), culling is disabled: few elements are on screen anyway,
    // and the margin becomes too tight (200px / zoom), causing false culling.
    // Reads from viewStateRef to stay accurate even after DOM-direct panning, but
    // depends on `viewState` in the deps so that React-driven viewport changes
    // (zoom via setViewState, fit-to-content, etc.) invalidate downstream React.memo'd
    // renderers — otherwise newly-visible elements stay culled until some other prop forces a re-check.
    const isElementVisible = useCallback((layout: { x: number; y: number }, width: number, height: number) => {
        const vs = viewStateRef.current;
        if (vs.zoom > 1.5) return true; // High zoom = few elements, culling not needed
        const vw = isMaximized ? window.innerWidth : modalSize.w;
        const vh = isMaximized ? window.innerHeight : modalSize.h;
        const MARGIN = 300;
        const minX = (-vs.x - MARGIN) / vs.zoom;
        const minY = (-vs.y - MARGIN) / vs.zoom;
        const maxX = (-vs.x + vw + MARGIN) / vs.zoom;
        const maxY = (-vs.y + vh + MARGIN) / vs.zoom;
        return layout.x + width > minX && layout.x < maxX
            && layout.y + height > minY && layout.y < maxY;
    }, [isMaximized, viewState, modalSize.w, modalSize.h]);

    const screenToCanvas = (sx: number, sy: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (sx - rect.left - viewStateRef.current.x) / viewStateRef.current.zoom,
            y: (sy - rect.top - viewStateRef.current.y) / viewStateRef.current.zoom
        };
    };

    const portCenterCache = useRef<Record<string, { x: number, y: number }>>({});
    // Snapshot of port positions at the moment an element drag starts.
    // Used by handleMouseMove to compute connection endpoints from the ORIGINAL
    // port positions + total drag delta — immune to mid-drag cache invalidation
    // (which can happen if the parent passes a new `incomingCables` reference,
    // triggering useLayoutEffect to wipe portCenterCache).
    const dragPortSnapshot = useRef<Record<string, { x: number, y: number }>>({});
    const containerRectCache = useRef<DOMRect | null>(null);

    const getPortCenter = useCallback((portId: string): { x: number, y: number } | null => {
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
                x: (relX - viewStateRef.current.x) / viewStateRef.current.zoom,
                y: (relY - viewStateRef.current.y) / viewStateRef.current.zoom
            };
            portCenterCache.current[portId] = result;
            return result;
        }
        return null;
    }, [viewState.zoom]);

    // Sync litPorts do prop. Sem mais filtro visual por posição — a direção é
    // tratada inteiramente pela source-restriction no BFS de App.tsx (que limita
    // o caminhar inicial a um dos extremos do cabo da fonte). O filtro visual
    // anterior conflitava com a restrição: clicando uma fibra "baixa" com ↓, o
    // BFS atingia ports topologicamente corretos, mas o filtro visual removia
    // tudo que estivesse "acima" da fonte (incluindo o cross-connect alvo).
    useEffect(() => {
        setLitPorts(incomingLitPorts);
    }, [incomingLitPorts]);

    // Forward-ref: handleSmartAlignCable é declarado abaixo. Permite que
    // handleSmartAlignConnection delegue pra ele sem TDZ.
    const smartAlignCableForwardRef = useRef<((cableId: string) => void) | null>(null);

    const handleSmartAlignConnection = useCallback((connId: string) => {
        // Quando essa conexão faz parte de um grupo (várias fibras do mesmo
        // cabo indo pro mesmo destino), delega pro alinhamento de CABO. Ele já
        // espaça lanes em 12px uniformes via LANE_SPACING. Sem isso, ciclar
        // shape em cada conexão individualmente produz midX/thirdX idênticos
        // pras N conexões → todas no mesmo bend column → empilhamento.
        const triggerConn = localCTORef.current.connections.find(c => c.id === connId);
        if (triggerConn) {
            const extractCableId = (portId: string) => {
                const i = portId.indexOf('-fiber-');
                return i >= 0 ? portId.slice(0, i) : null;
            };
            const srcCable = extractCableId(triggerConn.sourceId);
            const tgtCable = extractCableId(triggerConn.targetId);
            const siblings = localCTORef.current.connections.filter(c => {
                const cs = extractCableId(c.sourceId);
                const ct = extractCableId(c.targetId);
                return cs === srcCable && ct === tgtCable;
            });
            const cableForAlign = srcCable || tgtCable;
            if (siblings.length > 1 && cableForAlign && smartAlignCableForwardRef.current) {
                smartAlignCableForwardRef.current(cableForAlign);
                return;
            }
        }

        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.map(c => {
                if (c.id !== connId) return c;
                const p1 = getPortCenter(c.sourceId);
                const p2 = getPortCenter(c.targetId);
                if (!p1 || !p2) return c;

                // --- Sanitize helper ---
                const sanitize = (pts: { x: number, y: number }[]) => {
                    if (!pts || pts.length === 0) return [];
                    let prevRef = { x: Math.round(p1.x / GRID_SIZE) * GRID_SIZE, y: Math.round(p1.y / GRID_SIZE) * GRID_SIZE };
                    const cleanPts = pts.map(p => {
                        let nx = Math.round(p.x / GRID_SIZE) * GRID_SIZE;
                        let ny = Math.round(p.y / GRID_SIZE) * GRID_SIZE;
                        const THRESHOLD = GRID_SIZE * 1.5;
                        const dx = Math.abs(nx - prevRef.x);
                        const dy = Math.abs(ny - prevRef.y);
                        if (dx < THRESHOLD && dy >= THRESHOLD) nx = prevRef.x;
                        else if (dy < THRESHOLD && dx >= THRESHOLD) ny = prevRef.y;
                        prevRef = { x: nx, y: ny };
                        return { x: nx, y: ny };
                    });
                    return cleanPts.filter((p, i) => {
                        if (i === 0) return true;
                        return !(p.x === cleanPts[i - 1].x && p.y === cleanPts[i - 1].y);
                    });
                };

                const currentPoints = c.points || [];
                const sanitizedPoints = sanitize(currentPoints);

                const arePointsDifferent = (a: { x: number, y: number }[], b: { x: number, y: number }[]) => {
                    if (a.length !== b.length) return true;
                    for (let i = 0; i < a.length; i++) {
                        if (Math.abs(a[i].x - b[i].x) > 1 || Math.abs(a[i].y - b[i].y) > 1) return true;
                    }
                    return false;
                };

                // If current points are messy, sanitize first
                if (currentPoints.length > 0 && arePointsDifferent(currentPoints, sanitizedPoints)) {
                    return { ...c, points: sanitizedPoints };
                }

                // --- Shape candidates ---
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const thirdX = p1.x + (p2.x - p1.x) / 3;
                const twoThirdX = p1.x + (p2.x - p1.x) * 2 / 3;
                const thirdY = p1.y + (p2.y - p1.y) / 3;
                const twoThirdY = p1.y + (p2.y - p1.y) * 2 / 3;

                const candidates = [
                    [],                                                          // 0: Straight
                    [{ x: p2.x, y: p1.y }],                                     // 1: L horizontal
                    [{ x: p1.x, y: p2.y }],                                     // 2: L vertical
                    [{ x: midX, y: p1.y }, { x: midX, y: p2.y }],               // 3: Z horizontal mid (50%)
                    [{ x: thirdX, y: p1.y }, { x: thirdX, y: p2.y }],           // 4: Z horizontal 1/3
                    [{ x: twoThirdX, y: p1.y }, { x: twoThirdX, y: p2.y }],     // 5: Z horizontal 2/3
                    [{ x: p1.x, y: midY }, { x: p2.x, y: midY }],              // 6: Z vertical mid (50%)
                    [{ x: p1.x, y: thirdY }, { x: p2.x, y: thirdY }],          // 7: Z vertical 1/3
                    [{ x: p1.x, y: twoThirdY }, { x: p2.x, y: twoThirdY }],    // 8: Z vertical 2/3
                ];

                // --- Detect current shape ---
                // Uses direct array comparison (arePointsSnappedEqual) instead of JSON.stringify
                // to avoid allocating 10+ temporary strings per click.
                let matchIndex = -1;
                for (let idx = 0; idx < candidates.length; idx++) {
                    if (arePointsSnappedEqual(candidates[idx], currentPoints, GRID_SIZE)) {
                        matchIndex = idx;
                        break;
                    }
                }

                // Fallback detection by point count + orientation
                if (matchIndex === -1) {
                    if (currentPoints.length === 0) matchIndex = 0;
                    else if (currentPoints.length === 1) {
                        // L shape — check if closer to horizontal or vertical
                        const pt = currentPoints[0];
                        const dxToP2 = Math.abs(pt.x - p2.x);
                        const dyToP1 = Math.abs(pt.y - p1.y);
                        matchIndex = (dxToP2 < dyToP1) ? 1 : 2;
                    }
                    else if (currentPoints.length === 2) {
                        // Z shape — detect orientation and approximate position
                        const dx = Math.abs(currentPoints[0].x - currentPoints[1].x);
                        if (dx < GRID_SIZE * 2) {
                            // Horizontal Z — determine which third
                            const turnX = currentPoints[0].x;
                            const ratio = (turnX - p1.x) / (p2.x - p1.x || 1);
                            if (ratio < 0.4) matchIndex = 4;      // ~1/3
                            else if (ratio > 0.6) matchIndex = 5;  // ~2/3
                            else matchIndex = 3;                    // ~mid
                        } else {
                            // Vertical Z
                            const turnY = currentPoints[0].y;
                            const ratio = (turnY - p1.y) / (p2.y - p1.y || 1);
                            if (ratio < 0.4) matchIndex = 7;
                            else if (ratio > 0.6) matchIndex = 8;
                            else matchIndex = 6;
                        }
                    }
                }

                const nextIndex = (matchIndex + 1) % candidates.length;
                const nextShape = candidates[nextIndex];

                const finalPoints = nextShape.map(p => ({
                    x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
                    y: Math.round(p.y / GRID_SIZE) * GRID_SIZE
                }));

                return { ...c, points: finalPoints };
            })
        }));
    }, [getPortCenter, setLocalCTO]);

    const handleSmartAlignCable = (cableId: string) => {
        setLocalCTO(prev => {
            // --- Collect & sort relevant connections by fiber index ---
            const relevantConnections = prev.connections.filter(c =>
                c.sourceId.startsWith(cableId + '-') || c.targetId.startsWith(cableId + '-') ||
                c.sourceId === cableId || c.targetId === cableId
            );
            if (relevantConnections.length === 0) return prev;

            const getFiberIdx = (conn: FiberConnection) => {
                const ownPort = conn.sourceId.startsWith(cableId) ? conn.sourceId : conn.targetId;
                const m = ownPort.match(/-fiber-(\d+)$/);
                return m ? parseInt(m[1]) : 0;
            };

            const sorted = [...relevantConnections].sort((a, b) => getFiberIdx(a) - getFiberIdx(b));
            const connIndexMap = new Map<string, number>();
            sorted.forEach((c, i) => connIndexMap.set(c.id, i));
            const totalConns = sorted.length;

            // --- Sanitize helper ---
            const sanitize = (pts: { x: number; y: number }[], startP: { x: number; y: number }) => {
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

            // --- Determine action from representative ---
            let action: 'SANITIZE' | 'CYCLE' = 'CYCLE';
            let nextShapeIdx = 0;

            const representative = sorted[0];
            const p1Rep = getPortCenter(representative.sourceId);
            const p2Rep = getPortCenter(representative.targetId);

            if (p1Rep && p2Rep) {
                const currentPoints = representative.points || [];
                const sanitizedPoints = sanitize(currentPoints, p1Rep);

                const arePointsDifferent = (a: any[], b: any[]) => {
                    if (a.length !== b.length) return true;
                    for (let i = 0; i < a.length; i++) if (Math.abs(a[i].x - b[i].x) > 1 || Math.abs(a[i].y - b[i].y) > 1) return true;
                    return false;
                };

                if (currentPoints.length > 0 && arePointsDifferent(currentPoints, sanitizedPoints)) {
                    action = 'SANITIZE';
                } else {
                    // Detect current shape to determine cycle index
                    // Use simple shapes for detection (same as before)
                    const midX = (p1Rep.x + p2Rep.x) / 2;
                    const midY = (p1Rep.y + p2Rep.y) / 2;
                    const detectionCandidates = [
                        [],                                                     // 0: Straight
                        [{ x: p2Rep.x, y: p1Rep.y }],                          // 1: L horizontal
                        [{ x: p1Rep.x, y: p2Rep.y }],                          // 2: L vertical
                        [{ x: midX, y: p1Rep.y }, { x: midX, y: p2Rep.y }],    // 3: Z horizontal (approx)
                        [{ x: p1Rep.x, y: midY }, { x: p2Rep.x, y: midY }],   // 4: Z vertical (approx)
                    ];
                    // Direct array comparison replaces JSON.stringify-based `normalize()`.
                    // The previous `normalize` rounded to integer (not snapped to GRID_SIZE) for current
                    // points but compared against snapped candidates — that worked because integer rounding
                    // of an already-snapped value equals itself. arePointsSnappedEqual does the equivalent
                    // by snapping BOTH sides to GRID_SIZE before comparing.
                    let matchIndex = -1;
                    for (let idx = 0; idx < detectionCandidates.length; idx++) {
                        if (arePointsSnappedEqual(detectionCandidates[idx], currentPoints, GRID_SIZE)) {
                            matchIndex = idx;
                            break;
                        }
                    }

                    // For Z shapes: detect by point count since offsets vary per fiber
                    if (matchIndex === -1 && currentPoints.length === 2) {
                        // Determine if it's a horizontal Z (both points share ~same X) or vertical Z
                        const dx = Math.abs(currentPoints[0].x - currentPoints[1].x);
                        const dy = Math.abs(currentPoints[0].y - currentPoints[1].y);
                        if (dx < GRID_SIZE * 2) matchIndex = 3; // Horizontal Z (vertical turn column)
                        else if (dy < GRID_SIZE * 2) matchIndex = 4; // Vertical Z (horizontal turn row)
                    }
                    // Detect straight (0 points)
                    if (matchIndex === -1 && currentPoints.length === 0) matchIndex = 0;

                    const SHAPE_COUNT = 5;
                    nextShapeIdx = (matchIndex + 1) % SHAPE_COUNT;
                }
            }

            // --- Pre-compute global averages for uniform Z spacing ---
            let avgSourceX = 0, avgSourceY = 0, avgTargetX = 0, avgTargetY = 0;
            let validCount = 0;
            sorted.forEach(c => {
                const s = getPortCenter(c.sourceId);
                const t = getPortCenter(c.targetId);
                if (s && t) {
                    avgSourceX += s.x; avgSourceY += s.y;
                    avgTargetX += t.x; avgTargetY += t.y;
                    validCount++;
                }
            });
            if (validCount > 0) {
                avgSourceX /= validCount; avgSourceY /= validCount;
                avgTargetX /= validCount; avgTargetY /= validCount;
            }

            const LANE_SPACING = GRID_SIZE * 2; // 12px — matches fiber pitch

            // --- Apply to all connections ---
            const updatedConnections = prev.connections.map(c => {
                const isSourceRelated = c.sourceId === cableId || c.sourceId.startsWith(cableId + '-');
                const isTargetRelated = c.targetId === cableId || c.targetId.startsWith(cableId + '-');
                if (!isSourceRelated && !isTargetRelated) return c;

                const p1 = getPortCenter(c.sourceId);
                const p2 = getPortCenter(c.targetId);
                if (!p1 || !p2) return c;

                if (action === 'SANITIZE') {
                    return { ...c, points: sanitize(c.points || [], p1) };
                }

                const idx = connIndexMap.get(c.id) ?? 0;
                const center = (totalConns - 1) / 2;

                let shapePoints: { x: number; y: number }[];

                switch (nextShapeIdx) {
                    case 0: // Straight (no waypoints)
                        shapePoints = [];
                        break;
                    case 1: // L horizontal first
                        shapePoints = [{ x: p2.x, y: p1.y }];
                        break;
                    case 2: // L vertical first
                        shapePoints = [{ x: p1.x, y: p2.y }];
                        break;
                    case 3: { // Uniform Z horizontal — each fiber gets its own turn column
                        // Detecta o lado "own" (do cableId) e atribui lanes pro
                        // fiber idx 0 (topo) ficar CLOSEST a own. Sem isso, em
                        // cabos do lado direito do splitter, as lanes ficam ao
                        // contrário e os horizontais do topo do painel cruzam
                        // os verticais dos cabos abaixo. Resultado: entrelaçado.
                        const baseMidX = (avgSourceX + avgTargetX) / 2;
                        const ownIsRight = c.sourceId.startsWith(cableId)
                            ? p1.x > p2.x
                            : p2.x > p1.x;
                        const dirSign = ownIsRight ? 1 : -1;
                        const turnX = baseMidX + dirSign * (center - idx) * LANE_SPACING;
                        shapePoints = [{ x: turnX, y: p1.y }, { x: turnX, y: p2.y }];
                        break;
                    }
                    case 4: { // Uniform Z vertical — each fiber gets its own turn row
                        // Mesma lógica do shape 3 mas no eixo Y.
                        const baseMidY = (avgSourceY + avgTargetY) / 2;
                        const ownIsBelow = c.sourceId.startsWith(cableId)
                            ? p1.y > p2.y
                            : p2.y > p1.y;
                        const dirSign = ownIsBelow ? 1 : -1;
                        const turnY = baseMidY + dirSign * (center - idx) * LANE_SPACING;
                        shapePoints = [{ x: p1.x, y: turnY }, { x: p2.x, y: turnY }];
                        break;
                    }
                    default:
                        shapePoints = [];
                }

                const finalPoints = shapePoints.map(p => ({
                    x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
                    y: Math.round(p.y / GRID_SIZE) * GRID_SIZE
                }));

                return { ...c, points: finalPoints };
            });

            return { ...prev, connections: updatedConnections };
        });
    };

    // Atualiza o forward-ref usado por handleSmartAlignConnection pra delegar.
    useLayoutEffect(() => { smartAlignCableForwardRef.current = handleSmartAlignCable; });

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
    const removeConnection = useCallback((connId: string) => {
        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.filter(c => c.id !== connId)
        }));
    }, [setLocalCTO]);


    // (handleApply, handleCloseRequest, handleSaveAndClose — in useCTOEditorState hook)
    // Wrappers that pass viewState to the hook's functions
    const handleApply = () => _handleApply(viewState);
    const handleSaveAndClose = () => _handleSaveAndClose(viewState);

    // --- View Centering ---
    const handleCenterView = () => {
        const vw = isMaximized ? window.innerWidth : modalSize.w;
        const vh = isMaximized ? window.innerHeight : modalSize.h;
        setViewState(getInitialViewState(localCTO, vw, vh));
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

    // --- UNIFIED EXPORT (PNG / PDF) ---
    const handleExport = async (type: 'png' | 'pdf') => {
        // Gatekeeping: Block free users
        const isFree = userPlan === 'Plano Grátis';
        if (isFree) {
            if (onShowUpgrade) onShowUpgrade();
            else notify('Exportação disponível apenas para planos pagos.', 'info');
            return;
        }

        setExportingType(type);
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

            const isVerticalCondo = !!localCTO.building;
            const footerData: FooterData = {
                projectName: projectName || '',
                boxName: localCTO.name,
                date: dateStr,
                lat: localCTO.coordinates.lat.toFixed(6),
                lng: localCTO.coordinates.lng.toFixed(6),
                status: 'Implantada',
                level: isVerticalCondo ? 'CONDOMÍNIO' : 'CTO',
                pole: '-',
                obs: '',
                mapImage: '',
                logo: '',
                isVerticalCondo,
                building: localCTO.building || undefined
            };

            // Load static assets (map, logo, QR code)
            try {
                const lat = localCTO.coordinates.lat;
                const lng = localCTO.coordinates.lng;

                // Generate static map from OSM tiles (CORS-friendly, no external API needed)
                const mapZoom = type === 'pdf' ? 16 : 17;
                const mapBase64 = await generateStaticMap(lat, lng, mapZoom, 400, 250);
                if (mapBase64) footerData.mapImage = mapBase64;

                const logoUrlToUse = companyLogo || saasLogo || '/logo.png';
                const logoBase64 = await preloadImage(logoUrlToUse);
                if (logoBase64) footerData.logo = logoBase64;

                // QR code removed from export
            } catch (e) {
                console.warn("Could not load static assets for export", e);
            }

            // Build summary data for footer
            const catalogs = tracingCatalogs;
            footerData.splittersSummary = localCTO.splitters.map(s => {
                let powerStr = '';
                try {
                    const result = traceOpticalPath(s.id, cto.id, network, catalogs, localCTO);
                    powerStr = ` — ${result.finalPower.toFixed(2)} dBm`;
                } catch {
                    // Path calculation failed (e.g. no OLT connected)
                }
                return `${s.name || 'Splitter'} (${s.type})${powerStr}`;
            });
            footerData.cablesSummary = incomingCables.map(c => `${c.name} - ${c.fiberCount}F`);
            footerData.clientCount = ctoCustomers.length;
            footerData.clientNames = ctoCustomers.map(c => c.name);

            // Aggregate inventory counts for the COMPONENTES box.
            // Fusões e conectores convivem na mesma lista (`fusions`) — o discriminador é `category`.
            const fusionCount = localCTO.fusions.filter(f => (f.category || 'fusion') !== 'connector').length;
            const connectorCount = localCTO.fusions.filter(f => f.category === 'connector').length;
            const dioCount = (localCTO.dios || []).length;
            const totalDioPorts = (localCTO.dios || []).reduce((sum, d) => sum + d.ports, 0);
            const noteCount = (localCTO.notes || []).length;

            // DIO card folds the port total into the label: "1 DIO 12FO" / "2 DIO 36FO".
            const dioLabel = dioCount > 0 ? `DIO ${totalDioPorts}FO` : 'DIO';

            footerData.componentCounts = [
                { label: 'Cabos',      count: incomingCables.length,     color: '#0ea5e9' }, // sky
                { label: 'Splitters',  count: localCTO.splitters.length, color: '#10b981' }, // emerald
                { label: 'Fusões',     count: fusionCount,               color: '#6366f1' }, // indigo
                { label: 'Conectores', count: connectorCount,            color: '#f59e0b' }, // amber
                { label: dioLabel,     count: dioCount,                  color: '#334155' }, // slate-700 (matches DIO node)
                { label: 'Clientes',   count: ctoCustomers.length,       color: '#f43f5e' }, // rose
                { label: 'Notas',      count: noteCount,                 color: '#eab308' }, // yellow
            ];

            // Build client details. For vertical condos sort by floor then unit so
            // the table reads bottom-up like the building. For regular CTOs keep the
            // original behavior (sorted by splitter port number).
            footerData.clientDetails = ctoCustomers.map(c => {
                let port = '-';
                let sortKey = 9999;
                if (c.splitterPortIndex !== null && c.splitterPortIndex !== undefined) {
                    port = `${c.splitterPortIndex + 1}`;
                    sortKey = c.splitterPortIndex;
                } else if (c.connectorId) {
                    port = 'C';
                    sortKey = 10000;
                }
                const power = c.onuPower !== null && c.onuPower !== undefined ? `${c.onuPower} dBm` : undefined;
                return {
                    name: c.name,
                    port,
                    power,
                    floor: c.floor ?? null,
                    unit: c.unit ?? null,
                    _sort: sortKey
                };
            }).sort((a, b) => {
                if (isVerticalCondo) {
                    const af = a.floor ?? Number.POSITIVE_INFINITY;
                    const bf = b.floor ?? Number.POSITIVE_INFINITY;
                    if (af !== bf) return af - bf;
                    return (a.unit || '').localeCompare(b.unit || '', undefined, { numeric: true });
                }
                return a._sort - b._sort;
            }).map(({ _sort, ...rest }) => rest);

            const svg = generateCTOSVG(localCTO, incomingCables, litPorts, portPositions, footerData, ctoCustomers, availableSplitters);
            const fileName = `CTO-${localCTO.name.replace(/\s+/g, '_')}`;
            await exportToPNG(svg, `${fileName}.png`);
        } catch (error: any) {
            console.error('Export PNG failed', error);
            notify(t('export_png_error'), 'error');
        } finally {
            setExportingType(null);
        }
    };

    const handleExportPNG = () => handleExport('png');
    handleExportPNGRef.current = handleExportPNG;

    // --- OPTICAL POWER CALCULATION HANDLER ---
    // Mantém a callback estável pro React.memo do SplitterRenderer não
    // invalidar a cada mudança em localCTO (que muda em toda tecla / drag end /
    // etc). Lê o state via localCTORef (sempre fresh) e notify via ref.
    const notifyRef = useRef(notify);
    useLayoutEffect(() => { notifyRef.current = notify; });

    const handleSplitterDoubleClick = useCallback((splitterId: string) => {
        const ctoState = localCTORef.current;
        const splitter = ctoState.splitters.find(s => s.id === splitterId);
        if (!splitter) {
            console.error("Splitter not found in localCTO:", splitterId);
            return;
        }

        try {
            const catalogs = tracingCatalogs;

            const result = traceOpticalPath(splitterId, cto.id, network, catalogs, ctoState);
            setOpticalResult(result);

            // Nome exibido no orçamento óptico: combina rótulo da instância com o
            // modelo do catálogo. Helper compartilhado com opticalUtils pra que a
            // lista "Detalhes do Percurso" use o mesmo formato.
            const catalog = findSplitterCatalog(splitter, availableSplitters);
            setSelectedSplitterName(formatSplitterDisplayName(splitter, catalog));
            setSelectedSplitterForModal(splitter);
            setIsOpticalModalOpen(true);
        } catch (error) {
            console.error("Error calculating optical path:", error);
            notifyRef.current(`Erro: ${(error as Error).message}`, 'error');
        }
    }, [tracingCatalogs, cto.id, network, availableSplitters]);


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
        // If we already dragging something, ignore
        if (dragState) return;

        // NOTE DETECTION
        const noteId = (e.target as Element).closest('[data-note-id]')?.getAttribute('data-note-id');
        if (noteId) {
            const note = localCTO.notes?.find(n => n.id === noteId);
            if (note) {
                setDragState({
                    mode: 'note',
                    targetId: noteId,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialLayout: { x: note.x, y: note.y, rotation: 0 }
                });
                return;
            }
        }

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

        // Snapshot current port positions for every connection touching this element.
        // handleMouseMove will use this snapshot (+ drag delta) instead of reading
        // positions live, so the computation is resilient to getPortCenter cache
        // invalidation that may happen mid-drag (e.g. parent re-render passing a
        // fresh `incomingCables` array).
        dragPortSnapshot.current = {};
        localCTORef.current.connections.forEach(conn => {
            const sourceIsEl = conn.sourceId === id || conn.sourceId.startsWith(id + '-');
            const targetIsEl = conn.targetId === id || conn.targetId.startsWith(id + '-');
            if (!sourceIsEl && !targetIsEl) return;
            const p1 = getPortCenter(conn.sourceId);
            const p2 = getPortCenter(conn.targetId);
            if (p1) dragPortSnapshot.current[conn.sourceId] = p1;
            if (p2) dragPortSnapshot.current[conn.targetId] = p2;
        });

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
    }, [isVflToolActive, isOtdrToolActive, isDeleteMode, isRotateMode, isSmartAlignMode, getPortCenter]);

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

    const handleRenameSplitter = useCallback((id: string) => {
        const current = localCTO.splitters.find(s => s.id === id);
        if (!current) return;
        setSplitterRename({ id, value: current.name });
    }, [localCTO.splitters]);

    const commitSplitterRename = useCallback(() => {
        if (!splitterRename) return;
        const trimmed = splitterRename.value.trim();
        const current = localCTO.splitters.find(s => s.id === splitterRename.id);
        if (!current || !trimmed || trimmed === current.name) {
            setSplitterRename(null);
            return;
        }
        setLocalCTO(prev => ({
            ...prev,
            splitters: prev.splitters.map(s => s.id === splitterRename.id ? { ...s, name: trimmed } : s)
        }));
        setSplitterRename(null);
    }, [splitterRename, localCTO.splitters]);

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

    const handleDeleteDIO = useCallback((id: string) => {
        setLocalCTO(prev => {
            const dio = (prev.dios || []).find(d => d.id === id);
            if (!dio) return prev;
            const portIds = new Set<string>();
            for (let i = 0; i < dio.ports; i++) {
                portIds.add(makeDIOPortId(id, i, 'in'));
                portIds.add(makeDIOPortId(id, i, 'out'));
            }
            const nextLayout = { ...(prev.layout || {}) };
            delete nextLayout[id];
            return {
                ...prev,
                dios: (prev.dios || []).filter(d => d.id !== id),
                connections: prev.connections.filter(c => !portIds.has(c.sourceId) && !portIds.has(c.targetId)),
                layout: nextLayout,
            };
        });
    }, []);

    /**
     * Após qualquer mutação de layout que mova os ports de um elemento
     * (rotate, mirror, etc), agenda uma limpeza pós-commit para:
     *   1. esvaziar portCenterCache + containerRectCache
     *   2. re-ler as posições com getPortCenter (que agora lê do DOM atualizado)
     *   3. reescrever imperativamente o `d` das conexões tocando o elemento
     *      — bypass na reconciliation do React que pode pular o update se achar
     *      que o `d` no VDOM não mudou (situação clássica pós-drag em que o
     *      handleMouseMove deixou writes imperativos no DOM).
     *   4. se ainda em drag ativo, atualiza o dragPortSnapshot pras coords novas.
     *
     * Veja CTO Editor Canvas skill §7 (Bug A) pra contexto.
     *
     * NOTA: detecta sticky-drag lendo `dragStateRef.current` DENTRO do RAF
     * (não via flag passada como argumento). Versão anterior recebia
     * `isStickyDrag: boolean` mas o batching do React 18 fazia o callback
     * ser chamado com `false` mesmo durante drag ativo — o `setDragState`
     * updater que setaria a flag ainda não tinha rodado.
     */
    const scheduleConnectionRefresh = useCallback((elementId: string) => {
        requestAnimationFrame(() => {
            portCenterCache.current = {};
            containerRectCache.current = null;
            const isStickyDrag = dragStateRef.current?.mode === 'element' && dragStateRef.current?.targetId === elementId;
            localCTORef.current.connections.forEach(conn => {
                const sourceIsEl = conn.sourceId === elementId || conn.sourceId.startsWith(elementId + '-');
                const targetIsEl = conn.targetId === elementId || conn.targetId.startsWith(elementId + '-');
                if (!sourceIsEl && !targetIsEl) return;
                const p1 = getPortCenter(conn.sourceId);
                const p2 = getPortCenter(conn.targetId);
                if (!p1 || !p2) return;
                if (isStickyDrag) {
                    dragPortSnapshot.current[conn.sourceId] = p1;
                    dragPortSnapshot.current[conn.targetId] = p2;
                }
                const pathEl = connectionRefs.current[conn.id];
                if (pathEl) {
                    let d = `M ${p1.x} ${p1.y} `;
                    if (conn.points) {
                        conn.points.forEach((p: any) => { d += `L ${p.x} ${p.y} `; });
                    }
                    d += `L ${p2.x} ${p2.y}`;
                    pathEl.setAttribute('d', d);
                }
            });
        });
    }, [getPortCenter]);

    const handleElementAction = useCallback((e: React.MouseEvent, id: string, type: 'splitter' | 'fusion' | 'cable' | 'dio') => {
        e.stopPropagation();
        if (isVflToolActive || isOtdrToolActive) return;

        if (isRotateMode) {
            setLocalCTO(prev => {
                const existingLayout = prev.layout?.[id];
                if (!existingLayout) return prev; // Safety check

                const currentRot = existingLayout.rotation || 0;
                const newRot = (currentRot + 90) % 360;
                scheduleConnectionRefresh(id);
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
            } else if (type === 'dio') {
                handleDeleteDIO(id);
            }
            // Cable deletion not requested, but safe to ignore or add later
        }
    }, [isVflToolActive, isOtdrToolActive, isRotateMode, isDeleteMode, handleDeleteSplitter, handleDeleteFusion, handleDeleteDIO, scheduleConnectionRefresh]);

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

            // Espelhar move os ports → mesma classe de bug que rotate.
            scheduleConnectionRefresh(id);

            return {
                ...prev,
                layout: {
                    ...prev.layout,
                    [id]: { ...layout, mirrored: !layout.mirrored }
                }
            };
        });
    }, [isVflToolActive, isOtdrToolActive, scheduleConnectionRefresh]);

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
            });
        } else {
            // NEW CONNECTION MODE
            setDragState({
                mode: 'connection',
                portId: portId,
                startX: e.clientX,
                startY: e.clientY,
            });
        }
    }, [isVflToolActive, isOtdrToolActive, onToggleVfl, setOtdrTargetPort, viewState]);

    // Suppress hover state churn while an element is being dragged.
    // During element drag the transform is mutated directly on the DOM node for 60fps
    // smoothness — a React re-render triggered by hover state would overwrite that
    // transform with the stale React-tracked layout, causing visible jitter/shift.
    const handlePortMouseEnter = useCallback((portId: string) => {
        if (dragStateRef.current?.mode === 'element') return;
        setHoveredPortId(portId);
    }, []);
    const handlePortMouseLeave = useCallback(() => {
        if (dragStateRef.current?.mode === 'element') return;
        setHoveredPortId(null);
    }, []);

    const handleCableMouseEnter = useCallback((id: string) => onHoverCable && onHoverCable(id), [onHoverCable]);
    const handleCableMouseLeave = useCallback((id: string) => onHoverCable && onHoverCable(null), [onHoverCable]);

    const handleHoverConnection = useCallback((id: string | null) => {
        setHoveredElement(id ? { id, type: 'connection' } : null);
    }, []);

    // Stable hover handler via event delegation — avoids N inline arrows per .map() item
    // Child wrappers use data-hover-id and data-hover-type attributes instead of onMouseEnter/Leave
    const handleElementHover = useCallback((e: React.MouseEvent) => {
        // Skip during element drag to avoid re-renders that would overwrite direct-DOM transform.
        if (dragStateRef.current?.mode === 'element') return;
        const target = (e.target as HTMLElement).closest('[data-hover-id]') as HTMLElement | null;
        if (target) {
            setHoveredElement({
                id: target.dataset.hoverId!,
                type: target.dataset.hoverType as 'cable' | 'connection' | 'splitter' | 'fusion' | 'dio'
            });
        }
    }, []);
    const handleElementHoverClear = useCallback((e: React.MouseEvent) => {
        if (dragStateRef.current?.mode === 'element') return;
        const related = (e.relatedTarget as HTMLElement)?.closest?.('[data-hover-id]');
        if (!related) setHoveredElement(null);
    }, []);
    const handleFusionAction = useCallback((e: React.MouseEvent, fusionId: string) => {
        handleElementAction(e, fusionId, 'fusion');
    }, [handleElementAction]);
    const handleSplitterAction = useCallback((e: React.MouseEvent, splitterId: string) => {
        handleElementAction(e, splitterId, 'splitter');
    }, [handleElementAction]);

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
                scheduleConnectionRefresh(id);
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
    }, [isSmartAlignMode, isRotateMode, scheduleConnectionRefresh]);



    const handleCableEditClick = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const cable = incomingCables.find(c => c.id === id);
        if (cable) onEditCable(cable);
    }, [incomingCables, onEditCable]);

    const handleRotateElement = useCallback((e: React.MouseEvent | null, id: string) => {
        if (e) e.stopPropagation();
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
            let newRot = (currentRot + 90) % 360;
            let mirrored = layout.mirrored || false;

            const isCable = incomingCables.some(c => c.id === id);
            if (isCable) {
                if (newRot === 180) { newRot = 0; mirrored = !mirrored; }
                else if (newRot === 270) { newRot = 90; mirrored = !mirrored; }
            }

            let newLayout = { ...layout, rotation: newRot, mirrored };

            // To prevent visual jumping when rotating during a drag, sync x and y with DOM
            const domEl = document.getElementById(id);
            if (domEl) {
                const style = window.getComputedStyle(domEl);
                const matrix = new WebKitCSSMatrix(style.transform);
                newLayout.x = matrix.m41;
                newLayout.y = matrix.m42;
            }

            // If this element is currently being dragged (sticky drag),
            // sync dragState so the element rotates in place under the mouse.
            // Read current DOM position, set as new initialLayout,
            // and set startX/startY to current mouse so delta = 0.
            setDragState(ds => {
                if (ds?.mode === 'element' && ds.targetId === id && ds.initialLayout) {
                    const domEl = document.getElementById(id);
                    if (domEl) {
                        const m = new WebKitCSSMatrix(window.getComputedStyle(domEl).transform);
                        return {
                            ...ds,
                            initialLayout: { ...newLayout, x: m.m41, y: m.m42 },
                            startX: lastMouseScreenPos.current.x,
                            startY: lastMouseScreenPos.current.y
                        };
                    }
                }
                return ds;
            });

            scheduleConnectionRefresh(id);

            return {
                ...prev,
                layout: { ...prev.layout, [id]: newLayout }
            };
        });
    }, [incomingCables, scheduleConnectionRefresh]);





    const handlePointMouseDown = useCallback((e: React.MouseEvent, connId: string, pointIndex: number) => {
        e.stopPropagation();
        const { isVflToolActive, isOtdrToolActive } = toolModesRef.current;
        if (isVflToolActive || isOtdrToolActive) return;

        let pOffsetX = 0;
        let pOffsetY = 0;
        const conn = localCTORef.current.connections.find(c => c.id === connId);
        if (conn && conn.points && conn.points[pointIndex]) {
            const pt = conn.points[pointIndex];
            // Local screenToCanvas uses viewStateRef internally
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const vs = viewStateRef.current;
                const clickX = (e.clientX - rect.left - vs.x) / vs.zoom;
                const clickY = (e.clientY - rect.top - vs.y) / vs.zoom;
                pOffsetX = pt.x - clickX;
                pOffsetY = pt.y - clickY;
            }
        }

        setDragState({
            mode: 'point',
            connectionId: connId,
            pointIndex: pointIndex,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: pOffsetX,
            offsetY: pOffsetY
        });
    }, []);

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
    const lastMouseScreenPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const track = (e: MouseEvent) => { lastMouseScreenPos.current = { x: e.clientX, y: e.clientY }; };
        window.addEventListener('mousemove', track, { passive: true });
        return () => window.removeEventListener('mousemove', track);
    }, []);

    useEffect(() => {
        if (!isFusionToolActive) return;
        const positionGhost = (sx: number, sy: number) => {
            if (!cursorGhostRef.current || !containerRef.current) return;
            const { x, y } = screenToCanvas(sx, sy);
            const snapX = effectiveSnapping ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
            const snapY = effectiveSnapping ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;
            const vs = viewStateRef.current;
            cursorGhostRef.current.style.transform =
                `translate(${vs.x + (snapX - 12) * vs.zoom}px, ${vs.y + (snapY - 6) * vs.zoom}px) scale(${vs.zoom})`;
            cursorGhostRef.current.style.display = '';
        };
        const pos = lastMouseScreenPos.current;
        if (pos.x !== 0 || pos.y !== 0) positionGhost(pos.x, pos.y);
        const onMove = (e: MouseEvent) => {
            lastMouseScreenPos.current = { x: e.clientX, y: e.clientY };
            positionGhost(e.clientX, e.clientY);
        };
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, [isFusionToolActive, effectiveSnapping]);

    // OPTIMIZED: Direct DOM Manipulation for smooth 60FPS dragging
    const handleMouseMove = (e: React.MouseEvent) => {
        // Track mouse screen position for rotation-during-drag
        lastMouseScreenPos.current = { x: e.clientX, y: e.clientY };

        // Track Cursor for Fusion Ghost (Direct DOM — no setState at 60fps)
        if (isFusionToolActive) {
            const { x, y } = screenToCanvas(e.clientX, e.clientY);
            const snapX = effectiveSnapping ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
            const snapY = effectiveSnapping ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;
            if (cursorGhostRef.current) {
                const vs = viewStateRef.current;
                cursorGhostRef.current.style.transform =
                    `translate(${vs.x + (snapX - 12) * vs.zoom}px, ${vs.y + (snapY - 6) * vs.zoom}px) scale(${vs.zoom})`;
                cursorGhostRef.current.style.display = '';
            }
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

        // 1b. RESIZE DRAG
        if (dragState.mode === 'resize') {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            setModalSize({
                w: Math.max(MIN_WIDTH, (dragState.initialLayout?.x || DEFAULT_WIDTH) + dx),
                h: Math.max(MIN_HEIGHT, (dragState.initialLayout?.y || DEFAULT_HEIGHT) + dy)
            });
            return;
        }

        // 2. VIEW PAN (Direct DOM — zero React re-renders for 60fps smoothness)
        if (dragState.mode === 'view') {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;

            // Update ref silently (no setState = no re-render)
            viewStateRef.current = {
                ...viewStateRef.current,
                x: viewStateRef.current.x + dx,
                y: viewStateRef.current.y + dy
            };

            // Mutate dragState start coords directly (ref-like, avoids setDragState)
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;

            // Direct DOM manipulation for transform container
            if (diagramContentRef.current) {
                const vs = viewStateRef.current;
                diagramContentRef.current.style.transform =
                    `translate(${vs.x}px, ${vs.y}px) scale(${vs.zoom})`;
            }

            // Direct DOM manipulation for grid background
            if (gridRef.current) {
                const vs = viewStateRef.current;
                gridRef.current.style.backgroundPosition = `${vs.x}px ${vs.y}px`;
            }

            return;
        }

        // 3. NOTE DRAG (Direct DOM — commit em handleMouseUp)
        // Antes fazia setLocalCTO a cada mousemove e disparava render full do
        // editor a 60 Hz. Agora atualiza só o transform da nota; o state pega
        // o valor final na soltada do mouse.
        if (dragState.mode === 'note' && dragState.targetId) {
            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;

            const rawX = (dragState.initialLayout?.x || 0) + dx;
            const rawY = (dragState.initialLayout?.y || 0) + dy;
            const newX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
            const newY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;

            const noteEl = containerRef.current?.querySelector(`[data-note-id="${dragState.targetId}"]`) as HTMLElement | null;
            if (noteEl) {
                noteEl.style.transform = `translate(${newX}px, ${newY}px)`;
            }
            return;
        }

        if (dragState.mode === 'element' && dragState.targetId && dragState.initialLayout) {
            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;

            let newX = dragState.initialLayout.x + dx;
            let newY = dragState.initialLayout.y + dy;

            if (effectiveSnapping) {
                newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            }

            // A. Move the Element Itself
            const el = document.getElementById(dragState.targetId);
            if (el) {
                const rot = dragState.initialLayout.rotation || 0;
                el.style.transform = `translate(${newX}px, ${newY}px) rotate(${rot}deg)`;
            }

            // B. Move connected cables imperativamente (shift dos endpoints).
            // Lê via ref pra evitar stale closure durante drag rápido.
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

                // Prefer the drag-start snapshot over live reads:
                // the snapshot holds positions from BEFORE any DOM mutation, so
                // `snapshot + totalDelta` always equals the correct current position.
                // Live reads via getPortCenter could return post-mutation values
                // if the cache was invalidated mid-drag, causing compounded offset.
                const p1 = dragPortSnapshot.current[conn.sourceId] || getPortCenter(conn.sourceId);
                const p2 = dragPortSnapshot.current[conn.targetId] || getPortCenter(conn.targetId);
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

        // 4. CONNECTION POINT DRAG (Direct DOM) with live orthogonal snapping
        if (dragState.mode === 'point' && dragState.connectionId && dragState.pointIndex !== undefined) {
            let { x, y } = screenToCanvas(e.clientX, e.clientY);

            // Apply projection offset to prevent jump on initial drag
            if (dragState.offsetX !== undefined && dragState.offsetY !== undefined) {
                x += dragState.offsetX;
                y += dragState.offsetY;
            }

            const modes = toolModesRef.current;
            const FIBER_PITCH = GRID_SIZE * 2; // 12px — distância entre fibras (LANE_SPACING)

            // Use ref (not state) to get the latest connections - state may be stale
            // when a point was just created by handlePathMouseDown
            const conn = localCTORef.current.connections.find(c => c.id === dragState.connectionId);
            if (conn) {
                const p1 = getPortCenter(conn.sourceId);
                const p2 = getPortCenter(conn.targetId);

                // Pitch snap (12px) ancorado na source port. Grid arbitrário
                // de 6px não bate com as portas das fibras (que ficam em Y
                // baseado no layout), então cabos com bends fora do múltiplo
                // de 6 ficam visualmente desalinhados. Ancorar na source
                // garante que todos os cabos do mesmo painel compartilham a
                // mesma régua de 12px → spacing uniforme entre cabos.
                if (modes.isSnapping && p1) {
                    x = p1.x + Math.round((x - p1.x) / FIBER_PITCH) * FIBER_PITCH;
                    y = p1.y + Math.round((y - p1.y) / FIBER_PITCH) * FIBER_PITCH;
                }

                if (p1 && p2) {
                    const points = conn.points || [];
                    // Build full path: [source, ...waypoints, target]
                    const allPoints = [p1, ...points, p2];
                    const idx = dragState.pointIndex! + 1; // +1 because source is at index 0

                    // Orthogonal snap: align to the CLOSEST neighbor axis when near
                    if (modes.isSnapping) {
                        const SNAP_THRESHOLD = GRID_SIZE * 2; // 12px
                        const prevPt = allPoints[idx - 1];
                        const nextPt = allPoints[idx + 1];

                        // X-axis snap
                        const prevDx = prevPt ? Math.abs(x - prevPt.x) : Infinity;
                        const nextDx = nextPt ? Math.abs(x - nextPt.x) : Infinity;
                        if (prevDx < SNAP_THRESHOLD || nextDx < SNAP_THRESHOLD) {
                            x = prevDx <= nextDx ? prevPt!.x : nextPt!.x;
                        }

                        // Y-axis snap
                        const prevDy = prevPt ? Math.abs(y - prevPt.y) : Infinity;
                        const nextDy = nextPt ? Math.abs(y - nextPt.y) : Infinity;
                        if (prevDy < SNAP_THRESHOLD || nextDy < SNAP_THRESHOLD) {
                            y = prevDy <= nextDy ? prevPt!.y : nextPt!.y;
                        }
                    }

                    // Rebuild path with snapped position
                    const pathEl = connectionRefs.current[dragState.connectionId];
                    if (pathEl) {
                        let d = `M ${p1.x} ${p1.y} `;
                        points.forEach((p, i) => {
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

            // Move the handle circle to snapped position
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
            // Antes: setDragState({...prev, currentMouseX, currentMouseY}) a cada
            // mousemove disparava re-render da ConnectionsLayer (dragState está no
            // areEqual) só pra atualizar um campo que ninguém lia. Removido.
        }
    };



    const handleMouseUp = (e: React.MouseEvent) => {
        // Drag ended — release the port-position snapshot taken at drag start.
        // (Safe to clear for any mouseup, even non-element drags.)
        dragPortSnapshot.current = {};

        // NOTE DRAG COMMIT (mousemove só atualizou o transform DOM imperativamente)
        if (dragState?.mode === 'note' && dragState.targetId && dragState.initialLayout) {
            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;
            const rawX = dragState.initialLayout.x + dx;
            const rawY = dragState.initialLayout.y + dy;
            const newX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
            const newY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
            const noteId = dragState.targetId;
            setLocalCTO(prev => ({
                ...prev,
                notes: (prev.notes || []).map(n => n.id === noteId ? { ...n, x: newX, y: newY } : n)
            }));
        }

        // COMMIT DRAG CHANGES TO STATE
        if (dragState?.mode === 'element' && dragState.targetId && dragState.initialLayout && !dragState.targetId.startsWith('fus-')) {
            const dx = (e.clientX - dragState.startX) / viewState.zoom;
            const dy = (e.clientY - dragState.startY) / viewState.zoom;

            let newX = dragState.initialLayout.x + dx;
            let newY = dragState.initialLayout.y + dy;

            if (effectiveSnapping) {
                newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
            }

            const updated = {
                ...localCTORef.current,
                layout: {
                    ...localCTORef.current.layout,
                    [dragState.targetId!]: {
                        ...dragState.initialLayout!,
                        x: newX,
                        y: newY
                    }
                }
            };
            localCTORef.current = updated;
            setLocalCTO(updated);
        } else if (dragState?.mode === 'point' && dragState.connectionId && dragState.pointIndex !== undefined) {
            const raw = screenToCanvas(e.clientX, e.clientY);
            let dropX = raw.x;
            let dropY = raw.y;

            if (dragState.offsetX !== undefined && dragState.offsetY !== undefined) {
                dropX += dragState.offsetX;
                dropY += dragState.offsetY;
            }

            let x = dropX;
            let y = dropY;

            // Pitch snap igual ao live drag (12px ancorado na source).
            if (effectiveSnapping) {
                const conn = localCTORef.current.connections.find(c => c.id === dragState.connectionId);
                if (conn) {
                    const FIBER_PITCH = GRID_SIZE * 2;
                    const p1 = getPortCenter(conn.sourceId);
                    const p2 = getPortCenter(conn.targetId);
                    if (p1) {
                        x = p1.x + Math.round((x - p1.x) / FIBER_PITCH) * FIBER_PITCH;
                        y = p1.y + Math.round((y - p1.y) / FIBER_PITCH) * FIBER_PITCH;
                    }
                    if (p1 && p2) {
                        const allPoints = [p1, ...(conn.points || []), p2];
                        const idx = dragState.pointIndex! + 1;
                        const SNAP_THRESHOLD = GRID_SIZE * 2;
                        const prevPt = allPoints[idx - 1];
                        const nextPt = allPoints[idx + 1];

                        const prevDx = prevPt ? Math.abs(x - prevPt.x) : Infinity;
                        const nextDx = nextPt ? Math.abs(x - nextPt.x) : Infinity;
                        if (prevDx < SNAP_THRESHOLD || nextDx < SNAP_THRESHOLD) {
                            x = prevDx <= nextDx ? prevPt!.x : nextPt!.x;
                        }

                        const prevDy = prevPt ? Math.abs(y - prevPt.y) : Infinity;
                        const nextDy = nextPt ? Math.abs(y - nextPt.y) : Infinity;
                        if (prevDy < SNAP_THRESHOLD || nextDy < SNAP_THRESHOLD) {
                            y = prevDy <= nextDy ? prevPt!.y : nextPt!.y;
                        }
                    }
                }
            }

            const updated = {
                ...localCTORef.current,
                connections: localCTORef.current.connections.map(c => {
                    if (c.id !== dragState.connectionId) return c;
                    const newPoints = [...(c.points || [])];
                    newPoints[dragState.pointIndex!] = { x, y };
                    return { ...c, points: newPoints };
                })
            };
            localCTORef.current = updated;
            setLocalCTO(updated);
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

                // Helper to extract port index from ID (User Request: Persist Index)
                const getPortIndex = (id: string): number | undefined => {
                    if (id.includes('-fiber-')) {
                        const parts = id.split('-fiber-');
                        const idx = parseInt(parts[1]);
                        return isNaN(idx) ? undefined : idx;
                    }
                    return undefined;
                };

                const portIndex = getPortIndex(source) ?? getPortIndex(target);

                const newConn: FiberConnection = {
                    id: `conn-${Date.now()}`,
                    sourceId: source,
                    targetId: target,
                    color: connColor,
                    points: [],
                    portIndex: portIndex // PERSISTED INDEX
                };

                const exists = localCTO.connections.find(c =>
                    (c.sourceId === source && c.targetId === target) ||
                    (c.sourceId === target && c.targetId === source)
                );

                if (!exists) {
                    setLocalCTO(prev => {
                        // CHECK OCCUPANCY — só conta conexões "vivas" (cujos
                        // dois ports realmente resolvem). Ghost connections
                        // (port sumiu por resize de cabo, splitter mudou,
                        // etc.) eram invisíveis mas bloqueavam novas conexões.
                        const isLive = (c: FiberConnection) =>
                            !!getPortCenter(c.sourceId) && !!getPortCenter(c.targetId);
                        const isSourceOccupied = prev.connections.some(c => isLive(c) && (c.sourceId === source || c.targetId === source));
                        const isTargetOccupied = prev.connections.some(c => isLive(c) && (c.sourceId === target || c.targetId === target));

                        if (isSourceOccupied || isTargetOccupied) {
                            return prev; // Block connection
                        }

                        // Bonus cleanup: remove ghost connections que envolvem
                        // os ports da nova conexão (libera o slot oficialmente).
                        const cleanedConnections = prev.connections.filter(c => {
                            const touchesSource = c.sourceId === source || c.targetId === source;
                            const touchesTarget = c.sourceId === target || c.targetId === target;
                            if (touchesSource || touchesTarget) {
                                return isLive(c); // mantém só se válida
                            }
                            return true;
                        });

                        return {
                            ...prev,
                            connections: [...cleanedConnections, newConn]
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
                        // Também ignora ghost connections (port inexistente).
                        const isLive = (c: FiberConnection) =>
                            !!getPortCenter(c.sourceId) && !!getPortCenter(c.targetId);
                        const isTargetOccupied = prev.connections.some(c =>
                            c.id !== dragState.connectionId &&
                            isLive(c) &&
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

                        // UPDATE PORT INDEX (User Request)
                        const getPortIndex = (id: string): number | undefined => {
                            if (id.includes('-fiber-')) {
                                const parts = id.split('-fiber-');
                                const idx = parseInt(parts[1]);
                                return isNaN(idx) ? undefined : idx;
                            }
                            return undefined;
                        };
                        newMyConn.portIndex = getPortIndex(newMyConn.sourceId) ?? getPortIndex(newMyConn.targetId);

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
            if (effectiveSnapping) {
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
                let closestSegmentIndex = 0; // Index of the closest segment

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
                            closestSegmentIndex = i; // Save segment index of best match
                        }
                    }
                });

                if (closestConnection) {
                    const hitConnection = closestConnection as FiberConnection;
                    let hitSegmentIndex = closestSegmentIndex; // Use segment index from PASS 1

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
                                hitSegmentIndex = i;
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
                        points: (hitConnection.points || []).slice(0, hitSegmentIndex)
                    };

                    const conn2: FiberConnection = {
                        id: `conn-${Date.now()}-2`,
                        sourceId: portB,
                        targetId: hitConnection.targetId,
                        color: hitConnection.color,
                        points: (hitConnection.points || []).slice(hitSegmentIndex)
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

        // COMMIT view pan ref → React state (single render at end of pan, not per-frame)
        if (dragState?.mode === 'view') {
            setViewState({ ...viewStateRef.current });
        }

        setDragState(null);
    };

    // Global window listeners for drag & tools — binds only while active.
    // See hooks/useGlobalDragListeners.ts for the ref-based pattern.
    useGlobalDragListeners({
        isActive: !!dragState || isFusionToolActive,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
    });



    const removePoint = useCallback((e: React.MouseEvent, connId: string, pointIndex: number) => {
        e.stopPropagation();
        if (toolModesRef.current.isVflToolActive) return;
        setLocalCTO(prev => ({
            ...prev,
            connections: prev.connections.map(c => {
                if (c.id !== connId || !c.points) return c;
                const newPoints = c.points.filter((_, i) => i !== pointIndex);
                return { ...c, points: newPoints };
            })
        }));
    }, [setLocalCTO]);

    const handlePathMouseDown = useCallback((e: React.MouseEvent, connId: string) => {
        if (e.button !== 0) return;
        const modes = toolModesRef.current;
        if (modes.isFusionToolActive) return;

        e.stopPropagation();
        e.preventDefault();

        if (modes.isVflToolActive || modes.isOtdrToolActive || modes.isSmartAlignMode) return;

        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        const clickPt = { x, y };

        // 1. Calculate New State
        let newConnections = [...localCTORef.current.connections];
        let insertedPointIndex = -1;
        let pOffsetX = 0;
        let pOffsetY = 0;

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

            // Project clickPt onto the closest segment to prevent visual jumping
            const pStart = fullPath[insertIndex];
            const pEnd = fullPath[insertIndex + 1];
            const A = clickPt.x - pStart.x;
            const B = clickPt.y - pStart.y;
            const C = pEnd.x - pStart.x;
            const D = pEnd.y - pStart.y;
            const dot = A * C + B * D;
            const len_sq = C * C + D * D;
            let param = -1;
            if (len_sq !== 0) param = dot / len_sq;

            let projectedPt = { ...clickPt };
            if (param >= 0 && param <= 1) {
                projectedPt.x = pStart.x + param * C;
                projectedPt.y = pStart.y + param * D;
            } else if (param < 0) {
                projectedPt.x = pStart.x;
                projectedPt.y = pStart.y;
            } else if (param > 1) {
                projectedPt.x = pEnd.x;
                projectedPt.y = pEnd.y;
            }

            pOffsetX = projectedPt.x - clickPt.x;
            pOffsetY = projectedPt.y - clickPt.y;

            const newPoints = [...currentPoints];
            newPoints.splice(insertIndex, 0, projectedPt);
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
                startY: e.clientY,
                offsetX: pOffsetX,
                offsetY: pOffsetY
            });
        }
    }, [getPortCenter, setLocalCTO]);

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
            catalogId: catalogItem.id,
            inputPortId: `${id}-in`,
            outputPortIds: outputIds,
            connectorType: catalogItem.connectorType,
            polishType: catalogItem.polishType,
            allowCustomConnections: catalogItem.allowCustomConnections
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

        // Mark the new splitter as hovered so keyboard shortcuts (R/D) work immediately.
        // `onMouseEnter` won't fire: the element appears under a stationary cursor,
        // so without this the hover state would stay on whatever was previously hovered
        // (or null) until the user moves the mouse off and back on.
        setHoveredElement({ id, type: 'splitter' });

        // START DRAGGING IMMEDIATELY (UX REQUEST: Sticky Drag)
        setDragState({
            mode: 'element',
            targetId: id,
            startX: e.clientX,
            startY: e.clientY,
            initialLayout: initialLayout
        });
    };



    const handleAddNote = (e: React.MouseEvent) => {
        // Calculate canvas center from container dimensions and current viewState
        const NOTE_W = 140;
        const NOTE_H = 100;
        let cx = 300;
        let cy = 200;
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Container-local center → canvas coords (rect.width/2 já está
            // relativo ao container, não à viewport — basta tirar pan/zoom).
            const containerCX = rect.width / 2;
            const containerCY = rect.height / 2;
            cx = (containerCX - viewState.x) / viewState.zoom - NOTE_W / 2;
            cy = (containerCY - viewState.y) / viewState.zoom - NOTE_H / 2;
        }

        const newNote: Note = {
            id: `note-${Date.now()}`,
            text: '',
            x: Math.round(cx / GRID_SIZE) * GRID_SIZE,
            y: Math.round(cy / GRID_SIZE) * GRID_SIZE,
            width: NOTE_W,
            height: NOTE_H,
            color: '#fef08a'
        };

        setLocalCTO(prev => ({
            ...prev,
            notes: [...(prev.notes || []), newNote]
        }));
    };

    // useCallback keeps these stable so NotesLayer's React.memo can skip re-renders.
    const handleUpdateNoteText = useCallback((id: string, text: string) => {
        setLocalCTO(prev => ({
            ...prev,
            notes: (prev.notes || []).map(n => n.id === id ? { ...n, text } : n)
        }));
    }, [setLocalCTO]);

    const handleDeleteNote = useCallback((id: string) => {
        setLocalCTO(prev => ({
            ...prev,
            notes: (prev.notes || []).filter(n => n.id !== id)
        }));
    }, [setLocalCTO]);

    // --- DIO HANDLERS ---
    const handleAddDIOClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDIOModal(true);
    }, []);

    const handleConfirmAddDIO = useCallback((portCount: number, customName?: string) => {
        const id = `dio-${Date.now()}`;

        // Drop in canvas center so user can immediately drag it
        let cx = 300;
        let cy = 200;
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            cx = (rect.width / 2 - viewState.x) / viewState.zoom;
            cy = (rect.height / 2 - viewState.y) / viewState.zoom;
        }
        const width = 36;
        const height = 12 + portCount * 12;
        const size = Math.max(width, height);
        const halfSize = size / 2;
        const x = Math.round((cx - halfSize) / GRID_SIZE) * GRID_SIZE;
        const y = Math.round((cy - halfSize) / GRID_SIZE) * GRID_SIZE;
        const initialLayout: ElementLayout = { x, y, rotation: 0 };

        setLocalCTO(prev => {
            const existing = prev.dios || [];
            const newDIO: DIOInline = {
                id,
                name: customName || `DIO ${existing.length + 1}`,
                ports: portCount,
            };
            return {
                ...prev,
                dios: [...existing, newDIO],
                layout: { ...prev.layout, [id]: initialLayout },
            };
        });

        setHoveredElement({ id, type: 'dio' });
    }, [viewState.x, viewState.y, viewState.zoom]);

    const handleDIOAction = useCallback((e: React.MouseEvent, dioId: string) => {
        handleElementAction(e, dioId, 'dio');
    }, [handleElementAction]);

    const handleAddFusion = (e: React.MouseEvent) => {
        e.stopPropagation();

        const fusionTypes = availableFusions.length > 0 ? availableFusions : (network.fusionTypes || []);

        // Sem catálogo cadastrado a fusão criada não tem catalogId → o trace cai
        // no fallback "Fusão Padrão" que TAMBÉM não existe → perda 0 dB silenciosa.
        // Bloquear aqui evita o usuário criar fusões "fantasma" que não contam perda.
        if (fusionTypes.length === 0) {
            notify(t('no_fusions_in_catalog') || 'Cadastre ao menos um tipo de fusão no catálogo antes de usar esta ferramenta.', 'info');
            return;
        }

        if (fusionTypes.length > 1) {
            setShowFusionTypeModal(true);
        } else {
            // Único tipo disponível — ativa direto com ele.
            activateFusionTool(fusionTypes[0].id);
        }
    };

    const activateFusionTool = (typeId: string | null) => {
        clearAllToolModes();
        setIsFusionToolActive(true);
        setSelectedFusionTypeId(typeId);
        setShowFusionTypeModal(false);
        setShowConnectorTypeModal(false);
    };

    const handleAddConnector = (e: React.MouseEvent) => {
        e.stopPropagation();
        // If no connector catalog items exist, we cannot activate connector mode — doing so would
        // fall through to `activateFusionTool(null)` and silently enter plain fusion mode (the cursor
        // ghost would be round and clicks would create fusions, making the user think "clicked
        // connector → got fusion"). Warn the user and abort instead.
        if (availableConnectors.length === 0) {
            notify(t('no_connectors_in_catalog') || 'Cadastre um conector no catálogo antes de usar esta ferramenta.', 'info');
            return;
        }
        if (availableConnectors.length > 1) {
            setShowConnectorTypeModal(true);
        } else {
            activateFusionTool(availableConnectors[0].id);
        }
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
        // I will add `catalogId` to the object and `as any` to bypass strict check for this feature.

        const selectedCatalog = availableFusions.find(f => f.id === selectedFusionTypeId) || availableConnectors.find(c => c.id === selectedFusionTypeId);
        const newFusion: FusionPoint = {
            id,
            name: `F-${localCTO.fusions.length + 1}`,
            type: 'generic',
            catalogId: selectedFusionTypeId || undefined,
            category: (selectedCatalog?.category as any) || 'fusion',
            polishType: selectedCatalog?.polishType || undefined
        };

        const { x: rx, y: ry } = screenToCanvas(e.clientX, e.clientY);

        // RAW Calculation for Detection
        const rawX = rx - 12;
        const rawY = ry - 6;

        // Default Snapping
        let x = effectiveSnapping ? Math.round(rx / GRID_SIZE) * GRID_SIZE : rx;
        let y = effectiveSnapping ? Math.round(ry / GRID_SIZE) * GRID_SIZE : ry;
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
            let splitSegmentIndex = 0; // Index of the waypoint segment that was hit

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
                            splitSegmentIndex = i; // Save the segment index for waypoint splitting
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

                // 2. Create Left Side (Source -> Fusion A) — keep waypoints BEFORE the split segment
                updatedConnections.push({
                    id: `conn-${Date.now()}-1`,
                    sourceId: connToSplit.sourceId,
                    targetId: `${id}-a`,
                    color: resolvePortColor(connToSplit.sourceId) || connToSplit.color,
                    points: (connToSplit.points || []).slice(0, splitSegmentIndex)
                });

                // 3. Create Right Side (Fusion B -> Target) — keep waypoints FROM the split segment onward
                updatedConnections.push({
                    id: `conn-${Date.now()}-2`,
                    sourceId: `${id}-b`,
                    targetId: connToSplit.targetId,
                    color: resolvePortColor(connToSplit.targetId) || connToSplit.color,
                    points: (connToSplit.points || []).slice(splitSegmentIndex)
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




    const wheelRafRef = useRef<number | null>(null);
    const handleWheel = useCallback((e: React.WheelEvent) => {
        // Throttle zoom to 1 update per animation frame (prevents trackpad flood)
        const delta = e.deltaY;
        if (wheelRafRef.current) cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = requestAnimationFrame(() => {
            wheelRafRef.current = null;
            const scale = delta > 0 ? 0.9 : 1.1;
            setViewState(prev => {
                const newZoom = Math.min(Math.max(0.1, prev.zoom * scale), 4);
                const next = { ...prev, zoom: newZoom };
                viewStateRef.current = next;
                return next;
            });
        });
    }, []);

    const handleOtdrSubmit = () => {
        if (!otdrTargetPort || !otdrDistance) return;
        const dist = parseFloat(otdrDistance);
        if (isNaN(dist)) return;

        onOtdrTrace(otdrTargetPort, dist);
        setOtdrTargetPort(null);
        setIsOtdrToolActive(false);
    };

    // (Cache clear & force-update logic unified at top of component)

    // Keyboard shortcuts (S/F/A/T/R/D) — see hooks/useCanvasKeyboardShortcuts.ts
    useCanvasKeyboardShortcuts({
        readOnly,
        hoveredElement,
        setHoveredElement,
        toggleToolMode,
        setIsAutoSpliceOpen,
        handleRotateElement,
        handleDeleteSplitter,
        handleDeleteFusion,
        removeConnection,
    });

    return (
        <div
            id="cto-editor-modal"
            className={`cto-editor-modal fixed z-[2000] ${!dragState || (dragState.mode !== 'window' && dragState.mode !== 'resize') ? 'transition-all duration-300' : ''} ${isMaximized ? 'inset-0' : ''}`}
            style={isMaximized ? {} : { left: windowPos.x, top: windowPos.y }}
        >
            {dragState && (
                <style>{`
                    body, body * { cursor: ${dragState.mode === 'resize' ? 'nwse-resize' : 'grabbing'} !important; }
                    ${dragState.targetId ? `[id="${dragState.targetId}"] { pointer-events: none !important; }` : ''}
                `}</style>
            )}
            <div
                onContextMenu={(e) => e.preventDefault()}
                className={`cto-editor-container relative ${isMaximized ? 'w-full h-full rounded-none' : isCollapsed ? 'h-auto rounded-xl' : 'rounded-xl'} bg-white dark:bg-[#1a1d23] border border-slate-300 dark:border-slate-600 shadow-sm flex flex-col overflow-hidden ${isVflToolActive || isOtdrToolActive || isSmartAlignMode || isRotateMode || isDeleteMode ? 'cursor-crosshair' : ''}`}
                style={isMaximized ? undefined : { width: modalSize.w, height: isCollapsed ? 'auto' : modalSize.h }}
            >

                <CTOEditorToolbar
                    readOnly={readOnly}
                    t={t}
                    propertiesName={propertiesName}
                    onNameChange={(name) => { setPropertiesName(name); setLocalCTO(prev => ({ ...prev, name })); }}
                    isMaximized={isMaximized}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                    onToggleMaximize={toggleMaximize}
                    onClose={canEdit ? handleCloseRequest : onClose}
                    onWindowDragStart={handleWindowDragStart}
                    isRotateMode={isRotateMode}
                    isDeleteMode={isDeleteMode}
                    showSplitterDropdown={showSplitterDropdown}
                    isFusionToolActive={isFusionToolActive}
                    isSmartAlignMode={isSmartAlignMode}
                    isVflToolActive={isVflToolActive}
                    vflDirection={vflDirection}
                    onChangeVflDirection={onChangeVflDirection}
                    isOtdrToolActive={isOtdrToolActive}
                    isSnapping={isSnapping}
                    onToggleSnapping={() => setIsSnapping(!isSnapping)}
                    toggleToolMode={toggleToolMode}
                    onAddFusion={handleAddFusion}
                    onAddConnector={handleAddConnector}
                    isConnectorToolActive={isConnectorToolActive}
                    onAddNote={handleAddNote}
                    onAddDIO={handleAddDIOClick}
                    isAutoSpliceOpen={isAutoSpliceOpen}
                    onOpenAutoSplice={() => setIsAutoSpliceOpen(true)}
                    onClearConnections={() => setDestructiveConfirm({
                        title: 'Limpar todas as conexões?',
                        message: t('clear_connections_confirm') || 'Todas as conexões deste diagrama serão removidas. Esta ação não pode ser desfeita.',
                        confirmLabel: 'Limpar conexões',
                        onConfirm: () => setLocalCTO(prev => ({ ...prev, connections: [] })),
                    })}
                    showHotkeys={showHotkeys}
                    onToggleHotkeys={() => setShowHotkeys(!showHotkeys)}
                    hotkeysRef={hotkeysRef}
                    onExportPNG={handleExportPNG}
                    exportingType={exportingType}
                    onOpenQRCode={() => setIsQRCodeModalOpen(true)}
                />

                {/* Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-[#E6E6E6] dark:bg-[#1d2027] relative overflow-hidden"
                    style={{ display: isCollapsed ? 'none' : undefined, cursor: isVflToolActive || isOtdrToolActive ? 'crosshair' : 'default' }}
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                >
                    {/* LOADING OVERLAY - Masks initial layout calculation */}
                    {!isContentReady && (
                        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-100 dark:bg-[#1a1d23]">
                            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-3" />
                            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm animate-pulse">{t('loading_diagram') || 'Carregando diagrama...'}</p>
                        </div>
                    )}

                    {/* FUSION/CONNECTOR GHOST / CURSOR — positioned via ref (no setState on mousemove) */}
                    <div
                        ref={cursorGhostRef}
                        className="absolute pointer-events-none z-[50] flex items-center justify-center opacity-80"
                        style={{
                            left: 0,
                            top: 0,
                            width: '24px',
                            height: '12px',
                            display: isFusionToolActive ? '' : 'none',
                            transformOrigin: 'top left'
                        }}
                    >
                        {isConnectorToolActive ? (
                            <>
                                {/* Connector Ghost - Square with polish color */}
                                <div className={`w-2.5 h-2.5 rounded-[1px] border z-20 shadow-sm ${availableConnectors.find(c => c.id === selectedFusionTypeId)?.polishType === 'APC' ? 'bg-green-500 border-green-600' : 'bg-blue-500 border-blue-600'}`} />
                                <div className={`w-2 h-2 rounded-[1px] z-30 absolute left-[2px] ${availableConnectors.find(c => c.id === selectedFusionTypeId)?.polishType === 'APC' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                <div className={`w-2 h-2 rounded-[1px] z-30 absolute right-[2px] ${availableConnectors.find(c => c.id === selectedFusionTypeId)?.polishType === 'APC' ? 'bg-green-500' : 'bg-blue-500'}`} />
                            </>
                        ) : (
                            <>
                                {/* Fusion Ghost - Round */}
                                <div className="w-2.5 h-2.5 rounded-full border border-black z-20 shadow-sm bg-slate-400" />
                                <div className="w-2 h-2 rounded-full bg-[#2E2D39] border-[#2E2D39] z-30 absolute left-[2px]" />
                                <div className="w-2 h-2 rounded-full bg-[#2E2D39] border-[#2E2D39] z-30 absolute right-[2px]" />
                            </>
                        )}
                    </div>


                    {/* OTDR Info Banner */}
                    {isOtdrToolActive && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600 dark:bg-indigo-900/90 text-white px-4 py-2 rounded-full border border-indigo-400 dark:border-indigo-500 shadow-xl z-50 text-xs font-bold flex items-center gap-2 pointer-events-none">
                            <Ruler className="w-4 h-4" />
                            {t('otdr_instruction_banner')}
                        </div>
                    )}

                    {/* Snap override indicator — visible only when user holds Alt and snap was originally on */}
                    {isAltHeld && isSnapping && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/95 dark:bg-slate-900/95 text-amber-300 px-3 py-1.5 rounded-full border border-amber-500/50 shadow-xl z-50 text-[11px] font-semibold flex items-center gap-1.5 pointer-events-none">
                            <Magnet className="w-3.5 h-3.5 opacity-50" />
                            Snap desligado (Alt)
                        </div>
                    )}

                    {/* Grid Pattern - Adapts to Theme */}
                    <div
                        ref={gridRef}
                        className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#475569_1px,transparent_1px),linear-gradient(to_bottom,#475569_1px,transparent_1px)] opacity-60 dark:opacity-25"
                        style={{
                            backgroundSize: `${(GRID_SIZE * 5) * viewState.zoom}px ${(GRID_SIZE * 5) * viewState.zoom}px`,
                            backgroundPosition: `${viewState.x}px ${viewState.y}px`
                        }}
                    />

                    {/* Bottom Right Floating Controls */}
                    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-3 pointer-events-auto">
                        {/* Navigation Panel (Zoom & Center) */}
                        <div className="bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-1.5 flex flex-col gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewState(s => ({ ...s, zoom: s.zoom + 0.1 }))}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-slate-500 dark:text-slate-400"
                                title={t('zoom_in')}
                            >
                                <ZoomIn className="w-5 h-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewState(s => ({ ...s, zoom: Math.max(0.1, s.zoom - 0.1) }))}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-slate-500 dark:text-slate-400"
                                title={t('zoom_out')}
                            >
                                <ZoomOut className="w-5 h-5" />
                            </Button>
                            <div className="h-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCenterView}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-slate-500 dark:text-slate-400"
                                title={t('center_view') || "Center View"}
                            >
                                <Maximize className="w-5 h-5" />
                            </Button>
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
                            <ConnectionsLayer
                                connections={localCTO.connections}
                                litConnections={litConnections}
                                hoveredPortId={hoveredPortId}
                                isVflToolActive={isVflToolActive}
                                isOtdrToolActive={isOtdrToolActive}
                                dragState={dragState}
                                cacheVersion={cacheVersion}
                                getPortCenter={getPortCenter}
                                resolveFiberPortColor={resolveFiberPortColor}
                                onHoverConnection={handleHoverConnection}
                                handleSmartAlignConnection={handleSmartAlignConnection}
                                handlePathMouseDown={handlePathMouseDown}
                                handlePointMouseDown={handlePointMouseDown}
                                removeConnection={removeConnection}
                                removePoint={removePoint}
                                connectionRefs={connectionRefs}
                                connectionPointRefs={connectionPointRefs}
                                isSmartAlignMode={isSmartAlignMode}
                            />

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

                        <CableRenderer
                            cables={incomingCables}
                            layoutMap={localCTO.layout}
                            connections={localCTO.connections}
                            litPorts={litPorts}
                            poweredPorts={poweredPorts}
                            getPortPower={getPortPower}
                            getPortDirection={getPortDirection}
                            hoveredPortId={hoveredPortId}
                            cableStreetNames={cableStreetNamesRef.current}
                            isElementVisible={isElementVisible}
                            onDragStart={handleElementDragStart}
                            onRotate={handleRotateElement}
                            onMirror={handleMirrorElement}
                            onPortMouseDown={handlePortMouseDown}
                            onPortMouseEnter={handlePortMouseEnter}
                            onPortMouseLeave={handlePortMouseLeave}
                            onCableMouseEnter={handleCableMouseEnter}
                            onCableMouseLeave={handleCableMouseLeave}
                            onCableClick={handleCableClick}
                            onEdit={handleCableEditClick}
                            onContextMenu={handleCableContextMenu}
                            onHoverEnter={handleElementHover}
                            onHoverLeave={handleElementHoverClear}
                        />

                        <FusionRenderer
                            fusions={localCTO.fusions}
                            layoutMap={localCTO.layout}
                            connections={localCTO.connections}
                            litPorts={litPorts}
                            hoveredPortId={hoveredPortId}
                            customersByConnector={customersByConnector}
                            isElementVisible={isElementVisible}
                            onDragStart={handleElementDragStart}
                            onAction={handleFusionAction}
                            onPortMouseDown={handlePortMouseDown}
                            onPortMouseEnter={handlePortMouseEnter}
                            onPortMouseLeave={handlePortMouseLeave}
                            onHoverEnter={handleElementHover}
                            onHoverLeave={handleElementHoverClear}
                        />

                        {/* NOTES LAYER — see components/editor/NotesLayer.tsx */}
                        <NotesLayer
                            notes={localCTO.notes}
                            onUpdateNoteText={handleUpdateNoteText}
                            onDeleteNote={handleDeleteNote}
                        />

                        <SplitterRenderer
                            splitters={localCTO.splitters}
                            layoutMap={localCTO.layout}
                            connections={localCTO.connections}
                            litPorts={litPorts}
                            hoveredPortId={hoveredPortId}
                            availableSplitters={availableSplitters}
                            customersBySplitterPort={customersBySplitterPort}
                            isElementVisible={isElementVisible}
                            onDragStart={handleElementDragStart}
                            onAction={handleSplitterAction}
                            onPortMouseDown={handlePortMouseDown}
                            onPortMouseEnter={handlePortMouseEnter}
                            onPortMouseLeave={handlePortMouseLeave}
                            onDoubleClick={handleSplitterDoubleClick}
                            onContextMenu={handleSplitterContextMenu}
                            onHoverEnter={handleElementHover}
                            onHoverLeave={handleElementHoverClear}
                        />

                        <DIORenderer
                            dios={localCTO.dios || []}
                            layoutMap={localCTO.layout}
                            connections={localCTO.connections}
                            litPorts={litPorts}
                            hoveredPortId={hoveredPortId}
                            isElementVisible={isElementVisible}
                            onDragStart={handleElementDragStart}
                            onAction={handleDIOAction}
                            onPortMouseDown={handlePortMouseDown}
                            onPortMouseEnter={handlePortMouseEnter}
                            onPortMouseLeave={handlePortMouseLeave}
                            onHoverEnter={handleElementHover}
                            onHoverLeave={handleElementHoverClear}
                        />

                    </div>
                </div>

                {/* Footer: Status Controls. Box model is edited from the CTO
                    Properties panel only — keeping it out of the editor avoids
                    two competing places to change the same field. */}
                <div className={`h-16 bg-slate-100 dark:bg-[#1a1d23] border-t border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-50 cursor-default select-none ${isMaximized ? 'pr-24' : ''}`}>
                    {!readOnly && <div className="flex items-center gap-8">
                        {/* Status Radio Buttons — hidden when readOnly */}
                        {!readOnly && (
                            <div className="flex items-center gap-4">
                                {[
                                    { id: 'PLANNED', label: t('status_PLANNED'), color: '#f59e0b', textColor: 'text-amber-600 dark:text-amber-500' },
                                    { id: 'NOT_DEPLOYED', label: t('status_NOT_DEPLOYED'), color: '#ef4444', textColor: 'text-red-600 dark:text-red-500' },
                                    { id: 'DEPLOYED', label: t('status_DEPLOYED'), color: '#10b981', textColor: 'text-emerald-600 dark:text-emerald-500' },
                                    { id: 'CERTIFIED', label: t('status_CERTIFIED'), color: '#0ea5e9', textColor: 'text-sky-600 dark:text-sky-500' }
                                ].map((status) => (
                                    <button
                                        key={status.id}
                                        onClick={() => {
                                            setPropertiesStatus(status.id as CTOStatus);
                                            setLocalCTO(prev => ({ ...prev, status: status.id as CTOStatus }));
                                        }}
                                        className="flex items-center gap-2 group cursor-pointer transition-all"
                                    >
                                        <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${propertiesStatus === status.id ? 'border-slate-400 dark:border-slate-500 bg-white dark:bg-[#22262e]' : 'border-slate-300 dark:border-slate-600 bg-transparent group-hover:border-slate-400'}`}>
                                            <div
                                                className={`w-2.5 h-2.5 rounded-full transition-all shadow-sm ${propertiesStatus === status.id ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                                                style={{ backgroundColor: status.color }}
                                            />
                                        </div>
                                        <span className={`text-[13px] font-bold transition-colors ${propertiesStatus === status.id ? status.textColor : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                                            {status.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>}

                    {readOnly && readOnlyLabel && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300">
                            <span>🔒</span> {readOnlyLabel}
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        {canEdit && (
                            <Button
                                onClick={handleApply}
                                isLoading={savingAction === 'apply'}
                                disabled={savingAction !== 'idle'}
                                variant="primary"
                                className="px-5 font-bold min-w-[120px]"
                                icon={<Check className="w-4 h-4" />}
                            >
                                {t('apply') || 'Aplicar'}
                            </Button>
                        )}
                        {readOnly && onGoToParentProject && (
                            <Button
                                onClick={() => { onClose(); onGoToParentProject(); }}
                                variant="primary"
                                className="px-5 font-bold min-w-[120px]"
                                icon={<ExternalLink className="w-4 h-4" />}
                            >
                                <span className="whitespace-nowrap">{t('base_project_edit_in_base')}</span>
                            </Button>
                        )}
                        <Button
                            onClick={canEdit ? handleCloseRequest : onClose}
                            isLoading={savingAction === 'save_close'}
                            disabled={savingAction !== 'idle'}
                            variant={readOnly ? 'ghost' : 'emerald'}
                            className={readOnly ? 'px-4 font-bold' : 'px-6 font-bold min-w-[150px] shadow-sm shadow-emerald-900/20'}
                            icon={canEdit ? <Save className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        >
                            <span className="whitespace-nowrap">{canEdit ? (t('save_or_done') || 'Salvar / Sair') : (t('close') || 'Fechar')}</span>
                        </Button>
                    </div>
                </div>

                {/* CONFIRM UNSAVED CHANGES MODAL */}
                {showCloseConfirm && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
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
                            <div className="flex flex-row gap-3 mt-6">
                                <Button
                                    onClick={handleSaveAndClose}
                                    isLoading={savingAction === 'save_close'}
                                    disabled={savingAction !== 'idle'}
                                    variant="emerald"
                                    className="flex-1 font-bold shadow-lg"
                                    icon={<Save className="w-4 h-4" />}
                                >
                                    <span className="whitespace-nowrap">{t('save_and_close')}</span>
                                </Button>
                                <Button
                                    onClick={onClose}
                                    disabled={savingAction !== 'idle'}
                                    variant="secondary"
                                    className="flex-1 font-medium hover:bg-red-600 dark:hover:bg-red-900/30 hover:text-white dark:hover:text-red-400 border-slate-200 dark:border-slate-700 hover:border-red-600 dark:hover:border-red-900/50"
                                >
                                    <span className="whitespace-nowrap">{t('discard')}</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowCloseConfirm(false)}
                                    className="px-3 text-slate-500 text-xs font-medium"
                                >
                                    {t('cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* SPLITTER RENAME MODAL */}
                {splitterRename && (
                    <div
                        className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto"
                        onClick={() => setSplitterRename(null)}
                    >
                        <div
                            className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0 border border-emerald-300 dark:border-emerald-500/30">
                                    <Pencil className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                        {t('rename') || 'Renomear'}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t('rename_splitter_prompt') || 'Novo nome do splitter:'}
                                    </p>
                                </div>
                            </div>
                            <input
                                type="text"
                                autoFocus
                                value={splitterRename.value}
                                onChange={(e) => setSplitterRename({ ...splitterRename, value: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); commitSplitterRename(); }
                                    else if (e.key === 'Escape') { e.preventDefault(); setSplitterRename(null); }
                                }}
                                onFocus={(e) => e.currentTarget.select()}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                placeholder={t('rename_splitter_prompt') || 'Novo nome do splitter:'}
                            />
                            <div className="flex flex-row gap-3 mt-6">
                                <Button
                                    onClick={commitSplitterRename}
                                    disabled={!splitterRename.value.trim()}
                                    variant="emerald"
                                    className="flex-1 font-bold shadow-lg"
                                    icon={<Save className="w-4 h-4" />}
                                >
                                    <span className="whitespace-nowrap">{t('save') || 'Salvar'}</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setSplitterRename(null)}
                                    className="px-3 text-slate-500 text-xs font-medium"
                                >
                                    {t('cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <FusionTypeModal
                    isOpen={showFusionTypeModal}
                    onClose={() => setShowFusionTypeModal(false)}
                    options={availableFusions.length > 0 ? availableFusions : (network.fusionTypes || [])}
                    onSelect={activateFusionTool}
                />

                <ConnectorTypeModal
                    isOpen={showConnectorTypeModal}
                    onClose={() => setShowConnectorTypeModal(false)}
                    options={availableConnectors}
                    onSelect={activateFusionTool}
                />

                <SplitterSelectionModal
                    isOpen={showSplitterDropdown}
                    onClose={() => setShowSplitterDropdown(false)}
                    options={availableSplitters}
                    filter={splitterFilter}
                    onFilterChange={setSplitterFilter}
                    onSelect={handleAddSplitter}
                />

                <DIOAddModal
                    isOpen={showDIOModal}
                    onClose={() => setShowDIOModal(false)}
                    onConfirm={handleConfirmAddDIO}
                    suggestedName={`DIO ${(localCTO.dios?.length || 0) + 1}`}
                />



                <AutoSpliceModal
                    isOpen={isAutoSpliceOpen}
                    onClose={() => setIsAutoSpliceOpen(false)}
                    cables={incomingCables}
                    sourceId={autoSourceId}
                    targetId={autoTargetId}
                    onSourceChange={setAutoSourceId}
                    onTargetChange={setAutoTargetId}
                    onConfirm={performAutoSplice}
                />

                <OtdrInputModal
                    isOpen={!!otdrTargetPort}
                    onClose={() => setOtdrTargetPort(null)}
                    distance={otdrDistance}
                    onDistanceChange={setOtdrDistance}
                    onSubmit={handleOtdrSubmit}
                />

                {/* OPTICAL POWER MODAL */}
                <OpticalPowerModal
                    isOpen={isOpticalModalOpen}
                    onClose={() => setIsOpticalModalOpen(false)}
                    result={opticalResult}
                    splitterName={selectedSplitterName}
                    splitter={selectedSplitterForModal}
                    catalogItem={findSplitterCatalog(selectedSplitterForModal, availableSplitters)}
                />

                <QRCodeModal
                    isOpen={isQRCodeModalOpen}
                    onClose={() => setIsQRCodeModalOpen(false)}
                    ctoId={cto.id}
                    projectId={projectId || ''}
                    ctoName={cto.name || ''}
                    logo={saasLogo}
                />

                <CableRemoveModal
                    isOpen={!!cableToRemove}
                    onClose={() => setCableToRemove(null)}
                    onConfirm={() => {
                        if (!cableToRemove) return;
                        if (onDisconnectCable) onDisconnectCable(cableToRemove, localCTO.id);
                        setLocalCTO(prev => ({
                            ...prev,
                            inputCableIds: prev.inputCableIds?.filter(id => id !== cableToRemove),
                            connections: prev.connections?.filter(conn =>
                                !conn.sourceId.startsWith(`${cableToRemove}-`) &&
                                !conn.targetId.startsWith(`${cableToRemove}-`)
                            ) || []
                        }));
                        setCableToRemove(null);
                    }}
                />

                {/* CONTEXT MENU */}
                {contextMenu && (
                    <div
                        ref={contextMenuRef}
                        className="fixed z-[9999] bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {contextMenu.type === 'cable' ? (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (onDisconnectCable) {
                                            setCableToRemove(contextMenu.id);
                                            setContextMenu(null);
                                        }
                                    }}
                                    className="w-full !justify-start text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors gap-2 h-auto border-0"
                                    icon={<Link className="w-3.5 h-3.5 rotate-45" />}
                                >
                                    {t('ctx_remove_cable')}
                                </Button>
                                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        const cable = incomingCables.find(c => c.id === contextMenu.id);
                                        if (cable) {
                                            onEditCable(cable);
                                            setContextMenu(null);
                                        }
                                    }}
                                    className="w-full !justify-start text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors gap-2 h-auto border-0"
                                    icon={<Pencil className="w-3.5 h-3.5" />}
                                >
                                    {t('ctx_edit_cable')}
                                </Button>

                                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                                <Button
                                    variant="ghost"
                                    onClick={(e) => {
                                        // Trigger Mirror Action manually
                                        handleMirrorElement(e, contextMenu.id);
                                        setContextMenu(null);
                                    }}
                                    className="w-full !justify-start text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors gap-2 h-auto border-0"
                                    icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                                >
                                    {t('action_flip')}
                                </Button>

                                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (onSelectNextNode) {
                                            onSelectNextNode(contextMenu.id);
                                            setContextMenu(null);
                                        }
                                    }}
                                    className="w-full !justify-start text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors gap-2 h-auto border-0"
                                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                                >
                                    {t('ctx_next_box')}
                                </Button>
                            </>
                        ) : (
                            <>
                                {/* SPLITTER ACTIONS */}
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        handleSplitterDoubleClick(contextMenu.id);
                                        setContextMenu(null);
                                    }}
                                    className="w-full !justify-start text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors gap-2 h-auto border-0"
                                    icon={<Activity className="w-3.5 h-3.5" />}
                                >
                                    {t('ctx_details')}
                                </Button>
                                {!readOnly && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            handleRenameSplitter(contextMenu.id);
                                            setContextMenu(null);
                                        }}
                                        className="w-full !justify-start text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors gap-2 h-auto border-0"
                                        icon={<Pencil className="w-3.5 h-3.5" />}
                                    >
                                        {t('rename') || 'Renomear'}
                                    </Button>
                                )}
                                {!readOnly && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            handleDeleteSplitter(contextMenu.id);
                                            setContextMenu(null);
                                        }}
                                        className="w-full !justify-start text-left px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors gap-2 h-auto border-0"
                                        icon={<Trash2 className="w-3.5 h-3.5" />}
                                    >
                                        {t('delete')}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                )}

            </div>

            {/* RESIZE HANDLE (outside container to avoid overflow-hidden clipping) */}
            {!isMaximized && !isCollapsed && (
                <div
                    className="absolute bottom-1 right-1 w-5 h-5 cursor-nwse-resize z-[60] group/resize flex items-center justify-center"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDragState({
                            mode: 'resize',
                            startX: e.clientX,
                            startY: e.clientY,
                            initialLayout: { x: modalSize.w, y: modalSize.h, rotation: 0 }
                        });
                    }}
                >
                    <svg className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover/resize:text-emerald-500 transition-colors" viewBox="0 0 12 12">
                        <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                </div>
            )}

            {/* Destructive confirm modal (substitui window.confirm pro "limpar conexões" e similares). */}
            {destructiveConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700/30 animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            {destructiveConfirm.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            {destructiveConfirm.message}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDestructiveConfirm(null)}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-[#22262e] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { destructiveConfirm.onConfirm(); setDestructiveConfirm(null); }}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-md shadow-red-500/20 transition-colors active:scale-[0.98]"
                            >
                                {destructiveConfirm.confirmLabel || 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
};
