
import {
    NetworkState,
    CTOData,
    POPData,
    CableData,
    FiberConnection,
    Splitter,
    FusionPoint,
    Coordinates,
    OLT
} from '../types';
import { SplitterCatalogItem, CableCatalogItem, FusionCatalogItem, OLTCatalogItem } from '../services/catalogService';

// Interfaces for the Calculation Result
export interface OpticalElement {
    type: 'CABLE' | 'SPLITTER' | 'FUSION' | 'CONNECTOR' | 'OLT';
    id: string;
    name: string;
    loss: number; // dB
    details?: string;
    length?: number; // meters (for cables)
}

export interface OpticalPathResult {
    path: OpticalElement[];
    totalLoss: number;
    oltPower: number; // dBm
    finalPower: number; // dBm
    status: 'OK' | 'MARGINAL' | 'FAIL';
    sourceName?: string;
    oltDetails?: {
        name: string;
        slot?: number;
        port?: number;
    };
}

interface Catalogs {
    splitters: SplitterCatalogItem[];
    cables: CableCatalogItem[];
    fusions: FusionCatalogItem[];
    olts: OLTCatalogItem[];
}

// Helper: Calculate distance between two coordinates in meters
function getDistance(c1: Coordinates, c2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = c1.lat * Math.PI / 180;
    const φ2 = c2.lat * Math.PI / 180;
    const Δφ = (c2.lat - c1.lat) * Math.PI / 180;
    const Δλ = (c2.lng - c1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Helper: Calculate total cable length
function getCableLength(cable: CableData): number {
    let total = 0;
    for (let i = 0; i < cable.coordinates.length - 1; i++) {
        total += getDistance(cable.coordinates[i], cable.coordinates[i + 1]);
    }
    return total;
}

// Helper: Get Splitter Loss
// Helper: Get Splitter Loss
// Helper: Get Splitter Loss
function getSplitterLoss(splitter: Splitter, catalog: SplitterCatalogItem | undefined): number {
    const outputs = splitter.outputPortIds.length;

    // Default Theoretical Values (Approximate)
    // REMOVED PER USER REQUEST: If not in catalog, assume 0 loss (or user defined)
    const getDefaultLoss = (n: number) => 0;

    if (!catalog) return 0;

    // Try to extract from catalog
    if (catalog.attenuation !== undefined && catalog.attenuation !== null) {
        const att = catalog.attenuation;

        // 1. Direct Number
        if (typeof att === 'number' && !isNaN(att)) return att;

        // 2. String Number
        if (typeof att === 'string') {
            const parsed = parseFloat(att);
            if (!isNaN(parsed)) return parsed;
        }

        // 3. Object with 'value' (Common in this codebase for some types)
        if (typeof att === 'object' && att !== null) {
            // @ts-ignore
            if (att.value !== undefined) {
                // @ts-ignore
                const val = parseFloat(att.value);
                if (!isNaN(val)) return val;
            }
            // @ts-ignore
            if (att.x !== undefined) {
                // @ts-ignore
                const val = parseFloat(att.x);
                if (!isNaN(val)) return val;
            }
        }
    }

    return 0;
}

// Helper: Get Cable Loss
function getCableLoss(cable: CableData, catalog: CableCatalogItem | undefined): number {
    const lengthKm = getCableLength(cable) / 1000;
    let attPerKm = 0.3; // Default 1310/1550nm avg - Keep this as physics default? Or strict 0?
    // User context implied removing "hardcoded" values that should be in catalog.
    // Cables usually have a standard physics loss. But let's check catalog first.

    if (catalog && catalog.attenuation) {
        attPerKm = catalog.attenuation;
    }
    // Note: Leaving 0.3 defaults for cable as it's physics-based per km, not device insertion loss.
    // User specifically asked about Splitter and Fusion.

    return lengthKm * attPerKm;
}

// Helper: Get Fusion Loss
function getFusionLoss(fusion: FusionPoint, catalog: FusionCatalogItem | undefined): number {
    if (catalog) return catalog.attenuation;
    return 0; // Was 0.1. User requested 0 if not found.
}

// --- MAIN TRACE FUNCTION ---

export function traceOpticalPath(
    targetSplitterId: string,
    startNodeId: string, // The CTO ID where the splitter is
    network: NetworkState,
    catalogs: Catalogs,
    startNodeOverride?: CTOData | POPData // Optional: Use this instead of fetching from network (for Editor state)
): OpticalPathResult {

    const path: OpticalElement[] = [];
    let currentPower = 0; // Will be set by OLT
    let oltPower = 3; // Default Class B+ (+3dBm)

    // Find basic objects
    // Use override if ID matches, otherwise fetch from network
    const startNode = (startNodeOverride && startNodeOverride.id === startNodeId)
        ? startNodeOverride
        : network.ctos.find(c => c.id === startNodeId) || network.pops.find(p => p.id === startNodeId);

    if (!startNode) throw new Error("CTO not found");

    // Check if it's a CTO or POP to access splitters
    // Note: POPs don't usually have splitters in this model array, but we check 'splitters' property existence
    let targetSplitter: Splitter | undefined;
    if ('splitters' in startNode) {
        targetSplitter = (startNode as CTOData).splitters.find(s => s.id === targetSplitterId);
    }

    if (!targetSplitter) throw new Error("Splitter not found");

    // ROBUST CATALOG MATCHING
    let splitterCatalog = catalogs.splitters.find(c => c.name === targetSplitter.type);

    if (!splitterCatalog) {
        // Fallback 1: Normalized Name (case-insensitive, trimmed)
        const targetNameNorm = targetSplitter.type.trim().toLowerCase();
        splitterCatalog = catalogs.splitters.find(c => c.name.trim().toLowerCase() === targetNameNorm);
    }

    if (!splitterCatalog) {
        // Fallback 2: Match by Port Count (Best Guess)
        // If we have a 1:16 splitter in map, look for a 1:16 splitter in catalog
        const outputCount = targetSplitter.outputPortIds.length;
        splitterCatalog = catalogs.splitters.find(c => c.outputs === outputCount);

        if (splitterCatalog) {
            console.log(`[OpticalCalc] Matched Catalog by Port Count (${outputCount}): ${splitterCatalog.name}`);
        }
    }

    // DEBUG: Catalog Mismatch (Only if completely failed)
    if (!splitterCatalog) {
        console.warn(`[OpticalCalc] Splitter Catalog NOT FOUND for type: '${targetSplitter.type}' (Outputs: ${targetSplitter.outputPortIds.length})`);
        console.log("Available Splitters:", catalogs.splitters.map(s => `'${s.name}' (Out: ${s.outputs})`));
    } else {
        console.log(`[OpticalCalc] Found Catalog: ${splitterCatalog.name}, Attenuation: ${splitterCatalog.attenuation}`);
    }

    // 1. Add Target Splitter (We want output power, so we include its loss)
    const splitterLoss = getSplitterLoss(targetSplitter, splitterCatalog);
    path.unshift({
        type: 'SPLITTER',
        id: targetSplitter.id,
        name: targetSplitter.name,
        loss: splitterLoss,
        details: `1:${targetSplitter.outputPortIds.length}`
    });

    // Start tracing BACKWARDS from Splitter Input
    let currPortId = targetSplitter.inputPortId;
    let currNodeId = startNodeId;
    let iterations = 0;

    // Prevent backtracking loops
    let lastConnectionId: string | null = null;

    // Variable to store OLT Details for result
    let foundOltDetails: { name: string; slot?: number; port?: number; } | undefined;

    while (iterations < 100) { // Safety break
        iterations++;

        // Find the Node (CTO/POP) we are currently in
        let node: CTOData | POPData | undefined;

        if (startNodeOverride && startNodeOverride.id === currNodeId) {
            node = startNodeOverride;
        } else {
            node = network.ctos.find(c => c.id === currNodeId) || network.pops.find(p => p.id === currNodeId);
        }

        if (!node) {
            console.warn("Node not found:", currNodeId);
            break;
        }

        // Find Connection attached to current Port (Input of the element we just processed)
        // We are looking for a connection where targetId === currPortId
        // (Input Port of Splitter is the TARGET of a connection coming from elsewhere)

        console.log(`[Trace Step ${iterations}] Node: ${node.name}, Looking for connection involving: ${currPortId}`);

        // Exclude the connection we just used to get here
        let internalConnection = node.connections.find(c => c.id !== lastConnectionId && c.targetId === currPortId);
        let upstreamId: string | undefined;

        if (internalConnection) {
            upstreamId = internalConnection.sourceId;
            lastConnectionId = internalConnection.id;
            console.log(`[Trace Step ${iterations}] Found Incoming Connection from:`, upstreamId);
        } else {
            // Try reverse direction (User might have drawn line FROM this port TO the source)
            internalConnection = node.connections.find(c => c.id !== lastConnectionId && c.sourceId === currPortId);
            if (internalConnection) {
                upstreamId = internalConnection.targetId;
                lastConnectionId = internalConnection.id;
                console.log(`[Trace Step ${iterations}] Found Outgoing Connection to (treated as source):`, upstreamId);
            }
        }

        if (internalConnection && upstreamId) {
            // We found a connection. Follow it.
            const sourceId = upstreamId; // Alias for existing logic to work

            // Check what the sourceId belongs to

            // A. Is it a Fiber from an Input Cable?
            if (sourceId.includes('-fiber-')) {
                const cableId = sourceId.split('-fiber-')[0];
                const cable = network.cables.find(c => c.id === cableId);

                if (cable) {
                    const cableCatalog = catalogs.cables.find(c => c.id === cable.catalogId);
                    const cLoss = getCableLoss(cable, cableCatalog);
                    const len = getCableLength(cable);

                    path.unshift({
                        type: 'CABLE',
                        id: cable.id,
                        name: cable.name,
                        loss: cLoss,
                        length: len,
                        details: `${len.toFixed(0)}m`
                    });

                    // Move to the other end of the cable
                    // If we are at 'toNode', go to 'fromNode'. If at 'fromNode', go to 'toNode'.
                    // NOTE: Input Cable implies we are at the 'toNode' end usually? 
                    // Not necessarily, cable direction is arbitrary. 

                    let nextNodeId: string | null = null;
                    if (cable.toNodeId === currNodeId) nextNodeId = cable.fromNodeId;
                    else if (cable.fromNodeId === currNodeId) nextNodeId = cable.toNodeId;

                    if (!nextNodeId) break; // Floating cable?

                    currNodeId = nextNodeId;

                    // Now we need to find the port on the OTHER node that connects to this fiber.
                    // The fiber ID is the same `${ cable.id } -fiber - N`.
                    // So we look for a connection where TARGET is this fiber? 
                    // No, "Input Cable" means the signal comes FROM the cable.
                    // So inside the NEXT node (upstream), the cable is an OUTPUT (sending signal to us)?
                    // Wait, signal direction: OLT -> ... -> prevNode -> Cable -> currNode -> Splitter.
                    // In properties, `currNode` has `cable` as Input.
                    // So `sourceId` (Fiber) is where signal comes FROM.

                    // In `prevNode`, this same Cable/Fiber must be connected to something that FEEDS it.
                    // So in `prevNode`, we look for a connection where `targetId` === `sourceFiberId`.
                    // (The fiber accepts signal from something else).

                    currPortId = sourceId; // The fiber ID is consistent across nodes
                    continue;
                }
            }

            // B. Is it a Fusion?
            const fusion = node.fusions.find(f => f.id + '-a' === sourceId || f.id + '-b' === sourceId);
            if (fusion) {
                // It's a fusion point.
                // Robust Lookup (Updated for Catalog ID)
                // Priority 1: Catalog ID (best match)
                let fusionData = catalogs.fusions.find(f => f.id === fusion.catalogId);

                // Priority 2: Name Lookup (fallback)
                if (!fusionData && fusion.type && fusion.type !== 'generic' && fusion.type !== 'tray') {
                    const fusionTypeNorm = (fusion.type as string).trim().toLowerCase();
                    fusionData = catalogs.fusions.find(f => f.name.trim().toLowerCase() === fusionTypeNorm);
                }

                // If not found, defaults to 0 in getFusionLoss
                const fLoss = getFusionLoss(fusion, fusionData);

                path.unshift({
                    type: 'FUSION',
                    id: fusion.id,
                    name: fusion.name,
                    loss: fLoss
                });

                // Traverse fusion
                // If we hit 'a', we go to 'b'. If 'b', go to 'a'.
                const otherSide = sourceId.endsWith('-a') ? `${fusion.id}-b` : `${fusion.id}-a`;
                currPortId = otherSide;
                // Node stays same
                continue;
            }

            // C. Is it another Splitter? (Cascading)
            // If sourceId is an OUTPUT of a splitter
            if ('splitters' in node) {
                const parentSplitter = (node as CTOData).splitters.find(s => s.outputPortIds.includes(sourceId));
                if (parentSplitter) {
                    const psCatalog = catalogs.splitters.find(c => c.name === parentSplitter.type);
                    const psLoss = getSplitterLoss(parentSplitter, psCatalog);

                    path.unshift({
                        type: 'SPLITTER',
                        id: parentSplitter.id,
                        name: parentSplitter.name,
                        loss: psLoss,
                        details: `1:${parentSplitter.outputPortIds.length}`
                    });

                    currPortId = parentSplitter.inputPortId;
                    // Node stays same
                    continue;
                }
            }

            // D. Is it an OLT / PON Port? (In POP)
            if ('olts' in node) {
                const pop = node as POPData;
                // Robust check with trim
                const olt = pop.olts.find(o => o.portIds.some(pid => pid.trim() === sourceId.trim()));
                if (olt) {
                    // FOUND OLT!
                    // Lookup Power in Catalog by Name (Longest Prefix Match)
                    const oltNameLower = olt.name.trim().toLowerCase();
                    const matchedCatalog = catalogs.olts
                        .filter(c => oltNameLower.startsWith(c.name.trim().toLowerCase()))
                        .sort((a, b) => b.name.length - a.name.length)[0];

                    oltPower = matchedCatalog ? matchedCatalog.outputPower : 3; // Default 3

                    if (matchedCatalog) {
                        console.log(`Matched OLT Catalog: "${matchedCatalog.name}" (${matchedCatalog.outputPower}dBm) for "${olt.name}"`);
                    } else {
                        console.log(`No OLT Catalog match for "${olt.name}". Using default 3dBm.`);
                    }

                    // Extract Slot/Port details
                    let slot: number | undefined;
                    let port: number | undefined;

                    if (olt.structure) {
                        const globalPortIndex = olt.portIds.findIndex(pid => pid.trim() === sourceId.trim());
                        if (globalPortIndex !== -1) {
                            const pps = olt.structure.portsPerSlot || 16;
                            slot = Math.floor(globalPortIndex / pps) + 1;
                            port = (globalPortIndex % pps) + 1;
                        }
                    }

                    console.log("OLT Found (Direct):", olt.name, "Slot:", slot, "Port:", port);

                    const details = { name: olt.name, slot, port };

                    path.unshift({
                        type: 'OLT',
                        id: olt.id,
                        name: olt.name,
                        loss: 0,
                        details: `Slot ${slot || '?'} / Port ${port || '?'}`
                    });

                    // Update result variable
                    foundOltDetails = details;
                    break;
                }
            }
            // E. Is it a DIO Port? (Patch Panel)
            if ('dios' in node) {
                const pop = node as POPData;
                const dio = pop.dios.find(d => d.portIds.some(pid => pid.trim() === sourceId.trim()));
                if (dio) {
                    // Found a DIO.
                    // A DIO is a pass-through. We are currently at 'sourceId' (one side of the port).
                    // We need to find what is connected to this DIO port from the OTHER side?
                    // Actually, if we are tracing backwards:
                    // We came from a Cable -> Internal Connection (Patch Cord?) -> DIO Port.
                    // Wait, usually: Cable Fiber -> DIO Back -> DIO Front -> Patch Cord -> OLT.

                    // If `sourceId` is the DIO port, it means we traced FROM a connection that pointed TO this DIO port?
                    // No, `sourceId` is where the signal COMES FROM.
                    // So we are at some element, and its input gets signal from `dio-port-X`.
                    // This means `dio-port-X` is the OUTPUT side of the DIO relative to us.
                    // We need to go THROUGH the DIO to find where `dio-port-X` gets its signal.

                    // In this model, a DIO might just serve as a bridge.
                    // Often, the DIO Port is just a node.
                    // If we found `sourceId` = `dio-port`, we need to find the connection that FEEDS this `dio-port`.

                    // So, we treat DIO as an element in the path.
                    path.unshift({
                        type: 'CONNECTOR', // DIO is basically a connector/adaptor
                        id: dio.id,
                        name: dio.name,
                        loss: 0.5, // Standard connector loss (0.5 dB)
                        details: `Port ${sourceId}`
                    });

                    // Now we need to find what connects TO this DIO port.
                    // We set `currPortId` to the DIO port ID, and let the loop find the connection feeding it.
                    // BUT, we just came from a connection where `sourceId` WAS this port.
                    // So we need to find a connection where `targetId` === this port.

                    currPortId = sourceId;
                    continue;
                }
            }
        } else {
            // No internal connection found for currPortId.
            // Dead end or OLT direct connection?
            if ('olts' in node) {
                const pop = node as POPData;
                const olt = pop.olts.find(o => o.portIds.some(pid => pid.trim() === currPortId.trim()));

                if (olt) {
                    // FOUND OLT!
                    const oltNameLower = olt.name.trim().toLowerCase();
                    const matchedCatalog = catalogs.olts
                        .filter(c => oltNameLower.startsWith(c.name.trim().toLowerCase()))
                        .sort((a, b) => b.name.length - a.name.length)[0];

                    oltPower = matchedCatalog ? matchedCatalog.outputPower : 3; // Default 3

                    if (matchedCatalog) {
                        console.log(`Matched OLT Catalog (Fallback): "${matchedCatalog.name}" (${matchedCatalog.outputPower}dBm) for "${olt.name}"`);
                    }

                    let slot: number | undefined;
                    let port: number | undefined;

                    if (olt.structure) {
                        const globalPortIndex = olt.portIds.findIndex(pid => pid.trim() === currPortId.trim());
                        if (globalPortIndex !== -1) {
                            const pps = olt.structure.portsPerSlot || 16;
                            slot = Math.floor(globalPortIndex / pps) + 1;
                            port = (globalPortIndex % pps) + 1;
                        }
                    }

                    console.log("OLT Found (No Conn):", olt.name, "Slot:", slot, "Port:", port);

                    const details = { name: olt.name, slot, port };

                    path.unshift({
                        type: 'OLT',
                        id: olt.id,
                        name: olt.name,
                        loss: 0,
                        details: `Slot ${slot || '?'} / Port ${port || '?'}`
                    });

                    foundOltDetails = details;
                    break;
                }
            }

            // If not connected, break
            break;
        }
    }

    // Post-Process: Merge consecutive CABLE elements (User requirement: "Consider as one cable")
    const compressedPath: OpticalElement[] = [];
    if (path.length > 0) {
        let buffer = { ...path[0] };

        for (let i = 1; i < path.length; i++) {
            const current = path[i];

            if (buffer.type === 'CABLE' && current.type === 'CABLE') {
                // Merge
                buffer.loss += current.loss;
                buffer.length = (buffer.length || 0) + (current.length || 0);
                buffer.details = `${(buffer.length || 0).toFixed(0)}m`;
                // Keep the name of the upstream segment (buffer)
            } else {
                // Push buffer and start new
                compressedPath.push(buffer);
                buffer = { ...current };
            }
        }
        compressedPath.push(buffer);
    } else {
        // Should not happen, but safety
        // path is empty
    }

    // Use compressed path for result
    const finalPath = compressedPath.length > 0 ? compressedPath : path;

    // Calculate Total Loss
    // Calculate Total Loss
    const totalLoss = finalPath.reduce((acc, el) => acc + el.loss, 0);

    // Determine Power & Status based on connection
    let finalPower = -Infinity; // Default to No Signal
    let status: 'OK' | 'MARGINAL' | 'FAIL' = 'FAIL';
    let sourceName = 'NO_SIGNAL';

    if (foundOltDetails) {
        // Connected to OLT
        // oltPower was set to 3 (or catalog value) inside the loop
        finalPower = oltPower - totalLoss;
        sourceName = foundOltDetails.name;

        if (finalPower < -28) status = 'FAIL';
        else if (finalPower < -25) status = 'MARGINAL';
        else status = 'OK';
    } else {
        // Connection Broken / No OLT found
        // Determine status is FAIL (already set)
        // finalPower remains -Infinity
        // sourceName is 'Sem Sinal'
    }

    return {
        path: finalPath,
        totalLoss,
        oltPower: foundOltDetails ? oltPower : 0, // Show 0 if disconnected
        finalPower,
        status,
        sourceName,
        oltDetails: foundOltDetails
    };
}
