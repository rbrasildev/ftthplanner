import type {
    CableData,
    OpticalLinkResult,
    OpticalLinkStatus,
    POPData,
    SwitchPort,
} from '../types';
import { analyzeOpticalLink, buildLinkOptico, statusColor } from './opticalLink';
import { traceDioPortToCable } from './switchFiber';

export interface SwitchLinkOnCable {
    popId: string;
    popName: string;
    switchId: string;
    switchName: string;
    portId: string;
    portLabel: string;
    fiberIndex: number;           // 0-based
    result: OpticalLinkResult;
}

export interface CableOpticalStatus {
    /** Pior status entre todos os switch links que passam pelo cabo. */
    status: OpticalLinkStatus;
    /** Cor derivada do status (hex) pra usar no render do cabo. */
    color: string;
    links: SwitchLinkOnCable[];
}

/** Ranking para determinar "pior" status. */
const STATUS_RANK: Record<OpticalLinkStatus, number> = {
    OK: 0,
    MARGINAL: 1,
    NO_SIGNAL: 2,
};

/** Cor hexadecimal associada a cada status — usado no render do cabo no mapa. */
const STATUS_HEX: Record<OpticalLinkStatus, string> = {
    OK: '#22c55e',        // Verde
    MARGINAL: '#eab308',  // Amarelo
    NO_SIGNAL: '#ef4444', // Vermelho
};

/**
 * Percorre todos os POPs/switches e agrega por `cableId` os switch links ativos
 * que trafegam pelo cabo. Resultado alimenta o mapa e popup.
 *
 * Regras:
 *   - Só considera portas com GBIC + allocation válida + trace encontrando cabo.
 *   - Distância do link = comprimento geodésico do cabo (via buildLinkOptico).
 *   - Perdas usam overrides por-porta (linkLossConfig) ou defaults.
 */
export function computeCableStatusMap(
    pops: POPData[],
    cables: CableData[]
): Map<string, CableOpticalStatus> {
    const cableById = new Map(cables.map(c => [c.id, c]));
    const out = new Map<string, CableOpticalStatus>();

    for (const pop of pops) {
        const switches = pop.switches ?? [];
        if (switches.length === 0) continue;
        for (const sw of switches) {
            for (const port of sw.ports) {
                const link = buildSwitchPortLink(port, pop, cableById);
                if (!link) continue;

                const entry = out.get(link.cableId);
                const summary: SwitchLinkOnCable = {
                    popId: pop.id,
                    popName: pop.name,
                    switchId: sw.id,
                    switchName: sw.name,
                    portId: port.id,
                    portLabel: port.label ?? port.id,
                    fiberIndex: link.fiberIndex,
                    result: link.result,
                };
                if (!entry) {
                    out.set(link.cableId, {
                        status: link.result.status,
                        color: STATUS_HEX[link.result.status],
                        links: [summary],
                    });
                } else {
                    entry.links.push(summary);
                    if (STATUS_RANK[link.result.status] > STATUS_RANK[entry.status]) {
                        entry.status = link.result.status;
                        entry.color = STATUS_HEX[link.result.status];
                    }
                }
            }
        }
    }

    return out;
}

/** Resolve a porta do switch para um link óptico concreto, se possível. */
function buildSwitchPortLink(
    port: SwitchPort,
    pop: POPData,
    cableById: Map<string, CableData>
): { cableId: string; fiberIndex: number; result: OpticalLinkResult } | null {
    if (!port.gbic || !port.allocation?.txDioPortId) return null;
    const trace = traceDioPortToCable(port.allocation.txDioPortId, pop.connections);
    if (!trace) return null;
    const cable = cableById.get(trace.cableId);
    if (!cable) return null;
    const link = buildLinkOptico(cable, {
        conectores: port.linkLossConfig?.conectores,
        fusoes: port.linkLossConfig?.fusoes,
        atenuacaoFibraDbPorKm: port.linkLossConfig?.atenuacaoFibraDbPorKm,
        perdaPorConectorDb: port.linkLossConfig?.perdaPorConectorDb,
        perdaPorFusaoDb: port.linkLossConfig?.perdaPorFusaoDb,
    });
    return {
        cableId: trace.cableId,
        fiberIndex: trace.fiberIndex,
        result: analyzeOpticalLink(port.gbic, link),
    };
}

export { STATUS_HEX as CABLE_STATUS_HEX_BY_OPTICAL };
export { statusColor };
