import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import * as d3 from 'd3';
import L from 'leaflet';
import { CableData } from '../../types';

interface D3ParentCablesLayerProps {
    cables: CableData[];
    visible: boolean;
    onCableClick?: (e: any) => void;
}

export const D3ParentCablesLayer: React.FC<D3ParentCablesLayerProps> = ({
    cables,
    visible,
    onCableClick
}) => {
    const map = useMap();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const gRef = useRef<SVGGElement | null>(null);
    const onCableClickRef = useRef(onCableClick);
    useEffect(() => { onCableClickRef.current = onCableClick; }, [onCableClick]);

    // Create/Destroy SVG
    useEffect(() => {
        if (!visible) return;

        let pane = map.getPane('d3-parent-cables');
        if (!pane) {
            pane = map.createPane('d3-parent-cables');
            pane.style.pointerEvents = 'none';
        }
        pane.style.zIndex = '450';

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

    // Render & Update
    useEffect(() => {
        if (!visible || !svgRef.current || !gRef.current) return;

        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);

        const projectPoint = (lat: number, lng: number) => {
            return map.latLngToLayerPoint(new L.LatLng(lat, lng));
        };

        const update = () => {
            if (!cables || cables.length === 0) {
                g.selectAll('path').remove();
                return;
            }

            const currentZoom = map.getZoom();

            // Update SVG Dimensions & Position
            const mapSize = map.getSize();
            const mapTopLeft = map.containerPointToLayerPoint([0, 0]);

            svg
                .style('transform', `translate3d(${mapTopLeft.x}px, ${mapTopLeft.y}px, 0px)`)
                .attr('width', mapSize.x)
                .attr('height', mapSize.y);

            const localPathGenerator = d3.line<any>()
                .x(d => d.x - mapTopLeft.x)
                .y(d => d.y - mapTopLeft.y)
                .curve(d3.curveLinear);

            const getProjectedPoints = (d: CableData) => {
                const coords = d.coordinates;
                if (!coords || coords.length < 2) return null;
                return coords.map(c => projectPoint(c.lat, c.lng));
            };

            // Visual paths
            const paths = g.selectAll<SVGPathElement, CableData>('path.parent-cable-path')
                .data(cables, (d: any) => d.id);

            paths.exit().remove();

            const pathsEnter = paths.enter().append('path')
                .attr('class', 'parent-cable-path')
                .attr('fill', 'none')
                .attr('stroke-linecap', 'round')
                .attr('pointer-events', 'none');

            pathsEnter.merge(paths)
                .attr('d', (d: CableData) => {
                    const points = getProjectedPoints(d);
                    return points ? localPathGenerator(points) : null;
                })
                .attr('stroke', (d: any) => d.color || '#0ea5e9')
                .attr('stroke-width', (d: any) => {
                    const baseWidth = d.width || 4;
                    if (currentZoom < 12) return Math.max(1, baseWidth * 0.4);
                    if (currentZoom < 14) return Math.max(1.5, baseWidth * 0.6);
                    if (currentZoom < 16) return Math.max(2, baseWidth * 0.8);
                    return baseWidth;
                })
                .attr('stroke-dasharray', (d: any) => {
                    if (d.status === 'NOT_DEPLOYED') return '5, 5';
                    return null;
                })
                .attr('opacity', 0.8);

            // Hit area paths (for click detection)
            const hitPaths = g.selectAll<SVGPathElement, CableData>('path.parent-cable-hit')
                .data(cables, (d: any) => d.id);

            hitPaths.exit().remove();

            const hitPathsEnter = hitPaths.enter().append('path')
                .attr('class', 'parent-cable-hit')
                .attr('fill', 'none')
                .attr('stroke', 'rgba(0,0,0,0)')
                .attr('stroke-linecap', 'round')
                .style('pointer-events', 'auto')
                .style('cursor', 'pointer')
                .on("click", (event) => {
                    event.stopPropagation();
                    if (onCableClickRef.current) {
                        const latlng = map.mouseEventToLatLng(event);
                        const leafletEvent = { originalEvent: event, latlng };
                        onCableClickRef.current(leafletEvent);
                    }
                });

            hitPathsEnter.merge(hitPaths)
                .attr('d', (d: CableData) => {
                    const points = getProjectedPoints(d);
                    return points ? localPathGenerator(points) : null;
                })
                .attr('stroke-width', Math.max(10, 20 - (18 - currentZoom) * 2));
        };

        update();

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
    }, [map, cables, visible]);

    return null;
};
