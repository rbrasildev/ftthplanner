import { NetworkState, Coordinates } from '../types';
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
    cableStats: CableStats[];
    totalDeploymentMeters: number;
    totalPlannedMeters: number;
}

export function calculateNetworkReport(network: NetworkState): NetworkReport {
    const report: NetworkReport = {
        ctoCount: 0,
        ceoCount: 0,
        popCount: network.pops?.length || 0,
        poleCount: network.poles?.length || 0,
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
