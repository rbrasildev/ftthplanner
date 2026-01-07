import { NetworkState, CableData, Coordinates, CTOData, POPData } from '../types';
import L from 'leaflet';

// --- GEOMETRY HELPERS ---
export function getDistanceToSegment(p: Coordinates, a: Coordinates, b: Coordinates) {
    const x = p.lat;
    const y = p.lng;
    const x1 = a.lat;
    const y1 = a.lng;
    const x2 = b.lat;
    const y2 = b.lng;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;

    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    const distDeg = Math.sqrt(dx * dx + dy * dy);
    const distMeters = distDeg * 111320;

    // Fix: Use Epsilon for endpoint check
    const EPSILON = 0.0000001;
    const isAtStart = Math.abs(xx - x1) < EPSILON && Math.abs(yy - y1) < EPSILON;
    const isAtEnd = Math.abs(xx - x2) < EPSILON && Math.abs(yy - y2) < EPSILON;

    return {
        dist: distMeters,
        point: { lat: xx, lng: yy },
        isEndpoint: isAtStart || isAtEnd
    };
}

// --- AUTO SNAP LOGIC ---
export const autoSnapNetwork = (net: NetworkState, snapDistance: number): { state: NetworkState, snappedCount: number } => {
    // AUTO-SNAP DISABLED GLOBAL
    return { state: net, snappedCount: 0 };

    /*
    const nodes = [...net.ctos, ...(net.pops || [])];
    let snappedCount = 0;
    let hasChanges = false;

    // 1. Process Cable Ends (Tips)
    let currentCables = net.cables.map(cable => {
        let cModified = false;
        const coords = cable.coordinates.map(c => ({ ...c }));
        let from = cable.fromNodeId;
        let to = cable.toNodeId;

        // Check Start Point
        if (!from && coords.length > 0) {
            const startPt = L.latLng(coords[0].lat, coords[0].lng);
            let closestNode = null;
            let minDesc = Infinity;

            for (const n of nodes) {
                const dist = startPt.distanceTo(L.latLng(n.coordinates.lat, n.coordinates.lng));
                if (dist <= snapDistance && dist < minDesc) {
                    minDesc = dist;
                    closestNode = n;
                }
            }

            if (closestNode) {
                coords[0] = { ...closestNode.coordinates };
                from = closestNode.id;
                cModified = true;
                snappedCount++;
            }
        }

        // Check End Point
        if (!to && coords.length > 0) {
            const endPt = L.latLng(coords[coords.length - 1].lat, coords[coords.length - 1].lng);
            let closestNode = null;
            let minDesc = Infinity;

            for (const n of nodes) {
                const dist = endPt.distanceTo(L.latLng(n.coordinates.lat, n.coordinates.lng));
                if (dist <= snapDistance && dist < minDesc) {
                    minDesc = dist;
                    closestNode = n;
                }
            }

            if (closestNode) {
                coords[coords.length - 1] = { ...closestNode.coordinates };
                to = closestNode.id;
                cModified = true;
                snappedCount++;
            }
        }

        if (cModified) {
            hasChanges = true;
            return { ...cable, coordinates: coords, fromNodeId: from, toNodeId: to };
        }
        return cable;
    });

    // 2. Process Mid-Span Splits (Sangria)
    // We iterate through the cables resulting from step 1.
    // If a node is close to the middle of a cable, we split the cable.
    const finalCables: CableData[] = [];

    for (const cable of currentCables) {
        if (cable.coordinates.length < 2) {
            finalCables.push(cable);
            continue;
        }

        let bestSplit = null; // { node, segmentIndex, point }

        // Start/End coordinates to check for duplicates
        const cStart = cable.coordinates[0];
        const cEnd = cable.coordinates[cable.coordinates.length - 1];

        // Check this cable against all nodes
        for (const node of nodes) {
            // If already connected to this node, skip (prevent infinite splitting of ends)
            if (cable.fromNodeId === node.id || cable.toNodeId === node.id) continue;

            // Fix: Prevent splitting if node is extremely close to start/end (Micro-cables / Duplicates)
            // If Step 1 didn't snap (due to being 2nd closest), we shouldn't split a 1cm cable here.
            const distToStart = L.latLng(node.coordinates.lat, node.coordinates.lng).distanceTo(L.latLng(cStart.lat, cStart.lng));
            const distToEnd = L.latLng(node.coordinates.lat, node.coordinates.lng).distanceTo(L.latLng(cEnd.lat, cEnd.lng));

            // 0.5 meters buffer zone to prevent ambiguity/micro-segments
            if (distToStart < 0.5 || distToEnd < 0.5) continue;

            // Check every segment of the cable
            for (let i = 0; i < cable.coordinates.length - 1; i++) {
                const p1 = cable.coordinates[i];
                const p2 = cable.coordinates[i + 1];

                const result = getDistanceToSegment(node.coordinates, p1, p2);

                if (result.dist <= snapDistance) {
                    // Ignore if it's the endpoint (redundant with start/end check but good for safety)
                    if (result.isEndpoint) continue;

                    // Found a candidate. Is it the best one for this cable?
                    if (!bestSplit || result.dist < bestSplit.dist) {
                        bestSplit = { node, segmentIndex: i, point: result.point, dist: result.dist };
                    }
                }
            }
        }

        if (bestSplit) {
            // PERFORM SPLIT
            hasChanges = true;
            snappedCount++;
            const { node, segmentIndex, point } = bestSplit;

            // Coordinates for Cable A (Start -> Node)
            const coordsA = [...cable.coordinates.slice(0, segmentIndex + 1), node.coordinates];
            // Coordinates for Cable B (Node -> End)
            const coordsB = [node.coordinates, ...cable.coordinates.slice(segmentIndex + 1)];

            const cableA: CableData = {
                ...cable,
                coordinates: coordsA,
                toNodeId: node.id, // Connect end of A to Node
                name: `${cable.name} (A)`,
                looseTubeCount: cable.looseTubeCount // Pass loose tube count
            };

            const cableB: CableData = {
                ...cable,
                id: `cable-split-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, // New ID
                fromNodeId: node.id, // Connect start of B to Node
                toNodeId: cable.toNodeId,
                coordinates: coordsB,
                name: `${cable.name.replace(' (A)', '')} (B)`,
                looseTubeCount: cable.looseTubeCount // Pass loose tube count
            };

            finalCables.push(cableA, cableB);
        } else {
            finalCables.push(cable);
        }
    }

    if (!hasChanges) return { state: net, snappedCount: 0 };

    // 3. Update Node References (Input Cables)
    const updateNodeInputs = (node: any) => {
        const connectedCableIds = finalCables
            .filter(c => c.fromNodeId === node.id || c.toNodeId === node.id)
            .map(c => c.id);

        const currentInputs = node.inputCableIds || [];

        const isSame = connectedCableIds.length === currentInputs.length &&
            connectedCableIds.every(id => currentInputs.includes(id));

        if (!isSame) {
            return { ...node, inputCableIds: connectedCableIds };
        }
        return node;
    };

    return {
        state: {
            ...net,
            cables: finalCables,
            ctos: net.ctos.map(updateNodeInputs),
            pops: (net.pops || []).map(updateNodeInputs)
        },
        snappedCount
    };
    */
};
