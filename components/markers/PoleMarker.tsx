import React, { useMemo, useRef, useEffect } from 'react';
import { CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { PoleData, PoleApprovalStatus, POLE_APPROVAL_COLORS, PoleSituation, POLE_SITUATION_COLORS } from '../../types';

// One SVG renderer per Leaflet map instance — created lazily inside the component
// (after the map and `pole-circles-pane` exist) rather than at module-load time,
// because the bundled production build can evaluate this module before the pane
// has been created, leaving the renderer attached to a non-existent pane and
// silently rendering paths without the `.leaflet-interactive` class.
const poleRenderersByMap = new WeakMap<L.Map, L.Renderer>();
const getPoleRenderer = (map: L.Map): L.Renderer => {
    let renderer = poleRenderersByMap.get(map);
    if (!renderer) {
        renderer = L.svg({ pane: 'pole-circles-pane' });
        poleRenderersByMap.set(map, renderer);
    }
    return renderer;
};

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

const POLE_BASE_SIZE = 9;
const getPoleSize = (currentZoom: number) => {
    const zoomScale = Math.pow(1.15, Math.max(0, Math.floor(currentZoom) - 16));
    return Math.round(POLE_BASE_SIZE * zoomScale);
};

const createPoleIcon = (
    isSelected: boolean,
    type: string = 'concrete',
    currentZoom: number = 18,
    approvalStatus?: PoleApprovalStatus,
    situation?: PoleSituation,
) => {
    const effectiveZoom = Math.floor(currentZoom);
    const zoomScale = Math.pow(1.15, Math.max(0, effectiveZoom - 16));
    const size = getPoleSize(effectiveZoom);

    const cacheKey = `pole-${type}-${isSelected}-${effectiveZoom}-${approvalStatus || 'none'}-${situation || 'none'}`;

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
    const map = useMap();
    const isDragMode = mode === 'move_node';

    // Only build the divIcon when we actually need it (drag mode) — view mode uses
    // the lightweight CircleMarker, which doesn't need the cached divIcon.
    const icon = useMemo(() => {
        if (!isDragMode) return null;
        return createPoleIcon(isSelected, pole.type, currentZoom, pole.approvalStatus, pole.situation);
    }, [isDragMode, isSelected, pole.type, currentZoom, pole.approvalStatus, pole.situation]);

    const poleSize = getPoleSize(currentZoom);
    // Match the divIcon's visual footprint exactly so the swap to/from drag mode
    // doesn't visibly resize the pole. The divIcon's outer div uses Tailwind's
    // `box-sizing: border-box`, so its border lives INSIDE the `${poleSize}px`
    // width — total visible diameter equals poleSize. CircleMarker's visible
    // diameter is 2*radius + weight, hence radius = (poleSize - borderWidth) / 2
    // with weight = borderWidth.
    const zoomScaleForBorder = Math.pow(1.15, Math.max(0, Math.floor(currentZoom) - 16));
    const borderWidth = Math.max(2, 2.5 * zoomScaleForBorder);
    const circleRadius = Math.max(2, (poleSize - borderWidth) / 2);
    const shouldShowPermanentLabel = isSelected || showLabels;

    const pathOptions = useMemo(() => {
        const fillColor = pole.type === 'wood' ? '#78350f' : '#57534e';
        const borderColor = isSelected ? '#f59e0b' : getApprovalColor(pole.approvalStatus, pole.situation);
        return {
            color: borderColor,
            fillColor,
            fillOpacity: 1,
            weight: borderWidth,
            renderer: getPoleRenderer(map),
        };
    }, [map, pole.type, pole.approvalStatus, pole.situation, isSelected, borderWidth]);

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

    if (isDragMode && icon) {
        return (
            <Marker
                ref={markerRef}
                position={[pole.coordinates.lat, pole.coordinates.lng]}
                icon={icon}
                draggable={true}
                eventHandlers={eventHandlers}
            >
                <Tooltip
                    direction="top"
                    offset={[0, -poleSize / 2]}
                    opacity={1}
                    className={`map-label${isSelected ? ' map-label--selected' : ''}`}
                >
                    Poste
                </Tooltip>
            </Marker>
        );
    }

    return (
        <CircleMarker
            center={[pole.coordinates.lat, pole.coordinates.lng]}
            radius={circleRadius}
            pathOptions={pathOptions}
            pane="pole-circles-pane"
            eventHandlers={eventHandlers}
        >
            <Tooltip
                direction="top"
                offset={[0, -circleRadius]}
                opacity={1}
                permanent={shouldShowPermanentLabel}
                className={`map-label${shouldShowPermanentLabel ? ' map-label--permanent' : ''}${isSelected ? ' map-label--selected' : ''}`}
            >
                Poste
            </Tooltip>
        </CircleMarker>
    );
});
