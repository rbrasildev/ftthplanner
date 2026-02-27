import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates } from '../../types';

// Icon Cache to prevent re-creation and improve performance
const iconCache = new Map<string, L.DivIcon>();

const createReserveIcon = (reserveValue: number, currentZoom: number) => {
    const fontSize = currentZoom < 14 ? '9px' : '11px';
    const cacheKey = `reserve-${reserveValue}-${fontSize}`;

    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey)!;
    }

    const icon = L.divIcon({
        className: 'technical-reserve-icon',
        html: `
            <div style="position: relative; display: flex; align-items: center;">
                <div style="
                    position: relative;
                    width: 18px;
                    height: 18px;
                    background: white;
                    border: 1.5px solid #0f172a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-sizing: border-box;
                ">
                    <div style="
                        width: 12px;
                        height: 12px;
                        border: 1.2px solid #0f172a;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        box-sizing: border-box;
                    ">
                        <div style="
                            width: 6px;
                            height: 6px;
                            border: 1px solid #0f172a;
                            border-radius: 50%;
                            flex-shrink: 0;
                            box-sizing: border-box;
                        "></div>
                    </div>
                </div>
                <div style="
                    margin-left: 6px;
                    font-weight: 700;
                    font-family: Inter, system-ui, sans-serif;
                    color: white;
                    font-size: ${fontSize};
                    text-shadow: 0px 1px 3px rgba(0,0,0,0.8), 0px 0px 2px black;
                    white-space: nowrap;
                    pointer-events: none;
                ">
                    RT: ${reserveValue}m
                </div>
            </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    iconCache.set(cacheKey, icon);
    return icon;
};

interface TechnicalReserveMarkerProps {
    cableId: string;
    reserveValue: number;
    position: Coordinates;
    mode: string;
    currentZoom: number;
    onMoveReserve: (cableId: string, lat: number, lng: number) => void;
    onDragStart: (cableId: string) => void;
    onDrag: (lat: number, lng: number) => void;
    onDragEnd: () => void;
}

export const TechnicalReserveMarker = React.memo(({
    cableId, reserveValue, position, mode, currentZoom,
    onMoveReserve, onDragStart, onDrag, onDragEnd
}: TechnicalReserveMarkerProps) => {

    const icon = useMemo(() =>
        createReserveIcon(reserveValue, currentZoom),
        [reserveValue, currentZoom]);

    const markerRef = useRef<L.Marker>(null);
    const [localPos, setLocalPos] = useState<Coordinates>(position);
    const draggingRef = useRef(false);

    // Sync local position with prop when it changes (unless dragging)
    useEffect(() => {
        if (!draggingRef.current) {
            setLocalPos(position);
        }
    }, [position]);

    const isDraggable = mode === 'move_node' || mode === 'position_reserve';

    useEffect(() => {
        if (!markerRef.current) return;
        if (isDraggable) {
            markerRef.current.dragging?.enable();
        } else {
            markerRef.current.dragging?.disable();
        }
    }, [isDraggable]);

    const eventHandlers = useMemo(() => ({
        dragstart: () => {
            draggingRef.current = true;
            onDragStart(cableId);
        },
        drag: (e: any) => {
            const pos = e.target.getLatLng();
            setLocalPos({ lat: pos.lat, lng: pos.lng });
            onDrag(pos.lat, pos.lng);
        },
        dragend: (e: any) => {
            draggingRef.current = false;
            onDragEnd();
            const marker = e.target;
            const pos = marker.getLatLng();
            setLocalPos({ lat: pos.lat, lng: pos.lng });
            onMoveReserve(cableId, pos.lat, pos.lng);
        }
    }), [cableId, onMoveReserve, onDragStart, onDrag, onDragEnd]);

    return (
        <Marker
            ref={markerRef}
            position={[localPos.lat, localPos.lng]}
            icon={icon}
            draggable={isDraggable}
            eventHandlers={eventHandlers}
            zIndexOffset={500}
        />
    );
});
