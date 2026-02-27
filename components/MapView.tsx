
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Tooltip, useMap, Pane, Popup, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { CTOData, POPData, CableData, PoleData, Coordinates, CTO_STATUS_COLORS, CABLE_STATUS_COLORS, POLE_STATUS_COLORS, PoleStatus } from '../types';
import { CableContextMenu } from './CableContextMenu';
import { NodeContextMenu } from './NodeContextMenu';
import { useLanguage } from '../LanguageContext';
import { Box, Layers, Share2, Tag, Zap, Radio, Maximize, Search, UtilityPole, Ruler, User, Map as MapIcon, Globe, Building2, Diamond, CheckCircle2, XCircle, LocateFixed } from 'lucide-react';
import { D3CablesLayer } from './D3CablesLayer';
import { Customer } from '../types';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../services/customerService';
import { CustomersLayer } from './layers/CustomersLayer';
import { DropsLayer } from './layers/DropsLayer';
import { CustomerModal } from './modals/CustomerModal';
import { CustomerDropDrawer } from './interactions/CustomerDropDrawer';
import { ConnectCustomerModal } from './modals/ConnectCustomerModal';
import { CTOMarker } from './markers/CTOMarker';
import { POPMarker } from './markers/POPMarker';
import { PoleMarker } from './markers/PoleMarker';
import { TechnicalReserveMarker } from './markers/TechnicalReserveMarker';



// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: any;
    return function (...args: Parameters<T>) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Fix for default Leaflet icon issues in Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
    iconUrl: '/leaflet/images/marker-icon.png',
    shadowUrl: '/leaflet/images/marker-shadow.png',
});

// --- ICONS HELPERS WITH CACHING ---

// Icon cache to prevent recreation
const iconCache = new Map<string, L.DivIcon>();

const otdrIcon = L.divIcon({
    className: 'otdr-icon',
    html: `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <div class="animate-ping" style="
            position: absolute;
            width: 100%; height: 100%;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.6);
            border: 2px solid #ef4444;
        "></div>
        <div style="
            position: relative;
            width: 12px; height: 12px;
            background: #ef4444;
            border: 2px solid white;
            border-radius: 50%;
            z-index: 10;
        "></div>
    </div>
`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

const handleIcon = L.divIcon({
    className: 'cable-handle',
    html: `<div style="width: 12px; height: 12px; background: white; border: 2px solid #0ea5e9; border-radius: 50%; cursor: grab; box-shadow: 0 0 6px rgba(0,0,0,0.8);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

const startPointIcon = L.divIcon({
    className: 'start-point',
    html: `<div style="width: 10px; height: 10px; background: #fbbf24; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px black;"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
});

const createSearchPinIcon = (isSelected: boolean) => {
    const cacheKey = `search-pin-${isSelected}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

    const size = 40;
    const icon = L.divIcon({
        className: 'custom-pin-icon',
        html: `
            <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; items-center; justify-content: center;">
                <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 12px; height: 4px; background: rgba(0,0,0,0.2); border-radius: 50%; filter: blur(1px);"></div>
                <div style="position: relative; z-index: 10; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
                    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 21C16 17.5 19 14.4183 19 10C19 6.13401 15.866 3 12 3C8.13401 3 5 6.13401 5 10C5 14.4183 8 17.5 12 21Z" fill="url(#pinGradient)" stroke="white" stroke-width="1.5"/>
                        <circle cx="12" cy="10" r="3" fill="white"/>
                        <defs>
                            <linearGradient id="pinGradient" x1="12" y1="3" x2="12" y2="21" gradientUnits="userSpaceOnUse">
                                <stop stop-color="#ef4444"/>
                                <stop offset="1" stop-color="#b91c1c"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <div style="position: absolute; top: 10px; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; animation: pulse-red 2.5s infinite; pointer-events: none; z-index: 5;"></div>
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size - 4],
        popupAnchor: [0, -size + 10]
    });

    iconCache.set(cacheKey, icon);
    return icon;
};

const pinIcon = L.divIcon({
    className: 'custom-pin-icon',
    html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10]
});

// --- SUB COMPONENTS (Memoized for Performance) ---
// Markers are imported from ./markers/ folder


interface CablePolylineProps {
    cable: CableData;
    isLit: boolean;
    isActive: boolean;
    isHighlighted: boolean;
    mode: string;
    t: (key: string) => string;
    onClick: (e: any, cable: CableData) => void;
    onDoubleClick?: (e: any, cable: CableData) => void;
    onUpdateGeometry?: (id: string, coords: Coordinates[]) => void;
    onConnect?: (cableId: string, nodeId: string, index: number) => void;
    snapDistance?: number;
    ctos?: CTOData[];
    pops?: POPData[];
    poles?: PoleData[];
    onPointDragStart: (cableId: string, index: number) => void;
    onDrag: (lat: number, lng: number) => void;
    onDragEnd: () => void;
    handlePane?: string;
}

const CablePolyline: React.FC<CablePolylineProps> = React.memo(({
    cable, isLit, isActive, isHighlighted, mode, t, onClick, onDoubleClick, onUpdateGeometry, onConnect,
    snapDistance = 30, ctos = [], pops = [], poles = [], onPointDragStart, onDrag, onDragEnd, handlePane
}) => {

    const positions = useMemo(() => cable.coordinates.map(c => [c.lat, c.lng] as [number, number]), [cable.coordinates]);

    const color = useMemo(() => {
        if (isLit) return '#ef4444';
        if (isActive) return '#facc15'; // Yellow for Active/Editing
        if (cable.status === 'NOT_DEPLOYED') return CABLE_STATUS_COLORS['NOT_DEPLOYED'];
        return cable.color || CABLE_STATUS_COLORS['DEPLOYED'];
    }, [isLit, isActive, cable.status, cable.color]);

    const dashArray = useMemo(() => {
        // if (isActive) return '10, 10'; // Removed dash for active to match solid purple request
        if (cable.status === 'NOT_DEPLOYED') return '5, 5';
        return undefined;
    }, [isActive, cable.status]);

    const handleDragEnd = useCallback((e: any, index: number) => {
        // onDragEnd(); // Moved to end to prevent premature re-render resetting position
        if (!onUpdateGeometry) return;
        const marker = e.target;
        const pos = marker.getLatLng();
        let nearestNode: string | null = null;
        let minDist = Infinity;

        ctos.forEach(cto => {
            const dist = pos.distanceTo(L.latLng(cto.coordinates.lat, cto.coordinates.lng));
            if (dist < snapDistance) { if (dist < minDist) { minDist = dist; nearestNode = cto.id; } }
        });
        pops.forEach(pop => {
            const dist = pos.distanceTo(L.latLng(pop.coordinates.lat, pop.coordinates.lng));
            if (dist < snapDistance) { if (dist < minDist) { minDist = dist; nearestNode = pop.id; } }
        });
        poles.forEach(pole => {
            const dist = pos.distanceTo(L.latLng(pole.coordinates.lat, pole.coordinates.lng));
            if (dist < snapDistance) { if (dist < minDist) { minDist = dist; nearestNode = pole.id; } }
        });

        if (nearestNode && onConnect) {
            // Defer update to allow Leaflet drag cycle to complete
            setTimeout(() => {
                onConnect(cable.id, nearestNode, index);
                onDragEnd(); // Cleanup visual tether after connect
            }, 0);
        } else {
            const newCoords = [...cable.coordinates];
            newCoords[index] = { lat: pos.lat, lng: pos.lng };
            onUpdateGeometry(cable.id, newCoords);
            onDragEnd(); // Cleanup visual tether after update
        }
    }, [cable.coordinates, cable.id, ctos, pops, poles, snapDistance, onConnect, onUpdateGeometry, onDragEnd]);

    const handleRemovePoint = useCallback((e: any, index: number) => {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e); // Prevent context menu
        if (!onUpdateGeometry || cable.coordinates.length <= 2) return;
        const newCoords = [...cable.coordinates];
        newCoords.splice(index, 1);
        onUpdateGeometry(cable.id, newCoords);
    }, [cable.coordinates, cable.id, onUpdateGeometry]);

    const pathOptions = useMemo(() => ({
        color,
        weight: isActive ? 6 : 4,
        opacity: isLit ? 1 : 0.8,
        dashArray
    }), [color, isActive, isLit, dashArray]);

    const map = useMap();
    const shortenedPositions = useMemo(() => {
        if (!positions || positions.length < 2) return positions;

        // Convert to pixel points, shorten, convert back
        // We only care about shortening start and end
        const pixelPoints = positions.map(p => map.latLngToLayerPoint(L.latLng(p[0], p[1])));

        const SHORTEN_PX = 20;

        const shorten = (p1: L.Point, p2: L.Point) => {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= SHORTEN_PX) return p1;
            const t = SHORTEN_PX / dist;
            return L.point(p1.x + dx * t, p1.y + dy * t);
        };

        if (pixelPoints.length >= 2) {
            // Shorten Start
            pixelPoints[0] = shorten(pixelPoints[0], pixelPoints[1]);
            // Shorten End
            const last = pixelPoints.length - 1;
            pixelPoints[last] = shorten(pixelPoints[last], pixelPoints[last - 1]);
        }

        return pixelPoints.map(p => {
            const ll = map.layerPointToLatLng(p);
            return [ll.lat, ll.lng] as [number, number];
        });
    }, [positions, map]);


    return (
        <>
            {/* 1. VISUAL LAYERS (Low Z-Index) */}
            {/* Note: 'pathOptions' usually go to default overlayPane (400).
                If we want them strictly BELOW markers (600), we can use 'd3-visual' (350) or just default overlayPane is fine (400 < 600).
                User requested "look connected" (under the box). Markers are Z 600. OverlayPane is Z 400. So default is fine.
                BUT if we used 'd3-visual' (350) it's safer. Let's try to target 'd3-visual' if available, else default.
                React-Leaflet <Polyline> takes a 'pane' prop.
            */}

            {
                isLit && (
                    <Polyline
                        positions={positions}
                        pathOptions={{ color: '#ef4444', weight: 10, opacity: 0.4 }}
                        interactive={false}
                    />
                )
            }

            {
                isHighlighted && !isLit && (
                    <Polyline
                        positions={positions}
                        pathOptions={{ color: '#22c55e', weight: 12, opacity: 0.5 }}
                        interactive={false}
                    />
                )
            }

            {/* Active Cable Glow (Yellow) */}
            {
                isActive && !isLit && (
                    <Polyline
                        positions={positions}
                        pathOptions={{ color: '#facc15', weight: 12, opacity: 0.4 }}
                        interactive={false}
                    />
                )
            }

            {/* MAIN VISIBLE PATH */}
            <Polyline
                positions={positions}
                pathOptions={pathOptions}
                interactive={false} // Disable interaction on visual line
            />

            {/* 2. INTERACTION LAYER (Unified Low Z-Index) */}
            {/* Transparent wide path for clicking - NOW IN SAME PANE (Z350) */}
            {/* Markers (Z600) naturally cover this path, so no need for shortening */}
            <Polyline
                positions={positions}
                pathOptions={{
                    stroke: true,
                    color: 'transparent',
                    weight: 20, // Wide hit area
                    opacity: 0,
                    className: 'cursor-pointer' // Tailwind class for pointer cursor
                }}
                eventHandlers={{
                    click: (e) => onClick(e, cable),
                    dblclick: (e) => onDoubleClick && onDoubleClick(e, cable) // Pass double click to handler
                }}
            />

            {
                isActive && (mode === 'connect_cable' || mode === 'edit_cable') && cable.coordinates.map((coord, index) => (
                    <Marker
                        key={`${cable.id}-pt-${index}`}
                        position={[coord.lat, coord.lng]}
                        icon={handleIcon}
                        zIndexOffset={1000}
                        draggable={true}
                        pane={handlePane || "markerPane"} // Use Custom Pane if provided, else default markers (600)
                        eventHandlers={{
                            dragstart: () => onPointDragStart(cable.id, index),
                            drag: (e) => {
                                const pos = e.target.getLatLng();
                                onDrag(pos.lat, pos.lng);
                            },
                            dragend: (e) => handleDragEnd(e, index),
                            dblclick: (e) => handleRemovePoint(e, index), // Changed to dblclick to prevent accidental removal on drag release
                            contextmenu: (e) => handleRemovePoint(e, index)
                        }}
                        title={t('right_click_delete_point') || "Duplo clique para remover"}
                    >
                    </Marker >
                ))
            }
        </>
    );
});

// --- HELPER COMPONENTS ---

const MapEvents: React.FC<{
    mode: string,
    onMapClick: (lat: number, lng: number) => void,
    onClearSelection: () => void,
    onMapMoveEnd?: (lat: number, lng: number, zoom: number) => void,
    onContextMenu?: (e: L.LeafletMouseEvent) => void,
    onUndoDrawingPoint?: () => void,
    isRepositioning?: boolean,
    isDrawingDrop?: boolean
}> = ({ mode, onMapClick, onClearSelection, onMapMoveEnd, onContextMenu, onUndoDrawingPoint, isRepositioning, isDrawingDrop }) => {
    useMapEvents({
        contextmenu(e) {
            // Block context menu
            if (mode === 'draw_cable' || mode === 'ruler' || mode === 'position_reserve' || isDrawingDrop) {
                L.DomEvent.preventDefault(e as any);
                if (onUndoDrawingPoint) {
                    onUndoDrawingPoint();
                }
                return;
            }

            if (onContextMenu) {
                onContextMenu(e);
            }
        },
        click(e) {
            if (isRepositioning) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            } else if (mode === 'add_customer') {
                onMapClick(e.latlng.lat, e.latlng.lng);
            } else if (mode === 'add_cto' || mode === 'add_pop' || mode === 'add_pole' || mode === 'draw_cable' || mode === 'ruler' || mode === 'position_reserve') {
                onMapClick(e.latlng.lat, e.latlng.lng);
                onMapClick(e.latlng.lat, e.latlng.lng);
            } else if (mode === 'connect_cable') {
                onClearSelection();
            } else {
                // Always attempt to clear selection/menus on generic map clicks
                onClearSelection();
            }
        },
        moveend(e) {
            if (onMapMoveEnd) {
                const c = e.target.getCenter();
                const z = e.target.getZoom();
                onMapMoveEnd(c.lat, c.lng, z);
            }
        }
    });
    return null;
};

const MapResizeHandler = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => { map.invalidateSize(); }, 200);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const MapController = ({ bounds, viewKey, center, zoom }: { bounds: any, viewKey?: string, center?: Coordinates, zoom?: number }) => {
    const map = useMap();
    const lastViewKey = React.useRef<string | undefined>(undefined);

    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 22, animate: true, duration: 1.5 });
            return;
        }
        // Only update view if we have a center AND it's a new viewKey (project switch) 
        // AND we haven't processed this viewKey yet.
        if (center && zoom && viewKey && viewKey !== lastViewKey.current) {
            map.setView([center.lat, center.lng], zoom);
            lastViewKey.current = viewKey;
        }
    }, [bounds, map, viewKey, center, zoom]);
    return null;
};

function getDistanceFromLine(pt: Coordinates, lineStart: Coordinates, lineEnd: Coordinates) {
    const x = pt.lat; const y = pt.lng; const x1 = lineStart.lat; const y1 = lineStart.lng; const x2 = lineEnd.lat; const y2 = lineEnd.lng;
    const A = x - x1; const B = y - y1; const C = x2 - x1; const D = y2 - y1;
    const dot = A * C + B * D; const len_sq = C * C + D * D;
    let param = -1; if (len_sq !== 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
    const dx = x - xx; const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}



const BoundsUpdater = ({
    setBounds,
    setZoom
}: {
    setBounds: (b: L.LatLngBounds) => void,
    setZoom: (z: number) => void
}) => {
    const map = useMap();

    const updateMapState = useMemo(
        () => debounce(() => {
            setBounds(map.getBounds());
            setZoom(map.getZoom());
        }, 150),
        [map, setBounds, setZoom]
    );

    useMapEvents({
        moveend: () => updateMapState(),
        zoomend: () => updateMapState()
    });

    useEffect(() => {
        updateMapState();
    }, [map, updateMapState]);

    return null;
};

// --- MAP JUMP LOGIC (FOR LOCATE ON MAP) ---
const MapJumpController = ({ viewKey }: { viewKey?: string }) => {
    const map = useMap();
    React.useEffect(() => {
        const jumpCoords = localStorage.getItem('map_jump_to_coords');
        if (jumpCoords) {
            try {
                const { lat, lng } = JSON.parse(jumpCoords);
                map.flyTo([lat, lng], 18, { duration: 1.5 });
                localStorage.removeItem('map_jump_to_coords');
            } catch (e) {
                console.error("Error parsing jump coords", e);
            }
        }
    }, [map, viewKey]);
    return null;
};

// --- MAIN COMPONENT ---

interface MapViewProps {
    ctos: CTOData[];
    pops: POPData[];
    poles?: PoleData[];
    cables: CableData[];
    mode: 'view' | 'add_cto' | 'add_pop' | 'add_pole' | 'add_customer' | 'draw_cable' | 'connect_cable' | 'move_node' | 'otdr' | 'pick_connection_target' | 'edit_cable';
    selectedId: string | null;
    mapBounds?: L.LatLngBoundsExpression | null;
    showLabels?: boolean;
    litCableIds?: Set<string>;
    highlightedCableId?: string | null;
    cableStartPoint?: { lat: number, lng: number } | null;
    drawingPath?: Coordinates[];
    snapDistance?: number;
    otdrResult?: Coordinates | null;
    viewKey?: string;
    initialCenter?: Coordinates;
    initialZoom?: number;
    onMapMoveEnd?: (lat: number, lng: number, zoom: number) => void;
    onAddPoint: (lat: number, lng: number) => void;
    onNodeClick: (id: string, type: 'CTO' | 'POP' | 'Pole') => void;
    onMoveNode?: (id: string, lat: number, lng: number) => void;
    onCableStart: (nodeId: string) => void;
    onCableEnd: (nodeId: string) => void;
    onConnectCable?: (cableId: string, nodeId: string, pointIndex: number) => void;
    onUpdateCableGeometry?: (cableId: string, newCoordinates: Coordinates[]) => void;
    onCableClick?: (cableId: string) => void;
    onToggleLabels?: () => void;
    previewImportData?: {
        cables: any[];
        ctos: any[];
        ceos: any[];
        poles: any[];
    } | null;
    multiConnectionIds?: Set<string>;
    onEditCable?: (cableId: string) => void;
    onEditCableGeometry?: (cableId: string) => void;
    onDeleteCable?: (cableId: string) => void;
    onInitConnection?: (cableId: string) => void;

    onToggleReserveCable?: (id: string) => void;
    onPositionReserveCable?: (id: string) => void;
    onReservePositionSet?: (lat: number, lng: number) => void;

    projectId?: string;

    onEditNode?: (id: string, type: 'CTO' | 'POP' | 'Pole') => void;
    onDeleteNode?: (id: string, type: 'CTO' | 'POP' | 'Pole') => void;
    onMoveNodeStart?: (id: string, type: 'CTO' | 'POP' | 'Pole') => void;
    onPropertiesNode?: (id: string, type: 'CTO' | 'POP' | 'Pole') => void;
    onConvertPin?: (type: 'CTO' | 'Pole') => void;
    onClearPin?: () => void;
    onUndoDrawingPoint?: () => void;
    pinnedLocation?: (Coordinates & { viability?: { active: boolean, distance: number } }) | null;
    rulerPoints?: Coordinates[];
    onRulerPointsChange?: (points: Coordinates[]) => void;
    allCustomers?: Customer[];
    userRole?: string | null;
    onCustomerSaved?: (customer?: Customer) => void;
    onCancelMode?: () => void;
}

const noOp = (..._args: any[]) => { };

export const MapView: React.FC<MapViewProps> = ({
    ctos, pops, cables, poles = [], mode, selectedId, mapBounds, showLabels = false, litCableIds = new Set<string>(),
    highlightedCableId, cableStartPoint, drawingPath = [], snapDistance = 30, otdrResult, viewKey,
    initialCenter, initialZoom, onMapMoveEnd, onAddPoint, onNodeClick, onMoveNode,
    onCableStart, onCableEnd, onConnectCable, onUpdateCableGeometry, onCableClick, onEditCable, onEditCableGeometry, onDeleteCable, onInitConnection, onToggleLabels,
    previewImportData, multiConnectionIds = new Set(), onEditNode, onDeleteNode, onMoveNodeStart, onPropertiesNode,
    onConvertPin, onClearPin, onUndoDrawingPoint = noOp,
    pinnedLocation = null,
    rulerPoints = [],
    onRulerPointsChange = noOp,
    allCustomers = [],
    showToast,
    onToggleReserveCable, onPositionReserveCable, onReservePositionSet,
    onCustomerSaved,
    userRole = null,
    projectId,
    onCancelMode
}) => {
    const { t } = useLanguage();
    const [activeCableId, setActiveCableId] = useState<string | null>(null);

    // Customer State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const [connectCustomerModalOpen, setConnectCustomerModalOpen] = useState(false);
    const [pendingConnection, setPendingConnection] = useState<{ ctoId: string, dropPoints: L.LatLng[] } | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Partial<Customer> | undefined>(undefined);
    const [isCustomersVisible, setIsCustomersVisible] = useState(true);
    const [drawingCustomerDrop, setDrawingCustomerDrop] = useState<{
        customerId: string,
        startLat: number,
        startLng: number,
        points: L.LatLng[]
    } | null>(null);

    // Performance optimizations state (Moved here)
    const [mapBoundsState, setMapBoundsState] = useState<L.LatLngBounds | null>(null);
    const [currentZoom, setCurrentZoom] = useState<number>(initialZoom || 15);

    // Fetch Customers
    const fetchCustomers = useCallback(async (bounds?: L.LatLngBounds) => {
        if (!bounds) return;
        try {
            // Pad by 50% to ensure we load customers whose drops might cross the screen
            // even if the customer themselves are off-screen when zooming into a CTO.
            const paddedBounds = bounds.pad(0.5);

            // console.log("Fetching customers for bounds:", paddedBounds.toBBoxString());
            const data = await getCustomers({
                minLat: paddedBounds.getSouth(),
                maxLat: paddedBounds.getNorth(),
                minLng: paddedBounds.getWest(),
                maxLng: paddedBounds.getEast(),
                projectId
            });
            console.log(`[MapView] Fetched ${data.length} customers.`);
            // DEBUG: Check for drops
            const withDrops = data.filter(c => (c as any).drop).length;
            console.log(`[MapView] Customers with drops: ${withDrops}`, withDrops > 0 ? (data.find(c => (c as any).drop) as any).drop : 'None');
            setCustomers(data);
        } catch (error) {
            console.error("Error fetching customers:", error);
        }
    }, []);

    // Update customers when map moves (debounced)
    // Update customers when map moves (debounced)
    useEffect(() => {
        // Use mapBoundsState (from BoundsUpdater) if available, falling back to mapBounds prop
        const currentBounds = (mapBoundsState || mapBounds) as L.LatLngBounds;

        if (currentBounds && isCustomersVisible) {
            const timer = setTimeout(() => {
                fetchCustomers(currentBounds);
            }, 500); // 500ms debounce
            return () => clearTimeout(timer);
        }
    }, [mapBounds, mapBoundsState, isCustomersVisible, fetchCustomers, projectId]);

    // Customer Handlers
    const handleCustomerClick = useCallback((customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerModalOpen(true);
    }, []);

    // --- CUSTOMER FLOW PART 1: PLACEMENT ---
    const handleMapClickForCustomer = useCallback((lat: number, lng: number) => {
        // Step 1: Place customer, open modal for basic info
        setSelectedCustomer({ lat, lng });
        setCustomerModalOpen(true);
    }, []);

    const handleSaveCustomer = async (customer: Partial<Customer>) => {
        try {
            const currentBounds = (mapBoundsState || mapBounds) as L.LatLngBounds;
            if (customer.id) {
                // Determine logic for update vs new flow
                // For now, simple update
                const updatedCustomer = await updateCustomer(customer.id, customer);
                // Optimistically update the single customer in the state immediately
                setCustomers(prev => prev.map(c => c.id === customer.id ? updatedCustomer : c));
                setCustomerModalOpen(false);
                if (currentBounds) fetchCustomers(currentBounds); // Background sync
                setSelectedCustomer(null); // Clear placement marker
                if (onCustomerSaved) onCustomerSaved(updatedCustomer);
            } else {
                // CREATE NEW CUSTOMER
                const newCustomer = await createCustomer({ ...customer, projectId });
                setCustomers(prev => [...prev, newCustomer]);
                setCustomerModalOpen(false);
                if (currentBounds) fetchCustomers(currentBounds);
                setSelectedCustomer(null); // Clear placement marker
                if (onCustomerSaved) onCustomerSaved(newCustomer);
            }
        } catch (error) {
            console.error("Failed to save customer:", error);
            throw error;
        }
    };

    // Draw Drop Logic
    const handleCustomerContextMenu = useCallback((e: L.LeafletMouseEvent, customer: Customer) => {
        // Disabled right-click draw drop as per request. The button in the modal will be used instead.
        setMapContextMenu(null); // Close map menu
    }, []);

    const handleStartDrawingDrop = useCallback((customerId: string, coords?: { lat: number, lng: number }) => {
        const customer = allCustomers.find(c => c.id === customerId);
        if (!customer && !coords) return;

        setDrawingCustomerDrop({
            customerId: customerId,
            startLat: coords?.lat ?? customer?.lat ?? 0,
            startLng: coords?.lng ?? customer?.lng ?? 0,
            points: []
        });
        console.log("[MapView] Explicitly starting drop drawing for:", customerId, "at", coords || "stored coords");
    }, [allCustomers]);


    const handleConnectToCTO = useCallback((ctoId: string) => {
        if (!drawingCustomerDrop) return;

        const cto = ctos.find(c => c.id === ctoId);
        if (!cto) return;

        // Open Modal to select splitter/port
        setPendingConnection({
            ctoId: cto.id,
            dropPoints: drawingCustomerDrop.points || [] // Pass the path drawn so far
        });
        setConnectCustomerModalOpen(true);

        // Don't clear drawing state yet, wait for modal confirm/cancel
    }, [drawingCustomerDrop, ctos]);

    // Modify onMapClick to handle 'add_customer' mode
    // (This requires finding the existing onMapClick definition and modifying it or injecting logic)

    // --- PERSISTENCE HELPERS ---
    const getSaved = <T,>(key: string, def: T): T => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : def;
        } catch { return def; }
    };

    const [mapType, setMapType] = useState<'street' | 'satellite'>(() => getSaved('ftth_map_type', 'street'));

    // Performance optimizations state
    // (Moved to top of component)

    // Visibility States
    const [showCables, setShowCables] = useState(() => getSaved('ftth_show_cables', true));
    const [showCTOs, setShowCTOs] = useState(() => getSaved('ftth_show_ctos', true));
    const [showPOPs, setShowPOPs] = useState(() => getSaved('ftth_show_pops', true));
    const [showPoles, setShowPoles] = useState(() => getSaved('ftth_show_poles', false));
    const [isLayersOpen, setIsLayersOpen] = useState(false);
    const [enableClustering, setEnableClustering] = useState(() => getSaved('ftth_clustering', true));

    // --- PERSISTENCE EFFECTS ---
    useEffect(() => { localStorage.setItem('ftth_map_type', JSON.stringify(mapType)); }, [mapType]);
    useEffect(() => { localStorage.setItem('ftth_show_cables', JSON.stringify(showCables)); }, [showCables]);
    useEffect(() => { localStorage.setItem('ftth_show_ctos', JSON.stringify(showCTOs)); }, [showCTOs]);
    useEffect(() => { localStorage.setItem('ftth_show_pops', JSON.stringify(showPOPs)); }, [showPOPs]);
    useEffect(() => { localStorage.setItem('ftth_show_poles', JSON.stringify(showPoles)); }, [showPoles]);
    useEffect(() => { localStorage.setItem('ftth_clustering', JSON.stringify(enableClustering)); }, [enableClustering]);

    // --- PERFORMANCE REFS (Stabilize Callbacks) ---
    const cablesRef = useRef(cables);
    useEffect(() => { cablesRef.current = cables; }, [cables]);

    // --- DRAG FEEDBACK STATE ---
    const [dragState, setDragState] = useState<{ isDragging: boolean, currentPosition: Coordinates | null, tetherPoints: Coordinates[] }>({
        isDragging: false, currentPosition: null, tetherPoints: []
    });

    const handleNodeDragStart = useCallback((id: string) => {
        const tethers: Coordinates[] = [];
        // Use Ref to avoid re-creating callback when cables change (prevents Marker re-renders)
        cablesRef.current.forEach(c => {
            // If dragging a node, tether to the "next" point of any connected cable
            if (c.fromNodeId === id && c.coordinates.length > 1) tethers.push(c.coordinates[1]);
            else if (c.toNodeId === id && c.coordinates.length > 1) tethers.push(c.coordinates[c.coordinates.length - 2]);
        });
        setDragState({ isDragging: true, currentPosition: null, tetherPoints: tethers });
    }, []); // No dependency on 'cables'



    const handlePointDragStart = useCallback((cableId: string, index: number) => {
        const cable = cablesRef.current.find(c => c.id === cableId);
        if (!cable) return;
        const tethers: Coordinates[] = [];
        if (index > 0) tethers.push(cable.coordinates[index - 1]);
        if (index < cable.coordinates.length - 1) tethers.push(cable.coordinates[index + 1]);
        setDragState({ isDragging: true, currentPosition: null, tetherPoints: tethers });
    }, []); // No dependency on 'cables'

    const handleDrag = useCallback((lat: number, lng: number) => {
        setDragState(prev => ({ ...prev, currentPosition: { lat, lng } }));
    }, []);

    const handleDragEnd = useCallback(() => {
        setDragState({ isDragging: false, currentPosition: null, tetherPoints: [] });
    }, []);

    const handleConnectWrapper = useCallback((cableId: string, nodeId: string, index: number) => {
        // Multi-connect: Keep active to allow daisy-chaining nodes without re-selecting
        if (onConnectCable) onConnectCable(cableId, nodeId, index);
    }, [onConnectCable]);



    // Filter visible elements using useMemo for performance
    const allActiveCableIds = useMemo(() => {
        const set = new Set(multiConnectionIds);
        if (activeCableId) set.add(activeCableId);
        // Include selected cable in Edit Cable mode to show handles immediately
        if (mode === 'edit_cable' && selectedId) set.add(selectedId);
        return set;
    }, [multiConnectionIds, activeCableId, selectedId, mode]);

    // Pre-calculate BBoxes for ALL cables only when cables change (high performance)
    const cablesWithBBox = useMemo(() => {
        return cables.map(cable => {
            if (!cable.coordinates || cable.coordinates.length === 0) return { cable, bbox: null };
            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
            for (const c of cable.coordinates) {
                if (c.lat < minLat) minLat = c.lat;
                if (c.lat > maxLat) maxLat = c.lat;
                if (c.lng < minLng) minLng = c.lng;
                if (c.lng > maxLng) maxLng = c.lng;
            }
            return { cable, bbox: { minLat, maxLat, minLng, maxLng } };
        });
    }, [cables]);

    const visibleCables = useMemo(() => {
        if (!showCables) return [];

        // If no bounds yet (initial load), return a safe subset to prevent freeze
        if (!mapBoundsState) return cables.slice(0, 500);

        const paddedBounds = mapBoundsState.pad(0.2); // 20% buffer
        const viewMinLat = paddedBounds.getSouth();
        const viewMaxLat = paddedBounds.getNorth();
        const viewMinLng = paddedBounds.getWest();
        const viewMaxLng = paddedBounds.getEast();

        // Performance: optimization for large datasets (70k+ cables)
        // Only render cables that intersect with the current viewport via BBox check
        return cablesWithBBox
            .filter(({ bbox }) => {
                if (!bbox) return false;
                // Standard BBox overlap check is very fast
                return !(bbox.maxLat < viewMinLat || bbox.minLat > viewMaxLat || bbox.maxLng < viewMinLng || bbox.minLng > viewMaxLng);
            })
            .map(({ cable }) => cable);
    }, [showCables, cablesWithBBox, mapBoundsState]);

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string, type: 'CABLE' | 'CTO' | 'POP' | 'Pole' } | null>(null);

    const [mapContextMenu, setMapContextMenu] = useState<{
        x: number,
        y: number,
        lat: number,
        lng: number
    } | null>(null);

    const [repositioningCustomer, setRepositioningCustomer] = useState<{ id: string, name: string } | null>(null);

    // Close menus on interaction (escape key)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setContextMenu(null);
                setMapContextMenu(null);
                if (onCancelMode) {
                    onCancelMode();
                    // Prevent propagation to other listeners (like Leaflet or Browser)
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown, true); // Use capture phase to be first
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [onCancelMode]);

    const activeCable = useMemo(() => cables.find(c => c.id === activeCableId), [cables, activeCableId]);

    // Cables visible in D3 layer (everything EXCEPT the one being edited/active)
    const d3Cables = useMemo(() => visibleCables.filter(c => !allActiveCableIds.has(c.id)), [visibleCables, allActiveCableIds]);


    const visibleCTOs = useMemo(() => {
        if (!showCTOs) return [];
        if (!mapBoundsState) return ctos.slice(0, 100); // Initial load safety
        const paddedBounds = mapBoundsState.pad(0.3); // Reduced buffer to 30% (was 50%)
        return ctos.filter(c => paddedBounds.contains(c.coordinates));
    }, [showCTOs, ctos, mapBoundsState]);

    const visiblePOPs = useMemo(() => {
        if (!showPOPs) return [];
        if (!mapBoundsState) return pops;
        const paddedBounds = mapBoundsState.pad(0.3); // Reduced buffer to 30%
        return pops.filter(p => paddedBounds.contains(p.coordinates));
    }, [showPOPs, pops, mapBoundsState]);

    const visiblePoles = useMemo(() => {
        if (!showPoles) return [];
        if (!mapBoundsState) return poles.slice(0, 100);
        const paddedBounds = mapBoundsState.pad(0.3); // Reduced buffer to 30%
        return poles.filter(p => paddedBounds.contains(p.coordinates));
    }, [showPoles, poles, mapBoundsState]);

    const boxIds = useMemo(() => {
        const ids = new Set<string>();
        ctos.forEach(c => ids.add(c.id));
        pops.forEach(p => ids.add(p.id));
        return ids;
    }, [ctos, pops]);

    // Lazy loading labels based on zoom
    const effectiveShowLabels = showLabels && currentZoom > 16;

    useEffect(() => {
        if (mode !== 'connect_cable') setActiveCableId(null);
    }, [mode]);

    const handleCableClickInternal = useCallback((e: any, cable: CableData) => {
        // Fix propagation: Use originalEvent if available (Leaflet), otherwise e (DOM/D3)
        const domEvent = e.originalEvent || e;
        const isAddMode = ['add_cto', 'add_pop', 'add_pole', 'add_customer', 'add_poste', 'draw_cable'].includes(mode || '');
        if (mode !== 'ruler' && !isAddMode) L.DomEvent.stopPropagation(domEvent);

        // Single click: Only for selection/view/otdr
        if (mode === 'connect_cable') {
            // Force selection (no toggle) to avoid accidental deselection
            setActiveCableId(cable.id);
        } else if ((mode === 'view' || mode === 'otdr') && onCableClick) {
            onCableClick(cable.id);
            // NOTE: Logic moved to App.tsx. Left click in View Mode now only Selects (Highlights).
            // Right click (ContextMenu) is used to Edit.
        }
    }, [mode, onCableClick]);

    const handleCableContextMenu = useCallback((e: any, cable: CableData) => {
        // e.containerPoint comes from D3 layer or needs to be calculated
        // Use clientX/Y directly for fixed position menu if using Portal or fixed overlay
        const domEvent = e.originalEvent || e;
        L.DomEvent.stopPropagation(domEvent);
        setMapContextMenu(null); // Close map menu if open

        const clientX = e.originalEvent.clientX;
        const clientY = e.originalEvent.clientY;

        setContextMenu({ x: clientX, y: clientY, id: cable.id, type: 'CABLE' });
    }, []);

    const handleNodeContextMenu = useCallback((e: any, id: string, type: 'CTO' | 'POP' | 'Pole') => {
        L.DomEvent.stopPropagation(e.originalEvent || e); // Ensure propagation stops
        setMapContextMenu(null); // Close map menu if open
        const clientX = e.originalEvent.clientX;
        const clientY = e.originalEvent.clientY;
        setContextMenu({ x: clientX, y: clientY, id: id, type: type });
    }, []);

    const handleCableDoubleClickInternal = useCallback((e: any, cable: CableData) => {
        L.DomEvent.stopPropagation(e);

        if (mode === 'connect_cable' || (mode === 'edit_cable' && selectedId === cable.id)) {
            setActiveCableId(cable.id);
            if (onUpdateCableGeometry) {
                const clickLat = e.latlng.lat;
                const clickLng = e.latlng.lng;
                let minDistance = Infinity;
                let insertIndex = 1;
                for (let i = 0; i < cable.coordinates.length - 1; i++) {
                    const dist = getDistanceFromLine({ lat: clickLat, lng: clickLng }, cable.coordinates[i], cable.coordinates[i + 1]);
                    if (dist < minDistance) { minDistance = dist; insertIndex = i + 1; }
                }
                const newCoords = [...cable.coordinates];
                newCoords.splice(insertIndex, 0, { lat: clickLat, lng: clickLng });
                onUpdateCableGeometry(cable.id, newCoords);
            }
        }
    }, [mode, onUpdateCableGeometry]);



    return (
        <div className={`relative h-full w-full ${['draw_cable', 'add_cto', 'add_pop', 'add_pole', 'edit_cable', 'position_reserve'].includes(mode) ? 'drawing-cursor' : ''}`}>
            <div className="absolute top-48 lg:top-4 right-4 z-[1000] flex flex-col items-end gap-3">
                {/* Map Type Switcher - Google Maps Style */}
                <button
                    onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
                    className="group relative w-16 h-16 rounded-xl overflow-hidden shadow-2xl border-2 border-white dark:border-slate-700 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none z-[1000] bg-white dark:bg-slate-800"
                    title={mapType === 'street' ? t('map_satellite') : t('map_street')}
                >
                    {/* Thumbnail Preview */}
                    <div className="absolute inset-0 transition-transform duration-500 ease-in-out">
                        {mapType === 'street' ? (
                            <div className="absolute inset-0 bg-[url('https://mt1.google.com/vt/lyrs=y&x=0&y=0&z=0')] bg-cover bg-center" />
                        ) : (
                            <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <MapIcon className="w-8 h-8 text-sky-600 opacity-60" />
                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10" />
                            </div>
                        )}
                    </div>

                    {/* Interaction Overlay (Darkens on hover) */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                    {/* Label at the bottom */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-[2px] py-1">
                        <span className="text-[10px] font-black text-white uppercase tracking-tighter block text-center leading-none">
                            {mapType === 'street' ? t('map_satellite') : t('map_street')}
                        </span>
                    </div>
                </button>

                {/* Compact Layer Visibility Panel */}
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur p-2 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
                    {/* CTO Toggle */}
                    <button
                        onClick={() => setShowCTOs(!showCTOs)}
                        title={t('layer_ctos')}
                        className={`group relative p-3 rounded-lg transition-all flex items-center justify-center border ${showCTOs ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 border-blue-500' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                    >
                        <Box className="w-5 h-5" />
                        {!showCTOs && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-[2px] bg-red-500 rotate-45 opacity-60"></div></div>}
                    </button>

                    {/* POP Toggle */}
                    <button
                        onClick={() => setShowPOPs(!showPOPs)}
                        title={t('layer_pops')}
                        className={`group relative p-3 rounded-lg transition-all flex items-center justify-center border ${showPOPs ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 border-indigo-500' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                    >
                        <Building2 className="w-5 h-5" />
                        {!showPOPs && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-[2px] bg-red-500 rotate-45 opacity-60"></div></div>}
                    </button>

                    {/* Pole Toggle */}
                    <button
                        onClick={() => setShowPoles(!showPoles)}
                        title={t('layer_poles') || 'Postes'}
                        className={`group relative p-3 rounded-lg transition-all flex items-center justify-center border ${showPoles ? 'bg-stone-500 text-white shadow-lg shadow-stone-500/30 border-stone-500' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                    >
                        <UtilityPole className="w-5 h-5" />
                        {!showPoles && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-[2px] bg-red-500 rotate-45 opacity-60"></div></div>}
                    </button>


                    {/* Cable Toggle */}
                    <button
                        onClick={() => setShowCables(!showCables)}
                        title={t('layer_cables')}
                        className={`group relative p-3 rounded-lg transition-all flex items-center justify-center border ${showCables ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/30 border-slate-800' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                    >
                        <Share2 className="w-5 h-5" />
                        {!showCables && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-[2px] bg-red-500 rotate-45 opacity-60"></div></div>}
                    </button>

                    <div className="h-[1px] bg-slate-200 dark:bg-slate-700 mx-1 my-0.5"></div>

                    {/* Labels Toggle */}
                    <button
                        onClick={() => onToggleLabels && onToggleLabels()}
                        title={t('show_labels')}
                        className={`group relative p-3 rounded-lg transition-all flex items-center justify-center border ${showLabels ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border-emerald-600' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                    >
                        <Tag className="w-5 h-5" />
                        {!showLabels && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-[2px] bg-red-500 rotate-45 opacity-60"></div></div>}
                    </button>

                    <div className="h-[1px] bg-slate-200 dark:bg-slate-700 mx-1 my-0.5"></div>

                    {/* Clustering Toggle */}
                    <button
                        onClick={() => setEnableClustering(!enableClustering)}
                        title="Toggle Clustering"
                        className={`group relative p-3 rounded-lg transition-all flex items-center justify-center border ${enableClustering ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border-purple-600' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                    >
                        <Layers className="w-5 h-5" />
                        {!enableClustering && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-[2px] bg-red-500 rotate-45 opacity-60"></div></div>}
                    </button>

                    <div className="h-[1px] bg-slate-200 dark:bg-slate-700 mx-1 my-0.5"></div>

                    {/* Customers Toggle */}
                    <button
                        onClick={() => setIsCustomersVisible(!isCustomersVisible)}
                        title={t('layer_customers') || "Clientes"}
                        className={`group relative p-3 rounded-lg transition-all flex items-center justify-center border ${isCustomersVisible ? 'bg-green-600 text-white shadow-lg shadow-green-600/30 border-green-600' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                    >
                        <User className="w-5 h-5" />
                        {!isCustomersVisible && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-[2px] bg-red-500 rotate-45 opacity-60"></div></div>}
                    </button>
                </div>
            </div>

            <MapContainer
                center={initialCenter ? [initialCenter.lat, initialCenter.lng] : [-23.5505, -46.6333]}
                zoom={initialZoom || 15}
                maxZoom={24}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
                preferCanvas={true}
                zoomControl={false}
                zoomAnimation={true}
                fadeAnimation={true}
                markerZoomAnimation={true}
                transform3DLimit={1024}
            >
                <ZoomControl position="bottomright" />

                <MapJumpController viewKey={viewKey} />

                <MapResizeHandler />

                {mapType === 'street' ? (
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        maxNativeZoom={19}
                        maxZoom={24}
                        keepBuffer={8}
                        updateWhenIdle={false}
                        updateInterval={50}
                    />
                ) : (
                    <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        maxNativeZoom={20}
                        maxZoom={24}
                        keepBuffer={8}
                        updateWhenIdle={false}
                        updateInterval={50}
                    />
                )}

                <MapEvents
                    mode={mode}
                    isRepositioning={!!repositioningCustomer}
                    isDrawingDrop={!!drawingCustomerDrop}
                    onMapClick={(lat, lng) => {
                        setMapContextMenu(null); // Close map menu on click
                        if (mode === 'ruler') {
                            onRulerPointsChange([...rulerPoints, { lat, lng }]);
                        } else if (repositioningCustomer) {
                            // Find the customer to check for existing drop
                            const existingCustomer = customers.find(c => c.id === repositioningCustomer.id);
                            const updates: Partial<Customer> = { lat, lng };

                            // Backend requires ctoId to verify/update drop connection
                            if (existingCustomer?.ctoId) {
                                updates.ctoId = existingCustomer.ctoId;
                            }

                            // If customer has a drop, update its first point (Customer side) to the new location
                            if (existingCustomer && existingCustomer.drop && existingCustomer.drop.coordinates && existingCustomer.drop.coordinates.length > 0) {
                                const newDropCoords = [...existingCustomer.drop.coordinates];
                                newDropCoords[0] = { lat, lng };
                                updates.dropCoordinates = newDropCoords;
                                console.log("[Reposition] Updates payload:", updates);
                            }

                            // Handle Repositioning
                            updateCustomer(repositioningCustomer.id, updates)
                                .then(() => {
                                    showToast(t('customer_updated_success') || "Cliente atualizado", 'success');
                                    // Refresh map
                                    const currentBounds = (mapBoundsState || mapBounds) as L.LatLngBounds;
                                    if (currentBounds) fetchCustomers(currentBounds);
                                })
                                .catch(err => {
                                    console.error("Failed to move customer:", err);
                                    showToast(t('error_save_customer'), 'error');
                                })
                                .finally(() => {
                                    setRepositioningCustomer(null);
                                });
                        } else if (drawingCustomerDrop) {
                            // If we are drawing a drop, clicks add points to it
                            setDrawingCustomerDrop({
                                ...drawingCustomerDrop,
                                points: [...(drawingCustomerDrop.points || []), { lat, lng }]
                            });
                        } else if (mode === 'add_customer' || mode === 'add_poste') {
                            handleMapClickForCustomer(lat, lng);
                        } else {
                            onAddPoint(lat, lng);
                        }
                    }}
                    onClearSelection={() => {
                        setActiveCableId(null);
                        setMapContextMenu(null);
                    }}
                    onUndoDrawingPoint={() => {
                        if (mode === 'ruler') {
                            onRulerPointsChange(rulerPoints.slice(0, -1));
                        } else if (onUndoDrawingPoint) {
                            onUndoDrawingPoint();
                        }
                    }}

                    onMapMoveEnd={onMapMoveEnd}
                    onContextMenu={(e) => {
                        if (drawingCustomerDrop) {
                            // Right click to cancel?
                            setDrawingCustomerDrop(null);
                        }
                        L.DomEvent.preventDefault(e as any);

                        // Toggle behavior: If map menu is already open, close it and return
                        if (mapContextMenu) {
                            setMapContextMenu(null);
                            return;
                        }

                        setContextMenu(null); // Close other menus
                        setMapContextMenu({
                            x: e.originalEvent.clientX,
                            y: e.originalEvent.clientY,
                            lat: e.latlng.lat,
                            lng: e.latlng.lng
                        });
                    }}
                />

                <MapController bounds={mapBounds || null} viewKey={viewKey} center={initialCenter} zoom={initialZoom} />

                <BoundsUpdater setBounds={setMapBoundsState} setZoom={setCurrentZoom} />

                <CustomersLayer
                    customers={customers}
                    onCustomerClick={handleCustomerClick}
                    selectedId={selectedCustomer && (selectedCustomer as any).id}
                    visible={isCustomersVisible}
                    mapZoom={currentZoom}
                    onContextMenu={handleCustomerContextMenu}
                />
                <DropsLayer
                    customers={customers}
                    visible={isCustomersVisible}
                />

                <D3CablesLayer
                    cables={d3Cables}
                    boxIds={boxIds}
                    litCableIds={litCableIds}
                    highlightedCableId={highlightedCableId}
                    visible={showCables}
                    onClick={handleCableClickInternal}
                    onDoubleClick={handleCableDoubleClickInternal}
                    onContextMenu={handleCableContextMenu}
                    mode={mode}
                    showLabels={effectiveShowLabels}
                />

                {/* Render ONLY active cable with React-Leaflet for editing interactions (drag handles) */}
                {/* Render ALL active cables from multi-connection set + current active */}
                {Array.from(allActiveCableIds).map(id => {
                    const cable = cables.find(c => c.id === id);
                    if (!cable) return null;
                    return (
                        <React.Fragment key={cable.id}>
                            <Pane name={`cable-edit-${cable.id}`} style={{ zIndex: 550 }}>
                                <CablePolyline
                                    cable={cable}
                                    isLit={litCableIds.has(cable.id)}
                                    isActive={true}
                                    isHighlighted={highlightedCableId === cable.id}
                                    mode={mode}
                                    t={t}
                                    onClick={handleCableClickInternal}
                                    onDoubleClick={handleCableDoubleClickInternal}
                                    onUpdateGeometry={onUpdateCableGeometry}
                                    onConnect={mode === 'connect_cable' ? handleConnectWrapper : undefined}
                                    snapDistance={snapDistance}
                                    ctos={ctos}
                                    pops={pops}
                                    poles={poles}
                                    onPointDragStart={handlePointDragStart}
                                    onDrag={handleDrag}
                                    onDragEnd={handleDragEnd}
                                    handlePane="cable-handles"
                                />
                            </Pane>
                        </React.Fragment>
                    );
                })}
                <Pane name="cable-handles" style={{ zIndex: 700 }} />


                {mode === 'draw_cable' && drawingPath.length > 0 && (
                    <Polyline
                        positions={drawingPath.map(p => [p.lat, p.lng])}
                        pathOptions={{
                            color: "#0ea5e9",
                            weight: 3,
                            dashArray: "5, 10",
                            opacity: 0.8
                        }}
                    />
                )}

                {/* GHOST LINES FOR DRAGGING */}
                {dragState.isDragging && dragState.currentPosition && dragState.tetherPoints.map((pt, idx) => (
                    <Polyline
                        key={`ghost-${idx}`}
                        positions={[[dragState.currentPosition!.lat, dragState.currentPosition!.lng], [pt.lat, pt.lng]]}
                        pathOptions={{ color: '#fbbf24', weight: 2, dashArray: '5, 5', opacity: 0.8 }}
                    />
                ))}

                {/* RULER LAYER */}
                {mode === 'ruler' && rulerPoints.length > 0 && (
                    <>
                        <Polyline
                            positions={rulerPoints.map(p => [p.lat, p.lng])}
                            pathOptions={{ color: '#ec4899', weight: 4, dashArray: '1, 10', lineCap: 'round', opacity: 0.8 }}
                        />
                        {rulerPoints.map((p, idx) => (
                            <Marker
                                key={`ruler-pt-${idx}`}
                                position={[p.lat, p.lng]}
                                icon={L.divIcon({
                                    className: 'ruler-dot',
                                    html: `<div style="width: 10px; height: 10px; background: #ec4899; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
                                    iconSize: [10, 10],
                                    iconAnchor: [5, 5]
                                })}
                            />
                        ))}
                    </>
                )}

                {mode === 'draw_cable' && drawingPath.length > 0 && (
                    <Marker position={[drawingPath[0].lat, drawingPath[0].lng]} icon={startPointIcon} />
                )}

                {enableClustering ? (
                    <MarkerClusterGroup
                        chunkedLoading
                        maxClusterRadius={90} // Increased from 50 to 90 to group more aggressively (better performance/less clutter)
                        disableClusteringAtZoom={16} // Disable clustering later (at zoom 18+) to keep markers grouped longer on weak hardware
                        spiderfyOnMaxZoom={true}
                        showCoverageOnHover={false}
                    >
                        {visibleCTOs.filter(c => !(mode === 'move_node' && c.id === selectedId)).map(cto => (
                            <CTOMarker
                                key={cto.id}
                                cto={cto}
                                isSelected={selectedId === cto.id}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={(id, type) => {
                                    if (drawingCustomerDrop && type === 'CTO') {
                                        handleConnectToCTO(id);
                                    } else {
                                        onNodeClick(id, type);
                                    }
                                }}
                                onMoveNode={onMoveNode || noOp}
                                onCableStart={onCableStart}
                                onCableEnd={onCableEnd}
                                cableStartPoint={cableStartPoint}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={handleNodeContextMenu}
                                userRole={userRole}
                            />
                        ))}

                        {visiblePOPs.filter(p => !(mode === 'move_node' && p.id === selectedId)).map(pop => (
                            <POPMarker
                                key={pop.id}
                                pop={pop}
                                isSelected={selectedId === pop.id}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={onNodeClick}
                                onMoveNode={onMoveNode || noOp}
                                onCableStart={onCableStart}
                                onCableEnd={onCableEnd}
                                cableStartPoint={cableStartPoint}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={handleNodeContextMenu}
                                userRole={userRole}
                            />
                        ))}
                        {visiblePoles.filter(p => !(mode === 'move_node' && p.id === selectedId)).map(pole => (
                            <PoleMarker
                                key={pole.id}
                                pole={pole}
                                isSelected={selectedId === pole.id}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={onNodeClick}
                                onMoveNode={onMoveNode || noOp}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={handleNodeContextMenu}
                            />
                        ))}
                    </MarkerClusterGroup>
                ) : (
                    <>
                        {visibleCTOs.filter(c => !(mode === 'move_node' && c.id === selectedId)).map(cto => (
                            <CTOMarker
                                key={cto.id}
                                cto={cto}
                                isSelected={selectedId === cto.id}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={(id, type) => {
                                    if (drawingCustomerDrop && type === 'CTO') {
                                        handleConnectToCTO(id);
                                    } else {
                                        onNodeClick(id, type);
                                    }
                                }}
                                onMoveNode={onMoveNode || noOp}
                                onCableStart={onCableStart}
                                onCableEnd={onCableEnd}
                                cableStartPoint={cableStartPoint}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={handleNodeContextMenu}
                                userRole={userRole}
                            />
                        ))}

                        {visiblePOPs.filter(p => !(mode === 'move_node' && p.id === selectedId)).map(pop => (
                            <POPMarker
                                key={pop.id}
                                pop={pop}
                                isSelected={selectedId === pop.id}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={onNodeClick}
                                onMoveNode={onMoveNode || noOp}
                                onCableStart={onCableStart}
                                onCableEnd={onCableEnd}
                                cableStartPoint={cableStartPoint}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={handleNodeContextMenu}
                                userRole={userRole}
                            />
                        ))}
                        {visiblePoles.filter(p => !(mode === 'move_node' && p.id === selectedId)).map(pole => (
                            <PoleMarker
                                key={pole.id}
                                pole={pole}
                                isSelected={selectedId === pole.id}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={onNodeClick}
                                onMoveNode={onMoveNode || noOp}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={handleNodeContextMenu}
                            />
                        ))}
                    </>
                )}

                {/* TECHNICAL RESERVES (Draggable Markers) */}
                {cables.filter(c => (c.technicalReserve || 0) > 0 && (showLabels || c.showReserveLabel)).map(cable => {
                    const position = cable.reserveLocation || (() => {
                        const coords = cable.coordinates;
                        if (coords && coords.length >= 2) {
                            const midIndex = Math.floor(coords.length / 2);
                            return coords[midIndex];
                        }
                        return null;
                    })();

                    if (!position) return null;

                    return (
                        <TechnicalReserveMarker
                            key={`reserve-${cable.id}`}
                            cableId={cable.id}
                            reserveValue={cable.technicalReserve || 0}
                            position={position}
                            mode={mode}
                            currentZoom={currentZoom}
                            onMoveReserve={(id, lat, lng) => onReservePositionSet && onReservePositionSet(lat, lng)}
                            onDragStart={handlePointDragStart}
                            onDrag={handleDrag}
                            onDragEnd={handleDragEnd}
                        />
                    );
                })}



                {/* DRAGGED NODE ISOLATED FROM CLUSTER */}
                {mode === 'move_node' && selectedId && (
                    <>
                        {visibleCTOs.filter(c => c.id === selectedId).map(cto => (
                            <CTOMarker
                                key={`drag-cto-${cto.id}`}
                                cto={cto}
                                isSelected={true}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={noOp}
                                onMoveNode={onMoveNode || noOp}
                                onCableStart={noOp}
                                onCableEnd={noOp}
                                cableStartPoint={null}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={noOp}
                                userRole={userRole}
                            />
                        ))}
                        {visiblePOPs.filter(p => p.id === selectedId).map(pop => (
                            <POPMarker
                                key={`drag-pop-${pop.id}`}
                                pop={pop}
                                isSelected={true}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={noOp}
                                onMoveNode={onMoveNode || noOp}
                                onCableStart={noOp}
                                onCableEnd={noOp}
                                cableStartPoint={null}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={noOp}
                                userRole={userRole}
                            />
                        ))}
                        {visiblePoles.filter(p => p.id === selectedId).map(pole => (
                            <PoleMarker
                                key={`drag-pole-${pole.id}`}
                                pole={pole}
                                isSelected={true}
                                showLabels={effectiveShowLabels}
                                mode={mode}
                                onNodeClick={noOp}
                                onMoveNode={onMoveNode || noOp}
                                onDragStart={handleNodeDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                onContextMenu={noOp}
                            />
                        ))}
                    </>
                )}


                {/* PREVIEW IMPORT DATA (Temporary Layer) */}
                {previewImportData && (
                    <>
                        {previewImportData.cables.map((cable, idx) => (
                            <Polyline
                                key={`preview-cable-${idx}`}
                                positions={cable.coordinates.map((c: any) => [c[1], c[0]])} // GeoJSON [lng, lat] -> Leaflet [lat, lng]
                                pathOptions={{ color: '#f59e0b', weight: 4, dashArray: '10, 10', opacity: 0.8 }}
                            />
                        ))}
                        {[...previewImportData.ctos, ...previewImportData.ceos, ...previewImportData.poles].map((item, idx) => {
                            const lat = item.coordinates[1];
                            const lng = item.coordinates[0];
                            return (
                                <Marker
                                    key={`preview-node-${idx}`}
                                    position={[lat, lng]}
                                    icon={L.divIcon({
                                        className: 'preview-icon',
                                        html: `<div style="width: 14px; height: 14px; background: #f59e0b; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px black;"></div>`,
                                        iconSize: [14, 14]
                                    })}
                                >
                                    <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                                        <div className="text-xs font-bold text-amber-600 bg-white px-1 rounded shadow">{item.originalName}</div>
                                    </Tooltip>
                                </Marker>
                            );
                        })}
                    </>
                )}

                {otdrResult && (
                    <Marker position={[otdrResult.lat, otdrResult.lng]} icon={otdrIcon}>
                        <Tooltip direction="top" permanent offset={[0, -20]} className="font-bold border-0 bg-slate-800 text-white shadow-xl">
                            {t('otdr_event_tooltip')}
                        </Tooltip>
                    </Marker>
                )}

                {pinnedLocation && (
                    <Marker
                        position={[pinnedLocation.lat, pinnedLocation.lng]}
                        icon={createSearchPinIcon(selectedId === 'pin-location')}
                    >
                        <Popup>
                            <div className="flex flex-col gap-2 min-w-[150px]">
                                <h3 className="text-sm font-bold text-slate-800">{t('pinned_location')}</h3>
                                <div className="text-xs text-slate-500 font-mono mb-1">
                                    {pinnedLocation.lat.toFixed(6)}, {pinnedLocation.lng.toFixed(6)}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => onConvertPin && onConvertPin('CTO')}
                                        title={t('convert_to_cto')}
                                        className="flex items-center justify-center px-2 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 transition-colors"
                                    >
                                        <Box className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => onConvertPin && onConvertPin('Pole')}
                                        title={t('convert_to_pole')}
                                        className="flex items-center justify-center px-2 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
                                    >
                                        <UtilityPole className="w-5 h-5" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => onClearPin && onClearPin()}
                                    className="w-full mt-1 px-2 py-1 text-red-500 text-[10px] font-bold hover:bg-red-50 rounded"
                                >
                                    {t('remove_pin')}
                                </button>
                                {pinnedLocation.viability && (
                                    <div className={`mt-2 p-2 rounded-lg border flex items-center gap-2 ${pinnedLocation.viability.active ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                                        {pinnedLocation.viability.active ? <CheckCircle2 className={`w-5 h-5 ${pinnedLocation.viability.active ? 'text-emerald-600 dark:text-emerald-400' : ''}`} /> : <XCircle className="w-5 h-5 text-red-500" />}
                                        <div className="flex flex-col">
                                            <span className={`text-[10px] font-bold uppercase ${pinnedLocation.viability.active ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                                {pinnedLocation.viability.active ? t('viability_available') : t('viability_unavailable')}
                                            </span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                {t('distance_nearest', { dist: Math.round(pinnedLocation.viability.distance) })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Customer Drop Drawing Interaction */}
                {drawingCustomerDrop && (
                    <CustomerDropDrawer
                        drawingState={drawingCustomerDrop}
                        onUpdatePoints={(points) => {
                            // Assuming we just update the points in state
                            setDrawingCustomerDrop(prev => prev ? { ...prev, points } : null);
                        }}
                        onCancel={() => setDrawingCustomerDrop(null)}
                        onComplete={(ctoId) => {
                            // Handle CTO connection logic here or pass handler
                            console.log("Connect to CTO:", ctoId);
                        }}
                    />
                )}

            </MapContainer>

            {/* Context Menu for Cables */}
            {
                contextMenu && contextMenu.type === 'CABLE' && (
                    <CableContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onEdit={userRole !== 'MEMBER' ? () => {
                            // "Editar Cabo" -> Geometry Edit (Select ID)
                            if (onEditCableGeometry) onEditCableGeometry(contextMenu.id);
                            setContextMenu(null);
                        } : undefined}
                        onProperties={() => {
                            // "Propriedades" -> Open Side Panel
                            if (onEditCable) onEditCable(contextMenu.id);
                            setContextMenu(null);
                        }}
                        onDelete={userRole !== 'MEMBER' ? () => {
                            if (onDeleteCable) onDeleteCable(contextMenu.id);
                            setContextMenu(null);
                        } : undefined}
                        onConnect={userRole !== 'MEMBER' ? () => {
                            if (onInitConnection) onInitConnection(contextMenu.id);
                            setContextMenu(null);
                        } : undefined}
                        onClose={() => setContextMenu(null)}
                        showReserveLabel={cables.find(c => c.id === contextMenu.id)?.showReserveLabel}
                        onToggleReserve={userRole !== 'MEMBER' ? () => onToggleReserveCable && onToggleReserveCable(contextMenu.id) : undefined}
                        onPositionReserve={userRole !== 'MEMBER' ? () => onPositionReserveCable && onPositionReserveCable(contextMenu.id) : undefined}
                    />
                )
            }

            {
                contextMenu && contextMenu.type !== 'CABLE' && (
                    <NodeContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        type={contextMenu.type as 'CTO' | 'POP' | 'Pole'}
                        onEdit={userRole !== 'MEMBER' ? () => {
                            if (onEditNode) onEditNode(contextMenu.id, contextMenu.type as any);
                            setContextMenu(null);
                        } : undefined}
                        onProperties={onPropertiesNode ? () => {
                            onPropertiesNode(contextMenu.id, contextMenu.type as any);
                            setContextMenu(null);
                        } : undefined}
                        onDelete={userRole !== 'MEMBER' ? () => {
                            if (onDeleteNode) onDeleteNode(contextMenu.id, contextMenu.type as any);
                            setContextMenu(null);
                        } : undefined}
                        onMove={userRole !== 'MEMBER' ? () => {
                            if (onMoveNodeStart) onMoveNodeStart(contextMenu.id, contextMenu.type as any);
                            setContextMenu(null);
                        } : undefined}
                        onClose={() => setContextMenu(null)}
                    />
                )
            }




            <ConnectCustomerModal
                isOpen={connectCustomerModalOpen}
                onClose={() => {
                    setConnectCustomerModalOpen(false);
                    setPendingConnection(null);
                }}
                allCustomers={allCustomers}
                onConnect={async (ctoId, splitterId, portIndex) => {
                    if (!pendingConnection) return;

                    try {
                        // Construct FULL path for saving: [Start, ...Waypoints, End]
                        // 1. Start Point (Customer Location)
                        const startPoint = { lat: drawingCustomerDrop.startLat, lng: drawingCustomerDrop.startLng };

                        // 2. Waypoints (User clicks in between)
                        const waypoints = pendingConnection.dropPoints.map(p => ({ lat: p.lat, lng: p.lng }));

                        // 3. End Point (CTO Location)
                        const targetCto = ctos.find(c => c.id === ctoId);

                        if (!targetCto) {
                            console.error("Critical: Target CTO not found!", ctoId);
                            showToast(t('error_target_not_found'), 'error');
                            return;
                        }

                        const endPoint = { lat: targetCto.coordinates.lat, lng: targetCto.coordinates.lng };

                        const fullPath = [startPoint, ...waypoints, endPoint];
                        console.log("[MapView] Saving Drop Path:", fullPath);

                        if (drawingCustomerDrop?.customerId) {
                            const updatedCustomer = await updateCustomer(drawingCustomerDrop.customerId, {
                                dropCoordinates: fullPath,
                                ctoId: ctoId,
                                splitterId: splitterId ?? undefined,
                                splitterPortIndex: portIndex ?? undefined
                            });

                            showToast(t('toast_cable_split', { name: targetCto.name }), 'success');

                            // Authoritative Update from Server Response
                            setCustomers(prev => prev.map(c =>
                                c.id === drawingCustomerDrop.customerId ? updatedCustomer : c
                            ));
                            if (onCustomerSaved) onCustomerSaved(updatedCustomer);
                        }

                        setConnectCustomerModalOpen(false);
                        setPendingConnection(null);
                        setDrawingCustomerDrop(null); // Finish drawing

                        // Refresh map (Use state if available, fallback to prop)
                        const currentBounds = (mapBoundsState || mapBounds) as L.LatLngBounds;
                        if (currentBounds) {
                            // Increased delay to ensure backend consistency and avoid overwriting with stale data
                            setTimeout(() => fetchCustomers(currentBounds), 1000);
                        }

                    } catch (error: any) {
                        console.error("Error saving drop:", error);
                        // Handle 409 Conflict (Port Occupied)
                        if (error.response && error.response.status === 409) {
                            showToast(t('error_port_occupied'), 'error');
                        } else {
                            showToast(t('connection_failed_msg'), 'error');
                        }
                    }
                }}
                cto={ctos.find(c => c.id === pendingConnection?.ctoId) || null}
            />


            {/* Map Background Context Menu */}
            {
                mapContextMenu && (
                    <div
                        className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: mapContextMenu.y, left: mapContextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 mb-1">
                            <div className="text-[10px] uppercase font-bold text-slate-400">{t('coordinates')}</div>
                            <div className="text-xs font-mono text-slate-700 dark:text-slate-300 select-all">
                                {mapContextMenu.lat.toFixed(6)}, {mapContextMenu.lng.toFixed(6)}
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`${mapContextMenu.lat}, ${mapContextMenu.lng}`);
                                setMapContextMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2 transition-colors"
                        >
                            <Tag className="w-4 h-4 text-slate-400" />
                            {t('copy_coordinates') || "Copiar Coordenadas"}
                        </button>

                        <button
                            onClick={() => {
                                window.open(`https://www.google.com/maps?q=${mapContextMenu.lat},${mapContextMenu.lng}`, '_blank');
                                setMapContextMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2 transition-colors"
                        >
                            <Globe className="w-4 h-4 text-sky-500" />
                            {t('open_google_maps') || "Abrir no Google Maps"}
                        </button>

                        {/* Add Node Quick Actions (Optional, but nice to have) */}
                        <div className="my-1 border-t border-slate-100 dark:border-slate-700/50"></div>
                        <button
                            onClick={() => {
                                setMapContextMenu(null);
                                // To Add Node, we need to switch mode, but we can't do it easily from here without 'setToolMode' prop which isn't passed to MapView currently. 
                                // So limiting to requested features.
                            }}
                            className="hidden w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2 transition-colors"
                        >
                            Place Node Here
                        </button>
                    </div>
                )
            }
            <CustomerModal
                isOpen={customerModalOpen}
                onClose={() => {
                    setCustomerModalOpen(false);
                    setSelectedCustomer(null); // Also clear on close/cancel
                }}
                onSave={handleSaveCustomer}
                onStartDrawingDrop={handleStartDrawingDrop}
                onReposition={(customer) => {
                    if (customer.id) {
                        setRepositioningCustomer({ id: customer.id, name: customer.name || '' });
                        setCustomerModalOpen(false);
                        showToast(t('reposition_customer_instruction'), 'info');
                    }
                }}
                initialData={selectedCustomer}
                ctos={ctos}
                allCustomers={allCustomers}
            />
        </div >
    );
};
