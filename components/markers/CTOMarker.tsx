import React, { useMemo, useRef, useEffect } from 'react';
import { CircleMarker, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { CTOData, CTO_STATUS_COLORS } from '../../types';

// Map of colors for CTO status
// Need to re-define or import if possible, but for isolation let's keep it self-contained or import from types if available? 
// In MapView it was imported. Let's try to keep it simple.
// Actually CTO_STATUS_COLORS is imported from types in MapView.

const iconCache = new Map<string, L.DivIcon>();

const darkenHex = (hex: string, factor: number = 0.7): string => {
    const h = hex.startsWith('#') ? hex.substring(1, 7) : hex.substring(0, 6);
    const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * factor));
    const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * factor));
    const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * factor));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const createCTOIcon = (isSelected: boolean, status: string = 'PLANNED', customColor?: string, currentZoom: number = 18, isOnline?: boolean, type: string = 'CTO', isVerticalCondo: boolean = false, isLit: boolean = false) => {
    const effectiveZoom = Math.floor(currentZoom);
    const zoomScale = Math.pow(1.15, Math.max(0, effectiveZoom - 16));
    const size = Math.round(18 * zoomScale);
    const borderSize = Math.max(2, Math.round(3 * zoomScale));
    const pulseSize = Math.round(36 * zoomScale);

    const cacheKey = `cto-${isSelected}-${status}-${customColor || 'default'}-${effectiveZoom}-${isOnline}-${type}-${isVerticalCondo ? 'vc' : 'std'}-${isLit ? 'lit' : 'off'}`;

    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey)!;
    }

    let statusColor = CTO_STATUS_COLORS[status as keyof typeof CTO_STATUS_COLORS] || CTO_STATUS_COLORS['PLANNED'];
    // DEPLOYED é o estado "normal/instalado" — deixa a cor cadastrada no catálogo
    // dominar pra diferenciar CTO vs CEO vs variantes. Outros status (PLANNED,
    // NOT_DEPLOYED, CERTIFIED) mantêm a cor padrão porque comunicam estado.
    if (status === 'DEPLOYED' && customColor) statusColor = customColor;
    if (isOnline === true) statusColor = '#22c55e'; // Green for online
    else if (isOnline === false) statusColor = '#ef4444'; // Red for offline

    // Status color drives both fill and border so status changes are always fully visible.
    // CEO and CTO share the same size/colors; they only differ in border-radius (CEO slightly squared).
    // Quando o nó é atravessado pelo feixe VFL (`isLit`), a borda fica fuchsia
    // pra indicar o caminho da luz na topologia sem confundir com vermelho
    // de cabos NOT_DEPLOYED/offline.
    const fillColor = statusColor;
    const borderColor = isLit ? '#f87171' : (isSelected ? '#22c55e' : statusColor);

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
`
        : `
      ${isSelected ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: ${pulseSize}px; height: ${pulseSize}px; background: rgba(34, 197, 94, 0.4); border-radius: 50%; animation: pulse-green 2s infinite; pointer-events: none; z-index: 5;"></div>` : ''}
      <div style="
        position: relative;
        background-color: ${fillHex}cc;
        border: ${borderSize}px solid ${borderHex};
        border-radius: ${type === 'CEO' ? '30%' : '50%'};
        width: ${size}px;
        height: ${size}px;
        box-shadow: ${isLit ? `0 0 8px 2px rgba(248,113,113,0.65), 0 2px 4px rgba(0,0,0,0.4)` : `0 2px 4px rgba(0, 0, 0, 0.4)`};
        transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
        z-index: 10;
      ">
      </div>
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
    /** Borda vermelha quando o feixe VFL atravessa esse nó. */
    isLit?: boolean;
    /** Quando true, omite o Tooltip do Leaflet inteiro — assume que `LabelsCanvasLayer`
     *  está cuidando dos rótulos. Sem isto, hover sobre o marker mostra o tooltip
     *  preto antigo em cima do label canvas. */
    canvasLabelsActive?: boolean;
    /** Callback de hover. Recebe o id quando o mouse entra, null quando sai. */
    onHoverLabel?: (id: string | null) => void;
}

export const CTOMarker = React.memo(({
    cto, isSelected, showLabels, mode, currentZoom = 18, onNodeClick, onCableStart, onCableEnd, onMoveNode, cableStartPoint,
    onDragStart, onDrag, onDragEnd, onContextMenu, userRole, isOnline, isLit = false, canvasLabelsActive = false, onHoverLabel,
}: CTOMarkerProps) => {
    const isVerticalCondo = !!cto.building;
    const isCEO = cto.type === 'CEO';
    const isDragMode = mode === 'move_node' && userRole !== 'MEMBER';
    // Condos and CEOs render with the full divIcon at all times — both rely on a
    // non-circular shape (building silhouette / squared border-radius) that CircleMarker
    // can't reproduce. CTOs use the lightweight CircleMarker by default.
    const useDivIcon = isDragMode || isVerticalCondo || isCEO;

    const icon = useMemo(() => {
        if (!useDivIcon) return null;
        return createCTOIcon(isSelected, cto.status, cto.color, currentZoom, isOnline, cto.type, isVerticalCondo, isLit);
    }, [useDivIcon, isSelected, cto.status, cto.color, currentZoom, isOnline, cto.type, isVerticalCondo, isLit]);

    const pathOptions = useMemo(() => {
        let statusColor = CTO_STATUS_COLORS[cto.status as keyof typeof CTO_STATUS_COLORS] || CTO_STATUS_COLORS['PLANNED'];
        if (cto.status === 'DEPLOYED' && cto.color) statusColor = cto.color;
        if (isOnline === true) statusColor = '#22c55e';
        else if (isOnline === false) statusColor = '#ef4444';
        const fill = statusColor.substring(0, 7);
        return {
            color: isLit ? '#f87171' : (isSelected ? '#22c55e' : darkenHex(fill)),
            fillColor: fill,
            fillOpacity: 0.85,
            weight: isLit ? 3 : (isSelected ? 3 : 2),
        };
    }, [cto.status, cto.color, isOnline, isSelected, isLit]);

    const circleRadius = useMemo(() => {
        const zoomScale = Math.pow(1.15, Math.max(0, Math.floor(currentZoom) - 16));
        return Math.round(9 * zoomScale);
    }, [currentZoom]);

    // Selected CTO always shows label; otherwise honor the global toggle.
    // MapView already gates `showLabels` at zoom > 16 via `effectiveShowLabels`,
    // so no extra zoom check is needed here.
    const shouldShowPermanentLabel = isSelected || showLabels;

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
        // Stopa dblclick pra não disparar doubleClickZoom default do Leaflet.
        dblclick: (e: any) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
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
        },
        mouseover: () => onHoverLabel?.(cto.id),
        mouseout: () => onHoverLabel?.(null),
    }), [mode, cto.id, isSelected, cableStartPoint, onCableStart, onCableEnd, onNodeClick, onMoveNode, onDragStart, onDrag, onDragEnd, onContextMenu, onHoverLabel]);

    const markerRef = useRef<L.Marker>(null);

    useEffect(() => {
        if (!markerRef.current) return;
        if (mode === 'move_node' && userRole !== 'MEMBER') {
            markerRef.current.dragging?.enable();
        } else {
            markerRef.current.dragging?.disable();
        }
    }, [mode, userRole]);

    if (useDivIcon && icon) {
        // Condo silhouette is ~1.45× taller than wide; offset compensates so the label
        // sits just above the roof instead of overlapping the building body.
        const divIconHalfHeight = isVerticalCondo ? Math.round(circleRadius * 1.45) : circleRadius;
        return (
            <Marker
                ref={markerRef}
                position={[cto.coordinates.lat, cto.coordinates.lng]}
                icon={icon}
                draggable={isDragMode}
                eventHandlers={eventHandlers}
            >
                {!canvasLabelsActive && (
                    <Tooltip
                        direction="top"
                        offset={[0, -divIconHalfHeight]}
                        opacity={1}
                        permanent={!isDragMode && shouldShowPermanentLabel}
                        className={`map-label${!isDragMode && shouldShowPermanentLabel ? ' map-label--permanent' : ''}${isSelected ? ' map-label--selected' : ''}`}
                    >
                        {cto.name}
                    </Tooltip>
                )}
            </Marker>
        );
    }

    return (
        // Render in cto-circles-pane (z=550) where drop polylines also live. Sharing
        // the same pane means a single canvas, so Leaflet's hit-test iterates both
        // CTOs and drops in one pass — no inter-pane click absorption.
        <CircleMarker
            center={[cto.coordinates.lat, cto.coordinates.lng]}
            radius={circleRadius}
            pathOptions={pathOptions}
            pane="cto-circles-pane"
            eventHandlers={eventHandlers}
        >
            {!canvasLabelsActive && (
                <Tooltip
                    direction="top"
                    offset={[0, -circleRadius]}
                    opacity={1}
                    permanent={shouldShowPermanentLabel}
                    className={`map-label${shouldShowPermanentLabel ? ' map-label--permanent' : ''}${isSelected ? ' map-label--selected' : ''}`}
                >
                    {cto.name}
                </Tooltip>
            )}
        </CircleMarker>
    );
});
