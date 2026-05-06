import React, { useMemo, useRef, useEffect } from 'react';
import { CircleMarker, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { CTOData, CTO_STATUS_COLORS } from '../../types';

// Map of colors for CTO status
// Need to re-define or import if possible, but for isolation let's keep it self-contained or import from types if available? 
// In MapView it was imported. Let's try to keep it simple.
// Actually CTO_STATUS_COLORS is imported from types in MapView.

const iconCache = new Map<string, L.DivIcon>();

const createCTOIcon = (name: string, isSelected: boolean, status: string = 'PLANNED', showLabels: boolean = true, customColor?: string, currentZoom: number = 18, isOnline?: boolean, type: string = 'CTO', isVerticalCondo: boolean = false) => {
    const effectiveZoom = Math.floor(currentZoom);
    const zoomScale = Math.pow(1.15, Math.max(0, effectiveZoom - 16));
    const size = Math.round(18 * zoomScale);
    const borderSize = Math.max(2, Math.round(3 * zoomScale));
    const pulseSize = Math.round(36 * zoomScale);

    const cacheKey = `cto-${name}-${isSelected}-${status}-${showLabels}-${customColor || 'default'}-${effectiveZoom}-${isOnline}-${type}-${isVerticalCondo ? 'vc' : 'std'}`;

    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey)!;
    }

    let statusColor = CTO_STATUS_COLORS[status as keyof typeof CTO_STATUS_COLORS] || CTO_STATUS_COLORS['PLANNED'];
    if (isOnline === true) statusColor = '#22c55e'; // Green for online
    else if (isOnline === false) statusColor = '#ef4444'; // Red for offline

    // Status color drives both fill and border so status changes are always fully visible.
    // CEO and CTO share the same size/colors; they only differ in border-radius (CEO slightly squared).
    const fillColor = statusColor;
    const borderColor = isSelected ? '#22c55e' : statusColor;

    // Vertical condo gets a tall building silhouette: rectangular body taller
    // than wide, with a stepped roof and window grid drawn inline so the marker
    // reads as "prédio" instantly even at low zoom.
    const condoW = Math.round(size * 0.95);
    const condoH = Math.round(size * 1.45);
    const fillHex = fillColor.substring(0, 7);
    const borderHex = borderColor.substring(0, 7);

    const condoSvg = isVerticalCondo
        ? `
        <svg width="${condoW}" height="${condoH}" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" style="display:block; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.45));">
          <!-- Roof line -->
          <rect x="3" y="3" width="18" height="3" rx="0.5" fill="${borderHex}" stroke="${borderHex}" stroke-width="0.5" />
          <!-- Building body -->
          <rect x="2" y="6" width="20" height="28" rx="1" fill="${fillHex}" fill-opacity="0.95" stroke="${borderHex}" stroke-width="${borderSize >= 3 ? 1.8 : 1.4}" />
          <!-- Windows: 5 rows × 3 cols -->
          ${[0, 1, 2, 3, 4].map(row =>
            [0, 1, 2].map(col => {
                const wx = 4 + col * 5.5;
                const wy = 9 + row * 5;
                return `<rect x="${wx}" y="${wy}" width="3" height="3" rx="0.3" fill="white" fill-opacity="0.9" />`;
            }).join('')
        ).join('')}
          <!-- Door -->
          <rect x="10" y="29" width="4" height="5" fill="${borderHex}" />
        </svg>
      `
        : '';

    const html = isVerticalCondo
        ? `
      ${isSelected ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${pulseSize}px; height: ${Math.round(pulseSize * 1.4)}px; background: rgba(34, 197, 94, 0.4); border-radius: 12%; animation: pulse-green 2s infinite; pointer-events: none; z-index: 5;"></div>` : ''}
      <div style="position: relative; width: ${condoW}px; height: ${condoH}px;">${condoSvg}</div>
      <div style="
        display: ${showLabels ? 'block' : 'none'};
        position: absolute;
        top: ${condoH / 2 + 2}px;
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
`
        : `
      ${isSelected ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${pulseSize}px; height: ${pulseSize}px; background: rgba(34, 197, 94, 0.4); border-radius: 50%; animation: pulse-green 2s infinite; pointer-events: none; z-index: 5;"></div>` : ''}
      <div style="
        position: relative;
        background-color: ${fillHex}cc; /* 60% opacity */
        border: ${borderSize}px solid ${borderHex};
        border-radius: ${type === 'CEO' ? '30%' : '50%'};
        width: ${size}px;
        height: ${size}px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        transition: border-color 0.2s ease, background-color 0.2s ease;
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
`;

    const iconSize: [number, number] = isVerticalCondo ? [condoW, condoH] : [size, size];
    // Anchor at center for both shapes — keeps cables visually entering the marker
    // body. Anchoring at the building's base would leave the cable ending below the
    // drawing, looking disconnected.
    const iconAnchor: [number, number] = isVerticalCondo ? [condoW / 2, condoH / 2] : [size / 2, size / 2];

    const icon = L.divIcon({
        className: 'custom-icon',
        html,
        iconSize,
        iconAnchor
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
    isOnline?: boolean;
}

export const CTOMarker = React.memo(({
    cto, isSelected, showLabels, mode, currentZoom = 18, onNodeClick, onCableStart, onCableEnd, onMoveNode, cableStartPoint,
    onDragStart, onDrag, onDragEnd, onContextMenu, userRole, isOnline
}: CTOMarkerProps) => {
    const isVerticalCondo = !!cto.building;
    const isDragMode = mode === 'move_node' && userRole !== 'MEMBER';

    const icon = useMemo(() => {
        if (!isDragMode) return null;
        return createCTOIcon(cto.name, isSelected, cto.status, showLabels, cto.color, currentZoom, isOnline, cto.type, isVerticalCondo);
    }, [isDragMode, cto.name, isSelected, cto.status, showLabels, cto.color, currentZoom, isOnline, cto.type, isVerticalCondo]);

    const pathOptions = useMemo(() => {
        let statusColor = CTO_STATUS_COLORS[cto.status as keyof typeof CTO_STATUS_COLORS] || CTO_STATUS_COLORS['PLANNED'];
        if (isOnline === true) statusColor = '#22c55e';
        else if (isOnline === false) statusColor = '#ef4444';
        const fill = statusColor.substring(0, 7);
        return {
            color: isSelected ? '#22c55e' : fill,
            fillColor: fill,
            fillOpacity: 0.85,
            weight: isSelected ? 3 : 2,
        };
    }, [cto.status, isOnline, isSelected]);

    const circleRadius = useMemo(() => {
        const zoomScale = Math.pow(1.15, Math.max(0, Math.floor(currentZoom) - 16));
        return Math.round(9 * zoomScale);
    }, [currentZoom]);

    // Visibility tiers — keeps the map readable in dense clusters:
    // selected always wins (provided we're zoomed enough to give it room),
    // the global toggle requires more zoom because it affects every CTO at once.
    const shouldShowPermanentLabel = isSelected
        ? currentZoom >= 17
        : showLabels && currentZoom >= 19;

    const eventHandlers = useMemo(() => ({
        click: (e: any) => {
            if (mode !== 'ruler') L.DomEvent.stopPropagation(e);
            if (mode === 'draw_cable') {
                if (!isSelected && !cableStartPoint) onCableStart(cto.id);
                else onCableEnd(cto.id);
            } else if (mode === 'view' || mode === 'draw_customer_drop_dummy_mode' /* handled by parent wrapper in MapView using onNodeClick intercept */) {
                // In MapView we intercept onNodeClick for drop drawing, so we just pass it up.
                // `move_node` is intentionally excluded — clicking on a marker while dragging
                // it would otherwise open the properties panel right after the drop, since
                // Leaflet fires a click after dragend when the cursor stays over the marker.
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

    if (isDragMode && icon) {
        return (
            <Marker
                ref={markerRef}
                position={[cto.coordinates.lat, cto.coordinates.lng]}
                icon={icon}
                draggable={true}
                eventHandlers={eventHandlers}
            >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                    <div className="text-xs font-bold">{cto.name}</div>
                </Tooltip>
            </Marker>
        );
    }

    return (
        <CircleMarker
            center={[cto.coordinates.lat, cto.coordinates.lng]}
            radius={circleRadius}
            pathOptions={pathOptions}
            pane="cto-circles-pane"
            eventHandlers={eventHandlers}
        >
            <Tooltip
                direction="top"
                offset={[0, -circleRadius]}
                opacity={1}
                permanent={shouldShowPermanentLabel}
                className={`cto-label${shouldShowPermanentLabel ? ' cto-label--permanent' : ''}${isSelected ? ' cto-label--selected' : ''}`}
            >
                {cto.name}
            </Tooltip>
        </CircleMarker>
    );
});
