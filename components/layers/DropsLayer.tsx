
import React, { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import { Customer } from '../../types';

interface DropsLayerProps {
    customers: Customer[];
    visible: boolean;
}

// Stable path options object (never changes)
const DROP_PATH_OPTIONS = {
    color: '#000000',
    weight: 1,
    opacity: 0.8,
    dashArray: 'none',
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    smoothFactor: 0,
    noClip: true
};

export const DropsLayer: React.FC<DropsLayerProps> = React.memo(({ customers, visible }) => {
    if (!visible) return null;

    // Memoize path extraction based on customers reference
    // Only recompute when the customers array itself changes (parent already controls this)
    const allPaths = useMemo(() => {
        const paths: [number, number][][] = [];
        for (const customer of customers) {
            const drop = (customer as any).drop;
            if (!drop || !drop.coordinates) continue;

            const positions: [number, number][] = [];
            for (const c of drop.coordinates as any[]) {
                if (Array.isArray(c) && !isNaN(c[0]) && !isNaN(c[1])) {
                    positions.push([c[0], c[1]]);
                } else if (c && typeof c.lat === 'number' && typeof c.lng === 'number' && !isNaN(c.lat) && !isNaN(c.lng)) {
                    positions.push([c.lat, c.lng]);
                }
            }
            if (positions.length >= 2) {
                paths.push(positions);
            }
        }
        return paths;
    }, [customers]);

    if (allPaths.length === 0) return null;

    return (
        <Polyline
            positions={allPaths}
            pathOptions={DROP_PATH_OPTIONS}
            interactive={false}
        />
    );
});
