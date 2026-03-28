import React, { useMemo, useRef, useEffect } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { POPData } from '../../types';

// Icon Cache
const iconCache = new Map<string, L.DivIcon>();

const createPOPIcon = (name: string, isSelected: boolean, showLabels: boolean = true, color: string = '#6366f1', baseSize: number = 24, currentZoom: number = 18) => {
    const effectiveZoom = Math.floor(currentZoom);
    const zoomScale = Math.pow(1.15, Math.max(0, effectiveZoom - 16));
    const size = Math.round(baseSize * zoomScale);
    const borderSize = Math.max(2, Math.round(2.5 * zoomScale));
    const pulseSize = Math.round(size * 2.2);
    const iconSize = Math.round(size * 0.5);

    const cacheKey = `pop-${name}-${isSelected}-${showLabels}-${color}-${baseSize}-${effectiveZoom}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

    const icon = L.divIcon({
        className: 'custom-icon',
        html: `
      ${isSelected ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${pulseSize}px;height:${pulseSize}px;background:rgba(99,102,241,0.3);border-radius:50%;animation:pulse-indigo 2s infinite;pointer-events:none;z-index:5;"></div>` : ''}
      <div style="
        position:relative;
        width:${size}px;
        height:${size}px;
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:15;
        filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="${isSelected ? '#a5b4fc' : 'white'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
          <path d="M10 6h4" stroke="white" stroke-width="2"/>
          <path d="M10 10h4" stroke="white" stroke-width="2"/>
          <path d="M10 14h4" stroke="white" stroke-width="2"/>
          <path d="M10 18h4" stroke="white" stroke-width="2"/>
        </svg>
      </div>
      <div style="
        display:${showLabels ? 'block' : 'none'};
        position:absolute;
        top:${size + 3}px;
        left:50%;
        transform:translateX(-50%);
        background:rgba(15,23,42,0.92);
        color:white;
        padding:2px 6px;
        border-radius:4px;
        font-size:${Math.max(8, Math.round(10 * Math.min(1.5, zoomScale)))}px;
        font-weight:700;
        letter-spacing:0.01em;
        white-space:nowrap;
        pointer-events:none;
        box-shadow:0 1px 3px rgba(0,0,0,0.3);
        z-index:20;
      ">${name}</div>
`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });

    iconCache.set(cacheKey, icon);
    return icon;
};

interface POPMarkerProps {
    pop: POPData;
    isSelected: boolean;
    showLabels: boolean;
    mode: string;
    currentZoom?: number;
    onNodeClick: (id: string, type: 'POP') => void;
    onCableStart: (id: string) => void;
    onCableEnd: (id: string) => void;
    onMoveNode: (id: string, lat: number, lng: number) => void;
    cableStartPoint: any;
    onDragStart: (id: string) => void;
    onDrag: (lat: number, lng: number) => void;
    onDragEnd: () => void;
    onContextMenu: (e: any, id: string, type: 'POP') => void;
    userRole?: string | null;
}

export const POPMarker = React.memo(({
    pop, isSelected, showLabels, mode, currentZoom = 18, onNodeClick, onCableStart, onCableEnd, onMoveNode, cableStartPoint,
    onDragStart, onDrag, onDragEnd, onContextMenu, userRole
}: POPMarkerProps) => {
    const icon = useMemo(() =>
        createPOPIcon(pop.name, isSelected, showLabels, pop.color, pop.size, currentZoom),
        [pop.name, isSelected, showLabels, pop.color, pop.size, currentZoom]);

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            if (mode !== 'ruler') L.DomEvent.stopPropagation(e);
            if (mode === 'draw_cable') {
                if (!isSelected && !cableStartPoint) onCableStart(pop.id);
                else onCableEnd(pop.id);
            } else if (mode === 'view' || mode === 'move_node') {
                onNodeClick(pop.id, 'POP');
            }
        },
        contextmenu: (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (mode === 'view') {
                onContextMenu(e, pop.id, 'POP');
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
    }), [mode, pop.id, isSelected, cableStartPoint, onCableStart, onCableEnd, onNodeClick, onMoveNode, onDragStart, onDrag, onDragEnd, onContextMenu]);

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
            position={[pop.coordinates.lat, pop.coordinates.lng]}
            icon={icon}
            draggable={mode === 'move_node' && userRole !== 'MEMBER'}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                <div className="text-xs font-bold">{pop.name}</div>
            </Tooltip>
        </Marker>
    );
});
