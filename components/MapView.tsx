
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Tooltip, useMap, Pane } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { CTOData, POPData, CableData, PoleData, Coordinates, CTO_STATUS_COLORS, CABLE_STATUS_COLORS, POLE_STATUS_COLORS, PoleStatus } from '../types';
import { useLanguage } from '../LanguageContext';
import { Layers, Map as MapIcon, Globe, Box, Building2, Share2, Tag, Diamond, UtilityPole } from 'lucide-react';
import { D3CablesLayer } from './D3CablesLayer';



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

const createCTOIcon = (name: string, isSelected: boolean, status: string = 'PLANNED', showLabels: boolean = true, customColor?: string) => {
    const cacheKey = `cto-${name}-${isSelected}-${status}-${showLabels}-${customColor || 'default'}`;

    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey)!;
    }

    // Prioritize custom catalog color if available, otherwise fallback to status color
    // @ts-ignore
    const color = customColor || CTO_STATUS_COLORS[status] || CTO_STATUS_COLORS['PLANNED'];

    const icon = L.divIcon({
        className: 'custom-icon',
        html: `
      ${isSelected ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; background: rgba(34, 197, 94, 0.4); border-radius: 50%; animation: pulse-green 2s infinite; pointer-events: none; z-index: 5;"></div>` : ''}
      <div style="
        position: relative;
        background-color: ${color};
        border: 2px solid ${isSelected ? '#22c55e' : '#ffffff'};
        border-radius: 50%;
        width: 20px;
        height: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        transition: border-color 0.2s ease;
        z-index: 10;
      ">
      </div>
      <div style="
        display: ${showLabels ? 'block' : 'none'};
        position: absolute;
        top: 22px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.9);
        color: white;
        padding: 2px 5px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        z-index: 20;
      ">${name}</div>
`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    iconCache.set(cacheKey, icon);
    return icon;
};

const createPOPIcon = (name: string, isSelected: boolean, showLabels: boolean = true, color: string = '#6366f1', size: number = 24) => {
    const cacheKey = `pop-${name}-${isSelected}-${showLabels}-${color}-${size}`;

    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey)!;
    }

    const iconRadius = size / 2;
    const labelOffset = size - 2;

    const icon = L.divIcon({
        className: 'custom-icon',
        html: `
      ${isSelected ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${size * 2}px; height: ${size * 2}px; background: ${color}66; border-radius: 50%; animation: pulse-indigo 2s infinite; pointer-events: none; z-index: 5;"></div>` : ''}
      <div style="
        position: relative;
        background-color: ${color};
        border: 2px solid ${isSelected ? '#bef264' : '#ffffff'};
        border-radius: 4px; /* Square for Building */
        width: ${size}px;
        height: ${size}px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.6}" height="${size * 0.6}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
      </div>
      <div style="
        display: ${showLabels ? 'block' : 'none'};
        position: absolute;
        top: ${size + 2}px;
        left: 50%;
        transform: translateX(-50%);
        background: ${color}E6;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        z-index: 20;
      ">${name}</div>
`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });

    iconCache.set(cacheKey, icon);
    return icon;
};


const createPoleIcon = (name: string, isSelected: boolean, status: PoleStatus | undefined, showLabels: boolean = true) => {
    const cacheKey = `pole-${name}-${isSelected}-${status}-${showLabels}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

    const size = 16;
    const color = status ? (POLE_STATUS_COLORS[status] || '#78716c') : '#78716c';

    const icon = L.divIcon({
        className: 'custom-icon',
        html: `
      ${isSelected ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${size * 2}px; height: ${size * 2}px; background: ${color}66; border-radius: 50%; animation: pulse-gray 2s infinite; pointer-events: none; z-index: 5;"></div>` : ''}
      <div style="
        position: relative;
        background-color: ${color};
        border: 2px solid ${isSelected ? '#fbbf24' : '#ffffff'};
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
      ">
        <div style="width: 4px; height: 4px; background: white; border-radius: 50%;"></div>
      </div>
      <div style="
        display: ${showLabels ? 'block' : 'none'};
        position: absolute;
        top: ${size + 2}px;
        left: 50%;
        transform: translateX(-50%);
        background: #4b5563;
        color: white;
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 9px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        z-index: 20;
      ">${name}</div>
`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });

    iconCache.set(cacheKey, icon);
    return icon;
};

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

// --- SUB COMPONENTS (Memoized for Performance) ---

const CTOMarker = React.memo(({
    cto, isSelected, showLabels, mode, onNodeClick, onCableStart, onCableEnd, onMoveNode, cableStartPoint,
    onDragStart, onDrag, onDragEnd
}: {
    cto: CTOData, isSelected: boolean, showLabels: boolean, mode: string,
    onNodeClick: (id: string, type: 'CTO') => void,
    onCableStart: (id: string) => void,
    onCableEnd: (id: string) => void,
    onMoveNode: (id: string, lat: number, lng: number) => void,
    cableStartPoint: any,
    onDragStart: (id: string) => void,
    onDrag: (lat: number, lng: number) => void,
    onDragEnd: () => void
}) => {
    const icon = useMemo(() =>
        createCTOIcon(cto.name, isSelected, cto.status, showLabels, cto.color),
        [cto.name, isSelected, cto.status, showLabels, cto.color]);

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (mode === 'draw_cable') {
                if (!isSelected && !cableStartPoint) onCableStart(cto.id);
                else onCableEnd(cto.id);
            } else if (mode === 'view' || mode === 'move_node') {
                onNodeClick(cto.id, 'CTO');
            }
        },
        dragstart: () => onDragStart(cto.id),
        drag: (e: any) => {
            const pos = e.target.getLatLng();
            onDrag(pos.lat, pos.lng);
        },
        dragend: (e: any) => {
            onDragEnd();
            const marker = e.target;
            const position = marker.getLatLng();
            onMoveNode(cto.id, position.lat, position.lng);
        }
    }), [mode, cto.id, isSelected, cableStartPoint, onCableStart, onCableEnd, onNodeClick, onMoveNode, onDragStart, onDrag, onDragEnd]);

    return (
        <Marker
            position={[cto.coordinates.lat, cto.coordinates.lng]}
            icon={icon}
            draggable={mode === 'move_node'}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                <div className="text-xs font-bold">{cto.name}</div>
            </Tooltip>
        </Marker>
    );
});

const POPMarker = React.memo(({
    pop, isSelected, showLabels, mode, onNodeClick, onCableStart, onCableEnd, onMoveNode, cableStartPoint,
    onDragStart, onDrag, onDragEnd
}: {
    pop: POPData, isSelected: boolean, showLabels: boolean, mode: string,
    onNodeClick: (id: string, type: 'POP') => void,
    onCableStart: (id: string) => void,
    onCableEnd: (id: string) => void,
    onMoveNode: (id: string, lat: number, lng: number) => void,
    cableStartPoint: any,
    onDragStart: (id: string) => void,
    onDrag: (lat: number, lng: number) => void,
    onDragEnd: () => void
}) => {
    const icon = useMemo(() =>
        createPOPIcon(pop.name, isSelected, showLabels, pop.color, pop.size),
        [pop.name, isSelected, showLabels, pop.color, pop.size]);

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (mode === 'draw_cable') {
                if (!isSelected && !cableStartPoint) onCableStart(pop.id);
                else onCableEnd(pop.id);
            } else if (mode === 'view' || mode === 'move_node') {
                onNodeClick(pop.id, 'POP');
            }
        },
        dragstart: () => onDragStart(pop.id),
        drag: (e: any) => {
            const pos = e.target.getLatLng();
            onDrag(pos.lat, pos.lng);
        },
        dragend: (e: any) => {
            onDragEnd();
            const marker = e.target;
            const position = marker.getLatLng();
            onMoveNode(pop.id, position.lat, position.lng);
        }
    }), [mode, pop.id, isSelected, cableStartPoint, onCableStart, onCableEnd, onNodeClick, onMoveNode, onDragStart, onDrag, onDragEnd]);

    return (
        <Marker
            position={[pop.coordinates.lat, pop.coordinates.lng]}
            icon={icon}
            draggable={mode === 'move_node'}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -12]} opacity={0.9}>
                <div className="text-xs font-bold">{pop.name}</div>
            </Tooltip>
        </Marker>
    );
});

const PoleMarker = React.memo(({
    pole, isSelected, showLabels, mode, onNodeClick, onMoveNode,
    onDragStart, onDrag, onDragEnd
}: {
    pole: PoleData, isSelected: boolean, showLabels: boolean, mode: string,
    onNodeClick: (id: string, type: 'Pole') => void,
    onMoveNode: (id: string, lat: number, lng: number) => void,
    onDragStart: (id: string) => void,
    onDrag: (lat: number, lng: number) => void,
    onDragEnd: () => void
}) => {
    const icon = useMemo(() =>
        createPoleIcon(pole.name, isSelected, pole.status, showLabels),
        [pole.name, isSelected, pole.status, showLabels]);

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (mode === 'view' || mode === 'move_node') {
                onNodeClick(pole.id, 'Pole');
            }
        },
        dragstart: () => onDragStart(pole.id),
        drag: (e: any) => {
            const pos = e.target.getLatLng();
            onDrag(pos.lat, pos.lng);
        },
        dragend: (e: any) => {
            onDragEnd();
            const marker = e.target;
            const position = marker.getLatLng();
            onMoveNode(pole.id, position.lat, position.lng);
        }
    }), [mode, pole.id, isSelected, onNodeClick, onMoveNode, onDragStart, onDrag, onDragEnd]);

    return (
        <Marker
            position={[pole.coordinates.lat, pole.coordinates.lng]}
            icon={icon}
            draggable={mode === 'move_node'}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
                <div className="text-[10px] font-bold">{pole.name}</div>
                {pole.type && <div className="text-[9px] opacity-80">{pole.type}</div>}
            </Tooltip>
        </Marker>
    );
});


interface CablePolylineProps {
    cable: CableData;
    isLit: boolean;
    isActive: boolean;
    isHighlighted: boolean;
    mode: string;
    t: (key: string) => string;
    onClick: (e: any, cable: CableData) => void;
    onUpdateGeometry?: (id: string, coords: Coordinates[]) => void;
    onConnect?: (cableId: string, nodeId: string, index: number) => void;
    snapDistance?: number;
    ctos?: CTOData[];
    pops?: POPData[];
    onPointDragStart: (cableId: string, index: number) => void;
    onDrag: (lat: number, lng: number) => void;
    onDragEnd: () => void;
    handlePane?: string;
}

const CablePolyline: React.FC<CablePolylineProps> = React.memo(({
    cable, isLit, isActive, isHighlighted, mode, t, onClick, onUpdateGeometry, onConnect,
    snapDistance = 30, ctos = [], pops = [], onPointDragStart, onDrag, onDragEnd, handlePane
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
        if (!onConnect || !onUpdateGeometry) return;
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

        if (nearestNode) {
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
    }, [cable.coordinates, cable.id, ctos, pops, snapDistance, onConnect, onUpdateGeometry, onDragEnd]);

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
                eventHandlers={{ click: (e) => onClick(e, cable) }}
            />

            {
                isActive && mode === 'connect_cable' && cable.coordinates.map((coord, index) => (
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
    onMapMoveEnd?: (lat: number, lng: number, zoom: number) => void
}> = ({ mode, onMapClick, onClearSelection, onMapMoveEnd }) => {
    useMapEvents({
        click(e) {
            if (mode === 'add_cto' || mode === 'add_pop' || mode === 'add_pole' || mode === 'draw_cable') {
                onMapClick(e.latlng.lat, e.latlng.lng);
            } else if (mode === 'connect_cable') {
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

// --- MAIN COMPONENT ---

interface MapViewProps {
    ctos: CTOData[];
    pops: POPData[];
    poles?: PoleData[];
    cables: CableData[];
    mode: 'view' | 'add_cto' | 'add_pop' | 'add_pole' | 'draw_cable' | 'connect_cable' | 'move_node' | 'otdr';
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
}

const noOp = () => { };

export const MapView: React.FC<MapViewProps> = ({
    ctos, pops, cables, poles = [], mode, selectedId, mapBounds, showLabels = false, litCableIds = new Set(),
    highlightedCableId, cableStartPoint, drawingPath = [], snapDistance = 30, otdrResult, viewKey,
    initialCenter, initialZoom, onMapMoveEnd, onAddPoint, onNodeClick, onMoveNode,
    onCableStart, onCableEnd, onConnectCable, onUpdateCableGeometry, onCableClick, onToggleLabels
}) => {
    const { t } = useLanguage();
    const [activeCableId, setActiveCableId] = useState<string | null>(null);
    const [mapType, setMapType] = useState<'street' | 'satellite'>('street');

    // Performance optimizations state
    const [mapBoundsState, setMapBoundsState] = useState<L.LatLngBounds | null>(null);
    const [currentZoom, setCurrentZoom] = useState<number>(initialZoom || 15);

    // Visibility States
    const [showCables, setShowCables] = useState(true);
    const [showCTOs, setShowCTOs] = useState(true);
    const [showPOPs, setShowPOPs] = useState(true);
    const [showPoles, setShowPoles] = useState(false);
    const [isLayersOpen, setIsLayersOpen] = useState(false);
    const [enableClustering, setEnableClustering] = useState(true);

    // --- DRAG FEEDBACK STATE ---
    const [dragState, setDragState] = useState<{ isDragging: boolean, currentPosition: Coordinates | null, tetherPoints: Coordinates[] }>({
        isDragging: false, currentPosition: null, tetherPoints: []
    });

    const handleNodeDragStart = useCallback((id: string) => {
        const tethers: Coordinates[] = [];
        cables.forEach(c => {
            // If dragging a node, tether to the "next" point of any connected cable
            if (c.fromNodeId === id && c.coordinates.length > 1) tethers.push(c.coordinates[1]);
            else if (c.toNodeId === id && c.coordinates.length > 1) tethers.push(c.coordinates[c.coordinates.length - 2]);
        });
        setDragState({ isDragging: true, currentPosition: null, tetherPoints: tethers });
    }, [cables]);

    const handlePointDragStart = useCallback((cableId: string, index: number) => {
        const cable = cables.find(c => c.id === cableId);
        if (!cable) return;
        const tethers: Coordinates[] = [];
        if (index > 0) tethers.push(cable.coordinates[index - 1]);
        if (index < cable.coordinates.length - 1) tethers.push(cable.coordinates[index + 1]);
        setDragState({ isDragging: true, currentPosition: null, tetherPoints: tethers });
    }, [cables]);

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
    const visibleCables = useMemo(() => {
        if (!showCables) return [];

        // If no bounds yet (initial load), return a safe subset to prevent freeze
        if (!mapBoundsState) return cables.slice(0, 500);

        const paddedBounds = mapBoundsState.pad(0.2); // 20% buffer

        // Performance: optimization for large datasets (70k+ cables)
        // Only render cables that intersect with the current viewport
        return cables.filter(cable => {
            // Quick check: if cable has no coordinates, skip
            if (!cable.coordinates || cable.coordinates.length === 0) return false;

            // Optimization: Check if at least one point is visible
            // This handles most cases. For very long cables passing through but with no points inside, 
            // strict intersection is harder but this is a good trade-off for speed.
            // We check start, middle, and end to be safer? 
            // Checking ALL points is O(N*M), but M is small (points per cable).
            // For 71k cables, simple loop is fast enough in JS engine.

            // NOTE: D3 Layer can handle more, but filtering helps D3 performance too.
            // Let's keep this filtering logic.
            for (const coord of cable.coordinates) {
                // Safety check for valid coordinates
                if (!coord || typeof coord.lat !== 'number' || typeof coord.lng !== 'number' || isNaN(coord.lat) || isNaN(coord.lng)) continue;

                if (paddedBounds.contains(coord)) return true;
            }
            return false;
        });
    }, [showCables, cables, mapBoundsState]);

    const activeCable = useMemo(() => cables.find(c => c.id === activeCableId), [cables, activeCableId]);

    // Cables visible in D3 layer (everything EXCEPT the one being edited/active)
    const d3Cables = useMemo(() => visibleCables.filter(c => c.id !== activeCableId), [visibleCables, activeCableId]);


    const visibleCTOs = useMemo(() => {
        if (!showCTOs) return [];
        if (!mapBoundsState) return ctos.slice(0, 100); // Initial load safety
        const paddedBounds = mapBoundsState.pad(0.5); // 50% buffer for smoother panning
        return ctos.filter(c => paddedBounds.contains(c.coordinates));
    }, [showCTOs, ctos, mapBoundsState]);

    const visiblePOPs = useMemo(() => {
        if (!showPOPs) return [];
        if (!mapBoundsState) return pops;
        const paddedBounds = mapBoundsState.pad(0.5);
        return pops.filter(p => paddedBounds.contains(p.coordinates));
    }, [showPOPs, pops, mapBoundsState]);

    const visiblePoles = useMemo(() => {
        if (!showPoles) return [];
        if (!mapBoundsState) return poles.slice(0, 100);
        const paddedBounds = mapBoundsState.pad(0.5);
        return poles.filter(p => paddedBounds.contains(p.coordinates));
    }, [showPoles, poles, mapBoundsState]);

    // Lazy loading labels based on zoom
    const effectiveShowLabels = showLabels && currentZoom > 16;

    useEffect(() => {
        if (mode !== 'connect_cable') setActiveCableId(null);
    }, [mode]);

    const handleCableClickInternal = useCallback((e: any, cable: CableData) => {
        // Fix propagation: Use originalEvent if available (Leaflet), otherwise e (DOM/D3)
        const domEvent = e.originalEvent || e;
        L.DomEvent.stopPropagation(domEvent);

        // Single click: Only for selection/view/otdr
        if (mode === 'connect_cable') {
            // Force selection (no toggle) to avoid accidental deselection
            setActiveCableId(cable.id);
        } else if ((mode === 'view' || mode === 'otdr') && onCableClick) {
            onCableClick(cable.id);
        }
    }, [mode, onCableClick]);

    const handleCableDoubleClickInternal = useCallback((e: any, cable: CableData) => {
        L.DomEvent.stopPropagation(e);

        if (mode === 'connect_cable') {
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
        <div className="relative h-full w-full">
            <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-3">
                {/* Map Type Switcher - Segmented Control Style */}
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur p-1.5 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex gap-1.5">
                    <button
                        onClick={() => setMapType('street')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${mapType === 'street' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                        <MapIcon className="w-4 h-4" />
                        {t('map_street')}
                    </button>
                    <button
                        onClick={() => setMapType('satellite')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${mapType === 'satellite' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                        <Globe className="w-4 h-4" />
                        {t('map_satellite')}
                    </button>
                </div>

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
                </div>
            </div>

            <MapContainer
                center={initialCenter ? [initialCenter.lat, initialCenter.lng] : [-23.5505, -46.6333]}
                zoom={initialZoom || 15}
                maxZoom={24}
                style={{ height: '100%', width: '100%', backgroundColor: '#e2e8f0' }}
                className="z-0"
                preferCanvas={true} /* KEY PERFORMANCE OPTIMIZATION */
            >

                <MapResizeHandler />

                {mapType === 'street' ? (
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        maxNativeZoom={19}
                        maxZoom={24}
                    />
                ) : (
                    <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        maxNativeZoom={20}
                        maxZoom={24}
                    />
                )}

                <MapEvents mode={mode} onMapClick={onAddPoint} onClearSelection={() => setActiveCableId(null)} onMapMoveEnd={onMapMoveEnd} />

                <MapController bounds={mapBounds || null} viewKey={viewKey} center={initialCenter} zoom={initialZoom} />

                <BoundsUpdater setBounds={setMapBoundsState} setZoom={setCurrentZoom} />

                <D3CablesLayer
                    cables={d3Cables}
                    litCableIds={litCableIds}
                    highlightedCableId={highlightedCableId}
                    visible={showCables}
                    onClick={handleCableClickInternal}
                    onDoubleClick={handleCableDoubleClickInternal}
                />

                {/* Render ONLY active cable with React-Leaflet for editing interactions (drag handles) */}
                {activeCable && (
                    <>
                        {/* PANE HIERARCHY:
                            z-350: D3 Cables (Static) (Already configured above)
                            z-400: Default Overlay Pane
                            z-550: Active Cable Line (Below Markers but above D3)
                            z-600: Markers (CTOs/POPs)
                            z-700: Active Cable Handles (ABOVE Markers for clickability)
                        */}
                        <Pane name="cable-edit" style={{ zIndex: 550 }}>
                            <CablePolyline
                                key={activeCable.id}
                                cable={activeCable}
                                isLit={litCableIds.has(activeCable.id)}
                                isActive={true}
                                isHighlighted={highlightedCableId === activeCable.id}
                                mode={mode}
                                t={t}
                                onClick={handleCableClickInternal}
                                onUpdateGeometry={onUpdateCableGeometry}
                                onConnect={handleConnectWrapper}
                                snapDistance={snapDistance}
                                ctos={ctos}
                                pops={pops}
                                onPointDragStart={handlePointDragStart}
                                onDrag={handleDrag}
                                onDragEnd={handleDragEnd}
                                // Pass specific pane for handles to be ABOVE markers
                                handlePane="cable-handles"
                            />
                        </Pane>
                        <Pane name="cable-handles" style={{ zIndex: 700 }} />
                    </>
                )}


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

                {mode === 'draw_cable' && drawingPath.length > 0 && (
                    <Marker position={[drawingPath[0].lat, drawingPath[0].lng]} icon={startPointIcon} />
                )}

                {enableClustering ? (
                    <MarkerClusterGroup
                        chunkedLoading
                        maxClusterRadius={30} // Reduced from 50 to 30 to group less aggressively (items must be closer)
                        disableClusteringAtZoom={16} // Disable clustering sooner (at zoom 16+) to show individual items
                        spiderfyOnMaxZoom={true}
                        showCoverageOnHover={false}
                    >
                        {visibleCTOs.map(cto => (
                            <CTOMarker
                                key={cto.id}
                                cto={cto}
                                isSelected={selectedId === cto.id}
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
                            />
                        ))}

                        {visiblePOPs.map(pop => (
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
                            />
                        ))}
                        {visiblePoles.map(pole => (
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
                            />
                        ))}
                    </MarkerClusterGroup>
                ) : (
                    <>
                        {visibleCTOs.map(cto => (
                            <CTOMarker
                                key={cto.id}
                                cto={cto}
                                isSelected={selectedId === cto.id}
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
                            />
                        ))}

                        {visiblePOPs.map(pop => (
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
                            />
                        ))}
                        {visiblePoles.map(pole => (
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
                            />
                        ))}
                    </>
                )}

                {otdrResult && (
                    <Marker position={[otdrResult.lat, otdrResult.lng]} icon={otdrIcon}>
                        <Tooltip direction="top" permanent offset={[0, -20]} className="font-bold border-0 bg-slate-800 text-white shadow-xl">
                            {t('otdr_event_tooltip')}
                        </Tooltip>
                    </Marker>
                )}

            </MapContainer>
        </div>
    );
};
