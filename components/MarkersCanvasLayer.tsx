import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import RBush from 'rbush';
import { CTOData, CTO_STATUS_COLORS } from '../types';

export interface MarkerNode extends CTOData {
    /** Override status color quando o estado de conectividade é conhecido. */
    isOnline?: boolean;
}

interface Props {
    ctos: MarkerNode[];
    /** IDs que NÃO devem ser desenhados aqui — esperam um marker DOM separado
     *  (selecionado, sendo arrastado, ou tipo especial CEO/condo). */
    excludeIds: Set<string>;
    selectedId: string | null;
    litNodeIds: Set<string>;
    /** Visível só quando o layer está ativo (toggle). */
    visible: boolean;
    /** Modo do mapa — afeta clique (draw_cable etc.). */
    mode: string;
    /** Quando true, hover/click são desabilitados — evita interceptar gestos
     *  durante drag/ruler/etc. */
    interactive: boolean;
    onClick: (e: any, ctoId: string) => void;
    onContextMenu: (e: any, ctoId: string) => void;
    onHover: (ctoId: string | null) => void;
}

interface HitEntry {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    ctoId: string;
    cx: number;
    cy: number;
    radius: number;
}

class MarkerRTree extends RBush<HitEntry> {}

const darkenHex = (hex: string, factor = 0.7): string => {
    const h = hex.startsWith('#') ? hex.substring(1, 7) : hex.substring(0, 6);
    const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * factor));
    const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * factor));
    const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * factor));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const HIT_TOL_PX = 4;

/**
 * Pinta CTOs comuns (CircleMarker) num único canvas overlay.
 *
 * Trade vs DOM por marker:
 *  - Sem reflow de DOM em zoom/pan → sem o "bounce" da animação.
 *  - Sem 500 nós SVG/divs → ~10x mais rápido em mapas densos.
 *  - Hit-test via R-tree (rbush), dispatch de eventos via map.on().
 *
 * O que continua em DOM (delegado pro caller):
 *  - Marker selecionado (animação pulse).
 *  - Marker sendo arrastado.
 *  - CEO/Condo (formato customizado).
 */
export const MarkersCanvasLayer: React.FC<Props> = ({
    ctos, excludeIds, selectedId, litNodeIds, visible, mode, interactive,
    onClick, onContextMenu, onHover,
}) => {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const treeRef = useRef<MarkerRTree>(new MarkerRTree());
    const hoveredIdRef = useRef<string | null>(null);

    // Refs estáveis pra callbacks dentro do handler do map.on (que é registrado
    // uma vez por ciclo de vida do layer).
    const onClickRef = useRef(onClick);
    const onContextMenuRef = useRef(onContextMenu);
    const onHoverRef = useRef(onHover);
    const interactiveRef = useRef(interactive);
    const modeRef = useRef(mode);
    useEffect(() => { onClickRef.current = onClick; }, [onClick]);
    useEffect(() => { onContextMenuRef.current = onContextMenu; }, [onContextMenu]);
    useEffect(() => { onHoverRef.current = onHover; }, [onHover]);
    useEffect(() => { interactiveRef.current = interactive; }, [interactive]);
    useEffect(() => { modeRef.current = mode; }, [mode]);

    // Cria <canvas> no pane dedicado.
    useEffect(() => {
        if (!visible) return;
        let pane = map.getPane('markers-canvas');
        if (!pane) pane = map.createPane('markers-canvas');
        // z=590 — abaixo do markerPane (600) pra que markers DOM selecionados
        // fiquem acima dos canvas circles.
        pane.style.zIndex = '590';
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

    // Draw + rebuild hit-test tree.
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
            const radius = Math.round(9 * zoomScale);

            const entries: HitEntry[] = [];

            for (const cto of ctos) {
                if (excludeIds.has(cto.id)) continue;

                const layerPoint = map.latLngToLayerPoint([cto.coordinates.lat, cto.coordinates.lng]);
                const cx = layerPoint.x - mapTopLeft.x;
                const cy = layerPoint.y - mapTopLeft.y;

                // Cull fora do canvas com margem do raio + tol.
                if (cx + radius < -HIT_TOL_PX || cx - radius > size.x + HIT_TOL_PX
                    || cy + radius < -HIT_TOL_PX || cy - radius > size.y + HIT_TOL_PX) continue;

                // Mesma fórmula de cores do CTOMarker (pathOptions).
                let statusColor = CTO_STATUS_COLORS[cto.status as keyof typeof CTO_STATUS_COLORS] || CTO_STATUS_COLORS['PLANNED'];
                if (cto.isOnline === true) statusColor = '#22c55e';
                else if (cto.isOnline === false) statusColor = '#ef4444';
                const fill = statusColor.substring(0, 7);
                const isLit = litNodeIds.has(cto.id);
                const isSelected = selectedId === cto.id;
                const stroke = isLit ? '#f87171' : (isSelected ? '#22c55e' : darkenHex(fill));
                const weight = (isLit || isSelected) ? 3 : 2;

                // Fill circle.
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = fill;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();

                // Stroke border.
                ctx.globalAlpha = 1;
                ctx.strokeStyle = stroke;
                ctx.lineWidth = weight;
                ctx.stroke();

                // Glow pra lit (VFL).
                if (isLit) {
                    ctx.shadowColor = 'rgba(248,113,113,0.7)';
                    ctx.shadowBlur = 6;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';
                }

                entries.push({
                    minX: cx - radius - HIT_TOL_PX,
                    minY: cy - radius - HIT_TOL_PX,
                    maxX: cx + radius + HIT_TOL_PX,
                    maxY: cy + radius + HIT_TOL_PX,
                    ctoId: cto.id,
                    cx, cy, radius,
                });
            }

            ctx.globalAlpha = 1;

            // Rebuild tree (em coordenadas layer-relative ao topLeft do canvas).
            // Como a tree usa as mesmas coordenadas que o mouse vai consultar
            // (via containerPointToLayerPoint - mapTopLeft), o hit-test é direto.
            const tree = new MarkerRTree();
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
    }, [map, ctos, excludeIds, selectedId, litNodeIds, visible]);

    // Hit-test + event delegation no container Leaflet.
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
            // Múltiplos hits (markers sobrepostos): pega o mais próximo do centro.
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
                    bestId = h.ctoId;
                }
            }
            return bestId;
        };

        // Registra o hit-test num Set compartilhado no map pra outros layers
        // (D3CablesLayer) poderem ceder quando o ponto cai sobre QUALQUER
        // marker de canvas (CTOs, poles, etc.). Set permite múltiplos canvas
        // layers coexistirem sem um sobrescrever o outro.
        // `extraPad` deixa o cabo usar uma zona de exclusão maior que o hit-test
        // real do marker — a "área do marker" fica visualmente generosa sem
        // interferir no clique preciso.
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
        // Drag-vs-click detection: a tolerância nativa do browser pra "click"
        // é ~3-5px e ~500ms, muito permissiva — usuário arrastando o mapa de
        // leve dispara click acidental. Limites estritos (8px / 250ms) filtram
        // só interação intencional. Mesmo critério em PolesCanvasLayer.
        const CLICK_MAX_MOVE_PX = 8;
        const CLICK_MAX_DURATION_MS = 250;
        let downPos: { x: number; y: number; t: number } | null = null;

        const onMouseDownEvt = (e: MouseEvent) => {
            if (!interactiveRef.current) return;
            // Só botão esquerdo (0). Right/middle vão pelo contextmenu.
            if (e.button !== 0) return;
            downPos = { x: e.clientX, y: e.clientY, t: Date.now() };
        };
        const onClickEvt = (e: MouseEvent) => {
            if (!interactiveRef.current) return;
            // Filtra drag: se o cursor moveu muito ou demorou demais entre
            // mousedown e mouseup, foi pan/drag — ignora o click.
            if (downPos) {
                const dx = e.clientX - downPos.x;
                const dy = e.clientY - downPos.y;
                const dt = Date.now() - downPos.t;
                downPos = null;
                if (Math.sqrt(dx * dx + dy * dy) > CLICK_MAX_MOVE_PX || dt > CLICK_MAX_DURATION_MS) return;
            }
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
        // Stopa dblclick em cima de marker pra não disparar o doubleClickZoom
        // default do Leaflet.
        const onDblClickEvt = (e: MouseEvent) => {
            if (!interactiveRef.current) return;
            if (hitTest(getContainerPoint(e))) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Capture-phase pra disparar antes do Leaflet ver e iniciar pan.
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseleave', onMouseLeave);
        container.addEventListener('mousedown', onMouseDownEvt, true);
        container.addEventListener('click', onClickEvt, true);
        container.addEventListener('contextmenu', onContextEvt, true);
        container.addEventListener('dblclick', onDblClickEvt, true);

        return () => {
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseleave', onMouseLeave);
            container.removeEventListener('mousedown', onMouseDownEvt, true);
            container.removeEventListener('click', onClickEvt, true);
            container.removeEventListener('contextmenu', onContextEvt, true);
            container.removeEventListener('dblclick', onDblClickEvt, true);
            container.style.cursor = '';
            (map as any)._canvasMarkerHitTests?.delete(hitTest);
        };
    }, [map, visible]);

    return null;
};
