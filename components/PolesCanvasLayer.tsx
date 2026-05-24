import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import RBush from 'rbush';
import { PoleData, PoleApprovalStatus, PoleSituation, POLE_APPROVAL_COLORS, POLE_SITUATION_COLORS } from '../types';

export interface PoleNode extends PoleData {}

interface Props {
    poles: PoleNode[];
    /** IDs que NÃO devem ser desenhados aqui — esperam marker DOM (selecionado,
     *  arrastando, modo drag). */
    excludeIds: Set<string>;
    selectedId: string | null;
    visible: boolean;
    mode: string;
    /** Desliga hover/click — usado durante drag/ruler. */
    interactive: boolean;
    onClick: (e: any, poleId: string) => void;
    onContextMenu: (e: any, poleId: string) => void;
    onHover: (poleId: string | null) => void;
}

interface HitEntry {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    poleId: string;
    cx: number;
    cy: number;
    radius: number;
}

class PoleRTree extends RBush<HitEntry> {}

const HIT_TOL_PX = 4;
const POLE_BASE_SIZE = 9;

const getApprovalColor = (approvalStatus?: PoleApprovalStatus, situation?: PoleSituation): string => {
    if (situation === 'NEW') return POLE_SITUATION_COLORS.NEW;
    if (approvalStatus && POLE_APPROVAL_COLORS[approvalStatus]) return POLE_APPROVAL_COLORS[approvalStatus];
    return '#6b7280';
};

/**
 * Mesma ideia do MarkersCanvasLayer, porém pra postes: pinta num canvas único
 * com hit-test por R-tree. Visual idêntico ao PoleMarker (corpo wood/concrete
 * + borda de status). Selecionado/dragging continuam em DOM pra preservar
 * animação/handles do Leaflet.
 */
export const PolesCanvasLayer: React.FC<Props> = ({
    poles, excludeIds, selectedId, visible, mode, interactive,
    onClick, onContextMenu, onHover,
}) => {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const treeRef = useRef<PoleRTree>(new PoleRTree());
    const hoveredIdRef = useRef<string | null>(null);

    const onClickRef = useRef(onClick);
    const onContextMenuRef = useRef(onContextMenu);
    const onHoverRef = useRef(onHover);
    const interactiveRef = useRef(interactive);
    useEffect(() => { onClickRef.current = onClick; }, [onClick]);
    useEffect(() => { onContextMenuRef.current = onContextMenu; }, [onContextMenu]);
    useEffect(() => { onHoverRef.current = onHover; }, [onHover]);
    useEffect(() => { interactiveRef.current = interactive; }, [interactive]);

    useEffect(() => {
        if (!visible) return;
        let pane = map.getPane('poles-canvas');
        if (!pane) pane = map.createPane('poles-canvas');
        // z=585 — abaixo do markers-canvas (590) pra postes ficarem debaixo
        // de CTOs/POPs em sobreposição rara, mantendo a hierarquia visual.
        pane.style.zIndex = '585';
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

    useEffect(() => {
        if (!visible || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            const size = map.getSize();
            const mapTopLeft = map.containerPointToLayerPoint([0, 0]);
            const dpr = window.devicePixelRatio || 1;
            const currentZoom = map.getZoom();

            L.DomUtil.setPosition(canvas, mapTopLeft);

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

            const zoomScale = Math.pow(1.15, Math.max(0, Math.floor(currentZoom) - 16));
            const poleSize = Math.round(POLE_BASE_SIZE * zoomScale);
            const radius = poleSize / 2;
            const borderW = Math.max(1, 1.2 * zoomScale);
            // Canvas stroke é CENTRADO no path (metade dentro, metade fora).
            // DOM PoleMarker usa border-box (Tailwind preflight) — borda dentro
            // do width. Pra bater o tamanho visível total = poleSize, o body
            // precisa ser desenhado com raio = (poleSize - borderW) / 2 e a
            // borda traçada nele (extent externo = poleSize / 2).
            const bodyRadius = Math.max(0.5, (poleSize - borderW) / 2);

            const entries: HitEntry[] = [];

            for (const pole of poles) {
                if (excludeIds.has(pole.id)) continue;

                const layerPoint = map.latLngToLayerPoint([pole.coordinates.lat, pole.coordinates.lng]);
                const cx = layerPoint.x - mapTopLeft.x;
                const cy = layerPoint.y - mapTopLeft.y;

                if (cx + radius < -HIT_TOL_PX || cx - radius > size.x + HIT_TOL_PX
                    || cy + radius < -HIT_TOL_PX || cy - radius > size.y + HIT_TOL_PX) continue;

                // Mesma fórmula visual do PoleMarker.
                const bodyColor = pole.type === 'wood' ? '#78350f' : '#57534e';
                const isSelected = selectedId === pole.id;
                const borderColor = isSelected ? '#f59e0b' : getApprovalColor(pole.approvalStatus, pole.situation);

                // Sombra leve simulando box-shadow do divIcon.
                ctx.shadowColor = 'rgba(0,0,0,0.4)';
                ctx.shadowBlur = 2;
                ctx.shadowOffsetY = 1;
                ctx.fillStyle = bodyColor;
                ctx.beginPath();
                ctx.arc(cx, cy, bodyRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;

                ctx.strokeStyle = borderColor;
                ctx.lineWidth = borderW;
                ctx.stroke();

                entries.push({
                    minX: cx - radius - HIT_TOL_PX,
                    minY: cy - radius - HIT_TOL_PX,
                    maxX: cx + radius + HIT_TOL_PX,
                    maxY: cy + radius + HIT_TOL_PX,
                    poleId: pole.id,
                    cx, cy, radius,
                });
            }

            const tree = new PoleRTree();
            tree.load(entries);
            treeRef.current = tree;
        };

        draw();

        let scheduled = false;
        const onMove = () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => { scheduled = false; draw(); });
        };

        map.on('moveend', onMove);
        map.on('zoomend', onMove);
        map.on('viewreset', onMove);
        map.on('resize', onMove);

        return () => {
            map.off('moveend', onMove);
            map.off('zoomend', onMove);
            map.off('viewreset', onMove);
            map.off('resize', onMove);
        };
    }, [map, poles, excludeIds, selectedId, visible]);

    useEffect(() => {
        if (!visible) return;

        const container = map.getContainer();

        const hitTest = (containerPoint: L.Point, extraPad = 0): string | null => {
            const lp = map.containerPointToLayerPoint(containerPoint);
            const mapTopLeft = map.containerPointToLayerPoint([0, 0]);
            const x = lp.x - mapTopLeft.x;
            const y = lp.y - mapTopLeft.y;
            const pad = HIT_TOL_PX + extraPad;
            const hits = treeRef.current.search({
                minX: x - pad, minY: y - pad,
                maxX: x + pad, maxY: y + pad,
            });
            if (hits.length === 0) return null;
            let bestId: string | null = null;
            let bestDistSq = Infinity;
            for (const h of hits) {
                const dx = x - h.cx;
                const dy = y - h.cy;
                const d = dx * dx + dy * dy;
                const r = h.radius + pad;
                const inside = d <= r * r;
                if (inside && d < bestDistSq) {
                    bestDistSq = d;
                    bestId = h.poleId;
                }
            }
            return bestId;
        };

        // Registra no Set compartilhado pra D3CablesLayer ceder o evento.
        const reg: Set<(p: L.Point, pad?: number) => string | null> =
            (map as any)._canvasMarkerHitTests || ((map as any)._canvasMarkerHitTests = new Set());
        reg.add(hitTest);

        const getContainerPoint = (e: MouseEvent): L.Point => {
            const rect = container.getBoundingClientRect();
            return L.point(e.clientX - rect.left, e.clientY - rect.top);
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!interactiveRef.current) return;
            const id = hitTest(getContainerPoint(e));
            if (id !== hoveredIdRef.current) {
                hoveredIdRef.current = id;
                onHoverRef.current(id);
                container.style.cursor = id ? 'pointer' : '';
            }
        };
        const onMouseLeave = () => {
            if (hoveredIdRef.current) {
                hoveredIdRef.current = null;
                onHoverRef.current(null);
                container.style.cursor = '';
            }
        };
        const onClickEvt = (e: MouseEvent) => {
            if (!interactiveRef.current) return;
            const id = hitTest(getContainerPoint(e));
            if (id) {
                e.preventDefault();
                e.stopPropagation();
                onClickRef.current(e, id);
            }
        };
        const onContextEvt = (e: MouseEvent) => {
            if (!interactiveRef.current) return;
            const id = hitTest(getContainerPoint(e));
            if (id) {
                e.preventDefault();
                e.stopPropagation();
                onContextMenuRef.current(e, id);
            }
        };
        // Barra dblclick em cima de marker pra não disparar doubleClickZoom.
        const onDblClickEvt = (e: MouseEvent) => {
            if (!interactiveRef.current) return;
            if (hitTest(getContainerPoint(e))) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseleave', onMouseLeave);
        container.addEventListener('click', onClickEvt, true);
        container.addEventListener('contextmenu', onContextEvt, true);
        container.addEventListener('dblclick', onDblClickEvt, true);

        return () => {
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseleave', onMouseLeave);
            container.removeEventListener('click', onClickEvt, true);
            container.removeEventListener('contextmenu', onContextEvt, true);
            container.removeEventListener('dblclick', onDblClickEvt, true);
            container.style.cursor = '';
            (map as any)._canvasMarkerHitTests?.delete(hitTest);
        };
    }, [map, visible]);

    return null;
};
