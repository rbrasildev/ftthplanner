
import React, { useMemo } from 'react';
import { Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Customer } from '../../types';

interface DropsLayerProps {
    customers: Customer[];
    visible: boolean;
    editingDropCustomerId?: string | null;
    editingDropCoords?: { lat: number; lng: number }[] | null;
    onDropContextMenu?: (e: L.LeafletMouseEvent, customerId: string) => void;
    onDropDblClick?: (e: L.LeafletMouseEvent, customerId: string) => void;
    onDropVertexDrag?: (customerId: string, index: number, lat: number, lng: number) => void;
    onDropVertexDragEnd?: (customerId: string) => void;
    onDropVertexRemove?: (customerId: string, index: number) => void;
}

const DROP_PATH_OPTIONS: L.PathOptions = {
    color: '#000000',
    weight: 1,
    opacity: 0.8,
    lineCap: 'round',
    lineJoin: 'round',
    smoothFactor: 0,
};

const DROP_PATH_ACTIVE: L.PathOptions = {
    color: '#10b981',
    weight: 2.5,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    smoothFactor: 0,
};

const DROP_HIT_AREA: L.PathOptions = {
    color: 'transparent',
    weight: 16,
    opacity: 0,
};

const vertexIcon = L.divIcon({
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:grab;" onmouseenter="this.style.transform='scale(1.3)'" onmouseleave="this.style.transform='scale(1)'"></div>`
});

function getDropCoords(customer: Customer): { lat: number; lng: number }[] {
    const drop = (customer as any).drop;
    if (!drop || !drop.coordinates) return [];
    const positions: { lat: number; lng: number }[] = [];
    for (const c of drop.coordinates as any[]) {
        if (Array.isArray(c) && !isNaN(c[0]) && !isNaN(c[1])) {
            positions.push({ lat: c[0], lng: c[1] });
        } else if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
            positions.push({ lat: c.lat, lng: c.lng });
        }
    }
    return positions;
}

export const DropsLayer: React.FC<DropsLayerProps> = React.memo(({
    customers,
    visible,
    editingDropCustomerId,
    editingDropCoords,
    onDropContextMenu,
    onDropDblClick,
    onDropVertexDrag,
    onDropVertexDragEnd,
    onDropVertexRemove,
}) => {
    if (!visible) return null;

    const editingCoords = editingDropCoords || [];

    // All drops except the one being edited
    const drops = useMemo(() => {
        return customers
            .filter(c => c.id !== editingDropCustomerId)
            .map(c => ({ id: c.id, coords: getDropCoords(c) }))
            .filter(d => d.coords.length >= 2);
    }, [customers, editingDropCustomerId]);

    return (
        <>
            {/* Non-editing drops */}
            {drops.map(drop => {
                const positions = drop.coords.map(c => [c.lat, c.lng] as [number, number]);
                return (
                    <React.Fragment key={drop.id}>
                        <Polyline positions={positions} pathOptions={DROP_PATH_OPTIONS} interactive={false} />
                        {/* Wide invisible hit area for right-click and double-click */}
                        <Polyline
                            positions={positions}
                            pathOptions={DROP_HIT_AREA}
                            interactive={true}
                            eventHandlers={{
                                contextmenu: (e) => {
                                    L.DomEvent.stopPropagation(e as any);
                                    L.DomEvent.preventDefault(e as any);
                                    onDropContextMenu?.(e as any, drop.id);
                                },
                            }}
                        />
                    </React.Fragment>
                );
            })}

            {/* Editing drop */}
            {editingDropCustomerId && editingCoords.length >= 2 && (
                <>
                    {/* Active polyline */}
                    <Polyline
                        positions={editingCoords.map(c => [c.lat, c.lng] as [number, number])}
                        pathOptions={DROP_PATH_ACTIVE}
                        interactive={true}
                        eventHandlers={{
                            dblclick: (e) => {
                                L.DomEvent.stopPropagation(e as any);
                                onDropDblClick?.(e as any, editingDropCustomerId);
                            },
                        }}
                    />
                    {/* Wide hit area for double-click to add point */}
                    <Polyline
                        positions={editingCoords.map(c => [c.lat, c.lng] as [number, number])}
                        pathOptions={DROP_HIT_AREA}
                        interactive={true}
                        eventHandlers={{
                            dblclick: (e) => {
                                L.DomEvent.stopPropagation(e as any);
                                onDropDblClick?.(e as any, editingDropCustomerId);
                            },
                        }}
                    />

                    {/* Draggable vertex handles — intermediate points only */}
                    {editingCoords.map((coord, index) => {
                        if (index === 0 || index === editingCoords.length - 1) return null;
                        return (
                            <Marker
                                key={`drop-v-${index}`}
                                position={[coord.lat, coord.lng]}
                                icon={vertexIcon}
                                draggable={true}
                                zIndexOffset={1000}
                                eventHandlers={{
                                    drag: (e) => {
                                        const pos = e.target.getLatLng();
                                        onDropVertexDrag?.(editingDropCustomerId!, index, pos.lat, pos.lng);
                                    },
                                    dragend: () => {
                                        onDropVertexDragEnd?.(editingDropCustomerId!);
                                    },
                                    dblclick: (e) => {
                                        L.DomEvent.stopPropagation(e as any);
                                        onDropVertexRemove?.(editingDropCustomerId!, index);
                                    },
                                    contextmenu: (e) => {
                                        L.DomEvent.stopPropagation(e as any);
                                        L.DomEvent.preventDefault(e as any);
                                        onDropVertexRemove?.(editingDropCustomerId!, index);
                                    },
                                }}
                            />
                        );
                    })}
                </>
            )}
        </>
    );
});
