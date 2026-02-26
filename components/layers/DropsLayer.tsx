
import React from 'react';
import { Polyline } from 'react-leaflet';
import { Customer } from '../../types';

interface DropsLayerProps {
    customers: Customer[];
    visible: boolean;
}

export const DropsLayer: React.FC<DropsLayerProps> = React.memo(({ customers, visible }) => {
    if (!visible) return null;

    // DEBUG: Check if we have any drops
    const dropCount = customers.filter(c => (c as any).drop).length;
    if (dropCount > 0) console.log(`[DropsLayer] Found ${dropCount} customers with drops.`);

    const rawPaths = customers.reduce((acc: any[], customer) => {
        const drop = (customer as any).drop;
        if (!drop || !drop.coordinates) return acc;

        const positions = (drop.coordinates as any[] || [])
            .map((c: any) => {
                if (Array.isArray(c)) return [c[0], c[1]] as [number, number];
                if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
                    return [c.lat, c.lng] as [number, number];
                }
                return null;
            })
            .filter((p): p is [number, number] => p !== null && !isNaN(p[0]) && !isNaN(p[1]));

        if (positions.length >= 2) {
            acc.push(positions);
        }
        return acc;
    }, []);

    // Create a string representation to detect real changes in the drop geometry
    // This stringifies the nested array of coordinates [[lat, lng], [lat, lng], ...]
    const pathsString = JSON.stringify(rawPaths);

    // Only recreate the positions array reference when the actual data string changes.
    // This PREVENTS React Leaflet from calling setLatLngs() unless the drops ACTUALLY moved.
    // Calling setLatLngs destroys the in-progress zoom CSS transform on the SVG, causing severe blinking.
    const allPaths = React.useMemo(() => {
        return rawPaths;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathsString]);

    if (allPaths.length === 0) return null;

    return (
        <Polyline
            positions={allPaths}
            pathOptions={{
                color: '#000000', // Black for drops
                weight: 1,
                opacity: 0.8,
                dashArray: 'none',
                lineCap: 'round',
                lineJoin: 'round',
                smoothFactor: 0, // Disable simplification entirely: prevents the line from "snapping" or jumping its shape after zoom
                noClip: true // Prevent clipping artifacts at tile edges
            }}
            interactive={false} // Performance: Drops are usually not interactive
        />
    );
});
