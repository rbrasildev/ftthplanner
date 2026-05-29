import { NetworkState, Coordinates, Customer, CTOStatus, PoleStatus, CableStatus, CustomerStatus } from '../types';
import { calculateDistance } from './geometryUtils';

export interface CableStats {
    fiberCount: number;
    totalMeters: number;
    count: number;
    deployedCount: number;
    deployedMeters: number;
    plannedCount: number;
    plannedMeters: number;
}

export interface StatusBreakdown<T extends string> {
    total: number;
    byStatus: Record<T, number>;
}

export interface NetworkReport {
    // Breakdowns por status — usuário precisa ver implantado vs planejado vs etc.
    ctos: StatusBreakdown<CTOStatus>;
    ceos: StatusBreakdown<CTOStatus>;
    pops: StatusBreakdown<CTOStatus>;
    poles: StatusBreakdown<PoleStatus>;
    cables: StatusBreakdown<CableStatus>;
    customers: StatusBreakdown<CustomerStatus>;

    // Compat: contagens totais antigas (mantém o code que ainda lê isso).
    ctoCount: number;
    ceoCount: number;
    popCount: number;
    poleCount: number;
    cableCount: number;
    customerCount: number;

    // Drops & meters
    dropCount: number;
    dropMeters: number;
    cableStats: CableStats[];
    totalDeploymentMeters: number;
    totalPlannedMeters: number;

    // Métricas derivadas úteis pro dashboard.
    deploymentRate: number; // % de cabos DEPLOYED (0-100)
    deployedCtoRate: number; // % de CTOs com status DEPLOYED ou CERTIFIED
}

const emptyCTOBreakdown = (): StatusBreakdown<CTOStatus> => ({
    total: 0,
    byStatus: { PLANNED: 0, NOT_DEPLOYED: 0, DEPLOYED: 0, CERTIFIED: 0 },
});

const emptyPoleBreakdown = (): StatusBreakdown<PoleStatus> => ({
    total: 0,
    byStatus: { PLANNED: 0, ANALYSING: 0, LICENSED: 0 },
});

const emptyCableBreakdown = (): StatusBreakdown<CableStatus> => ({
    total: 0,
    byStatus: { NOT_DEPLOYED: 0, DEPLOYED: 0 },
});

const emptyCustomerBreakdown = (): StatusBreakdown<CustomerStatus> => ({
    total: 0,
    byStatus: { ACTIVE: 0, INACTIVE: 0, PLANNED: 0, SUSPENDED: 0, CANCELLED: 0 },
});

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

    const ctos = emptyCTOBreakdown();
    const ceos = emptyCTOBreakdown();
    const pops = emptyCTOBreakdown();
    const poles = emptyPoleBreakdown();
    const cables = emptyCableBreakdown();
    const customerBd = emptyCustomerBreakdown();

    // 1. Processa boxes (CTOs vs CEOs) + status
    network.ctos.forEach(cto => {
        const status = (cto.status || 'PLANNED') as CTOStatus;
        if (cto.type === 'CEO') {
            ceos.total++;
            if (ceos.byStatus[status] !== undefined) ceos.byStatus[status]++;
        } else {
            ctos.total++;
            if (ctos.byStatus[status] !== undefined) ctos.byStatus[status]++;
        }
    });

    // 2. POPs (compartilham CTOStatus por design)
    (network.pops || []).forEach(pop => {
        const status = ((pop as any).status || 'DEPLOYED') as CTOStatus;
        pops.total++;
        if (pops.byStatus[status] !== undefined) pops.byStatus[status]++;
    });

    // 3. Poles
    (network.poles || []).forEach(pole => {
        const status = ((pole as any).status || 'PLANNED') as PoleStatus;
        poles.total++;
        if (poles.byStatus[status] !== undefined) poles.byStatus[status]++;
    });

    // 4. Customers
    customers.forEach(c => {
        const status = ((c as any).status || 'ACTIVE') as CustomerStatus;
        customerBd.total++;
        if (customerBd.byStatus[status] !== undefined) customerBd.byStatus[status]++;
    });

    // 5. Cabos — agrupa por fiberCount + breakdown de status
    const cableGrouping: Record<number, CableStats> = {};
    let totalDeploymentMeters = 0;
    let totalPlannedMeters = 0;

    network.cables.forEach(cable => {
        let lengthMeters = 0;
        for (let i = 0; i < cable.coordinates.length - 1; i++) {
            lengthMeters += calculateDistance(cable.coordinates[i], cable.coordinates[i + 1]);
        }
        if (cable.technicalReserve) lengthMeters += cable.technicalReserve;

        const fibers = cable.fiberCount || 0;
        if (!cableGrouping[fibers]) {
            cableGrouping[fibers] = {
                fiberCount: fibers, totalMeters: 0, count: 0,
                deployedCount: 0, deployedMeters: 0,
                plannedCount: 0, plannedMeters: 0,
            };
        }

        const g = cableGrouping[fibers];
        g.totalMeters += lengthMeters;
        g.count += 1;

        const status = (cable.status || 'NOT_DEPLOYED') as CableStatus;
        cables.total++;
        if (cables.byStatus[status] !== undefined) cables.byStatus[status]++;

        if (status === 'DEPLOYED') {
            totalDeploymentMeters += lengthMeters;
            g.deployedCount++;
            g.deployedMeters += lengthMeters;
        } else {
            totalPlannedMeters += lengthMeters;
            g.plannedCount++;
            g.plannedMeters += lengthMeters;
        }
    });

    const cableStats = Object.values(cableGrouping).sort((a, b) => a.fiberCount - b.fiberCount);

    const deploymentRate = cables.total > 0
        ? (cables.byStatus.DEPLOYED / cables.total) * 100
        : 0;
    const deployedCtoRate = ctos.total > 0
        ? ((ctos.byStatus.DEPLOYED + ctos.byStatus.CERTIFIED) / ctos.total) * 100
        : 0;

    return {
        ctos, ceos, pops, poles, cables, customers: customerBd,
        ctoCount: ctos.total,
        ceoCount: ceos.total,
        popCount: pops.total,
        poleCount: poles.total,
        cableCount: cables.total,
        customerCount: customerBd.total,
        dropCount,
        dropMeters,
        cableStats,
        totalDeploymentMeters,
        totalPlannedMeters,
        deploymentRate,
        deployedCtoRate,
    };
}
