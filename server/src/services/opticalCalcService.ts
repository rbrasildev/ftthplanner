/**
 * Optical Power Calculation Service
 * Server-side port of the frontend opticalUtils.ts
 * Calculates the final optical power at a CTO by tracing the path back to the OLT
 */

// ---- Interfaces ----

interface Coordinates {
    lat: number;
    lng: number;
}

interface Splitter {
    id: string;
    name: string;
    type: string;
    inputPortId: string;
    outputPortIds: string[];
    catalogId?: string;
}

interface FusionPoint {
    id: string;
    name: string;
    type?: string;
    catalogId?: string;
}

interface FiberConnection {
    id: string;
    sourceId: string;
    targetId: string;
}

interface CableData {
    id: string;
    name: string;
    fiberCount: number;
    coordinates: Coordinates[];
    fromNodeId?: string | null;
    toNodeId?: string | null;
    catalogId?: string | null;
}

interface CTONode {
    id: string;
    name: string;
    splitters: Splitter[];
    fusions: FusionPoint[];
    connections: FiberConnection[];
    inputCableIds: string[];
}

interface OLT {
    id: string;
    name: string;
    portIds: string[];
    structure?: {
        slots: number;
        portsPerSlot: number;
    };
}

interface DIO {
    id: string;
    name: string;
    portIds: string[];
}

interface POPNode {
    id: string;
    name: string;
    olts: OLT[];
    dios: DIO[];
    fusions: FusionPoint[];
    connections: FiberConnection[];
    inputCableIds: string[];
}

interface NetworkState {
    ctos: CTONode[];
    pops: POPNode[];
    cables: CableData[];
}

interface CatalogSplitter {
    id: string;
    name: string;
    outputs: number;
    attenuation: any;
}

interface CatalogCable {
    id: string;
    name: string;
    attenuation: number;
}

interface CatalogFusion {
    id: string;
    name: string;
    attenuation: number;
}

interface CatalogOLT {
    id: string;
    name: string;
    outputPower: number;
}

interface Catalogs {
    splitters: CatalogSplitter[];
    cables: CatalogCable[];
    fusions: CatalogFusion[];
    olts: CatalogOLT[];
}

export interface OpticalPowerResult {
    finalPower: number;
    oltPower: number;
    totalLoss: number;
    status: 'OK' | 'MARGINAL' | 'FAIL';
    sourceName: string;
    oltDetails?: { name: string; slot?: number; port?: number };
    path: { type: string; name: string; loss: number; details?: string }[];
}

// ---- Helpers ----

function getDistance(c1: Coordinates, c2: Coordinates): number {
    const R = 6371e3;
    const φ1 = c1.lat * Math.PI / 180;
    const φ2 = c2.lat * Math.PI / 180;
    const Δφ = (c2.lat - c1.lat) * Math.PI / 180;
    const Δλ = (c2.lng - c1.lng) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCableLength(cable: CableData): number {
    let total = 0;
    for (let i = 0; i < cable.coordinates.length - 1; i++) {
        total += getDistance(cable.coordinates[i], cable.coordinates[i + 1]);
    }
    return total;
}

function getSplitterLoss(splitter: Splitter, catalog: CatalogSplitter | undefined, outputPortId?: string): number {
    if (!catalog) return 0;
    const att: any = catalog.attenuation;
    if (att === undefined || att === null) return 0;

    const parseVal = (v: any) => { const p = parseFloat(v); return isNaN(p) ? null : p; };

    // Port-specific attenuation (unbalanced splitters)
    if (outputPortId && splitter.outputPortIds.includes(outputPortId)) {
        const portIndex = splitter.outputPortIds.indexOf(outputPortId);
        if (typeof att === 'object' && !Array.isArray(att)) {
            if (portIndex === 0 && att.port1 !== undefined) { const v = parseVal(att.port1); if (v !== null) return v; }
            if (portIndex === 1 && att.port2 !== undefined) { const v = parseVal(att.port2); if (v !== null) return v; }
        } else if (typeof att === 'string' && att.trim().startsWith('{')) {
            try {
                const obj = JSON.parse(att);
                if (portIndex === 0 && obj.port1 !== undefined) { const v = parseVal(obj.port1); if (v !== null) return v; }
                if (portIndex === 1 && obj.port2 !== undefined) { const v = parseVal(obj.port2); if (v !== null) return v; }
            } catch { }
        }
    }

    // Standard (balanced)
    if (typeof att === 'number' && !isNaN(att)) return att;
    if (typeof att === 'string') {
        const parsed = parseFloat(att);
        if (!isNaN(parsed) && !att.trim().startsWith('{')) return parsed;
    }
    if (typeof att === 'object' && att !== null) {
        if (att.value !== undefined) { const v = parseFloat(att.value); if (!isNaN(v)) return v; }
    }
    if (typeof att === 'string' && att.trim().startsWith('{')) {
        try { const obj = JSON.parse(att); if (obj.value !== undefined) { const v = parseFloat(obj.value); if (!isNaN(v)) return v; } } catch { }
    }
    return 0;
}

function getCableLoss(cable: CableData, catalog: CatalogCable | undefined): number {
    const lengthKm = getCableLength(cable) / 1000;
    const attPerKm = (catalog && catalog.attenuation) ? catalog.attenuation : 0.3;
    return lengthKm * attPerKm;
}

function getFusionLoss(catalog: CatalogFusion | undefined): number {
    return catalog ? catalog.attenuation : 0;
}

// ---- Main Trace ----

export function traceOpticalPower(
    targetSplitterId: string,
    startNodeId: string,
    network: NetworkState,
    catalogs: Catalogs
): OpticalPowerResult {
    const path: { type: string; id: string; name: string; loss: number; length?: number; details?: string }[] = [];
    let oltPower = 3; // Default Class B+

    const startNode: CTONode | POPNode | undefined =
        (network.ctos as any[]).find(c => c.id === startNodeId) ||
        (network.pops as any[]).find(p => p.id === startNodeId);

    if (!startNode) {
        console.log(`[Trace] Node not found: ${startNodeId}`);
        return { finalPower: -Infinity, oltPower: 0, totalLoss: 0, status: 'FAIL', sourceName: 'NO_SIGNAL', path: [] };
    }

    let targetSplitter: Splitter | undefined;
    if ('splitters' in startNode) {
        targetSplitter = (startNode as CTONode).splitters.find(s => s.id === targetSplitterId);
    }
    if (!targetSplitter) {
        console.log(`[Trace] Splitter not found: ${targetSplitterId} in node ${startNode.name}`);
        return { finalPower: -Infinity, oltPower: 0, totalLoss: 0, status: 'FAIL', sourceName: 'NO_SIGNAL', path: [] };
    }

    // Match splitter catalog
    let splitterCatalog = catalogs.splitters.find(c => c.name === targetSplitter!.type);
    if (!splitterCatalog) {
        const norm = targetSplitter.type.trim().toLowerCase();
        splitterCatalog = catalogs.splitters.find(c => c.name.trim().toLowerCase() === norm);
    }
    if (!splitterCatalog) {
        const outCount = targetSplitter.outputPortIds.length;
        splitterCatalog = catalogs.splitters.find(c => c.outputs === outCount);
    }

    const splitterLoss = getSplitterLoss(targetSplitter, splitterCatalog);
    path.unshift({ type: 'SPLITTER', id: targetSplitter.id, name: targetSplitter.name, loss: splitterLoss, details: `1:${targetSplitter.outputPortIds.length}` });

    let currPortId = targetSplitter.inputPortId;
    let currNodeId = startNodeId;
    let lastConnectionId: string | null = null;
    let foundOltDetails: { name: string; slot?: number; port?: number } | undefined;

    for (let i = 0; i < 100; i++) {
        const node: CTONode | POPNode | undefined =
            (network.ctos as any[]).find(c => c.id === currNodeId) ||
            (network.pops as any[]).find(p => p.id === currNodeId);

        if (!node) {
            console.log(`[Trace] Node not found during trace: ${currNodeId}`);
            break;
        }

        let internalConnection = node.connections.find(c => c.id !== lastConnectionId && c.targetId === currPortId);
        let upstreamId: string | undefined;

        if (internalConnection) {
            upstreamId = internalConnection.sourceId;
            lastConnectionId = internalConnection.id;
        } else {
            internalConnection = node.connections.find(c => c.id !== lastConnectionId && c.sourceId === currPortId);
            if (internalConnection) {
                upstreamId = internalConnection.targetId;
                lastConnectionId = internalConnection.id;
            }
        }

        if (internalConnection && upstreamId) {
            const sourceId = upstreamId;

            // A. Cable fiber
            if (sourceId.includes('-fiber-')) {
                const cableId = sourceId.split('-fiber-')[0];
                const cable = network.cables.find(c => c.id === cableId);
                if (cable) {
                    const cableCatalog = catalogs.cables.find(c => c.id === cable.catalogId);
                    const cLoss = getCableLoss(cable, cableCatalog);
                    const len = getCableLength(cable);
                    path.unshift({ type: 'CABLE', id: cable.id, name: cable.name, loss: cLoss, length: len, details: `${len.toFixed(0)}m` });

                    let nextNodeId: string | null = null;
                    if (cable.toNodeId === currNodeId) nextNodeId = cable.fromNodeId || null;
                    else if (cable.fromNodeId === currNodeId) nextNodeId = cable.toNodeId || null;
                    if (!nextNodeId) {
                        console.log(`[Trace] Cable ${cable.name} has no connected node on the other end (from: ${cable.fromNodeId}, to: ${cable.toNodeId}, current: ${currNodeId})`);
                        break;
                    }

                    currNodeId = nextNodeId;
                    currPortId = sourceId;
                    continue;
                }
            }

            // B. Fusion
            const fusion = node.fusions.find(f => f.id + '-a' === sourceId || f.id + '-b' === sourceId);
            if (fusion) {
                const fusionData = catalogs.fusions.find(f => f.id === fusion.catalogId);
                const fLoss = getFusionLoss(fusionData);
                path.unshift({ type: 'FUSION', id: fusion.id, name: fusion.name, loss: fLoss });
                const otherSide = sourceId.endsWith('-a') ? `${fusion.id}-b` : `${fusion.id}-a`;
                currPortId = otherSide;
                continue;
            }

            // C. Cascading splitter
            if ('splitters' in node) {
                const parentSplitter = (node as CTONode).splitters.find(s => s.outputPortIds.includes(sourceId));
                if (parentSplitter) {
                    let psCat = catalogs.splitters.find(c => c.name === parentSplitter.type);
                    if (!psCat) { const n = parentSplitter.type.trim().toLowerCase(); psCat = catalogs.splitters.find(c => c.name.trim().toLowerCase() === n); }
                    if (!psCat) { const oc = parentSplitter.outputPortIds.length; psCat = catalogs.splitters.find(c => c.outputs === oc); }
                    const psLoss = getSplitterLoss(parentSplitter, psCat, sourceId);
                    path.unshift({ type: 'SPLITTER', id: parentSplitter.id, name: parentSplitter.name, loss: psLoss, details: `1:${parentSplitter.outputPortIds.length}` });
                    currPortId = parentSplitter.inputPortId;
                    continue;
                }
            }

            // D. OLT port
            if ('olts' in node) {
                const pop = node as POPNode;
                const olt = pop.olts.find(o => o.portIds.some(pid => pid.trim() === sourceId.trim()));
                if (olt) {
                    const oltNameLower = olt.name.trim().toLowerCase();
                    const matched = catalogs.olts
                        .filter(c => oltNameLower.startsWith(c.name.trim().toLowerCase()))
                        .sort((a, b) => b.name.length - a.name.length)[0];
                    oltPower = matched ? matched.outputPower : 3;

                    let slot: number | undefined, port: number | undefined;
                    if (olt.structure) {
                        const idx = olt.portIds.findIndex(pid => pid.trim() === sourceId.trim());
                        if (idx !== -1) {
                            const pps = olt.structure.portsPerSlot || 16;
                            slot = Math.floor(idx / pps) + 1;
                            port = (idx % pps) + 1;
                        }
                    }
                    path.unshift({ type: 'OLT', id: olt.id, name: olt.name, loss: 0, details: `Slot ${slot || '?'} / Port ${port || '?'}` });
                    foundOltDetails = { name: olt.name, slot, port };
                    break;
                }
            }

            // E. DIO port
            if ('dios' in node) {
                const pop = node as POPNode;
                const dio = pop.dios.find(d => d.portIds.some(pid => pid.trim() === sourceId.trim()));
                if (dio) {
                    path.unshift({ type: 'CONNECTOR', id: dio.id, name: dio.name, loss: 0.5, details: `Port ${sourceId}` });
                    currPortId = sourceId;
                    continue;
                }
            }
        } else {
            // No internal connection found
            console.log(`[Trace] No connection found for port ${currPortId} in node ${node.name} (${currNodeId})`);
            // Check direct OLT
            if ('olts' in node) {
                const pop = node as POPNode;
                const olt = pop.olts.find(o => o.portIds.some(pid => pid.trim() === currPortId.trim()));
                if (olt) {
                    const oltNameLower = olt.name.trim().toLowerCase();
                    const matched = catalogs.olts
                        .filter(c => oltNameLower.startsWith(c.name.trim().toLowerCase()))
                        .sort((a, b) => b.name.length - a.name.length)[0];
                    oltPower = matched ? matched.outputPower : 3;

                    let slot: number | undefined, port: number | undefined;
                    if (olt.structure) {
                        const idx = olt.portIds.findIndex(pid => pid.trim() === currPortId.trim());
                        if (idx !== -1) {
                            const pps = olt.structure.portsPerSlot || 16;
                            slot = Math.floor(idx / pps) + 1;
                            port = (idx % pps) + 1;
                        }
                    }
                    path.unshift({ type: 'OLT', id: olt.id, name: olt.name, loss: 0, details: `Slot ${slot || '?'} / Port ${port || '?'}` });
                    foundOltDetails = { name: olt.name, slot, port };
                    break;
                }
            }
            break;
        }
    }

    // Merge consecutive cables
    const compressed: typeof path = [];
    if (path.length > 0) {
        let buf = { ...path[0] };
        for (let i = 1; i < path.length; i++) {
            const cur = path[i];
            if (buf.type === 'CABLE' && cur.type === 'CABLE') {
                buf.loss += cur.loss;
                buf.length = (buf.length || 0) + (cur.length || 0);
                buf.details = `${(buf.length || 0).toFixed(0)}m`;
            } else {
                compressed.push(buf);
                buf = { ...cur };
            }
        }
        compressed.push(buf);
    }

    const finalPath = compressed.length > 0 ? compressed : path;
    const totalLoss = finalPath.reduce((acc, el) => acc + el.loss, 0);

    let finalPower = -Infinity;
    let status: 'OK' | 'MARGINAL' | 'FAIL' = 'FAIL';
    let sourceName = 'NO_SIGNAL';

    if (foundOltDetails) {
        finalPower = oltPower - totalLoss;
        sourceName = foundOltDetails.name;
        if (finalPower < -28) status = 'FAIL';
        else if (finalPower < -25) status = 'MARGINAL';
        else status = 'OK';
    }

    console.log(`[Trace] Result for splitter in ${startNode.name}: power=${finalPower.toFixed(2)}dBm, status=${status}, source=${sourceName}, pathLen=${finalPath.length}`);

    return {
        finalPower,
        oltPower: foundOltDetails ? oltPower : 0,
        totalLoss,
        status,
        sourceName,
        oltDetails: foundOltDetails,
        path: finalPath.map(p => ({ type: p.type, name: p.name, loss: p.loss, details: p.details }))
    };
}
