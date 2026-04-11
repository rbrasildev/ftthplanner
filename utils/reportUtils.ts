import { NetworkState, Coordinates, Customer } from '../types';
import { calculateDistance } from './geometryUtils';

export interface CableStats {
    fiberCount: number;
    totalMeters: number;
    count: number;
}

export interface NetworkReport {
    ctoCount: number;
    ceoCount: number;
    popCount: number;
    poleCount: number;
    // Total drops in the project. A drop == one attached customer (the Drop row is 1:1 with
    // customer.ctoId). We count customers whose `ctoId` is set, so disconnected customers
    // don't inflate the number.
    dropCount: number;
    // Summed length of every drop cable (geodesic distance over the coordinates list).
    // Prefers the server-provided `drop.length` when it's populated; otherwise computes on the fly.
    dropMeters: number;
    cableStats: CableStats[];
    totalDeploymentMeters: number;
    totalPlannedMeters: number;
}

export function calculateNetworkReport(network: NetworkState, customers: Customer[] = []): NetworkReport {
    // Tally drops — count + summed length. Only counts connected customers (ctoId set).
    let dropCount = 0;
    let dropMeters = 0;
    for (const c of customers) {
        if (!c.ctoId) continue;
        dropCount++;
        const drop: any = (c as any).drop;
        if (!drop) continue;
        if (typeof drop.length === 'number' && drop.length > 0) {
            dropMeters += drop.length;
            continue;
        }
        const coords: any[] = Array.isArray(drop.coordinates) ? drop.coordinates : [];
        if (coords.length < 2) continue;
        for (let i = 0; i < coords.length - 1; i++) {
            const a = coords[i];
            const b = coords[i + 1];
            // Tolerate both {lat,lng} objects and [lat,lng] tuples (legacy payloads).
            const aLat = Array.isArray(a) ? a[0] : a?.lat;
            const aLng = Array.isArray(a) ? a[1] : a?.lng;
            const bLat = Array.isArray(b) ? b[0] : b?.lat;
            const bLng = Array.isArray(b) ? b[1] : b?.lng;
            if (aLat == null || aLng == null || bLat == null || bLng == null) continue;
            dropMeters += calculateDistance({ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng });
        }
    }

    const report: NetworkReport = {
        ctoCount: 0,
        ceoCount: 0,
        popCount: network.pops?.length || 0,
        poleCount: network.poles?.length || 0,
        dropCount,
        dropMeters,
        cableStats: [],
        totalDeploymentMeters: 0,
        totalPlannedMeters: 0
    };

    // 1. Process Boxes (CTOs vs CEOs)
    network.ctos.forEach(cto => {
        if (cto.type === 'CEO') {
            report.ceoCount++;
        } else {
            report.ctoCount++;
        }
    });

    // 2. Process Cables
    const cableGrouping: Record<number, CableStats> = {};

    network.cables.forEach(cable => {
        let lengthMeters = 0;
        for (let i = 0; i < cable.coordinates.length - 1; i++) {
            lengthMeters += calculateDistance(cable.coordinates[i], cable.coordinates[i + 1]);
        }

        // Add technical reserve if exists
        if (cable.technicalReserve) {
            lengthMeters += cable.technicalReserve;
        }

        const fibers = cable.fiberCount || 0;
        if (!cableGrouping[fibers]) {
            cableGrouping[fibers] = { fiberCount: fibers, totalMeters: 0, count: 0 };
        }

        cableGrouping[fibers].totalMeters += lengthMeters;
        cableGrouping[fibers].count += 1;

        if (cable.status === 'DEPLOYED') {
            report.totalDeploymentMeters += lengthMeters;
        } else {
            report.totalPlannedMeters += lengthMeters;
        }
    });

    report.cableStats = Object.values(cableGrouping).sort((a, b) => a.fiberCount - b.fiberCount);

    return report;
}
