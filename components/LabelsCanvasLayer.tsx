import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export interface LabelNode {
    id: string;
    name: string;
    lat: number;
    lng: number;
    /** Posição prioritária — mostra antes dos demais e pinta destacado. */
    isSelected?: boolean;
    /** Acentua (cor de destaque) sem prioridade absoluta. */
    isLit?: boolean;
    /** Sempre desenhado, mesmo quando zoom < minZoom. Pintado em destaque. */
    isHovered?: boolean;
    /** Raio do marker em px no zoom atual — usado pra calcular offset vertical do label. */
    markerRadius?: number;
}

interface Props {
    nodes: LabelNode[];
    visible: boolean;
    /** Zoom mínimo pra mostrar a leva COMPLETA de labels. Nós marcados como
     *  `isHovered` ignoram esse gate (hover sempre mostra o label). */
    minZoom?: number;
}

/**
 * Renderiza labels de CTOs/POPs num canvas overlay com colisão.
 *
 * Por que canvas em vez de Leaflet `Tooltip permanent`?
 *  - Tooltip do Leaflet é um DOM por marker → 500+ tooltips = 500+ divs absolutos
 *    reposicionados a cada pan/zoom. Lento e sem collision detection (labels
 *    se sobrepõem; visualmente "somem").
 *  - Canvas pinta TUDO num único pass; colisão por R-tree-like é trivial.
 *    Skip de labels colidentes em vez de empilhar.
 *
 * Prioridade de placement (primeiro que cabe vence):
 *  1. Selecionado
 *  2. Lit (VFL ativo)
 *  3. Alfabético
 */
export const LabelsCanvasLayer: React.FC<Props> = ({ nodes, visible, minZoom = 14 }) => {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const nodesRef = useRef<LabelNode[]>(nodes);
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);

    // Lifecycle: cria <canvas> no pane dedicado, acima dos markers (z=650),
    // não-interativo (pointer-events: none) — markers continuam clicáveis.
    useEffect(() => {
        if (!visible) return;

        let pane = map.getPane('labels-canvas');
        if (!pane) {
            pane = map.createPane('labels-canvas');
        }
        // Acima do markerPane (default 600); abaixo do tooltipPane (700) pra
        // tooltips de hover ainda renderizarem sobre o canvas.
        pane.style.zIndex = '650';
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

    // Draw effect: redraw on map move/zoom or quando `nodes` muda.
    useEffect(() => {
        if (!visible || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const roundRect = (
            c: CanvasRenderingContext2D,
            x: number, y: number, w: number, h: number, r: number,
        ) => {
            c.beginPath();
            c.moveTo(x + r, y);
            c.lineTo(x + w - r, y);
            c.quadraticCurveTo(x + w, y, x + w, y + r);
            c.lineTo(x + w, y + h - r);
            c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            c.lineTo(x + r, y + h);
            c.quadraticCurveTo(x, y + h, x, y + h - r);
            c.lineTo(x, y + r);
            c.quadraticCurveTo(x, y, x + r, y);
            c.closePath();
        };

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

            // Em zoom baixo: só desenha os marcados como hovered ou selected.
            // Selected vem da busca/clique e deve aparecer sempre, igual hover.
            const belowMinZoom = currentZoom < minZoom;

            // Style escala com zoom.
            const fontSize = currentZoom >= 17 ? 11 : currentZoom >= 16 ? 10 : 9;
            ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
            ctx.textBaseline = 'middle';
            const padX = 5;
            const padY = 2;
            const boxH = fontSize + padY * 2 + 2;
            // Gap entre marker e label. Usa markerRadius se disponível.
            const labelGap = 4;

            // Ordenação por prioridade — hovered > selected > lit > alfabético.
            // Hovered e selected ficam no topo pra nunca ser ocultados por colisão.
            const sourceNodes = belowMinZoom
                ? nodesRef.current.filter(n => n.isHovered || n.isSelected)
                : nodesRef.current;
            const sorted = [...sourceNodes].sort((a, b) => {
                if (!!a.isHovered !== !!b.isHovered) return a.isHovered ? -1 : 1;
                if (!!a.isSelected !== !!b.isSelected) return a.isSelected ? -1 : 1;
                if (!!a.isLit !== !!b.isLit) return a.isLit ? -1 : 1;
                return (a.name || '').localeCompare(b.name || '');
            });

            const bounds = map.getBounds();
            const placed: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];
            // Margem extra entre labels — evita "encostar". 2 px de cada lado.
            const COLLISION_PAD = 2;

            for (const n of sorted) {
                if (!bounds.contains([n.lat, n.lng])) continue;
                const text = n.name || '';
                if (!text) continue;
                const layerPoint = map.latLngToLayerPoint([n.lat, n.lng]);
                const cx = layerPoint.x - mapTopLeft.x;
                const cy = layerPoint.y - mapTopLeft.y;

                const textW = ctx.measureText(text).width;
                const boxW = textW + padX * 2;
                const offsetY = (n.markerRadius || 10) + labelGap + boxH / 2;
                const boxX = Math.round(cx - boxW / 2);
                const boxY = Math.round(cy - offsetY - boxH / 2);

                // Skip fora do canvas (com pequena margem pra labels parciais).
                if (boxX + boxW < -20 || boxX > size.x + 20 || boxY + boxH < -20 || boxY > size.y + 20) continue;

                const bbox = {
                    minX: boxX - COLLISION_PAD,
                    minY: boxY - COLLISION_PAD,
                    maxX: boxX + boxW + COLLISION_PAD,
                    maxY: boxY + boxH + COLLISION_PAD,
                };

                // Colisão O(N²) com early-out. Pra N=200, ~20k checks por draw,
                // ainda OK. Se virar gargalo, troca por RBush.
                let collides = false;
                for (let i = 0; i < placed.length; i++) {
                    const p = placed[i];
                    if (!(bbox.minX > p.maxX || bbox.maxX < p.minX || bbox.minY > p.maxY || bbox.maxY < p.minY)) {
                        collides = true;
                        break;
                    }
                }
                if (collides) continue;

                // Estilo: VFL ativo (`isLit`) usa emerald cheio — comunica estado
                // do sistema (luz no cabo). Hover/selected NÃO mudam a cor pra
                // não criar inconsistência com a leva normal — só garantem que
                // o label apareça. Demais ficam neutros (branco semi-opaco).
                if (n.isLit) {
                    ctx.fillStyle = '#10b981';
                    ctx.strokeStyle = '#059669';
                } else {
                    ctx.fillStyle = 'rgba(255,255,255,0.92)';
                    ctx.strokeStyle = 'rgba(15,23,42,0.18)';
                }
                ctx.lineWidth = 1;
                roundRect(ctx, boxX, boxY, boxW, boxH, 4);
                // Sombra sutil pra legibilidade sobre tiles claros.
                ctx.shadowColor = 'rgba(0,0,0,0.15)';
                ctx.shadowBlur = 2;
                ctx.shadowOffsetY = 1;
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                ctx.stroke();

                ctx.fillStyle = n.isLit ? '#ffffff' : '#0f172a';
                ctx.fillText(text, boxX + padX, boxY + boxH / 2);

                placed.push(bbox);
            }
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
    }, [map, nodes, visible, minZoom]);

    return null;
};
