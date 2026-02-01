
import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import * as d3 from 'd3';
import L from 'leaflet';
import { CableData, CABLE_STATUS_COLORS } from '../types';

interface D3CablesLayerProps {
    cables: CableData[];
    litCableIds: Set<string>;
    highlightedCableId: string | null;
    visible: boolean;
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

    // Cache for simplified geometries to avoid re-calculating on every render
    // Key: cableId-zoomLevelOrThreshold
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
    const getRenderCoordinates = (cable: CableData) => {
        const currentZoom = map.getZoom(); // Use direct map zoom for immediate responsiveness

        // Full detail if zoomed in
        if (currentZoom >= LOD_SIMPLIFY_THRESHOLD_ZOOM) {
            return cable.coordinates;
        }

        const cacheKey = `${cable.id}-lowzoom`;
        if (geometryCache.current.has(cacheKey)) {
            return geometryCache.current.get(cacheKey);
        }

        // Simplify: Keep first, last, and every Nth point
        // Heuristic: For very low zoom, skip many more points to reduce CPU/GPU load.
        let step = 1;
        if (currentZoom < 10) step = 15;
        else if (currentZoom < 12) step = 8;
        else if (currentZoom < 14) step = 3;

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
                .x(d => projectPoint(d.lat, d.lng).x - mapTopLeft.x)
                .y(d => projectPoint(d.lat, d.lng).y - mapTopLeft.y)
                .curve(d3.curveLinear); // Linear is faster than basis/cardinal

            // 3. Data Join - Visual Paths
            // We separate Visuals (Stroke) from Interaction (Hit Area) for layering

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
            // Optimize: Split geometry updates from style updates if possible, 
            // but D3 merge chains them. We trust D3 is fast enough for 1000s nodes if attrs are minimal.

            pathsEnter.merge(paths)
                // Geometry - Re-calculate based on LOD
                .attr('d', (d: any) => localPathGenerator(getRenderCoordinates(d) as any))
                // Styling - Dynamic
                .attr('stroke', (d: any) => {
                    if (litCableIds.has(d.id)) return '#ef4444';
                    if (highlightedCableId === d.id) return '#22c55e';
                    if (d.status === 'NOT_DEPLOYED') return CABLE_STATUS_COLORS['NOT_DEPLOYED'];
                    return d.color || CABLE_STATUS_COLORS['DEPLOYED'];
                })
                .attr('stroke-width', (d: any) => {
                    if (litCableIds.has(d.id)) return 4;
                    if (highlightedCableId === d.id) return 5;
                    // Make thinner at lower zooms to reduce clutter
                    return currentZoom < 12 ? 2 : 3;
                })
                .attr('stroke-dasharray', (d: any) => {
                    if (currentZoom < LOD_HIDE_DASHED_ZOOM) return null; // Simplify rendering
                    if (d.status === 'NOT_DEPLOYED') return '5, 5';
                    return null;
                })
                .attr('opacity', (d: any) => {
                    if (litCableIds.has(d.id)) return 1;
                    return 0.8;
                });

            // --- CLEANUP ---
            // Remove any old technical reserve labels that might be orphan (from previous version)
            g.selectAll('text.cable-label:not(.cable-label-group text)').remove();

            // --- LABEL LAYER (Technical Reserve) ---
            const labels = g.selectAll<SVGGElement, CableData>('g.cable-label-group')
                .data(cables.filter(c => (c.technicalReserve || 0) > 0 && (showLabels || c.showReserveLabel)), (d: any) => d.id);

            labels.exit().remove();

            const labelsEnter = labels.enter().append('g')
                .attr('class', 'cable-label-group')
                .style('pointer-events', 'none');

            // Icon background / Outer ring
            labelsEnter.append('circle')
                .attr('r', 9)
                .style('fill', 'white')
                .style('stroke', '#0f172a')
                .style('stroke-width', '1.5px');

            // Middle ring
            labelsEnter.append('circle')
                .attr('r', 6)
                .style('fill', 'none')
                .style('stroke', '#0f172a')
                .style('stroke-width', '1.2px');

            // Inner ring
            labelsEnter.append('circle')
                .attr('r', 3)
                .style('fill', 'none')
                .style('stroke', '#0f172a')
                .style('stroke-width', '1px');

            labelsEnter.append('text')
                .attr('class', 'cable-label')
                .attr('text-anchor', 'start')
                .attr('dominant-baseline', 'middle')
                .attr('dx', 11)
                .style('font-weight', '700')
                .style('font-family', 'Inter, system-ui, sans-serif')
                .style('fill', 'white')
                .style('text-shadow', '0px 1px 3px rgba(0,0,0,0.8), 0px 0px 2px black');

            labelsEnter.merge(labels)
                .attr('transform', (d: any) => {
                    let x = 0, y = 0;
                    if (d.reserveLocation) {
                        const p = projectPoint(d.reserveLocation.lat, d.reserveLocation.lng);
                        x = p.x - mapTopLeft.x;
                        y = p.y - mapTopLeft.y;
                    } else {
                        const coords = getRenderCoordinates(d);
                        if (coords && coords.length >= 2) {
                            const midIndex = Math.floor(coords.length / 2);
                            const p = projectPoint(coords[midIndex].lat, coords[midIndex].lng);
                            x = p.x - mapTopLeft.x;
                            y = p.y - mapTopLeft.y - 8;
                        }
                    }
                    // Use Math.round to prevent sub-pixel rendering jump during zoom
                    return `translate(${Math.round(x)}, ${Math.round(y)})`;
                });

            // Update text separately in the merged selection
            g.selectAll<SVGTextElement, CableData>('g.cable-label-group text')
                .attr('font-size', currentZoom < 14 ? '9px' : '11px')
                .text((d: any) => `RT: ${d.technicalReserve}m`);

            // --- HIT AREA LAYER (Transparent, wider) ---
            const hitPaths = g.selectAll<SVGPathElement, CableData>('path.cable-hit')
                .data(cables, (d: any) => d.id);

            hitPaths.exit().remove();

            const hitPathsEnter = hitPaths.enter().append('path')
                .attr('class', 'cable-hit')
                .attr('fill', 'none')
                .attr('stroke', 'rgba(0,0,0,0)') // Fully transparent
                .attr('stroke-width', Math.max(10, 20 - (18 - currentZoom) * 2)) // Scale hit area with zoom
                .attr('stroke-linecap', 'round')
                .style('pointer-events', 'auto')
                .style('cursor', 'pointer')
                .on("mouseover", function () { d3.select(this).style("cursor", "pointer"); });

            // Attach Events only on Enter (or re-attach if handlers change - which they might via closure)
            // Better to re-attach merge to ensure closure freshness? 
            // Yes, overhead is low for event binding.
            hitPathsEnter.merge(hitPaths)
                .attr('d', (d: any) => localPathGenerator(getRenderCoordinates(d) as any))
                .on("dblclick", (event, d: any) => {
                    if (onDoubleClick) {
                        const latlng = map.mouseEventToLatLng(event);
                        const leafletEvent = { originalEvent: event, latlng: latlng, target: { getLatLng: () => latlng } };
                        onDoubleClick(leafletEvent, d);
                        L.DomEvent.stopPropagation(event);
                    }
                })
                .on("click", (event, d) => {
                    const latlng = map.mouseEventToLatLng(event);
                    const leafletEvent = { originalEvent: event, latlng: latlng, target: { getLatLng: () => latlng } };
                    onClick(leafletEvent, d);
                    if (mode !== 'ruler') L.DomEvent.stopPropagation(event);
                })
                .on("contextmenu", (event, d) => {
                    // Prevent default browser context menu
                    event.preventDefault();
                    if (onContextMenu) {
                        const latlng = map.mouseEventToLatLng(event);
                        const leafletEvent = {
                            originalEvent: event,
                            latlng: latlng,
                            target: { getLatLng: () => latlng },
                            // Add raw mouse coordinates for menu positioning
                            containerPoint: map.mouseEventToContainerPoint(event)
                        };
                        onContextMenu(leafletEvent, d);
                        if (mode !== 'ruler') L.DomEvent.stopPropagation(event);
                    }
                });
        };

        // Initial Draw
        update();

        // Handle Map Moves (Zoom/Pan)
        // Optimization: Use 'viewreset' for hard resets, 'move' for pans
        // D3 with Leaflet usually requires full re-project on zoom. Pan could be transform-only if SVGs were massive content,
        // but here we project relative to top-left.
        const handleUpdate = () => {
            update();
        };

        map.on('zoomend', handleUpdate);
        map.on('moveend', handleUpdate);
        // 'viewreset' is sometimes needed for older Leaflet or specific transitions
        map.on('viewreset', handleUpdate);

        return () => {
            map.off('zoomend', handleUpdate);
            map.off('moveend', handleUpdate);
            map.off('viewreset', handleUpdate);
        };

    }, [map, cables, litCableIds, highlightedCableId, visible, onClick, onDoubleClick, mode, showLabels, userRole]);

    return null;
};
