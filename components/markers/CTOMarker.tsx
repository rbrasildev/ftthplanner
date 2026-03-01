import React, { useMemo, useRef, useEffect } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { CTOData, CTO_STATUS_COLORS } from '../../types';

// Map of colors for CTO status
// Need to re-define or import if possible, but for isolation let's keep it self-contained or import from types if available? 
// In MapView it was imported. Let's try to keep it simple.
// Actually CTO_STATUS_COLORS is imported from types in MapView.

const iconCache = new Map<string, L.DivIcon>();

const createCTOIcon = (name: string, isSelected: boolean, status: string = 'PLANNED', showLabels: boolean = true, customColor?: string, currentZoom: number = 15) => {
    const zoomScale = Math.pow(1.15, Math.max(0, currentZoom - 15));
    const size = Math.round(20 * zoomScale);
    const borderSize = Math.max(2, Math.round(3 * zoomScale));
    const pulseSize = Math.round(40 * zoomScale);

    const cacheKey = `cto-${name}-${isSelected}-${status}-${showLabels}-${customColor || 'default'}-${currentZoom}`;

    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey)!;
    }

    // Prioritize custom catalog color if available, otherwise fallback to status color
    // @ts-ignore
    const color = customColor || CTO_STATUS_COLORS[status] || CTO_STATUS_COLORS['PLANNED'];

    const icon = L.divIcon({
        className: 'custom-icon',
        html: `
      ${isSelected ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${pulseSize}px; height: ${pulseSize}px; background: rgba(34, 197, 94, 0.4); border-radius: 50%; animation: pulse-green 2s infinite; pointer-events: none; z-index: 5;"></div>` : ''}
      <div style="
        position: relative;
        background-color: ${color.substring(0, 7)}cc; /* 60% opacity */
        border: ${borderSize}px solid ${isSelected ? '#22c55e' : color.substring(0, 7)}; /* Solid thick border, green when selected */
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        transition: border-color 0.2s ease;
        z-index: 10;
      ">
      </div>
      <div style="
        display: ${showLabels ? 'block' : 'none'};
        position: absolute;
        top: ${size + 2}px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.9);
        color: white;
        padding: 2px 5px;
        border-radius: 4px;
        font-size: ${Math.max(8, Math.round(10 * Math.min(1.5, zoomScale)))}px;
        font-weight: 600;
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

interface CTOMarkerProps {
    cto: CTOData;
    isSelected: boolean;
    showLabels: boolean;
    mode: string;
    currentZoom?: number;
    onNodeClick: (id: string, type: 'CTO') => void;
    onCableStart: (id: string) => void;
    onCableEnd: (id: string) => void;
    onMoveNode: (id: string, lat: number, lng: number) => void;
    cableStartPoint: any;
    onDragStart: (id: string) => void;
    onDrag: (lat: number, lng: number) => void;
    onDragEnd: () => void;
    onContextMenu: (e: any, id: string, type: 'CTO') => void;
    userRole?: string | null;
}

export const CTOMarker = React.memo(({
    cto, isSelected, showLabels, mode, currentZoom = 15, onNodeClick, onCableStart, onCableEnd, onMoveNode, cableStartPoint,
    onDragStart, onDrag, onDragEnd, onContextMenu, userRole
}: CTOMarkerProps) => {
    const icon = useMemo(() =>
        createCTOIcon(cto.name, isSelected, cto.status, showLabels, cto.color, currentZoom),
        [cto.name, isSelected, cto.status, showLabels, cto.color, currentZoom]);

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            if (mode !== 'ruler') L.DomEvent.stopPropagation(e);
            if (mode === 'draw_cable') {
                if (!isSelected && !cableStartPoint) onCableStart(cto.id);
                else onCableEnd(cto.id);
            } else if (mode === 'view' || mode === 'move_node' || mode === 'draw_customer_drop_dummy_mode' /* handled by parent wrapper in MapView using onNodeClick intercept */) {
                // In MapView we intercept onNodeClick for drop drawing, so we just pass it up
                onNodeClick(cto.id, 'CTO');
            }
        },
        contextmenu: (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (mode === 'view') {
                onContextMenu(e, cto.id, 'CTO');
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
    }), [mode, cto.id, isSelected, cableStartPoint, onCableStart, onCableEnd, onNodeClick, onMoveNode, onDragStart, onDrag, onDragEnd, onContextMenu]);

    const markerRef = useRef<L.Marker>(null);

    useEffect(() => {
        if (!markerRef.current) return;
        if (mode === 'move_node' && userRole !== 'MEMBER') {
            markerRef.current.dragging?.enable();
        } else {
            markerRef.current.dragging?.disable();
        }
    }, [mode, userRole]);

    return (
        <Marker
            ref={markerRef}
            position={[cto.coordinates.lat, cto.coordinates.lng]}
            icon={icon}
            draggable={mode === 'move_node' && userRole !== 'MEMBER'}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                <div className="text-xs font-bold">{cto.name}</div>
            </Tooltip>
        </Marker>
    );
});
