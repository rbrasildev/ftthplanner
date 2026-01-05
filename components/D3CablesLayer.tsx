
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
    onDoubleClick?: (e: any, cable: CableData) => void; // New prop for double click
}

export const D3CablesLayer: React.FC<D3CablesLayerProps> = ({
    cables,
    litCableIds,
    highlightedCableId,
    visible,
    onClick,
    onDoubleClick
}) => {
    const map = useMap();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const gRef = useRef<SVGGElement | null>(null);

    // EFFECT 1: Lifecycle (Create/Destroy SVG)
    useEffect(() => {
        if (!visible) return;

        // --- CUSTOM PANE SETUP ---
        let pane = map.getPane('d3-visual');
        if (!pane) {
            pane = map.createPane('d3-visual');
            pane.style.pointerEvents = 'none'; // Pass events through container
        }
        pane.style.zIndex = '500'; // Raised above default overlay (400)

        // Setup Single SVG
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
            // Cleanup: Remove the entire SVG element ONLY when component unmounts or visibility changes
            if (svgRef.current) {
                d3.select(svgRef.current).remove();
                svgRef.current = null;
                gRef.current = null;
            }
        };
    }, [map, visible]); // Only run on mount/unmount or visibility toggle

    // EFFECT 2: Data & Transform Updates (D3 magic)
    useEffect(() => {
        if (!visible || !svgRef.current || !gRef.current) return;

        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);

        // Project point function
        const projectPoint = function (lat: number, lng: number) {
            const point = map.latLngToLayerPoint(new L.LatLng(lat, lng));
            return point;
        }

        const update = () => {
            if (!cables) { // Allow empty array to clear paths
                g.selectAll('path').remove();
                return;
            }

            const mapSize = map.getSize();
            const mapTopLeft = map.containerPointToLayerPoint([0, 0]);

            const updateSVGTransform = (svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
                svgSelection
                    .style('transform', `translate3d(${mapTopLeft.x}px, ${mapTopLeft.y}px, 0px)`)
                    .attr('width', mapSize.x)
                    .attr('height', mapSize.y);
            };

            updateSVGTransform(svg);

            // Local path generator relative to the SVG 0,0 (map viewport top-left)
            const localPathGenerator = d3.line<any>()
                .x(d => {
                    const layerPoint = projectPoint(d.lat, d.lng);
                    return layerPoint.x - mapTopLeft.x;
                })
                .y(d => {
                    const layerPoint = projectPoint(d.lat, d.lng);
                    return layerPoint.y - mapTopLeft.y;
                })
                .curve(d3.curveLinear);


            // --- VISIBLE PATHS ---
            const paths = g.selectAll<SVGPathElement, CableData>('path.cable-path')
                .data(cables, (d) => d.id);

            paths.exit().remove();

            const pathsEnter = paths.enter().append('path')
                .attr('class', 'cable-path')
                .attr('fill', 'none')
                .attr('stroke-linecap', 'round')
                .attr('pointer-events', 'none'); // Non-interactive visuals

            const pathsMerged = pathsEnter.merge(paths);

            pathsMerged
                .attr('d', d => localPathGenerator(d.coordinates as any))
                .attr('stroke', d => {
                    if (litCableIds.has(d.id)) return '#ef4444';
                    if (highlightedCableId === d.id) return '#22c55e';
                    if (d.status === 'NOT_DEPLOYED') return CABLE_STATUS_COLORS['NOT_DEPLOYED'];
                    return d.color || CABLE_STATUS_COLORS['DEPLOYED'];
                })
                .attr('stroke-width', d => {
                    if (litCableIds.has(d.id)) return 4;
                    if (highlightedCableId === d.id) return 5;
                    return 3;
                })
                .attr('stroke-dasharray', d => {
                    if (d.status === 'NOT_DEPLOYED') return '5, 5';
                    return null;
                })
                .attr('opacity', d => {
                    if (litCableIds.has(d.id)) return 1;
                    return 0.8;
                });

            // --- HIT PATHS (Top of stack) ---
            const hitPaths = g.selectAll<SVGPathElement, CableData>('path.cable-hit')
                .data(cables, (d) => d.id);

            hitPaths.exit().remove();

            const hitPathsEnter = hitPaths.enter().append('path')
                .attr('class', 'cable-hit')
                .attr('fill', 'none')
                .attr('stroke', 'rgba(255, 0, 0, 0)') // Fully transparent
                .attr('stroke-width', 20) // Wide hit area
                .attr('stroke-linecap', 'round')
                .style('pointer-events', 'auto') // Interactable
                .style('cursor', 'pointer')
                .on("mouseover", function () { d3.select(this).style("cursor", "pointer"); });

            hitPathsEnter.merge(hitPaths)
                .attr('d', d => localPathGenerator(d.coordinates as any))
                .on("dblclick", (event, d) => {
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
                    L.DomEvent.stopPropagation(event);
                });
        };

        update();

        // Immediate update on zoomend to prevent "drifting"
        const handleZoomEnd = () => {
            update();
        };

        // We only attach zoom listeners here.
        // NOTE: We don't detach them? We must detach them in cleanup of this effect.
        // Wait, if dependencies change, we detach old and attach new?
        // Actually zoomend handlers depend on 'update', which depends on 'cables' closure.
        // So we MUST re-bind them.
        map.on('zoomend', handleZoomEnd);
        map.on('moveend', handleZoomEnd);

        return () => {
            map.off('zoomend', handleZoomEnd);
            map.off('moveend', handleZoomEnd);
            // DO NOT REMOVE SVG HERE
        };

    }, [map, cables, litCableIds, highlightedCableId, visible, onClick, onDoubleClick]);

    return null;
};
