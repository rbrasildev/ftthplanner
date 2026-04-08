import React, { useMemo, useRef, useEffect } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { PoleData, PoleApprovalStatus, POLE_APPROVAL_COLORS, PoleSituation, POLE_SITUATION_COLORS } from '../../types';

// Icon Cache
const iconCache = new Map<string, L.DivIcon>();

const getApprovalColor = (approvalStatus?: PoleApprovalStatus, situation?: PoleSituation): string => {
    // Poste novo = azul (prioridade visual)
    if (situation === 'NEW') return POLE_SITUATION_COLORS.NEW;
    // Depois, cor por status de aprovação
    if (approvalStatus && POLE_APPROVAL_COLORS[approvalStatus]) return POLE_APPROVAL_COLORS[approvalStatus];
    // Fallback: cinza padrão
    return '#6b7280';
};

const createPoleIcon = (
    isSelected: boolean,
    showLabels: boolean = false,
    type: string = 'concrete',
    currentZoom: number = 18,
    approvalStatus?: PoleApprovalStatus,
    situation?: PoleSituation,
    poleName?: string,
) => {
    const effectiveZoom = Math.floor(currentZoom);
    const zoomScale = Math.pow(1.15, Math.max(0, effectiveZoom - 16));
    const baseSize = 12;
    const size = Math.round(baseSize * zoomScale);

    const cacheKey = `pole-${type}-${isSelected}-${showLabels}-${effectiveZoom}-${approvalStatus || 'none'}-${situation || 'none'}`;

    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey)!;
    }

    const borderColor = isSelected ? '#f59e0b' : getApprovalColor(approvalStatus, situation);
    const color = type === 'wood' ? '#78350f' : '#57534e';

    const icon = L.divIcon({
        className: 'custom-icon',
        html: `
      <div style="
        position: relative;
        background-color: ${color};
        border: ${Math.max(2, 2.5 * zoomScale)}px solid ${borderColor};
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
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
    onCableStart?: (id: string) => void;
    onCableEnd?: (id: string) => void;
    cableStartPoint?: any;
    isDrawingCable?: boolean;
    onAddPoint?: (lat: number, lng: number) => void;
    onMoveNode: (id: string, lat: number, lng: number) => void;
    onDragStart: (id: string) => void;
    onDrag: (lat: number, lng: number) => void;
    onDragEnd: () => void;
    onContextMenu: (e: any, id: string, type: 'Pole') => void;
}

export const PoleMarker = React.memo(({
    pole, isSelected, showLabels, mode, currentZoom = 18, onNodeClick, onCableStart, onCableEnd, cableStartPoint, isDrawingCable, onAddPoint, onMoveNode,
    onDragStart, onDrag, onDragEnd, onContextMenu
}: PoleMarkerProps) => {
    const icon = useMemo(() =>
        createPoleIcon(isSelected, showLabels, pole.type, currentZoom, pole.approvalStatus, pole.situation, pole.name),
        [isSelected, showLabels, pole.type, currentZoom, pole.approvalStatus, pole.situation]);

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            if (mode !== 'ruler') L.DomEvent.stopPropagation(e);
            if (mode === 'draw_cable') {
                if (!isDrawingCable && onCableStart) {
                    // Primeiro clique: iniciar cabo a partir deste poste
                    onCableStart(pole.id);
                } else if (isDrawingCable && onAddPoint) {
                    // Cliques intermediários: snap no poste e continuar desenhando
                    onAddPoint(pole.coordinates.lat, pole.coordinates.lng);
                }
            } else if (mode === 'view' || mode === 'move_node') {
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
    }), [mode, pole.id, isSelected, isDrawingCable, onNodeClick, onCableStart, onCableEnd, onAddPoint, onMoveNode, onDragStart, onDrag, onDragEnd, onContextMenu]);

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
