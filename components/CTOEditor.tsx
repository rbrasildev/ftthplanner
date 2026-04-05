import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { CTOData, CableData, FiberConnection, Splitter, FusionPoint, getFiberColor, ElementLayout, CTO_STATUS_COLORS, CTOStatus, Note } from '../types';
import { X, Save, Plus, Scissors, RotateCw, Trash2, ZoomIn, ZoomOut, GripHorizontal, Link, Magnet, Flashlight, Move, Ruler, ArrowRightLeft, FileDown, Image as ImageIcon, AlertTriangle, ChevronDown, ChevronUp, Zap, Maximize, Minimize2, Box, Eraser, AlignCenter, Triangle, Pencil, Loader2, ArrowRight, Activity, ExternalLink, Check, ChevronLeft, ChevronRight, QrCode, Printer, Keyboard, CircleHelp, StickyNote } from 'lucide-react';
import { Button } from './common/Button';
import { useLanguage } from '../LanguageContext';
import { CustomSelect } from './common/CustomSelect';
import { CustomInput } from './common/CustomInput';
import { FiberCableNode } from './editor/FiberCableNode';
import { CTOEditorToolbar } from './editor/CTOEditorToolbar';
import { FusionNode } from './editor/FusionNode';
import { SplitterNode } from './editor/SplitterNode';
import { generateCTOSVG, exportToPNG } from './CTOExporter';
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
import { QRCodeModal } from './modals/QRCodeModal';
import { traceOpticalPath, OpticalPathResult } from '../utils/opticalUtils';
import { NetworkState, Customer } from '../types';
import { getCustomers } from '../services/customerService';
import { useCTOEditorState } from '../hooks/useCTOEditorState';
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
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }

        // Convert lat/lng to tile coordinates
        const n = Math.pow(2, zoom);
        const centerTileX = ((lng + 180) / 360) * n;
        const centerTileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;

        const tileSize = 256;
        const tilesX = Math.ceil(width / tileSize) + 1;
        const tilesY = Math.ceil(height / tileSize) + 1;

        // Offset within the center tile
        const offsetX = (centerTileX % 1) * tileSize;
        const offsetY = (centerTileY % 1) * tileSize;

        const startTileX = Math.floor(centerTileX) - Math.floor(tilesX / 2);
        const startTileY = Math.floor(centerTileY) - Math.floor(tilesY / 2);

        let loaded = 0;
        const totalTiles = tilesX * tilesY;

        const drawX = width / 2 - offsetX - (Math.floor(centerTileX) - startTileX) * tileSize;
        const drawY = height / 2 - offsetY - (Math.floor(centerTileY) - startTileY) * tileSize;

        for (let tx = 0; tx < tilesX; tx++) {
            for (let ty = 0; ty < tilesY; ty++) {
                const tileXi = startTileX + tx;
                const tileYi = startTileY + ty;

                const tileImg = new Image();
                tileImg.crossOrigin = "Anonymous";
                tileImg.onload = () => {
                    ctx.drawImage(tileImg, drawX + tx * tileSize, drawY + ty * tileSize);
                    loaded++;
                    if (loaded === totalTiles) {
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
                    }
                };
                tileImg.onerror = () => {
                    loaded++;
                    if (loaded === totalTiles) {
                        try { resolve(canvas.toDataURL('image/png')); } catch { resolve(null); }
                    }
                };
                tileImg.src = `https://tile.openstreetmap.org/${zoom}/${tileXi}/${tileYi}.png`;
            }
        }
    });
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
    network: NetworkState;
    projectId?: string;
    companyLogo?: string | null;
    saasLogo?: string | null;
    autoDownload?: boolean; // NEW: To trigger export on load
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

                const finalColor = isLit ? '#ef4444' : (useThemeColor ? undefined : conn.color);
                const finalWidth = isLit ? 3.5 : 2.5;

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
                            style={{ filter: isLit ? 'drop-shadow(0 0 5px rgba(239, 68, 68, 0.45))' : 'none' }}
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
    litPorts: incomingLitPorts, vflSource, onToggleVfl, onOtdrTrace, onHoverCable, onDisconnectCable, onSelectNextNode, onUpdateCableStreetNames,
    userPlan, subscriptionExpiresAt, onShowUpgrade, network, userRole,
    projectId, companyLogo, saasLogo,
    autoDownload
}) => {
    const { t } = useLanguage();

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
    const handleExportPNGRef = useRef<() => void>(() => {});

    useEffect(() => {
        if (autoDownload) {
            console.log("[CTOEditor] Auto-download triggered via deep link");
            const timer = setTimeout(() => {
                handleExportPNGRef.current();
            }, 3000); // 3 seconds to be safe with all renders
            return () => clearTimeout(timer);
        }
    }, [autoDownload]);

    useEffect(() => {
        setLitPorts(incomingLitPorts);
    }, [incomingLitPorts]);

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

    const [isVflToolActive, setIsVflToolActive] = useState(false);
    const [isOtdrToolActive, setIsOtdrToolActive] = useState(false);
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

    // Sync properties states with localCTO when it changes (initial load)
    useEffect(() => {
        setPropertiesName(localCTO.name);
        setPropertiesStatus((localCTO.status as CTOStatus) || 'PLANNED');
    }, [localCTO.id]);


    const [showSplitterDropdown, setShowSplitterDropdown] = useState(false);
    const [splitterFilter, setSplitterFilter] = useState<'all' | 'Balanced' | 'Unbalanced'>('all');
    const [isSmartAlignMode, setIsSmartAlignMode] = useState(false);
    const [isRotateMode, setIsRotateMode] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);

    // FUSION TOOL STATE
    const [isFusionToolActive, setIsFusionToolActive] = useState(false);
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
    const [availableBoxes, setAvailableBoxes] = useState<BoxCatalogItem[]>([]);
    const [isCatalogLoading, setIsCatalogLoading] = useState(true);

    // Load catalogs on mount (splitters, fusions, cables, boxes, OLTs)
    useEffect(() => {
        const loadCatalogs = async () => {
            setIsCatalogLoading(true);
            try {
                const [splitters, fusions, connectors, cables, boxes, olts] = await Promise.all([
                    getSplitters(),
                    getFusions('fusion'),
                    getFusions('connector'),
                    getCables(),
                    getBoxes(),
                    getOLTs()
                ]);
                setAvailableSplitters(splitters);
                setAvailableFusions(fusions);
                setAvailableConnectors(connectors);
                setAvailableCables(cables);
                setAvailableBoxes(boxes);
                setAvailableOLTs(olts);
            } catch (err) {
                console.error("Failed to load catalogs", err);
            } finally {
                setIsCatalogLoading(false);
            }
        };
        loadCatalogs();
    }, []);

    // --- CENTRALIZED TOOL MODE MANAGEMENT ---
    // All tool modes are mutually exclusive. This function clears ALL tool modes.
    const clearAllToolModes = useCallback(() => {
        setIsRotateMode(false);
        setIsDeleteMode(false);
        setIsSmartAlignMode(false);
        setIsVflToolActive(false);
        setIsOtdrToolActive(false);
        setIsFusionToolActive(false);
        setShowSplitterDropdown(false);
    }, []);

    // Toggle a specific tool mode. If it was active, deactivate it (clear all).
    // If it was inactive, clear all others and activate it.
    type ToolMode = 'rotate' | 'delete' | 'smartAlign' | 'vfl' | 'otdr' | 'fusion' | 'splitterDropdown';
    const toolModeSetters: Record<ToolMode, React.Dispatch<React.SetStateAction<boolean>>> = {
        rotate: setIsRotateMode,
        delete: setIsDeleteMode,
        smartAlign: setIsSmartAlignMode,
        vfl: setIsVflToolActive,
        otdr: setIsOtdrToolActive,
        fusion: setIsFusionToolActive,
        splitterDropdown: setShowSplitterDropdown
    };
    const toolModeGetters: Record<ToolMode, boolean> = {
        rotate: isRotateMode,
        delete: isDeleteMode,
        smartAlign: isSmartAlignMode,
        vfl: isVflToolActive,
        otdr: isOtdrToolActive,
        fusion: isFusionToolActive,
        splitterDropdown: showSplitterDropdown
    };
    const toggleToolMode = useCallback((mode: ToolMode) => {
        const wasActive = toolModeGetters[mode];
        clearAllToolModes();
        if (!wasActive) {
            toolModeSetters[mode](true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRotateMode, isDeleteMode, isSmartAlignMode, isVflToolActive, isOtdrToolActive, isFusionToolActive, showSplitterDropdown, clearAllToolModes]);

    const GRID_SIZE = 6; // Reduced from 12 for finer granule control
    const splitterDropdownRef = useRef<HTMLDivElement>(null);

    // Stable ref for tool modes - allows useCallback handlers to read current tool states
    // without being recreated when modes toggle (prevents ConnectionsLayer re-renders)
    const toolModesRef = useRef({
        isVflToolActive, isOtdrToolActive, isFusionToolActive,
        isSmartAlignMode, isRotateMode, isDeleteMode, isSnapping: true
    });
    useLayoutEffect(() => {
        toolModesRef.current = {
            isVflToolActive, isOtdrToolActive, isFusionToolActive,
            isSmartAlignMode, isRotateMode, isDeleteMode, isSnapping
        };
    });

    // Optical Power Calculation State
    const [isOpticalModalOpen, setIsOpticalModalOpen] = useState(false);
    const [opticalResult, setOpticalResult] = useState<OpticalPathResult | null>(null);
    const [selectedSplitterName, setSelectedSplitterName] = useState('');

    // UNIFIED CACHE CLEAR
    // Clears geometric caches when structure changes (NOT on pan/zoom — ports don't move relative to canvas).
    // forceRender is needed so ConnectionsLayer can measure port positions after DOM paints.
    // cacheVersion is passed to ConnectionsLayer so the custom areEqual doesn't block the re-render.
    const [cacheVersion, forceRender] = useState(0);

    useLayoutEffect(() => {
        portCenterCache.current = {};
        containerRectCache.current = null;
        forceRender(n => n + 1);
    }, [incomingCables, localCTO.connections, localCTO.layout, localCTO.splitters, localCTO.fusions, isMaximized, modalSize]);


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
        currentMouseX?: number;
        currentMouseY?: number;
        initialWindowPos?: { x: number, y: number };
        offsetX?: number;
        offsetY?: number;
        // Optimization: Cache initial connection points for delta calculation
        initialConnectionPoints?: { x: number, y: number }[];
    } | null>(null);
    const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
    const [hoveredElement, setHoveredElement] = useState<{ id: string, type: 'cable' | 'connection' | 'splitter' | 'fusion' } | null>(null);
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


    // Cable Editing State - REMOVED (Handled Globally)

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

    // Viewport culling — compute visible canvas bounds to skip rendering off-screen elements
    // Viewport culling — skip rendering off-screen elements to reduce DOM nodes.
    // At high zoom (>1.5), culling is disabled: few elements are on screen anyway,
    // and the margin becomes too tight (200px / zoom), causing false culling.
    // Also reads from viewStateRef to stay accurate after DOM-direct panning.
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
    }, [isMaximized]);

    const screenToCanvas = (sx: number, sy: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (sx - rect.left - viewStateRef.current.x) / viewStateRef.current.zoom,
            y: (sy - rect.top - viewStateRef.current.y) / viewStateRef.current.zoom
        };
    };

    const portCenterCache = useRef<Record<string, { x: number, y: number }>>({});
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

    const handleSmartAlignConnection = useCallback((connId: string) => {
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
                const snap = (pts: { x: number, y: number }[]) =>
                    JSON.stringify(pts.map(p => ({
                        x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
                        y: Math.round(p.y / GRID_SIZE) * GRID_SIZE
                    })));
                const currentStr = snap(currentPoints);

                let matchIndex = -1;
                candidates.forEach((cand, idx) => {
                    if (snap(cand) === currentStr) matchIndex = idx;
                });

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
                    const normalize = (pts: any[]) => JSON.stringify(pts.map((p: any) => ({ x: Math.round(p.x), y: Math.round(p.y) })));
                    const currentStr = normalize(currentPoints);

                    let matchIndex = -1;
                    // For Z shapes (idx 3,4), check with tolerance since uniform spacing offsets them
                    detectionCandidates.forEach((cand, idx) => {
                        const candSnapped = cand.map(p => ({
                            x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
                            y: Math.round(p.y / GRID_SIZE) * GRID_SIZE
                        }));
                        if (normalize(candSnapped) === currentStr) matchIndex = idx;
                    });

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
                        const baseMidX = (avgSourceX + avgTargetX) / 2;
                        const turnX = baseMidX + (idx - center) * LANE_SPACING;
                        shapePoints = [{ x: turnX, y: p1.y }, { x: turnX, y: p2.y }];
                        break;
                    }
                    case 4: { // Uniform Z vertical — each fiber gets its own turn row
                        const baseMidY = (avgSourceY + avgTargetY) / 2;
                        const turnY = baseMidY + (idx - center) * LANE_SPACING;
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
            else alert("Exportação disponível apenas para planos pagos.");
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
                mapImage: '',
                logo: ''
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

            const svg = generateCTOSVG(localCTO, incomingCables, litPorts, portPositions, footerData);
            const fileName = `CTO-${localCTO.name.replace(/\s+/g, '_')}`;
            await exportToPNG(svg, `${fileName}.png`);
        } catch (error: any) {
            console.error('Export PNG failed', error);
            alert(t('export_png_error'));
        } finally {
            setExportingType(null);
        }
    };

    const handleExportPNG = () => handleExport('png');
    handleExportPNGRef.current = handleExportPNG;

    // --- OPTICAL POWER CALCULATION HANDLER ---
    const handleSplitterDoubleClick = (splitterId: string) => {
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

    const handleHoverConnection = useCallback((id: string | null) => {
        setHoveredElement(id ? { id, type: 'connection' } : null);
    }, []);

    // Stable hover handler via event delegation — avoids N inline arrows per .map() item
    // Child wrappers use data-hover-id and data-hover-type attributes instead of onMouseEnter/Leave
    const handleElementHover = useCallback((e: React.MouseEvent) => {
        const target = (e.target as HTMLElement).closest('[data-hover-id]') as HTMLElement | null;
        if (target) {
            setHoveredElement({
                id: target.dataset.hoverId!,
                type: target.dataset.hoverType as 'cable' | 'connection' | 'splitter' | 'fusion'
            });
        }
    }, []);
    const handleElementHoverClear = useCallback((e: React.MouseEvent) => {
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

            return {
                ...prev,
                layout: { ...prev.layout, [id]: newLayout }
            };
        });
    }, [incomingCables]);





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

    // OPTIMIZED: Direct DOM Manipulation for smooth 60FPS dragging
    const handleMouseMove = (e: React.MouseEvent) => {
        // Track mouse screen position for rotation-during-drag
        lastMouseScreenPos.current = { x: e.clientX, y: e.clientY };

        // Track Cursor for Fusion Ghost (Direct DOM — no setState at 60fps)
        if (isFusionToolActive) {
            const { x, y } = screenToCanvas(e.clientX, e.clientY);
            const snapX = isSnapping ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
            const snapY = isSnapping ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;
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

        // 3. ELEMENT DRAG (Direct DOM)
            if (dragState.mode === 'note') {
                const dy = (e.clientY - dragState.startY) / viewState.zoom;
                const dx = (e.clientX - dragState.startX) / viewState.zoom;
                
                const newX = (dragState.initialLayout?.x || 0) + dx;
                const newY = (dragState.initialLayout?.y || 0) + dy;

                setLocalCTO(prev => ({
                    ...prev,
                    notes: (prev.notes || []).map(n => n.id === dragState.targetId ? {
                        ...n,
                        x: Math.round(newX / GRID_SIZE) * GRID_SIZE,
                        y: Math.round(newY / GRID_SIZE) * GRID_SIZE
                    } : n)
                }));
                return;
            }

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

        // 4. CONNECTION POINT DRAG (Direct DOM) with live orthogonal snapping
        if (dragState.mode === 'point' && dragState.connectionId && dragState.pointIndex !== undefined) {
            let { x, y } = screenToCanvas(e.clientX, e.clientY);

            // Apply projection offset to prevent jump on initial drag
            if (dragState.offsetX !== undefined && dragState.offsetY !== undefined) {
                x += dragState.offsetX;
                y += dragState.offsetY;
            }

            const modes = toolModesRef.current;

            // Grid snap
            if (modes.isSnapping) {
                x = Math.round(x / GRID_SIZE) * GRID_SIZE;
                y = Math.round(y / GRID_SIZE) * GRID_SIZE;
            }

            // Use ref (not state) to get the latest connections - state may be stale
            // when a point was just created by handlePathMouseDown
            const conn = localCTORef.current.connections.find(c => c.id === dragState.connectionId);
            if (conn) {
                const p1 = getPortCenter(conn.sourceId);
                const p2 = getPortCenter(conn.targetId);

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

            let x = isSnapping ? Math.round(dropX / GRID_SIZE) * GRID_SIZE : dropX;
            let y = isSnapping ? Math.round(dropY / GRID_SIZE) * GRID_SIZE : dropY;

            // Apply same orthogonal snap as during drag (closest neighbor wins)
            if (isSnapping) {
                const conn = localCTORef.current.connections.find(c => c.id === dragState.connectionId);
                if (conn) {
                    const p1 = getPortCenter(conn.sourceId);
                    const p2 = getPortCenter(conn.targetId);
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

    // --- GLOBAL EVENT LISTENERS FOR DRAG & TOOLS ---
    // Use refs for handlers to avoid re-binding window listeners on every render.
    // The handlers read all state via refs/closures that are always fresh.
    const handleMouseMoveRef = useRef(handleMouseMove);
    const handleMouseUpRef = useRef(handleMouseUp);
    useLayoutEffect(() => { handleMouseMoveRef.current = handleMouseMove; });
    useLayoutEffect(() => { handleMouseUpRef.current = handleMouseUp; });

    useEffect(() => {
        if (dragState || isFusionToolActive) {
            const onMove = (e: MouseEvent) => handleMouseMoveRef.current(e as unknown as React.MouseEvent);
            const onUp = (e: MouseEvent) => handleMouseUpRef.current(e as unknown as React.MouseEvent);

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);

            return () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
        }
    }, [dragState, isFusionToolActive]);



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
            // Convert container center to canvas coordinates
            const screenCX = rect.width / 2;
            const screenCY = rect.height / 2;
            cx = (screenCX - viewState.x) / viewState.zoom - NOTE_W / 2;
            cy = (screenCY - viewState.y) / viewState.zoom - NOTE_H / 2;
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

    const handleUpdateNoteText = (id: string, text: string) => {
        setLocalCTO(prev => ({
            ...prev,
            notes: (prev.notes || []).map(n => n.id === id ? { ...n, text } : n)
        }));
    };

    const handleDeleteNote = (id: string) => {
        setLocalCTO(prev => ({
            ...prev,
            notes: (prev.notes || []).filter(n => n.id !== id)
        }));
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
        clearAllToolModes();
        setIsFusionToolActive(true);
        setSelectedFusionTypeId(typeId);
        setShowFusionTypeModal(false);
        setShowConnectorTypeModal(false);
    };

    const handleAddConnector = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (availableConnectors.length > 1) {
            setShowConnectorTypeModal(true);
        } else {
            const defaultType = availableConnectors.length === 1 ? availableConnectors[0].id : null;
            activateFusionTool(defaultType);
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

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();

            // (S) Add Splitter
            if (key === 's') {
                e.preventDefault();
                toggleToolMode('splitterDropdown');
            }
            // (F) Fusion Tool
            else if (key === 'f') {
                e.preventDefault();
                toggleToolMode('fusion');
            }
            // (A) Smart Align
            else if (key === 'a') {
                e.preventDefault();
                toggleToolMode('smartAlign');
            }
            // (R) Rotate Hovered
            else if (key === 'r') {
                if (hoveredElement && (hoveredElement.type === 'cable' || hoveredElement.type === 'splitter' || hoveredElement.type === 'fusion')) {
                    e.preventDefault();
                    handleRotateElement(null as any, hoveredElement.id);
                }
            }
            // (T) Open Auto Passante
            else if (key === 't') {
                e.preventDefault();
                setIsAutoSpliceOpen(prev => !prev);
            }
            // (D) Delete Hovered
            else if (key === 'd') {
                if (hoveredElement) {
                    e.preventDefault();
                    if (hoveredElement.type === 'splitter') {
                        handleDeleteSplitter(hoveredElement.id);
                    } else if (hoveredElement.type === 'fusion') {
                        handleDeleteFusion(hoveredElement.id);
                    } else if (hoveredElement.type === 'connection') {
                        removeConnection(hoveredElement.id);
                    }
                    setHoveredElement(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hoveredElement, handleRotateElement, handleDeleteSplitter, handleDeleteFusion, removeConnection, toggleToolMode, setIsAutoSpliceOpen]);

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
                className={`cto-editor-container relative ${isMaximized ? 'w-full h-full rounded-none' : isCollapsed ? 'h-auto rounded-xl' : 'rounded-xl'} bg-white dark:bg-[#1a1d23] border-[1px] border-slate-300 dark:border-slate-600 shadow-sm flex flex-col overflow-hidden ${isVflToolActive || isOtdrToolActive || isSmartAlignMode || isRotateMode || isDeleteMode ? 'cursor-crosshair' : ''}`}
                style={isMaximized ? undefined : { width: modalSize.w, height: isCollapsed ? 'auto' : modalSize.h }}
            >

                <CTOEditorToolbar
                    t={t}
                    propertiesName={propertiesName}
                    onNameChange={(name) => { setPropertiesName(name); setLocalCTO(prev => ({ ...prev, name })); }}
                    isMaximized={isMaximized}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                    onToggleMaximize={toggleMaximize}
                    onClose={handleCloseRequest}
                    onWindowDragStart={handleWindowDragStart}
                    isRotateMode={isRotateMode}
                    isDeleteMode={isDeleteMode}
                    showSplitterDropdown={showSplitterDropdown}
                    isFusionToolActive={isFusionToolActive}
                    isSmartAlignMode={isSmartAlignMode}
                    isVflToolActive={isVflToolActive}
                    isOtdrToolActive={isOtdrToolActive}
                    isSnapping={isSnapping}
                    onToggleSnapping={() => setIsSnapping(!isSnapping)}
                    toggleToolMode={toggleToolMode}
                    onAddFusion={handleAddFusion}
                    onAddConnector={handleAddConnector}
                    isConnectorToolActive={isConnectorToolActive}
                    onAddNote={handleAddNote}
                    isAutoSpliceOpen={isAutoSpliceOpen}
                    onOpenAutoSplice={() => setIsAutoSpliceOpen(true)}
                    onClearConnections={() => { if (window.confirm(t('clear_connections_confirm'))) setLocalCTO(prev => ({ ...prev, connections: [] })); }}
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
                    className="flex-1 bg-[#E6E6E6] dark:bg-[#1a1d23] relative overflow-hidden"
                    style={{ display: isCollapsed ? 'none' : undefined, cursor: isVflToolActive || isOtdrToolActive ? 'crosshair' : 'default' }}
                    onMouseDown={handleMouseDown}
                    onWheel={handleWheel}
                >
                    {/* LOADING OVERLAY - Masks initial layout calculation */}
                    {!isContentReady && (
                        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-100 dark:bg-[#1a1d23] border-2 border-slate-300 dark:border-slate-600 rounded-bl-xl">
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
                        ref={gridRef}
                        className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#475569_1px,transparent_1px),linear-gradient(to_bottom,#475569_1px,transparent_1px)] opacity-60 dark:opacity-20"
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
                            <div className="h-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
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

                                // Viewport culling: skip rendering cables outside visible area
                                if (!isElementVisible(layout, 192, totalHeight)) return null;

                                return (
                                        <FiberCableNode
                                            key={cable.id}
                                            cable={cable}
                                            layout={layout}
                                            connections={localCTO.connections}
                                            litPorts={litPorts}
                                            hoveredPortId={hoveredPortId}
                                            streetName={cableStreetNamesRef.current.get(cable.id)}
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
                                            onHoverEnter={handleElementHover}
                                            onHoverLeave={handleElementHoverClear}
                                            hoverData={{ id: cable.id, type: 'cable' }}
                                        />
                                );
                            });
                        })()}

                        {localCTO.fusions.map(fusion => {
                            const layout = getLayout(fusion.id);
                            // Viewport culling: skip off-screen fusions (48x24 bounding box)
                            if (!isElementVisible(layout, 48, 24)) return null;
                            return (
                                    <FusionNode
                                        key={fusion.id}
                                        fusion={fusion}
                                        layout={layout}
                                        connections={localCTO.connections}
                                        litPorts={litPorts}
                                        hoveredPortId={hoveredPortId}
                                        onDragStart={handleElementDragStart}
                                        onAction={handleFusionAction}
                                        onPortMouseDown={handlePortMouseDown}
                                        onPortMouseEnter={setHoveredPortId}
                                        onPortMouseLeave={handlePortMouseLeave}
                                        onHoverEnter={handleElementHover}
                                        onHoverLeave={handleElementHoverClear}
                                        hoverData={{ id: fusion.id, type: 'fusion' }}
                                    />
                            );
                        })}

                            {/* NOTES LAYER (HTML implementation for better layout integration) */}
                            {localCTO.notes?.map(note => (
                                <div 
                                    key={note.id} 
                                    data-note-id={note.id}
                                    className="absolute z-50 group/note select-none cursor-move flex flex-col pt-1"
                                    style={{
                                        transform: `translate(${note.x}px, ${note.y}px)`,
                                        width: note.width,
                                        height: note.height,
                                        backgroundColor: note.color,
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                                        borderRadius: '2px',
                                        border: '1px solid #eab308',
                                        pointerEvents: 'auto'
                                    }}
                                >
                                    {/* Drag Handle (Top Bar) */}
                                    <div className="h-3 w-full flex items-center justify-center opacity-30 group-hover/note:opacity-100 transition-opacity">
                                        <div className="w-8 h-0.5 bg-yellow-900/20 rounded-full" />
                                    </div>

                                    <div className="flex-1 px-2 pb-2">
                                        <textarea
                                            className="w-full h-full bg-transparent border-none outline-none font-sans resize-none text-[11px] leading-tight text-yellow-900 font-medium placeholder:text-yellow-700/30"
                                            value={note.text}
                                            onChange={(e) => handleUpdateNoteText(note.id, e.target.value)}
                                            placeholder={t('note_placeholder') || '...'}
                                            onMouseDown={(e) => e.stopPropagation()} 
                                        />
                                    </div>
                                    
                                    <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        className="absolute top-0.5 right-0.5 p-0.5 text-yellow-900/20 hover:text-red-500 opacity-0 group-hover/note:opacity-100 transition-all pointer-events-auto"
                                    >
                                        <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            ))}

                        {localCTO.splitters.map(splitter => {
                            const layout = getLayout(splitter.id);
                            // Viewport culling: skip off-screen splitters
                            const splitterWidth = splitter.outputPortIds.length * 24;
                            if (!isElementVisible(layout, splitterWidth, 72)) return null;

                            // Map customers to ports for this splitter
                            const attachedCustomers = ctoCustomers
                                .filter(c => c.splitterId === splitter.id && c.splitterPortIndex !== null && c.splitterPortIndex !== undefined)
                                .reduce((acc, c) => ({ ...acc, [c.splitterPortIndex!]: { name: c.name, status: c.connectionStatus } }), {} as Record<number, { name: string; status?: string }>);

                            // Find official catalog item to pass technical specs (attenuation)
                            const catalogItem = availableSplitters.find(c =>
                                c.name === splitter.type ||
                                c.type === splitter.type ||
                                (c.outputs === splitter.outputPortIds.length && splitter.type.includes(c.name))
                            );

                            return (
                                    <SplitterNode
                                        key={splitter.id}
                                        splitter={splitter}
                                        layout={layout}
                                        connections={localCTO.connections}
                                        litPorts={litPorts}
                                        hoveredPortId={hoveredPortId}
                                        catalogItem={catalogItem}
                                        onDragStart={handleElementDragStart}
                                        onAction={handleSplitterAction}
                                        onPortMouseDown={handlePortMouseDown}
                                        onPortMouseEnter={setHoveredPortId}
                                        onPortMouseLeave={handlePortMouseLeave}
                                        onDoubleClick={handleSplitterDoubleClick}
                                        onContextMenu={handleSplitterContextMenu}
                                        attachedCustomers={attachedCustomers}
                                        onHoverEnter={handleElementHover}
                                        onHoverLeave={handleElementHoverClear}
                                        hoverData={{ id: splitter.id, type: 'splitter' }}
                                    />
                                    );
                                })}

                            </div>
                        </div>

                {/* Footer: Redesigned with Model and Status Controls */}
                <div className={`h-16 bg-slate-100 dark:bg-[#1a1d23] border-t border-slate-200 dark:border-slate-700/30 flex items-center justify-between px-6 shrink-0 z-50 cursor-default select-none ${isMaximized ? 'pr-24' : ''}`}>
                    <div className="flex items-center gap-8">
                        {/* Model Select */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('model') || 'Modelo'}</span>
                            <div className="w-48">
                                {isCatalogLoading ? (
                                    <div className="h-10 w-full bg-slate-200 dark:bg-[#22262e] animate-pulse rounded-xl border border-slate-300 dark:border-slate-700" />
                                ) : (
                                    <CustomSelect
                                        value={localCTO.catalogId || ''}
                                        placement="top"
                                        showSearch={false}
                                        onChange={(selectedId) => {
                                            const box = availableBoxes.find(b => b.id === selectedId);
                                            setLocalCTO(prev => ({
                                                ...prev,
                                                catalogId: selectedId,
                                                type: box?.type || prev.type
                                            }));
                                        }}
                                        options={[
                                            { value: '', label: t('select_box_model') || 'Selecionar Modelo...' },
                                            ...availableBoxes.map(box => ({
                                                value: box.id,
                                                label: `${box.name} (${box.brand})`
                                            }))
                                        ]}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Status Radio Buttons */}
                        <div className="flex items-center gap-4">
                            {[
                                { id: 'PLANNED', label: t('status_PLANNED'), color: '#f59e0b', textColor: 'text-amber-600 dark:text-amber-500' },
                                { id: 'NOT_DEPLOYED', label: t('status_NOT_DEPLOYED'), color: '#ef4444', textColor: 'text-red-600 dark:text-red-500' },
                                { id: 'DEPLOYED', label: t('status_DEPLOYED'), color: '#10b981', textColor: 'text-emerald-600 dark:text-emerald-500' },
                                { id: 'CERTIFIED', label: t('status_CERTIFIED'), color: '#0ea5e9', textColor: 'text-emerald-600 dark:text-emerald-500' }
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
                    </div>

                    <div className="flex items-center gap-3">
                        {userRole !== 'MEMBER' && (
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
                        <Button
                            onClick={userRole === 'MEMBER' ? onClose : handleCloseRequest}
                            isLoading={savingAction === 'save_close'}
                            disabled={savingAction !== 'idle'}
                            variant="emerald"
                            className="px-6 font-bold min-w-[150px] shadow-sm shadow-emerald-900/20"
                            icon={userRole === 'MEMBER' ? <X className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        >
                            <span className="whitespace-nowrap">{userRole === 'MEMBER' ? (t('done') || 'Sair') : (t('save_or_done') || 'Salvar / Sair')}</span>
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

                {/* FUSION TYPE SELECTION MODAL */}
                {showFusionTypeModal && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
                        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl p-4 max-w-xs w-full shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                            <div className="flex items-center justify-between mb-2 px-2">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {t('select_fusion_type')}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowFusionTypeModal(false)}
                                    className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {(availableFusions.length > 0 ? availableFusions : network.fusionTypes)?.map((ft: any) => (
                                    <Button
                                        key={ft.id}
                                        variant="ghost"
                                        onClick={() => activateFusionTool(ft.id)}
                                        className="w-full justify-between items-center group transition-colors px-3 py-2.5 h-auto"
                                    >
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                            {ft.name}
                                        </span>
                                        {ft.attenuation && (
                                            <span className="text-xs text-slate-400 font-mono">
                                                {ft.attenuation}dB
                                            </span>
                                        )}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* CONNECTOR TYPE SELECTION MODAL */}
                {showConnectorTypeModal && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
                        <div className="bg-white dark:bg-[#1a1d23] rounded-2xl p-4 max-w-xs w-full shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                            <div className="flex items-center justify-between mb-2 px-2">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {t('select_connector_type') || 'Selecionar Conector'}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowConnectorTypeModal(false)}
                                    className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {availableConnectors.map((ct: any) => (
                                    <Button
                                        key={ct.id}
                                        variant="ghost"
                                        onClick={() => { activateFusionTool(ct.id); setShowConnectorTypeModal(false); }}
                                        className="w-full justify-between items-center group transition-colors px-3 py-2.5 h-auto"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-[1px] ${ct.polishType === 'APC' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                                {ct.name}
                                            </span>
                                        </div>
                                        {ct.attenuation !== undefined && (
                                            <span className="text-xs text-slate-400 font-mono">{ct.attenuation}dB</span>
                                        )}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* SPLITTER SELECTION MODAL */}
                {showSplitterDropdown && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] pointer-events-auto">
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-100 dark:border-slate-700/30 rounded-2xl p-4 max-w-xs w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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

                            <div className="flex bg-slate-100 dark:bg-[#22262e] p-1 rounded-xl mb-3 gap-1">
                                <button
                                    onClick={() => setSplitterFilter('all')}
                                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${splitterFilter === 'all' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {t('all')}
                                </button>
                                <button
                                    onClick={() => setSplitterFilter('Balanced')}
                                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${splitterFilter === 'Balanced' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {t('splitter_mode_balanced')}
                                </button>
                                <button
                                    onClick={() => setSplitterFilter('Unbalanced')}
                                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${splitterFilter === 'Unbalanced' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {t('splitter_mode_unbalanced')}
                                </button>
                            </div>

                            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {(() => {
                                    const filteredSplitters = availableSplitters.filter(s =>
                                        splitterFilter === 'all' || s.mode === splitterFilter
                                    );

                                    if (filteredSplitters.length === 0) {
                                        return (
                                            <div className="px-4 py-8 text-center text-xs text-slate-500 italic">
                                                {t('no_templates') || 'No templates available'}
                                            </div>
                                        );
                                    }

                                    return filteredSplitters.map(item => (
                                        <Button
                                            key={item.id}
                                            variant="ghost"
                                            onClick={(e) => { handleAddSplitter(e, item); setShowSplitterDropdown(false); }}
                                            className="w-full justify-between items-center group transition-colors px-3 py-2.5 h-auto"
                                        >
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                                {item.name}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">
                                                {item.outputs} {t('outputs') || 'outputs'}
                                            </span>
                                        </Button>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                )}



                {/* AUTO SPLICE MODAL */}
                {isAutoSpliceOpen && (
                    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsAutoSpliceOpen(false)}>
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 w-96 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                                    <ArrowRightLeft className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('auto_splice')}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('auto_splice_help')}</p>
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-normal">
                                {t('auto_splice_desc')}
                            </p>

                            <div className="space-y-4 mb-6">
                                <CustomSelect
                                    label={t('source_cable')}
                                    value={autoSourceId}
                                    onChange={(val) => setAutoSourceId(val)}
                                    showSearch={false}
                                    options={[
                                        { value: '', label: t('select_cable') },
                                        ...incomingCables.map(c => ({ value: c.id, label: `${c.name} (${c.fiberCount} FO)` }))
                                    ]}

                                />
                                <CustomSelect
                                    label={t('target_cable')}
                                    value={autoTargetId}
                                    onChange={(val) => setAutoTargetId(val)}
                                    showSearch={false}
                                    options={[
                                        { value: '', label: t('select_cable') },
                                        ...incomingCables.map(c => ({ value: c.id, label: `${c.name} (${c.fiberCount} FO)` }))
                                    ]}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsAutoSpliceOpen(false)}
                                    className="flex-1"
                                >
                                    {t('cancel')}
                                </Button>
                                <Button
                                    variant="emerald"
                                    onClick={performAutoSplice}
                                    disabled={!autoSourceId || !autoTargetId || autoSourceId === autoTargetId}
                                    className="flex-1 font-bold shadow-lg"
                                >
                                    {t('perform_splice')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* OTDR INPUT MODAL */}
                {otdrTargetPort && (
                    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOtdrTargetPort(null)}>
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 w-80 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                                    <Ruler className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('otdr_title')}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('otdr_trace_msg')}</p>
                                </div>
                            </div>

                            <div className="mb-4">
                                <CustomInput
                                    label={t('otdr_distance_lbl')}
                                    type="number"
                                    value={otdrDistance}
                                    onChange={(e) => setOtdrDistance(e.target.value)}
                                    placeholder="e.g. 1250"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setOtdrTargetPort(null)}
                                    className="flex-1"
                                >
                                    {t('cancel')}
                                </Button>
                                <Button
                                    variant="emerald"
                                    onClick={handleOtdrSubmit}
                                    className="flex-1 font-bold shadow-lg"
                                >
                                    {t('otdr_locate')}
                                </Button>
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

                <QRCodeModal
                    isOpen={isQRCodeModalOpen}
                    onClose={() => setIsQRCodeModalOpen(false)}
                    ctoId={cto.id}
                    projectId={projectId || ''}
                    ctoName={cto.name || ''}
                    logo={saasLogo}
                />

                {/* CONFIRM CABLE REMOVAL MODAL */}
                {cableToRemove && (
                    <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0 border border-red-300 dark:border-red-500/30">
                                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('title_remove_cable') || 'Remover Cabo'}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t('confirm_remove_cable_box')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-row gap-3 mt-6">
                                <Button
                                    variant="destructive"
                                    onClick={() => {
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
                                    className="flex-1 font-bold shadow-lg"
                                    icon={<Link className="w-4 h-4 rotate-45" />}
                                >
                                    {t('action_remove') || 'Remover'}
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
                                <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1"></div>
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

                                <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1"></div>
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

                                <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1"></div>
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
                                        handleSplitterDoubleClick(contextMenu.id); // Reusing existing double-click logic for "Details"
                                        setContextMenu(null);
                                    }}
                                    className="w-full !justify-start text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors gap-2 h-auto border-0"
                                    icon={<Activity className="w-3.5 h-3.5" />}
                                >
                                    {t('ctx_details')}
                                </Button>
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
        </div >
    );
};
