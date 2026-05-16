import type {
    CableData,
    CTOData,
    DirectSwitchLink,
    DIO,
    FiberConnection,
    Gbic,
    OLT,
    POPData,
    SwitchData,
    SwitchFiberAllocation,
    SwitchPort,
} from '../types';
import { analyzeOpticalLink, buildLinkOptico, buildPathLinkOptico } from './opticalLink';

/** Regex pra identificar IDs de fibra de cabo (formato `${cableId}-fiber-${N}`). */
const FIBER_ID_RE = /^.+-fiber-\d+$/;

/**
 * Quantas portas de DIO uma porta de switch consome:
 *   duplex → 2 (TX/RX em portas diferentes)
 *   bidi   → 1 (TX/RX na mesma porta)
 */
export function portsNeededForGbic(gbic: Pick<Gbic, 'transmissao'>): 1 | 2 {
    return gbic.transmissao === 'duplex' ? 2 : 1;
}

/** Mantido por retrocompat — número de fibras usadas no cabo downstream. */
export function fibersNeededForGbic(gbic: Pick<Gbic, 'transmissao'>): 1 | 2 {
    return portsNeededForGbic(gbic);
}

export interface OccupiedDioPort {
    dioId: string;
    dioPortId: string;
    /** Fonte da ocupação (switch port id, outro fusion/connection, etc). */
    ownerId: string;
    kind: 'switch' | 'connection';
}

/**
 * Portas de DIO já alocadas por switches do POP.
 * Caller pode excluir portas do próprio switch port sob edição (ver opts.excludePortId).
 */
export function collectSwitchOccupiedDioPorts(
    switches: SwitchData[] | undefined,
    opts: { excludePortId?: string } = {}
): OccupiedDioPort[] {
    const out: OccupiedDioPort[] = [];
    if (!switches) return out;
    for (const sw of switches) {
        for (const port of sw.ports) {
            if (port.id === opts.excludePortId) continue;
            const a = port.allocation;
            if (!a) continue;
            out.push({ dioId: a.dioId, dioPortId: a.txDioPortId, ownerId: port.id, kind: 'switch' });
            if (a.rxDioPortId !== a.txDioPortId) {
                out.push({ dioId: a.dioId, dioPortId: a.rxDioPortId, ownerId: port.id, kind: 'switch' });
            }
        }
    }
    return out;
}

/**
 * Portas de DIO ocupadas por FiberConnection que NÃO sejam do próprio switch.
 * Serve pra cruzar com conexões existentes (ex: DIO port spliceada para um cabo
 * já está "in use" para outro propósito, mas isso é splicing — não necessariamente
 * impede a porta de terminar num switch se a intenção é justamente patchear).
 *
 * Por ora só usamos as alocações de outros switches; deixamos esta função pronta
 * caso a regra evolua.
 */
export function collectConnectionOccupiedDioPorts(
    connections: FiberConnection[] | undefined,
    dioPortIds: Set<string>,
    opts: { excludeSourceIdStartsWith?: string } = {}
): OccupiedDioPort[] {
    if (!connections) return [];
    const out: OccupiedDioPort[] = [];
    for (const c of connections) {
        if (opts.excludeSourceIdStartsWith && (
            c.sourceId.startsWith(opts.excludeSourceIdStartsWith) ||
            c.targetId.startsWith(opts.excludeSourceIdStartsWith)
        )) continue;
        if (dioPortIds.has(c.sourceId)) {
            out.push({ dioId: '', dioPortId: c.sourceId, ownerId: c.id, kind: 'connection' });
        }
        if (dioPortIds.has(c.targetId)) {
            out.push({ dioId: '', dioPortId: c.targetId, ownerId: c.id, kind: 'connection' });
        }
    }
    return out;
}

// ---------- Direct switch↔switch links ----------

export interface OccupiedSwitchPort {
    /** ID do equipamento dono da porta — pode ser switch OU OLT. */
    switchId: string;
    portId: string;
    ownerId: string; // ID da porta que ocupa
    peerKind?: 'switch' | 'olt';
}

/**
 * Portas de switches E uplinks de OLTs já ocupadas por direct links.
 * Cada directLink é single-sided (armazenado na porta do switch que iniciou).
 * Ao renderizar, a porta peer também conta como ocupada.
 */
export function collectOccupiedSwitchPorts(
    switches: SwitchData[] | undefined,
    opts: { excludePortId?: string } = {}
): OccupiedSwitchPort[] {
    const out: OccupiedSwitchPort[] = [];
    if (!switches) return out;
    for (const sw of switches) {
        for (const port of sw.ports) {
            if (port.id === opts.excludePortId) continue;
            if (!port.directLink) continue;
            out.push({ switchId: sw.id, portId: port.id, ownerId: port.id });
            out.push({
                switchId: port.directLink.peerSwitchId,
                portId: port.directLink.peerPortId,
                ownerId: port.id,
                peerKind: port.directLink.peerKind ?? 'switch',
            });
        }
    }
    return out;
}

export type DirectLinkIssue =
    | { kind: 'self_link' }
    | { kind: 'peer_switch_missing' }
    | { kind: 'peer_port_missing' }
    | { kind: 'peer_port_occupied' }
    | { kind: 'peer_gbic_missing' }
    | { kind: 'peer_transmission_mismatch'; self: string; peer: string }
    | { kind: 'olt_port_not_uplink' };

export interface DirectLinkValidation {
    ok: boolean;
    issues: DirectLinkIssue[];
}

/**
 * Valida um directLink proposto — peer pode ser outro switch ou um uplink de OLT.
 *
 * Regras:
 *   - Não pode linkar na própria porta (self-link).
 *   - Switch peer: precisa existir; porta peer existe; tem GBIC; transmissão compatível.
 *   - OLT peer: OLT existe; portId está em `uplinkPortIds` (não aceita porta GPON).
 *   - Peer port não pode estar ocupada por outro direct link (fora o próprio).
 */
export function validateDirectLink(args: {
    selfPortId: string;
    selfGbic: Pick<Gbic, 'transmissao'> | undefined;
    directLink: DirectSwitchLink;
    switches: SwitchData[];
    olts?: OLT[];
}): DirectLinkValidation {
    const issues: DirectLinkIssue[] = [];
    const { selfPortId, selfGbic, directLink, switches, olts } = args;
    const { peerKind, peerSwitchId, peerPortId } = directLink;
    const kind = peerKind ?? 'switch';

    if (peerPortId === selfPortId) issues.push({ kind: 'self_link' });

    if (kind === 'olt') {
        const olt = (olts ?? []).find(o => o.id === peerSwitchId);
        if (!olt) {
            issues.push({ kind: 'peer_switch_missing' });
            return { ok: false, issues };
        }
        if (!peerPortId) {
            issues.push({ kind: 'peer_port_missing' });
            return { ok: false, issues };
        }
        const isUplink = deriveOltUplinkIds(olt).includes(peerPortId);
        if (!isUplink) {
            // Pode ser que o usuário tenha escolhido porta GPON; bloqueia.
            const isGpon = (olt.portIds ?? []).includes(peerPortId);
            issues.push(isGpon ? { kind: 'olt_port_not_uplink' } : { kind: 'peer_port_missing' });
        }
        const occupied = collectOccupiedSwitchPorts(switches, { excludePortId: selfPortId });
        const conflict = occupied.some(o => o.portId === peerPortId && o.ownerId !== selfPortId);
        if (conflict) issues.push({ kind: 'peer_port_occupied' });
        // OLT uplink não tem GBIC modelado — não validamos transmissão/gbic.
        return { ok: issues.length === 0, issues };
    }

    // kind === 'switch'
    const peerSwitch = switches.find(s => s.id === peerSwitchId);
    if (!peerSwitch) {
        issues.push({ kind: 'peer_switch_missing' });
        return { ok: false, issues };
    }
    const peerPort = peerSwitch.ports.find(p => p.id === peerPortId);
    if (!peerPort) {
        issues.push({ kind: 'peer_port_missing' });
        return { ok: false, issues };
    }

    const occupied = collectOccupiedSwitchPorts(switches, { excludePortId: selfPortId });
    // Quando salvamos um direct link, o peer recebe o link espelhado de volta.
    // Esse espelho gera uma entrada `{portId: peerPortId, ownerId: peerPortId}` no
    // collectOccupiedSwitchPorts — não é "outro link", é a mesma conexão. Ignora.
    const peerMirrorsBack = peerPort.directLink?.peerPortId === selfPortId;
    const conflict = occupied.some(o => {
        if (o.portId !== peerPortId) return false;
        if (o.ownerId === selfPortId) return false;
        if (o.ownerId === peerPortId && peerMirrorsBack) return false;
        return true;
    });
    if (conflict) issues.push({ kind: 'peer_port_occupied' });

    if (!peerPort.gbic) {
        issues.push({ kind: 'peer_gbic_missing' });
    } else if (selfGbic && peerPort.gbic.transmissao !== selfGbic.transmissao) {
        issues.push({
            kind: 'peer_transmission_mismatch',
            self: selfGbic.transmissao,
            peer: peerPort.gbic.transmissao,
        });
    }

    return { ok: issues.length === 0, issues };
}

export function describeDirectLinkIssue(issue: DirectLinkIssue): string {
    switch (issue.kind) {
        case 'self_link': return 'Não é possível linkar a porta nela mesma.';
        case 'peer_switch_missing': return 'Equipamento peer não encontrado.';
        case 'peer_port_missing': return 'Porta do peer não existe.';
        case 'peer_port_occupied': return 'Porta do peer já está em uso por outro link.';
        case 'peer_gbic_missing': return 'A porta do peer não tem GBIC — sinal sem receptor.';
        case 'peer_transmission_mismatch':
            return `Transmissão incompatível: ${issue.self} num lado e ${issue.peer} no outro.`;
        case 'olt_port_not_uplink':
            return 'Porta da OLT não é uplink — só portas de uplink aceitam link direto.';
    }
}

/** Valores default pra OLT uplink (SFP típico 1G/10G) quando não há catálogo. */
const OLT_UPLINK_DEFAULT_TX_DBM = 0;
const OLT_UPLINK_DEFAULT_RX_DBM = -24;

/**
 * Deriva uplinkPortIds de uma OLT, tolerante a dados legados onde
 * `uplinkPortIds` pode estar faltando mesmo com `uplinkPorts > 0`.
 * Usa o mesmo padrão de ID que `handleAddOLT` gera (`${id}-uplink-${N}`).
 */
function deriveOltUplinkIds(olt: OLT): string[] {
    if (olt.uplinkPortIds && olt.uplinkPortIds.length > 0) return olt.uplinkPortIds;
    const count = olt.uplinkPorts ?? 0;
    return Array.from({ length: count }, (_, i) => `${olt.id}-uplink-${i + 1}`);
}

/** Shape mínimo do item de catálogo GBIC que `resolveDirectPeer` consome. */
export interface CatalogGbicLookup {
    id: string;
    name: string;
    tipo: string;
    modoFibra: string;
    transmissao: string;
    potenciaTx: number;
    sensibilidadeRx: number;
    waveTxNm?: number | null;
    waveRxNm?: number | null;
}

/**
 * Resolve o peer endpoint para uma porta que está em direct link.
 * Funciona pra peer 'switch' OU 'olt' (uplink).
 *
 * Para OLT: se `directLink.peerGbicCatalogId` + `gbicCatalog` estiverem
 * disponíveis, usa os valores reais de TX/RX/λ. Caso contrário, sintetiza
 * com defaults conservadores pra o cálculo não quebrar.
 */
export function resolveDirectPeer(
    port: SwitchPort,
    switches: SwitchData[],
    olts: OLT[] | undefined,
    popId: string,
    popName: string,
    selfGbic?: Pick<Gbic, 'transmissao'>,
    gbicCatalog?: CatalogGbicLookup[],
): SwitchEndpoint | null {
    if (!port.directLink) return null;
    const kind = port.directLink.peerKind ?? 'switch';

    if (kind === 'olt') {
        const olt = (olts ?? []).find(o => o.id === port.directLink!.peerSwitchId);
        if (!olt) return null;
        const uplinkIdx = deriveOltUplinkIds(olt).indexOf(port.directLink.peerPortId);
        if (uplinkIdx < 0) return null;

        // Se há GBIC cadastrado no catálogo pra essa uplink, usa real
        const catGbic = port.directLink.peerGbicCatalogId
            ? gbicCatalog?.find(g => g.id === port.directLink!.peerGbicCatalogId)
            : undefined;

        const virtualPort: SwitchPort = {
            id: port.directLink.peerPortId,
            label: `uplink ${uplinkIdx + 1}`,
            gbic: catGbic
                ? {
                    id: `olt-uplink-gbic-${port.directLink.peerPortId}`,
                    catalogId: catGbic.id,
                    name: catGbic.name,
                    tipo: catGbic.tipo as Gbic['tipo'],
                    modoFibra: catGbic.modoFibra as Gbic['modoFibra'],
                    transmissao: catGbic.transmissao as Gbic['transmissao'],
                    waveTxNm: catGbic.waveTxNm ?? undefined,
                    waveRxNm: catGbic.waveRxNm ?? undefined,
                    potenciaTx: catGbic.potenciaTx,
                    sensibilidadeRx: catGbic.sensibilidadeRx,
                }
                : {
                    id: `olt-uplink-virtual-${port.directLink.peerPortId}`,
                    name: `${olt.name} uplink SFP (estimado)`,
                    tipo: 'SFP',
                    modoFibra: 'monomodo',
                    transmissao: selfGbic?.transmissao ?? 'duplex',
                    potenciaTx: OLT_UPLINK_DEFAULT_TX_DBM,
                    sensibilidadeRx: OLT_UPLINK_DEFAULT_RX_DBM,
                },
        };
        return {
            popId,
            popName,
            dioId: '',
            dioPortId: '',
            switchId: olt.id,
            switchName: olt.name,
            port: virtualPort,
        };
    }

    const peerSwitch = switches.find(s => s.id === port.directLink!.peerSwitchId);
    if (!peerSwitch) return null;
    const peerPort = peerSwitch.ports.find(p => p.id === port.directLink!.peerPortId);
    if (!peerPort) return null;
    return {
        popId,
        popName,
        dioId: '',
        dioPortId: '',
        switchId: peerSwitch.id,
        switchName: peerSwitch.name,
        port: peerPort,
    };
}

export type AllocationIssue =
    | { kind: 'dio_missing' }
    | { kind: 'port_not_in_dio'; portId: string }
    | { kind: 'bidi_mismatch' }
    | { kind: 'duplex_needs_two' }
    | { kind: 'already_used'; dioPortId: string };

export interface AllocationValidation {
    ok: boolean;
    issues: AllocationIssue[];
}

/**
 * Valida uma alocação proposta.
 *
 * Regras:
 *   - Duplex: txDioPortId !== rxDioPortId, ambas existindo no DIO informado.
 *   - BiDi:   txDioPortId === rxDioPortId.
 *   - Portas do DIO referenciadas devem existir.
 *   - Portas não podem estar já alocadas em outro switch port do POP.
 */
export function validateAllocation(args: {
    gbic: Pick<Gbic, 'transmissao'>;
    allocation: SwitchFiberAllocation;
    dio: Pick<DIO, 'id' | 'portIds'> | undefined;
    otherOccupied: OccupiedDioPort[];
}): AllocationValidation {
    const issues: AllocationIssue[] = [];
    const { gbic, allocation, dio, otherOccupied } = args;
    const { dioId, txDioPortId, rxDioPortId } = allocation;

    if (!dio || dio.id !== dioId) {
        issues.push({ kind: 'dio_missing' });
        return { ok: false, issues };
    }

    const portSet = new Set(dio.portIds);
    if (!portSet.has(txDioPortId)) {
        issues.push({ kind: 'port_not_in_dio', portId: txDioPortId });
    }
    if (!portSet.has(rxDioPortId)) {
        issues.push({ kind: 'port_not_in_dio', portId: rxDioPortId });
    }

    if (gbic.transmissao === 'bidi') {
        if (txDioPortId !== rxDioPortId) {
            issues.push({ kind: 'bidi_mismatch' });
        }
    } else if (txDioPortId === rxDioPortId) {
        issues.push({ kind: 'duplex_needs_two' });
    }

    for (const used of otherOccupied) {
        if (used.dioId && used.dioId !== dioId) continue;
        if (used.dioPortId === txDioPortId || used.dioPortId === rxDioPortId) {
            issues.push({ kind: 'already_used', dioPortId: used.dioPortId });
        }
    }

    return { ok: issues.length === 0, issues };
}

/**
 * Sugere a próxima alocação livre num DIO.
 * Duplex: dois primeiros portIds livres (não precisa consecutivo — DIO é flexível).
 * BiDi:   primeiro portId livre.
 */
export function suggestNextAllocation(args: {
    gbic: Pick<Gbic, 'transmissao'>;
    dio: Pick<DIO, 'id' | 'portIds'>;
    otherOccupied: OccupiedDioPort[];
}): SwitchFiberAllocation | null {
    const { gbic, dio, otherOccupied } = args;
    const busy = new Set(
        otherOccupied
            .filter(o => !o.dioId || o.dioId === dio.id)
            .map(o => o.dioPortId)
    );
    const free = dio.portIds.filter(id => !busy.has(id));

    if (gbic.transmissao === 'bidi') {
        if (free.length < 1) return null;
        return { dioId: dio.id, txDioPortId: free[0], rxDioPortId: free[0] };
    }
    if (free.length < 2) return null;
    return { dioId: dio.id, txDioPortId: free[0], rxDioPortId: free[1] };
}

export function describeAllocationIssue(issue: AllocationIssue): string {
    switch (issue.kind) {
        case 'dio_missing':
            return 'DIO selecionado não encontrado.';
        case 'port_not_in_dio':
            return `Porta "${issue.portId}" não existe no DIO informado.`;
        case 'bidi_mismatch':
            return 'BiDi deve usar a mesma porta de DIO para TX e RX.';
        case 'duplex_needs_two':
            return 'Duplex exige 2 portas de DIO diferentes (TX e RX).';
        case 'already_used':
            return `Porta "${issue.dioPortId}" já está alocada em outro switch deste POP.`;
    }
}

/**
 * Rastreia a partir de um portId do DIO qual cabo e fibra estão spliceados.
 * Retorna null se a porta não estiver conectada a um cabo.
 *
 * Assume-se o padrão do sistema: o DIO port se liga via FiberConnection a
 * `${cableId}-fiber-${index}` (ou vice-versa).
 */
export function traceDioPortToCable(
    dioPortId: string,
    connections: FiberConnection[] | undefined
): { cableId: string; fiberIndex: number } | null {
    if (!connections) return null;
    for (const c of connections) {
        const other =
            c.sourceId === dioPortId ? c.targetId
            : c.targetId === dioPortId ? c.sourceId
            : null;
        if (!other) continue;
        const m = other.match(/^(.+)-fiber-(\d+)$/);
        if (m) {
            return { cableId: m[1], fiberIndex: Number(m[2]) };
        }
    }
    return null;
}

/** Switch port terminando numa ponta do cabo/fibra. */
export interface SwitchEndpoint {
    popId: string;
    popName: string;
    dioId: string;
    dioPortId: string;
    switchId: string;
    switchName: string;
    port: SwitchPort;
}

/**
 * Coleta TODAS as FiberConnection do projeto (POPs + CTOs) — usado pelo BFS
 * que atravessa sangrias/fusões entre fibras de cabos diferentes.
 */
function collectAllConnections(pops: POPData[], ctos?: CTOData[]): FiberConnection[] {
    const out: FiberConnection[] = [];
    for (const pop of pops) {
        if (pop.connections) out.push(...pop.connections);
    }
    for (const cto of ctos ?? []) {
        if (cto.connections) out.push(...cto.connections);
    }
    return out;
}

/** ID de uma das pernas (a/b) de um FusionPoint, ex: "fusion-1234-a". */
const FUSION_LEG_RE = /^(.+)-(a|b)$/;

/**
 * BFS no grafo de splices: expande um fiberId inicial (`${cable}-fiber-${N}`)
 * pra todas as fibras alcançáveis via sangrias/fusões através de qualquer
 * CTO, CEO ou POP.
 *
 * Dois tipos de splice são atravessados:
 *  1. Sangria direta fibra↔fibra (FiberConnection entre dois `*-fiber-N`).
 *  2. Fusão via FusionPoint: o fiber está conectado a `fusion-X-a`, e
 *     `fusion-X-b` está conectado a outro fiber. O BFS entra pela perna
 *     A e sai automaticamente pela B (e vice-versa).
 *
 * Antes da #2, switches conectados via cabo→CTO(fusão)→cabo→outro switch
 * nunca encontravam o peer porque o BFS parava na primeira perna da fusão.
 *
 * Retorna o Set de fiberIds alcançáveis (inclui o inicial).
 */
export function expandReachableFibers(
    startFiberId: string,
    allConnections: FiberConnection[]
): Set<string> {
    const reachable = new Set<string>([startFiberId]);
    const visitedNonFiber = new Set<string>();
    const queue: string[] = [startFiberId];

    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const c of allConnections) {
            const other =
                c.sourceId === cur ? c.targetId
                : c.targetId === cur ? c.sourceId
                : null;
            if (!other) continue;

            // Outra fibra: adiciona ao set e continua o BFS por ela.
            if (FIBER_ID_RE.test(other)) {
                if (!reachable.has(other)) {
                    reachable.add(other);
                    queue.push(other);
                }
                continue;
            }

            // Perna de fusão (`fusion-X-a` / `fusion-X-b`): a outra perna
            // representa a continuidade óptica da fusão — empurra ela na fila
            // pra o próximo ciclo achar o fiber do outro lado.
            const legMatch = other.match(FUSION_LEG_RE);
            if (legMatch && !visitedNonFiber.has(other)) {
                visitedNonFiber.add(other);
                const fusionId = legMatch[1];
                const side = legMatch[2];
                const otherLeg = `${fusionId}-${side === 'a' ? 'b' : 'a'}`;
                if (!visitedNonFiber.has(otherLeg)) {
                    visitedNonFiber.add(otherLeg);
                    queue.push(otherLeg);
                }
            }
            // Outros endpoints (DIO ports, splitter ports) são fim de linha —
            // não expandem a reachability óptica de cabos.
        }
    }
    return reachable;
}

/**
 * Dado um cable+fiberIndex, procura em todos os POPs quais switch ports terminam
 * naquela fibra (via splice para porta do DIO → patch cord para switch port).
 *
 * O trace **atravessa sangrias**: se a fibra A foi emendada com a fibra B num
 * CTO/CEO, ambas são consideradas o mesmo caminho óptico.
 *
 * Pode retornar 0, 1 ou 2+ endpoints:
 *   - 0: fibra sem switch (talvez conectada a OLT ou dangling)
 *   - 1: só um lado (fibra "dangling" — outro lado não tem switch ainda)
 *   - 2: link switch↔switch (caso típico)
 *   - 3+: topologia estranha (multiponto) — pode acontecer com hubs/splitters
 */
export function findSwitchEndpointsOnFiber(args: {
    cableId: string;
    fiberIndex: number;
    pops: POPData[];
    /** CTOs/CEOs onde ficam as sangrias. Sem isso não consegue atravessar emendas. */
    ctos?: CTOData[];
}): SwitchEndpoint[] {
    const startFiberId = `${args.cableId}-fiber-${args.fiberIndex}`;
    const allConns = collectAllConnections(args.pops, args.ctos);
    const reachableFibers = expandReachableFibers(startFiberId, allConns);

    const out: SwitchEndpoint[] = [];
    for (const pop of args.pops) {
        // DIO ports deste POP que estão spliceados a QUALQUER uma das fibras alcançáveis.
        const dioPortsOnFiber = new Set<string>();
        for (const c of pop.connections || []) {
            if (reachableFibers.has(c.sourceId) && !FIBER_ID_RE.test(c.targetId)) {
                dioPortsOnFiber.add(c.targetId);
            } else if (reachableFibers.has(c.targetId) && !FIBER_ID_RE.test(c.sourceId)) {
                dioPortsOnFiber.add(c.sourceId);
            }
        }
        if (dioPortsOnFiber.size === 0) continue;

        for (const sw of pop.switches || []) {
            for (const port of sw.ports) {
                const a = port.allocation;
                if (!a) continue;
                const matches =
                    dioPortsOnFiber.has(a.txDioPortId) ||
                    (a.rxDioPortId !== a.txDioPortId && dioPortsOnFiber.has(a.rxDioPortId));
                if (!matches) continue;
                const dioPortId = dioPortsOnFiber.has(a.txDioPortId) ? a.txDioPortId : a.rxDioPortId;
                out.push({
                    popId: pop.id,
                    popName: pop.name,
                    dioId: a.dioId,
                    dioPortId,
                    switchId: sw.id,
                    switchName: sw.name,
                    port,
                });
            }
        }
    }

    return out;
}

/**
 * Encontra o switch port peer de uma porta de switch — ou seja, o switch port
 * que termina na outra ponta da mesma fibra do cabo que este port está usando.
 *
 * Atravessa sangrias/fusões — se a fibra A emendou em B num CTO, o peer na
 * ponta da fibra B é encontrado normalmente.
 *
 * Retorna null se não houver peer (fibra dangling, OLT na outra ponta, etc).
 */
export function tracePeerSwitchPort(args: {
    myPortId: string;
    cableId: string;
    fiberIndex: number;
    pops: POPData[];
    ctos?: CTOData[];
}): SwitchEndpoint | null {
    const endpoints = findSwitchEndpointsOnFiber({
        cableId: args.cableId,
        fiberIndex: args.fiberIndex,
        pops: args.pops,
        ctos: args.ctos,
    });
    const peer = endpoints.find(e => e.port.id !== args.myPortId);
    return peer ?? null;
}

// ---------- Trace completo (multi-cabo com sangrias) ----------

/** Descreve um cabo percorrido no caminho óptico entre dois switch ports. */
export interface PathCableSegment {
    cableId: string;
    cableName: string;
    fiberIndex: number;
    lengthKm: number;
}

/** Caminho óptico completo entre duas DIO ports, incluindo sangrias/fusões. */
export interface SwitchLinkPath {
    /** Cabos traversados, na ordem do caminho. */
    cables: PathCableSegment[];
    /** Quantidade de sangrias/fusões fibra→fibra no caminho (excluindo DIO splices). */
    sangriaCount: number;
    /** Distância total em km somada dos cabos. */
    totalDistanceKm: number;
}

/**
 * BFS no grafo de connections (POPs + CTOs) entre fromDioPortId e toDioPortId.
 * Tracka parent pointers pra reconstruir o caminho — sequência de fibra IDs e
 * splices atravessados.
 */
function bfsPath(
    fromId: string,
    toId: string,
    connections: FiberConnection[]
): string[] | null {
    if (fromId === toId) return [fromId];
    const parent = new Map<string, string>();
    const visited = new Set<string>([fromId]);
    const queue: string[] = [fromId];
    let found = false;
    while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur === toId) { found = true; break; }
        for (const c of connections) {
            const other =
                c.sourceId === cur ? c.targetId
                : c.targetId === cur ? c.sourceId
                : null;
            if (!other || visited.has(other)) continue;
            visited.add(other);
            parent.set(other, cur);
            if (other === toId) { found = true; break; }
            queue.push(other);
        }
        if (found) break;
    }
    if (!found) return null;
    const path: string[] = [toId];
    let cur = toId;
    while (cur !== fromId) {
        const p = parent.get(cur);
        if (!p) return null;
        path.unshift(p);
        cur = p;
    }
    return path;
}

/**
 * Traça o caminho óptico completo entre `fromDioPortId` e um peer switch port,
 * seguindo sangrias/fusões ao longo do grafo de splices.
 *
 * Retorna `{ peer, path }` com a lista de cabos percorridos e contagem de
 * sangrias no meio. `path.totalDistanceKm` soma o comprimento geodésico de
 * todos os cabos.
 *
 * Se não houver peer ou não for alcançável, retorna null.
 */
export function traceSwitchLinkPath(args: {
    myPortId: string;
    fromDioPortId: string;
    pops: POPData[];
    ctos?: CTOData[];
    cables: CableData[];
}): { peer: SwitchEndpoint; path: SwitchLinkPath } | null {
    const allConns = collectAllConnections(args.pops, args.ctos);
    const cableById = new Map(args.cables.map(c => [c.id, c]));

    // 1. Acha o endpoint candidato a peer via splice graph (já atravessa sangrias)
    //    — precisamos primeiro descobrir qual cabo/fibra está na nossa ponta:
    const myTrace = traceDioPortToCable(args.fromDioPortId, allConns);
    if (!myTrace) return null;
    const endpoints = findSwitchEndpointsOnFiber({
        cableId: myTrace.cableId,
        fiberIndex: myTrace.fiberIndex,
        pops: args.pops,
        ctos: args.ctos,
    });
    const peer = endpoints.find(e => e.port.id !== args.myPortId);
    if (!peer) return null;

    // 2. BFS entre meu DIO port e o DIO port do peer, via todas as connections
    const nodePath = bfsPath(args.fromDioPortId, peer.dioPortId, allConns);
    if (!nodePath) return null;

    // 3. Extrai os fiber IDs (ignora DIO ports) e calcula cabos + sangrias
    const fiberHops = nodePath.filter(id => FIBER_ID_RE.test(id));
    let sangriaCount = 0;
    // sangrias = pares consecutivos fiber→fiber no path original
    for (let i = 0; i < nodePath.length - 1; i++) {
        if (FIBER_ID_RE.test(nodePath[i]) && FIBER_ID_RE.test(nodePath[i + 1])) {
            sangriaCount++;
        }
    }
    // Cabos únicos percorridos, na ordem de aparição
    const seen = new Set<string>();
    const cables: PathCableSegment[] = [];
    for (const fid of fiberHops) {
        const m = fid.match(/^(.+)-fiber-(\d+)$/);
        if (!m) continue;
        const cableId = m[1];
        const fiberIndex = Number(m[2]);
        if (seen.has(cableId)) continue;
        seen.add(cableId);
        const cable = cableById.get(cableId);
        if (!cable) continue;
        cables.push({
            cableId,
            cableName: cable.name,
            fiberIndex,
            lengthKm: cableLengthKmLocal(cable),
        });
    }
    const totalDistanceKm = cables.reduce((s, c) => s + c.lengthKm, 0);

    return {
        peer,
        path: { cables, sangriaCount, totalDistanceKm },
    };
}

/** Comprimento geodésico do cabo em km (evita import circular com opticalLink). */
function cableLengthKmLocal(cable: Pick<CableData, 'coordinates'>): number {
    const coords = cable.coordinates || [];
    let meters = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        meters += haversine(coords[i], coords[i + 1]);
    }
    return meters / 1000;
}
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371e3;
    const φ1 = a.lat * Math.PI / 180;
    const φ2 = b.lat * Math.PI / 180;
    const Δφ = (b.lat - a.lat) * Math.PI / 180;
    const Δλ = (b.lng - a.lng) * Math.PI / 180;
    const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Checagens de compatibilidade entre dois GBICs num link. */
export type PeerCompatIssue =
    | { kind: 'transmission_mismatch'; self: string; peer: string }
    | { kind: 'wavelength_mismatch'; txNm?: number; rxNm?: number }
    | { kind: 'fiber_mode_mismatch'; self: string; peer: string };

export function checkPeerCompatibility(
    self: Pick<Gbic, 'transmissao' | 'modoFibra' | 'waveTxNm' | 'waveRxNm'>,
    peer: Pick<Gbic, 'transmissao' | 'modoFibra' | 'waveTxNm' | 'waveRxNm'>
): PeerCompatIssue[] {
    const issues: PeerCompatIssue[] = [];

    if (self.transmissao !== peer.transmissao) {
        issues.push({ kind: 'transmission_mismatch', self: self.transmissao, peer: peer.transmissao });
    }
    if (self.modoFibra !== peer.modoFibra) {
        issues.push({ kind: 'fiber_mode_mismatch', self: self.modoFibra, peer: peer.modoFibra });
    }
    // BiDi: minha TX tem que ser a RX do peer, e vice-versa.
    if (self.transmissao === 'bidi' && peer.transmissao === 'bidi'
        && self.waveTxNm != null && peer.waveRxNm != null
        && self.waveTxNm !== peer.waveRxNm) {
        issues.push({ kind: 'wavelength_mismatch', txNm: self.waveTxNm, rxNm: peer.waveRxNm });
    }
    return issues;
}

/**
 * Estado simulado dos LEDs TX e RX de uma porta de switch.
 *
 *   off:  sem GBIC ou sem alocação (porta "desligada")
 *   on:   link operando dentro do budget (OK)
 *   warn: link marginal (amarelo piscando)
 *   fail: sem sinal (vermelho)
 *   idle: GBIC configurado mas path incompleto (ex: DIO não spliceado, peer ausente)
 */
export type LedState = 'off' | 'on' | 'warn' | 'fail' | 'idle';

export interface PortLedStates {
    tx: LedState;
    rx: LedState;
}

/**
 * Calcula TX/RX LEDs de todas as portas de UM switch num POP.
 *
 *   TX on: GBIC + allocation + DIO spliceado a cabo (sinal saindo)
 *   TX idle: GBIC + allocation mas DIO não spliceado (sem path)
 *   TX off: sem GBIC ou sem allocation
 *
 *   RX depende da recepção vinda do peer:
 *     - Sem peer ou peer sem GBIC → idle (link só de um lado)
 *     - Com peer + GBIC: calcula reverse (peer TX → minha sensibilidade)
 *       - margem ≥ 3 dB  → on
 *       - margem 0..3 dB → warn
 *       - margem < 0 dB  → fail
 */
export function computeSwitchPortLedStates(args: {
    sw: SwitchData;
    currentPop: POPData;
    allPops: POPData[];
    cables: CableData[];
    /** CTOs/CEOs do projeto — necessários pra atravessar sangrias no trace do peer. */
    allCtos?: CTOData[];
    /** Catálogo GBIC — usado pra resolver SFP da OLT uplink em direct links. */
    gbicCatalog?: CatalogGbicLookup[];
}): Map<string, PortLedStates> {
    const { sw, currentPop, allPops, cables, allCtos, gbicCatalog } = args;
    const out = new Map<string, PortLedStates>();
    const cableById = new Map(cables.map(c => [c.id, c]));

    for (const port of sw.ports) {
        const state: PortLedStates = { tx: 'off', rx: 'off' };

        if (!port.gbic) {
            out.set(port.id, state);
            continue;
        }

        // --- MODO DIRECT ---
        if (port.directLink) {
            state.tx = 'on';
            const peer = resolveDirectPeer(
                port,
                currentPop.switches || [],
                currentPop.olts,
                currentPop.id,
                currentPop.name,
                port.gbic,
                gbicCatalog,
            );
            const peerPort = peer?.port;
            if (!peerPort || !peerPort.gbic) {
                state.rx = 'idle';
                out.set(port.id, state);
                continue;
            }
            // Patch cord curto — default 3m, sem fusões.
            const link = buildLinkOptico({ coordinates: [] }, {
                distanciaKm: 0.003,
                conectores: port.linkLossConfig?.conectores ?? 2,
                fusoes: port.linkLossConfig?.fusoes ?? 0,
                atenuacaoFibraDbPorKm: port.linkLossConfig?.atenuacaoFibraDbPorKm,
                perdaPorConectorDb: port.linkLossConfig?.perdaPorConectorDb,
                perdaPorFusaoDb: port.linkLossConfig?.perdaPorFusaoDb,
            });
            const reverse = analyzeOpticalLink(
                { potenciaTx: peerPort.gbic.potenciaTx, sensibilidadeRx: port.gbic.sensibilidadeRx },
                link,
            );
            state.rx = reverse.status === 'OK' ? 'on'
                : reverse.status === 'MARGINAL' ? 'warn'
                : 'fail';
            out.set(port.id, state);
            continue;
        }

        // --- MODO DIO ---
        if (!port.allocation?.txDioPortId) {
            // GBIC presente mas porta não foi nem alocada num DIO nem ligada via
            // direct link. tx='idle' faz o LED ficar âmbar fraco no canvas, dando
            // dica visual de que falta um passo de configuração (em vez de cinza
            // total que sugere "porta morta").
            state.tx = 'idle';
            out.set(port.id, state);
            continue;
        }

        const trace = traceDioPortToCable(port.allocation.txDioPortId, currentPop.connections);
        if (!trace) {
            // GBIC configurado, mas fibra não está spliceada
            state.tx = 'idle';
            state.rx = 'idle';
            out.set(port.id, state);
            continue;
        }
        const cable = cableById.get(trace.cableId);
        if (!cable) {
            state.tx = 'idle';
            state.rx = 'idle';
            out.set(port.id, state);
            continue;
        }

        // Sinal nosso sai da porta (TX aceso — o cabo existe)
        state.tx = 'on';

        // Busca peer + path completo (inclui sangrias/fusões cross-cabo)
        const pathTrace = traceSwitchLinkPath({
            myPortId: port.id,
            fromDioPortId: port.allocation.txDioPortId,
            pops: allPops,
            ctos: allCtos,
            cables,
        });

        if (!pathTrace || !pathTrace.peer.port.gbic) {
            state.rx = 'idle';
            out.set(port.id, state);
            continue;
        }

        const peer = pathTrace.peer;

        // Link do path completo — soma comprimentos + conta sangrias como fusões
        const link = buildPathLinkOptico(pathTrace.path, {
            conectores: port.linkLossConfig?.conectores,
            fusoes: port.linkLossConfig?.fusoes,
            atenuacaoFibraDbPorKm: port.linkLossConfig?.atenuacaoFibraDbPorKm,
            perdaPorConectorDb: port.linkLossConfig?.perdaPorConectorDb,
            perdaPorFusaoDb: port.linkLossConfig?.perdaPorFusaoDb,
        });
        const reverse = analyzeOpticalLink(
            { potenciaTx: peer.port.gbic.potenciaTx, sensibilidadeRx: port.gbic.sensibilidadeRx },
            link,
        );
        state.rx = reverse.status === 'OK' ? 'on'
            : reverse.status === 'MARGINAL' ? 'warn'
            : 'fail';
        out.set(port.id, state);
    }

    return out;
}

export function describePeerCompatIssue(issue: PeerCompatIssue): string {
    switch (issue.kind) {
        case 'transmission_mismatch':
            return `Transmissão incompatível: ${issue.self} de um lado, ${issue.peer} do outro.`;
        case 'fiber_mode_mismatch':
            return `Modo de fibra incompatível: ${issue.self} vs ${issue.peer}.`;
        case 'wavelength_mismatch':
            return `Comprimento de onda não casa: TX ${issue.txNm}nm não bate com RX do peer (${issue.rxNm}nm).`;
    }
}
