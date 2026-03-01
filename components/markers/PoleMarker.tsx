import React, { useMemo, useRef, useEffect } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { PoleData } from '../../types';

// Icon Cache
const iconCache = new Map<string, L.DivIcon>();

const createPoleIcon = (isSelected: boolean, showLabels: boolean = false, type: string = 'concrete', currentZoom: number = 18) => {
    const zoomScale = Math.pow(1.15, Math.max(0, currentZoom - 18));
    const baseSize = 12;
    const size = Math.round(baseSize * zoomScale);

    const cacheKey = `pole-${type}-${isSelected}-${showLabels}-${currentZoom}`;

    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey)!;
    }

    const color = type === 'wood' ? '#78350f' : '#57534e'; // wood vs stone

    const icon = L.divIcon({
        className: 'custom-icon',
        html: `
      <div style="
        position: relative;
        background-color: ${color};
        border: ${Math.max(1.5, 2 * zoomScale)}px solid ${isSelected ? '#f59e0b' : '#a8a29e'};
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        z-index: 5;
      ">
      </div>
      ${showLabels ? `<div style="position: absolute; top: ${size + 2}px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: white; padding: 1px 3px; font-size: ${Math.max(7, Math.round(8 * Math.min(1.5, zoomScale)))}px; border-radius: 2px; white-space: nowrap;">Poste</div>` : ''}
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });

    iconCache.set(cacheKey, icon);
    return icon;
};

interface PoleMarkerProps {
    pole: PoleData;
    isSelected: boolean;
    showLabels: boolean;
    mode: string;
    currentZoom?: number;
    onNodeClick: (id: string, type: 'Pole') => void;
    onMoveNode: (id: string, lat: number, lng: number) => void;
    onDragStart: (id: string) => void;
    onDrag: (lat: number, lng: number) => void;
    onDragEnd: () => void;
    onContextMenu: (e: any, id: string, type: 'Pole') => void;
}

export const PoleMarker = React.memo(({
    pole, isSelected, showLabels, mode, currentZoom = 18, onNodeClick, onMoveNode,
    onDragStart, onDrag, onDragEnd, onContextMenu
}: PoleMarkerProps) => {
    const icon = useMemo(() =>
        createPoleIcon(isSelected, showLabels, pole.type, currentZoom),
        [isSelected, showLabels, pole.type, currentZoom]);

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            if (mode !== 'ruler') L.DomEvent.stopPropagation(e);
            if (mode === 'view' || mode === 'move_node') {
                onNodeClick(pole.id, 'Pole');
            }
        },
        contextmenu: (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (mode === 'view') {
                onContextMenu(e, pole.id, 'Pole');
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
    }), [mode, pole.id, isSelected, onNodeClick, onMoveNode, onDragStart, onDrag, onDragEnd, onContextMenu]);

    const markerRef = useRef<L.Marker>(null);

    useEffect(() => {
        if (!markerRef.current) return;
        if (mode === 'move_node') {
            markerRef.current.dragging?.enable();
        } else {
            markerRef.current.dragging?.disable();
        }
    }, [mode]);

    return (
        <Marker
            ref={markerRef}
            position={[pole.coordinates.lat, pole.coordinates.lng]}
            icon={icon}
            draggable={mode === 'move_node'}
            eventHandlers={eventHandlers}
        >
        </Marker>
    );
});
