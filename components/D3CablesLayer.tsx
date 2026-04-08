
import React, { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import * as d3 from 'd3';
import L from 'leaflet';
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
}

// LOD Thresholds
const LOD_SIMPLIFY_THRESHOLD_ZOOM = 14; // Below this zoom, simplify geometry
const LOD_HIDE_DASHED_ZOOM = 12; // Below this zoom, simplify styling (no dashes)

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
    showLabels,
    userRole
}) => {
    const map = useMap();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const gRef = useRef<SVGGElement | null>(null);

    // Stable refs for callbacks to avoid re-running the main useEffect on callback changes
    const onClickRef = useRef(onClick);
    const onDoubleClickRef = useRef(onDoubleClick);
    const onContextMenuRef = useRef(onContextMenu);
    const modeRef = useRef(mode);
    useEffect(() => { onClickRef.current = onClick; }, [onClick]);
    useEffect(() => { onDoubleClickRef.current = onDoubleClick; }, [onDoubleClick]);
    useEffect(() => { onContextMenuRef.current = onContextMenu; }, [onContextMenu]);
    useEffect(() => { modeRef.current = mode; }, [mode]);

    // Cache for simplified geometries to avoid re-calculating on every render
    // Key: cableId-zoomBucket
    const geometryCache = useRef<Map<string, any[]>>(new Map());

    // Effect: Lifecycle (Create/Destroy SVG)
    useEffect(() => {
        if (!visible) return;

        let pane = map.getPane('d3-visual');
        if (!pane) {
            pane = map.createPane('d3-visual');
            pane.style.pointerEvents = 'none';
        }
        pane.style.zIndex = '500';

        if (!svgRef.current) {
            const svg = d3.select(pane).append("svg").attr("class", "leaflet-zoom-hide");
            svg.style("pointer-events", "none");
            svg.style("position", "absolute");
            svg.style("top", "0");
            svg.style("left", "0");

            svgRef.current = svg.node();
            gRef.current = svg.append("g").attr("class", "leaflet-zoom-hide").node();
        }

        return () => {
            if (svgRef.current) {
                d3.select(svgRef.current).remove();
                svgRef.current = null;
                gRef.current = null;
            }
        };
    }, [map, visible]);

    // Helper: Geometry Simplification (Simple Point Reduction)
    const getRenderCoordinates = (cable: CableData, currentZoom: number) => {
        // Full detail if zoomed in
        if (currentZoom >= LOD_SIMPLIFY_THRESHOLD_ZOOM) {
            return cable.coordinates;
        }

        // Bucket zoom into step ranges so cache doesn't thrash
        let step = 1;
        if (currentZoom < 10) step = 15;
        else if (currentZoom < 12) step = 8;
        else if (currentZoom < 14) step = 3;

        const cacheKey = `${cable.id}-step${step}`;
        if (geometryCache.current.has(cacheKey)) {
            return geometryCache.current.get(cacheKey);
        }

        const coords = cable.coordinates;
        if (coords.length <= 2 || step === 1) return coords;

        const simplified = [coords[0]];
        for (let i = 1; i < coords.length - 1; i += step) {
            simplified.push(coords[i]);
        }
        simplified.push(coords[coords.length - 1]);

        geometryCache.current.set(cacheKey, simplified);
        return simplified;
    };


    // Effect: Render & Update
    useEffect(() => {
        if (!visible || !svgRef.current || !gRef.current) return;

        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);

        const projectPoint = function (lat: number, lng: number) {
            return map.latLngToLayerPoint(new L.LatLng(lat, lng));
        }

        const update = () => {
            if (!cables) {
                g.selectAll('path').remove();
                return;
            }

            const currentZoom = map.getZoom();

            // 1. Update SVG Dimensions & Position
            const mapSize = map.getSize();
            const mapTopLeft = map.containerPointToLayerPoint([0, 0]);

            svg
                .style('transform', `translate3d(${mapTopLeft.x}px, ${mapTopLeft.y}px, 0px)`)
                .attr('width', mapSize.x)
                .attr('height', mapSize.y);

            // 2. Path Generator
            const localPathGenerator = d3.line<any>()
                .x(d => d.x - mapTopLeft.x)
                .y(d => d.y - mapTopLeft.y)
                .curve(d3.curveLinear); // Linear is faster than basis/cardinal

            // Helper to get projected points with clipping
            const getProjectedPoints = (d: CableData) => {
                const coords = getRenderCoordinates(d, currentZoom);
                if (!coords || coords.length < 2) return null;

                let points = coords.map(c => projectPoint(c.lat, c.lng));

                // Smart Clipping: Shorten line slightly if connected to a Box (CTO/POP)
                const radius = 10; // Box radius in px

                // Start point clipping
                if (d.fromNodeId && boxIds.has(d.fromNodeId)) {
                    const p1 = points[0];
                    const p2 = points[1];
                    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                    if (dist > radius) {
                        const ratio = radius / dist;
                        points[0] = {
                            x: p1.x + (p2.x - p1.x) * ratio,
                            y: p1.y + (p2.y - p1.y) * ratio
                        } as any;
                    }
                }

                // End point clipping
                if (d.toNodeId && boxIds.has(d.toNodeId)) {
                    const p1 = points[points.length - 1];
                    const p2 = points[points.length - 2];
                    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                    if (dist > radius) {
                        const ratio = radius / dist;
                        points[points.length - 1] = {
                            x: p1.x + (p2.x - p1.x) * ratio,
                            y: p1.y + (p2.y - p1.y) * ratio
                        } as any;
                    }
                }

                return points;
            };

            // 3. Data Join - Visual Paths

            // --- VISUAL LAYER ---
            const paths = g.selectAll<SVGPathElement, CableData>('path.cable-path')
                .data(cables, (d: any) => d.id);

            // EXIT
            paths.exit().remove();

            // ENTER
            const pathsEnter = paths.enter().append('path')
                .attr('class', 'cable-path')
                .attr('fill', 'none')
                .attr('stroke-linecap', 'round')
                .attr('pointer-events', 'none');

            // UPDATE + ENTER (Merge)
            pathsEnter.merge(paths)
                .attr('d', (d: CableData) => {
                    const points = getProjectedPoints(d);
                    return points ? localPathGenerator(points) : null;
                })
                .attr('stroke', (d: any) => {
                    if (litCableIds.has(d.id)) return '#ef4444';
                    if (highlightedCableId === d.id) return '#22c55e';
                    if (d.status === 'NOT_DEPLOYED') return CABLE_STATUS_COLORS['NOT_DEPLOYED'];
                    return d.color || CABLE_STATUS_COLORS['DEPLOYED'];
                })
                .attr('stroke-width', (d: any) => {
                    const isLit = litCableIds.has(d.id);
                    const isHigh = highlightedCableId === d.id;
                    const baseWidth = d.width || 2.5;

                    if (isLit) return currentZoom < 14 ? 2.5 : Math.max(4, baseWidth + 1);
                    if (isHigh) return currentZoom < 14 ? 3 : Math.max(5, baseWidth + 2);

                    if (currentZoom < 12) return Math.max(1, baseWidth * 0.4);
                    if (currentZoom < 14) return Math.max(1.5, baseWidth * 0.6);
                    if (currentZoom < 16) return Math.max(2, baseWidth * 0.8);
                    return baseWidth;
                })
                .attr('stroke-dasharray', (d: any) => {
                    if (currentZoom < LOD_HIDE_DASHED_ZOOM) return null;
                    if (d.status === 'NOT_DEPLOYED') return '5, 5';
                    return null;
                })
                .attr('opacity', (d: any) => {
                    if (litCableIds.has(d.id)) return 1;
                    return 0.8;
                });

            // --- HIT AREA LAYER (Transparent, wider) ---
            const hitPaths = g.selectAll<SVGPathElement, CableData>('path.cable-hit')
                .data(cables, (d: any) => d.id);

            hitPaths.exit().remove();

            // ENTER: Create new hit paths with event handlers (bound via refs for stability)
            const hitPathsEnter = hitPaths.enter().append('path')
                .attr('class', 'cable-hit')
                .attr('fill', 'none')
                .attr('stroke', 'rgba(0,0,0,0)')
                .attr('stroke-linecap', 'round')
                .style('pointer-events', 'auto')
                .style('cursor', 'pointer')
                .on("dblclick", (event, d: any) => {
                    if (onDoubleClickRef.current) {
                        const latlng = map.mouseEventToLatLng(event);
                        const leafletEvent = { originalEvent: event, latlng: latlng, target: { getLatLng: () => latlng } };
                        onDoubleClickRef.current(leafletEvent, d);
                        L.DomEvent.stopPropagation(event);
                    }
                })
                .on("click", (event, d) => {
                    const latlng = map.mouseEventToLatLng(event);
                    const leafletEvent = { originalEvent: event, latlng: latlng, target: { getLatLng: () => latlng } };
                    onClickRef.current(leafletEvent, d);

                    const currentMode = modeRef.current || '';
                    const isAddMode = ['add_cto', 'add_pop', 'add_pole', 'add_customer', 'add_poste', 'draw_cable'].includes(currentMode);
                    if (currentMode !== 'ruler' && !isAddMode) L.DomEvent.stopPropagation(event);
                })
                .on("contextmenu", (event, d) => {
                    event.preventDefault();
                    if (onContextMenuRef.current) {
                        const latlng = map.mouseEventToLatLng(event);
                        const leafletEvent = {
                            originalEvent: event,
                            latlng: latlng,
                            target: { getLatLng: () => latlng },
                            containerPoint: map.mouseEventToContainerPoint(event)
                        };
                        onContextMenuRef.current(leafletEvent, d);
                        if (modeRef.current !== 'ruler') L.DomEvent.stopPropagation(event);
                    }
                });

            // UPDATE only: geometry + hit area width (no re-binding events)
            hitPathsEnter.merge(hitPaths)
                .attr('d', (d: CableData) => {
                    const points = getProjectedPoints(d);
                    return points ? localPathGenerator(points) : null;
                })
                .attr('stroke-width', Math.max(10, 20 - (18 - currentZoom) * 2));
        };

        // Initial Draw
        update();

        // Deduplicated map event: moveend fires after both pan and zoom
        // Use a single listener to avoid double-work
        let updateScheduled = false;
        const handleUpdate = () => {
            if (updateScheduled) return;
            updateScheduled = true;
            requestAnimationFrame(() => {
                updateScheduled = false;
                update();
            });
        };

        map.on('moveend', handleUpdate);
        map.on('viewreset', handleUpdate);

        return () => {
            map.off('moveend', handleUpdate);
            map.off('viewreset', handleUpdate);
        };

    }, [map, cables, litCableIds, highlightedCableId, visible, boxIds, showLabels, userRole]);

    return null;
};
