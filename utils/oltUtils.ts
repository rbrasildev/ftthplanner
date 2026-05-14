import { OLT } from '../types';
import { OLTCatalogItem } from '../services/catalogService';

export interface OLTPowerResolution {
    matchedCatalog: OLTCatalogItem | undefined;
    /** Potência efetiva (dBm): override por porta > catálogo > default Class B+ (+3). */
    oltPower: number;
    slot?: number;
    port?: number;
    /** "slot-port" (1-indexed) se ambos puderam ser resolvidos. */
    portKey?: string;
    /** Override de potência específico desta porta, se existir no catálogo. */
    portOverride?: number;
}

/**
 * Resolve catálogo + slot/porta + potência efetiva de uma OLT a partir do ID
 * de porta sendo traçado.
 *
 * Antes deste helper, esta lógica de ~25 linhas estava duplicada em 4 ramos do
 * trace óptico (traceOpticalPath × 2 e walkUpstreamForPower × 2), com risco de
 * divergência sempre que regra de matching ou cálculo de slot/porta mudasse.
 *
 * Match por nome usa "longest prefix": pega o item do catálogo cujo nome é o
 * prefixo mais longo do nome da OLT (case-insensitive). Permite registrar uma
 * família ("OLT-XYZ") no catálogo e várias instâncias herdarem a configuração.
 */
export function resolveOLTPower(
    olt: OLT,
    portId: string,
    catalogOLTs: OLTCatalogItem[]
): OLTPowerResolution {
    const oltNameLower = olt.name.trim().toLowerCase();
    const matchedCatalog = catalogOLTs
        .filter(c => oltNameLower.startsWith(c.name.trim().toLowerCase()))
        .sort((a, b) => b.name.length - a.name.length)[0];

    let slot: number | undefined;
    let port: number | undefined;

    if (olt.structure) {
        const globalPortIndex = olt.portIds.findIndex(pid => pid.trim() === portId.trim());
        if (globalPortIndex !== -1) {
            const pps = olt.structure.portsPerSlot || 16;
            slot = Math.floor(globalPortIndex / pps) + 1;
            port = (globalPortIndex % pps) + 1;
        }
    }

    const portKey = slot && port ? `${slot}-${port}` : undefined;
    const portOverride = portKey ? matchedCatalog?.portPowers?.[portKey] : undefined;
    const oltPower = Number.isFinite(portOverride as number)
        ? (portOverride as number)
        : (matchedCatalog ? matchedCatalog.outputPower : 3);

    return { matchedCatalog, oltPower, slot, port, portKey, portOverride };
}
