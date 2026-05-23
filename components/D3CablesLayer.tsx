import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import RBush from 'rbush';
import simplify from 'simplify-js';
import { CableData, CABLE_STATUS_COLORS } from '../types';

interface D3CablesLayerProps {
    cables: CableData[];
    litCableIds: Set<string>;
    highlightedCableId: string | null;
    visible: boolean;
    boxIds: Set<string>;
    onClick: (e: any, cable: CableData) => void;
    onDoubleClick?: (e: any, cable: CableData) => void;
    onContextMenu?: (e: any, cable: CableData) => void;
    mode?: string;
    showLabels?: boolean;
    userRole?: string | null;
    /**
     * Cores derivadas do status óptico de switch links por cabo (Fase 4).
     * Quando presente, sobrescreve a cor default do cabo para comunicar
     * NO_SIGNAL/MARGINAL/OK através do mapa.
     */
    cableStatusColorMap?: Map<string, string>;
}

// LOD Thresholds
const LOD_SIMPLIFY_THRESHOLD_ZOOM = 14;
const LOD_HIDE_DASHED_ZOOM = 12;
const HIT_TOLERANCE_PX = 8;

interface HitEntry {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    cableId: string;
    segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

class CableRTree extends RBush<HitEntry> {}

const distanceToSegment = (
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        const ex = px - x1;
        const ey = py - y1;
        return Math.sqrt(ex * ex + ey * ey);
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    const ex = px - cx;
    const ey = py - cy;
    return Math.sqrt(ex * ex + ey * ey);
};

export const D3CablesLayer: React.FC<D3CablesLayerProps> = ({
    cables,
    litCableIds,
    highlightedCableId,
    visible,
    boxIds,
    onClick,
    onDoubleClick,
    onContextMenu,
    mode,
    cableStatusColorMap,
}) => {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const treeRef = useRef<CableRTree>(new CableRTree());
    const cablesByIdRef = useRef<Map<string, CableData>>(new Map());
    const hoveredCableIdRef = useRef<string | null>(null);
    const hoverTooltipRef = useRef<L.Tooltip | null>(null);

    // Stable refs for callbacks
    const onClickRef = useRef(onClick);
    const onDoubleClickRef = useRef(onDoubleClick);
    const onContextMenuRef = useRef(onContextMenu);
    const modeRef = useRef(mode);
    useEffect(() => { onClickRef.current = onClick; }, [onClick]);
    useEffect(() => { onDoubleClickRef.current = onDoubleClick; }, [onDoubleClick]);
    useEffect(() => { onContextMenuRef.current = onContextMenu; }, [onContextMenu]);
    useEffect(() => { modeRef.current = mode; }, [mode]);

    // Cache for simplified geometries (keyed by cableId-zoomBucket).
    const geometryCache = useRef<Map<string, Array<{ lat: number; lng: number }>>>(new Map());

    // Invalidate cache when cables change.
    useEffect(() => {
        geometryCache.current.clear();
    }, [cables]);

    // Keep id->cable lookup synced for hit-test.
    useEffect(() => {
        const m = new Map<string, CableData>();
        for (const c of cables) m.set(c.id, c);
        cablesByIdRef.current = m;
    }, [cables]);

    // Lifecycle: create <canvas> inside the Leaflet pane.
    useEffect(() => {
        if (!visible) return;

        let pane = map.getPane('d3-visual');
        if (!pane) {
            pane = map.createPane('d3-visual');
        }
        pane.style.zIndex = '500';
        // Pane itself must be click-through; canvas below ignores events (we use map.on for hit-test).
        pane.style.pointerEvents = 'none';

        const canvas = document.createElement('canvas');
        canvas.className = 'leaflet-zoom-hide';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        pane.appendChild(canvas);

        canvasRef.current = canvas;

        return () => {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            canvasRef.current = null;
        };
    }, [map, visible]);

    // Draw effect: render cables to canvas + rebuild hit-test R-tree.
    useEffect(() => {
        if (!visible || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const getRenderCoordinates = (cable: CableData, currentZoom: number): Array<{ lat: number; lng: number }> => {
            if (currentZoom >= LOD_SIMPLIFY_THRESHOLD_ZOOM) return cable.coordinates;

            // Tolerance in degrees (~11m per 0.0001 at equator). Higher zoom-out = coarser simplification.
            let tolerance: number;
            let bucket: number;
            if (currentZoom < 10) { tolerance = 0.0005; bucket = 0; }
            else if (currentZoom < 12) { tolerance = 0.00015; bucket = 1; }
            else { tolerance = 0.00005; bucket = 2; }

            const cacheKey = `${cable.id}-z${bucket}`;
            const cached = geometryCache.current.get(cacheKey);
            if (cached) return cached;

            const coords = cable.coordinates;
            if (coords.length <= 2) return coords;

            // Ramer-Douglas-Peucker: preserves shape by dropping redundant vertices,
            // not every Nth point — keeps curves & corners intact.
            const simplified = simplify(
                coords.map(c => ({ x: c.lng, y: c.lat })),
                tolerance,
                false // radial-distance variant: ~2x faster, visually equivalent at these scales
            ).map(p => ({ lat: p.y, lng: p.x }));

            geometryCache.current.set(cacheKey, simplified);
            return simplified;
        };

        const draw = () => {
            const size = map.getSize();
            const mapTopLeft = map.containerPointToLayerPoint([0, 0]);
            const dpr = window.devicePixelRatio || 1;
            const currentZoom = map.getZoom();

            // Track layer origin so content moves with the map during pan (no per-frame redraw).
            L.DomUtil.setPosition(canvas, mapTopLeft);

            // Resize only when needed (changing canvas size clears it).
            const targetW = Math.max(1, Math.round(size.x * dpr));
            const targetH = Math.max(1, Math.round(size.y * dpr));
            if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW;
                canvas.height = targetH;
                canvas.style.width = `${size.x}px`;
                canvas.style.height = `${size.y}px`;
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, size.x, size.y);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const entries: HitEntry[] = [];

            for (const cable of cables) {
                const coords = getRenderCoordinates(cable, currentZoom);
                if (!coords || coords.length < 2) continue;

                // Project lat/lng -> layer points.
                const pts = coords.map(c => map.latLngToLayerPoint([c.lat, c.lng]));

                // Smart clipping: shorten endpoint segments that touch a box (CTO/POP) node.
                const radius = 10;
                if (cable.fromNodeId && boxIds.has(cable.fromNodeId) && pts.length >= 2) {
                    const p1 = pts[0];
                    const p2 = pts[1];
                    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                    if (d > radius) {
                        const r = radius / d;
                        pts[0] = L.point(p1.x + (p2.x - p1.x) * r, p1.y + (p2.y - p1.y) * r);
                    }
                }
                if (cable.toNodeId && boxIds.has(cable.toNodeId) && pts.length >= 2) {
                    const p1 = pts[pts.length - 1];
                    const p2 = pts[pts.length - 2];
                    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                    if (d > radius) {
                        const r = radius / d;
                        pts[pts.length - 1] = L.point(p1.x + (p2.x - p1.x) * r, p1.y + (p2.y - p1.y) * r);
                    }
                }

                // Style resolution (preserves prior SVG semantics).
                const isLit = litCableIds.has(cable.id);
                const isHigh = highlightedCableId === cable.id;
                const opticalColor = cableStatusColorMap?.get(cable.id);

                let strokeStyle: string;
                if (isLit) strokeStyle = '#ef4444';
                else if (isHigh) strokeStyle = '#22c55e';
                else if (opticalColor) strokeStyle = opticalColor;
                else if (cable.status === 'NOT_DEPLOYED') strokeStyle = CABLE_STATUS_COLORS['NOT_DEPLOYED'];
                else strokeStyle = cable.color || CABLE_STATUS_COLORS['DEPLOYED'];

                const baseWidth = cable.width || 2.5;
                let lineWidth: number;
                if (isLit) lineWidth = currentZoom < 14 ? 1.5 : Math.max(2, baseWidth);
                else if (isHigh) lineWidth = currentZoom < 14 ? 3 : Math.max(5, baseWidth + 2);
                else if (currentZoom < 12) lineWidth = Math.max(1, baseWidth * 0.4);
                else if (currentZoom < 14) lineWidth = Math.max(1.5, baseWidth * 0.6);
                else if (currentZoom < 16) lineWidth = Math.max(2, baseWidth * 0.8);
                else lineWidth = baseWidth;

                const dashed = currentZoom >= LOD_HIDE_DASHED_ZOOM && cable.status === 'NOT_DEPLOYED';
                const alpha = 1;

                // Build path once — reusado em ambos modos (lit e normal).
                ctx.beginPath();
                ctx.moveTo(pts[0].x - mapTopLeft.x, pts[0].y - mapTopLeft.y);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x - mapTopLeft.x, pts[i].y - mapTopLeft.y);
                }

                if (isLit) {
                    // Renderização "laser": 2 camadas leves — glow vermelho
                    // sutil + linha vermelha fina. shadowBlur dá o esmaecimento
                    // radial e o pulse modula a intensidade do brilho.
                    if (dashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);

                    const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(Date.now() * 0.008));

                    // Glow externo — só o blur, sem engrossar a linha.
                    ctx.globalAlpha = 0.55 * pulse;
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = 8 * pulse + 3;
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();

                    // Linha principal, sem shadow, alpha cheio.
                    ctx.globalAlpha = 1;
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();
                } else {
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = strokeStyle;
                    ctx.lineWidth = lineWidth;
                    if (dashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
                    ctx.stroke();
                }

                // Build hit entry (layer coords; identical frame as cursor latLng projection).
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const a = pts[i];
                    const b = pts[i + 1];
                    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
                    if (a.x < minX) minX = a.x; if (a.y < minY) minY = a.y;
                    if (b.x < minX) minX = b.x; if (b.y < minY) minY = b.y;
                    if (a.x > maxX) maxX = a.x; if (a.y > maxY) maxY = a.y;
                    if (b.x > maxX) maxX = b.x; if (b.y > maxY) maxY = b.y;
                }
                entries.push({
                    minX: minX - HIT_TOLERANCE_PX,
                    minY: minY - HIT_TOLERANCE_PX,
                    maxX: maxX + HIT_TOLERANCE_PX,
                    maxY: maxY + HIT_TOLERANCE_PX,
                    cableId: cable.id,
                    segments,
                });
            }

            ctx.globalAlpha = 1;
            ctx.setLineDash([]);

            const tree = new CableRTree();
            tree.load(entries);
            treeRef.current = tree;
        };

        draw();

        let scheduled = false;
        const onMove = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                draw();
            });
        };

        map.on('moveend', onMove);
        map.on('zoomend', onMove);
        map.on('viewreset', onMove);
        map.on('resize', onMove);

        // Loop de pulse para o VFL: enquanto houver pelo menos um cabo aceso,
        // redesenha modulando o glow via `Date.now()` (sin wave). Throttle pra
        // ~30 fps — pulse é suave, 60 fps gasta CPU à toa. Para sem cabos lit.
        let pulseRafId: number | null = null;
        let lastPulseTime = 0;
        const PULSE_INTERVAL_MS = 1000 / 30; // ~33ms
        const pulseLoop = (now: number) => {
            if (now - lastPulseTime >= PULSE_INTERVAL_MS) {
                lastPulseTime = now;
                draw();
            }
            pulseRafId = requestAnimationFrame(pulseLoop);
        };
        if (litCableIds.size > 0) {
            pulseRafId = requestAnimationFrame(pulseLoop);
        }

        return () => {
            map.off('moveend', onMove);
            map.off('zoomend', onMove);
            map.off('viewreset', onMove);
            map.off('resize', onMove);
            if (pulseRafId !== null) cancelAnimationFrame(pulseRafId);
        };
    }, [map, cables, litCableIds, highlightedCableId, visible, boxIds, cableStatusColorMap]);

    // Hit-test + event delegation (cursor, click, dblclick, contextmenu).
    useEffect(() => {
        if (!visible) return;

        const hitTest = (containerPoint: L.Point): CableData | null => {
            const lp = map.containerPointToLayerPoint(containerPoint);
            const hits = treeRef.current.search({
                minX: lp.x - HIT_TOLERANCE_PX,
                minY: lp.y - HIT_TOLERANCE_PX,
                maxX: lp.x + HIT_TOLERANCE_PX,
                maxY: lp.y + HIT_TOLERANCE_PX,
            });
            if (hits.length === 0) return null;

            let bestId: string | null = null;
            let bestDist = HIT_TOLERANCE_PX;
            for (const h of hits) {
                for (const s of h.segments) {
                    const d = distanceToSegment(lp.x, lp.y, s.x1, s.y1, s.x2, s.y2);
                    if (d < bestDist) {
                        bestDist = d;
                        bestId = h.cableId;
                    }
                }
            }
            return bestId ? cablesByIdRef.current.get(bestId) ?? null : null;
        };

        const container = map.getContainer();

        // When the event target is a Leaflet marker / popup / interactive SVG / tooltip / control,
        // the user is interacting with something ABOVE the cable canvas — let it through.
        // Without this guard, capture-phase interception steals clicks from CTOs, POPs, customers, etc.
        const INTERACTIVE_SELECTORS = '.leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-popup, .leaflet-tooltip, .leaflet-interactive, .leaflet-control';
        const isOnInteractiveElement = (target: EventTarget | null): boolean => {
            if (!target || !(target instanceof Element)) return false;
            return !!target.closest(INTERACTIVE_SELECTORS);
        };

        // Lazy-init reusable tooltip — one instance, opened/closed on hover.
        const ensureTooltip = (): L.Tooltip => {
            if (!hoverTooltipRef.current) {
                hoverTooltipRef.current = L.tooltip({
                    direction: 'top',
                    offset: [0, -8],
                    opacity: 0.95,
                    className: 'cable-hover-tooltip',
                });
            }
            return hoverTooltipRef.current;
        };

        const closeHoverTooltip = () => {
            const tt = hoverTooltipRef.current;
            if (tt && map.hasLayer(tt)) {
                map.removeLayer(tt);
            }
        };

        // Hover: no conflict with other listeners, use map.on for simplicity.
        let rafPending = false;
        const onMouseMove = (e: L.LeafletMouseEvent) => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                // Don't override cursor when hovering a marker/control.
                if (isOnInteractiveElement(e.originalEvent.target)) {
                    if (hoveredCableIdRef.current !== null) {
                        hoveredCableIdRef.current = null;
                        container.style.cursor = '';
                        closeHoverTooltip();
                    }
                    return;
                }
                const cable = hitTest(e.containerPoint);
                const newId = cable?.id ?? null;
                if (newId !== hoveredCableIdRef.current) {
                    hoveredCableIdRef.current = newId;
                    container.style.cursor = newId ? 'pointer' : '';
                    if (!newId) {
                        closeHoverTooltip();
                    }
                }
                if (cable) {
                    const tt = ensureTooltip();
                    tt.setLatLng(e.latlng).setContent(`<span class="font-semibold">${cable.name}</span>`);
                    if (!map.hasLayer(tt)) tt.addTo(map);
                }
            });
        };

        // Click / dblclick / contextmenu: intercept on DOM capture phase so we run
        // BEFORE Leaflet's own handlers (e.g. MapView's useMapEvents({ contextmenu, click })).
        // Without this, the cable's right-click menu would lose to the generic map menu.
        const buildEvent = (e: MouseEvent) => {
            const containerPoint = map.mouseEventToContainerPoint(e);
            const latlng = map.mouseEventToLatLng(e);
            return {
                originalEvent: e,
                latlng,
                target: { getLatLng: () => latlng },
                containerPoint,
            };
        };

        const onClickDom = (e: MouseEvent) => {
            if (isOnInteractiveElement(e.target)) return;
            const containerPoint = map.mouseEventToContainerPoint(e);
            const cable = hitTest(containerPoint);
            if (!cable) return;
            if (!onClickRef.current) return;

            onClickRef.current(buildEvent(e), cable);

            const currentMode = modeRef.current || '';
            const isAddMode = ['add_cto', 'add_pop', 'add_pole', 'add_customer', 'add_poste', 'draw_cable'].includes(currentMode);
            if (currentMode !== 'ruler' && !isAddMode) {
                e.stopImmediatePropagation();
            }
        };

        const onDblClickDom = (e: MouseEvent) => {
            if (isOnInteractiveElement(e.target)) return;
            const containerPoint = map.mouseEventToContainerPoint(e);
            const cable = hitTest(containerPoint);
            if (!cable) return;
            if (!onDoubleClickRef.current) return;

            onDoubleClickRef.current(buildEvent(e), cable);

            // Block Leaflet's doubleClickZoom and any other dblclick consumer.
            e.preventDefault();
            e.stopImmediatePropagation();
        };

        const onContextMenuDom = (e: MouseEvent) => {
            if (isOnInteractiveElement(e.target)) return;
            const containerPoint = map.mouseEventToContainerPoint(e);
            const cable = hitTest(containerPoint);
            if (!cable) return;
            if (!onContextMenuRef.current) return;

            // Must run before Leaflet's contextmenu handler to win over MapView's generic menu.
            e.preventDefault();
            e.stopImmediatePropagation();

            onContextMenuRef.current(buildEvent(e), cable);
        };

        map.on('mousemove', onMouseMove);
        // Use capture=true so we see the event before Leaflet's internal listeners.
        container.addEventListener('click', onClickDom, true);
        container.addEventListener('dblclick', onDblClickDom, true);
        container.addEventListener('contextmenu', onContextMenuDom, true);

        return () => {
            map.off('mousemove', onMouseMove);
            container.removeEventListener('click', onClickDom, true);
            container.removeEventListener('dblclick', onDblClickDom, true);
            container.removeEventListener('contextmenu', onContextMenuDom, true);
            if (hoveredCableIdRef.current !== null) {
                container.style.cursor = '';
                hoveredCableIdRef.current = null;
            }
            closeHoverTooltip();
            hoverTooltipRef.current = null;
        };
    }, [map, visible]);

    return null;
};
