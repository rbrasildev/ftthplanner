import React, { useEffect, useMemo, useState } from 'react';
import {
    X, Save, Plus, Trash2, AlertCircle, Zap, Network, Fingerprint, Activity,
    CircuitBoard, ArrowLeftRight, Unplug, Cable,
} from 'lucide-react';
import {
    CableData,
    CTOData,
    DirectSwitchLink,
    DIO,
    FiberConnection,
    Gbic,
    LinkLossConfig,
    OLT,
    POPData,
    SwitchData,
    SwitchFiberAllocation,
    SwitchPort,
} from '../types';
import { getGbics, GbicCatalogItem } from '../services/catalogService';
import {
    checkPeerCompatibility,
    collectOccupiedSwitchPorts,
    collectSwitchOccupiedDioPorts,
    describeAllocationIssue,
    describeDirectLinkIssue,
    describePeerCompatIssue,
    DirectLinkValidation,
    OccupiedDioPort,
    OccupiedSwitchPort,
    PeerCompatIssue,
    portsNeededForGbic,
    resolveDirectPeer,
    suggestNextAllocation,
    SwitchEndpoint,
    SwitchLinkPath,
    traceDioPortToCable,
    tracePeerSwitchPort,
    traceSwitchLinkPath,
    validateAllocation,
    validateDirectLink,
} from '../utils/switchFiber';
import {
    analyzeOpticalLink,
    buildLinkOptico,
    buildPathLinkOptico,
    cableLengthKm,
    computeLosses,
    DEFAULT_CONNECTOR_LOSS_DB,
    DEFAULT_FIBER_ATTENUATION_DB_PER_KM,
    DEFAULT_FUSION_LOSS_DB,
    statusColor,
    statusLabel,
} from '../utils/opticalLink';
import { CustomInput } from './common/CustomInput';
import { CustomSelect } from './common/CustomSelect';

interface SwitchEditorProps {
    sw: SwitchData;
    allSwitches: SwitchData[];           // cross-port DIO conflict checks
    olts: OLT[];                         // OLTs do POP (para linkar direto em uplinks)
    dios: DIO[];                         // DIOs disponíveis no POP
    cables: CableData[];                 // cabos do POP (para tracing ótico via DIO→cabo)
    connections: FiberConnection[];      // FiberConnections do POP (splicings do DIO)
    /** TODOS os POPs — necessário para rastrear o peer switch na outra ponta do cabo. */
    allPops?: POPData[];
    /** CTOs/CEOs do projeto — pra atravessar sangrias no trace de peer. */
    allCtos?: CTOData[];
    /** ID do POP atual, pra excluir do trace de peer (ou distinguir intra-POP). */
    currentPopId?: string;
    onClose: () => void;
    onSave: (updated: SwitchData) => void;
    readOnly?: boolean;
    /** Porta a pré-selecionar ao abrir (ex: usuário clicou direto numa porta no canvas). */
    initialPortId?: string;
}

function mapCatalogToGbic(item: GbicCatalogItem): Gbic {
    return {
        id: `gbic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        catalogId: item.id,
        name: item.name,
        tipo: item.tipo,
        modoFibra: item.modoFibra,
        transmissao: item.transmissao,
        rateGbps: item.rateGbps ?? undefined,
        waveTxNm: item.waveTxNm ?? undefined,
        waveRxNm: item.waveRxNm ?? undefined,
        reachKm: item.reachKm ?? undefined,
        potenciaTx: item.potenciaTx,
        sensibilidadeRx: item.sensibilidadeRx,
    };
}

function makePort(index: number): SwitchPort {
    return {
        id: `swp-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        label: `P${index + 1}`,
    };
}

export const SwitchEditor: React.FC<SwitchEditorProps> = ({
    sw,
    allSwitches,
    olts,
    dios,
    cables,
    connections,
    allPops,
    allCtos,
    currentPopId,
    onClose,
    onSave,
    readOnly = false,
    initialPortId,
}) => {
    const [local, setLocal] = useState<SwitchData>(() =>
        JSON.parse(JSON.stringify(sw))
    );
    const [catalog, setCatalog] = useState<GbicCatalogItem[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [selectedPortId, setSelectedPortId] = useState<string | null>(
        (initialPortId && sw.ports.some(p => p.id === initialPortId))
            ? initialPortId
            : sw.ports[0]?.id ?? null
    );

    useEffect(() => {
        setCatalogLoading(true);
        getGbics()
            .then(setCatalog)
            .catch(err => {
                console.error('Failed to load GBIC catalog', err);
                setCatalog([]);
            })
            .finally(() => setCatalogLoading(false));
    }, []);

    const selectedPort = useMemo(
        () => local.ports.find(p => p.id === selectedPortId) ?? null,
        [local.ports, selectedPortId]
    );

    // Portas de DIO já ocupadas — junta:
    //  1) alocações de outros switches (e do próprio menos a porta editada)
    //  2) patch cords OLT↔DIO. Splice DIO↔cabo NÃO conta (é o uso normal do DIO).
    const occupiedDioPorts = useMemo<OccupiedDioPort[]>(() => {
        const otherSwitches = allSwitches.filter(s => s.id !== local.id);
        const selfMinusEdited: SwitchData = {
            ...local,
            ports: local.ports.filter(p => p.id !== selectedPortId),
        };
        const fromSwitches = collectSwitchOccupiedDioPorts([...otherSwitches, selfMinusEdited]);

        // Set de IDs de portas de OLT (GPON + uplink) — só conexões com OLT contam
        // como conflito. Splice DIO↔fiber é o uso normal do DIO.
        const oltPortIds = new Set<string>();
        for (const o of olts) {
            for (const pid of o.portIds || []) oltPortIds.add(pid);
            for (const pid of o.uplinkPortIds || []) oltPortIds.add(pid);
        }

        // Mapeia dioPortId → dioId.
        const portToDioId = new Map<string, string>();
        for (const d of dios) {
            for (const portId of d.portIds || []) portToDioId.set(portId, d.id);
        }

        const fromConnections: OccupiedDioPort[] = [];
        for (const c of connections) {
            const srcIsDio = portToDioId.has(c.sourceId);
            const tgtIsDio = portToDioId.has(c.targetId);
            // Caso clássico: patch cord DIO↔OLT
            if (srcIsDio && oltPortIds.has(c.targetId)) {
                fromConnections.push({
                    dioId: portToDioId.get(c.sourceId)!,
                    dioPortId: c.sourceId,
                    ownerId: c.id,
                    kind: 'connection',
                });
            } else if (tgtIsDio && oltPortIds.has(c.sourceId)) {
                fromConnections.push({
                    dioId: portToDioId.get(c.targetId)!,
                    dioPortId: c.targetId,
                    ownerId: c.id,
                    kind: 'connection',
                });
            }
        }
        return [...fromSwitches, ...fromConnections];
    }, [allSwitches, local, selectedPortId, dios, olts, connections]);

    const updatePort = (portId: string, patch: Partial<SwitchPort>) => {
        setLocal(prev => ({
            ...prev,
            ports: prev.ports.map(p => (p.id === portId ? { ...p, ...patch } : p)),
        }));
    };

    const handleAssignGbic = (portId: string, catalogId: string) => {
        const item = catalog.find(c => c.id === catalogId);
        if (!item) {
            updatePort(portId, { gbic: undefined, allocation: undefined });
            return;
        }
        const gbic = mapCatalogToGbic(item);
        // GBIC change invalidates current allocation (pode ter virado BiDi↔Duplex)
        updatePort(portId, { gbic, allocation: undefined });
    };

    const handleDioChange = (portId: string, dioId: string) => {
        const port = local.ports.find(p => p.id === portId);
        if (!port?.gbic) return;
        if (!dioId) {
            updatePort(portId, { allocation: undefined });
            return;
        }
        const dio = dios.find(d => d.id === dioId);
        if (!dio) return;
        const suggested = suggestNextAllocation({
            gbic: port.gbic,
            dio,
            otherOccupied: occupiedDioPorts,
        });
        if (suggested) {
            updatePort(portId, { allocation: suggested });
        } else {
            // Sem sugestão — marca DIO sem portas pra surfacar "já cheio".
            updatePort(portId, {
                allocation: { dioId, txDioPortId: '', rxDioPortId: '' },
            });
        }
    };

    const handleDioPortChange = (
        portId: string,
        which: 'tx' | 'rx',
        dioPortId: string
    ) => {
        const port = local.ports.find(p => p.id === portId);
        if (!port?.allocation || !port.gbic) return;
        const next: SwitchFiberAllocation = {
            ...port.allocation,
            txDioPortId: which === 'tx' ? dioPortId : port.allocation.txDioPortId,
            rxDioPortId: which === 'rx' ? dioPortId : port.allocation.rxDioPortId,
        };
        // BiDi: força TX === RX
        if (port.gbic.transmissao === 'bidi') {
            next.txDioPortId = dioPortId;
            next.rxDioPortId = dioPortId;
        }
        updatePort(portId, { allocation: next });
    };

    // Portas de switches já usadas por direct links (de outros switches ou outras portas do próprio)
    const occupiedSwitchPorts = useMemo<OccupiedSwitchPort[]>(
        () => collectOccupiedSwitchPorts(allSwitches, { excludePortId: selectedPortId ?? undefined }),
        [allSwitches, selectedPortId]
    );

    const handleSetMode = (portId: string, mode: 'dio' | 'direct') => {
        const port = local.ports.find(p => p.id === portId);
        if (!port) return;
        if (mode === 'dio') {
            // Sai do modo direct limpando o link. Allocation fica pra o user definir.
            updatePort(portId, { directLink: undefined });
        } else {
            // Entra em modo direct — cria placeholder vazio pra o UI mudar.
            // Validação vai sinalizar "peer switch missing" até o user preencher.
            updatePort(portId, {
                allocation: undefined,
                directLink: { peerSwitchId: '', peerPortId: '' },
            });
        }
    };

    const handleDirectPeerChange = (
        portId: string,
        peerSwitchId: string,
        peerPortId: string,
        peerKind: 'switch' | 'olt' = 'switch',
    ) => {
        const port = local.ports.find(p => p.id === portId);
        const prevGbicCatalogId = port?.directLink?.peerGbicCatalogId;

        // Caso 1: limpou o equipamento inteiro (dropdown voltou pra placeholder)
        if (!peerSwitchId) {
            updatePort(portId, {
                directLink: { peerKind, peerSwitchId: '', peerPortId: '' },
            });
            return;
        }

        // Caso 2: selecionou equipamento mas ainda sem porta — mantém o equipamento
        // gravado pra validação sinalizar só "porta do peer não existe/escolha uma porta"
        // em vez de voltar pro estado vazio e obrigar o user a re-selecionar tudo.
        updatePort(portId, {
            directLink: {
                peerKind,
                peerSwitchId,
                peerPortId: peerPortId || '',
                ...(peerKind === 'olt' && prevGbicCatalogId
                    ? { peerGbicCatalogId: prevGbicCatalogId }
                    : {}),
            },
        });
    };

    const handlePeerGbicChange = (portId: string, catalogId: string) => {
        const port = local.ports.find(p => p.id === portId);
        if (!port?.directLink) return;
        updatePort(portId, {
            directLink: {
                ...port.directLink,
                peerGbicCatalogId: catalogId || undefined,
            },
        });
    };

    const handleLossConfigChange = (portId: string, patch: Partial<LinkLossConfig>) => {
        setLocal(prev => ({
            ...prev,
            ports: prev.ports.map(p => {
                if (p.id !== portId) return p;
                const next: LinkLossConfig = { ...(p.linkLossConfig ?? {}), ...patch };
                (Object.keys(next) as (keyof LinkLossConfig)[]).forEach(k => {
                    if (next[k] === undefined) delete next[k];
                });
                return { ...p, linkLossConfig: Object.keys(next).length === 0 ? undefined : next };
            }),
        }));
    };

    const handleAddPort = () => {
        setLocal(prev => {
            const p = makePort(prev.ports.length);
            return { ...prev, ports: [...prev.ports, p], portCount: prev.ports.length + 1 };
        });
    };

    const handleRemovePort = (portId: string) => {
        setLocal(prev => {
            const ports = prev.ports.filter(p => p.id !== portId);
            return { ...prev, ports, portCount: ports.length };
        });
        if (selectedPortId === portId) setSelectedPortId(null);
    };

    const gbicOptions = useMemo(
        () => [
            { value: '', label: '— Sem GBIC —' },
            ...catalog.map(c => ({
                value: c.id,
                label: c.name,
                sublabel: `${c.tipo} · ${c.transmissao} · TX ${c.potenciaTx} dBm · RX ${c.sensibilidadeRx} dBm`,
            })),
        ],
        [catalog]
    );

    const dioOptions = useMemo(
        () => [
            { value: '', label: '— Sem DIO —' },
            ...dios.map(d => ({
                value: d.id,
                label: d.name,
                sublabel: `${d.ports} portas`,
            })),
        ],
        [dios]
    );

    /**
     * Validação unificada (DIO ou direct). Retorna lista de mensagens legíveis
     * em português — sem detalhe do tipo de erro, só strings prontas pro UI.
     */
    const portValidation = (port: SwitchPort): { ok: boolean; messages: string[] } | null => {
        if (!port.gbic) return null;
        if (port.directLink) {
            const v = validateDirectLink({
                selfPortId: port.id,
                selfGbic: port.gbic,
                directLink: port.directLink,
                switches: allSwitches,
                olts,
            });
            return { ok: v.ok, messages: v.issues.map(describeDirectLinkIssue) };
        }
        if (port.allocation) {
            const dio = dios.find(d => d.id === port.allocation!.dioId);
            // Exclui a própria porta da lista de ocupadas — senão validação acusa
            // colisão da porta consigo mesma quando outra porta está selecionada.
            const otherOccupied = occupiedDioPorts.filter(o => o.ownerId !== port.id);
            const v = validateAllocation({
                gbic: port.gbic,
                allocation: port.allocation,
                dio,
                otherOccupied,
            });
            return { ok: v.ok, messages: v.issues.map(describeAllocationIssue) };
        }
        return null;
    };

    /**
     * Calcula o análise óptico da porta.
     *
     * - Modo direto: patch cord curto (default 3m, sem fusões). Peer conhecido
     *   direto pelo directLink.
     * - Modo DIO: usa o path completo (soma cabos + conta sangrias) quando
     *   existe peer alcançável; senão cabo imediato.
     */
    const portOptical = (port: SwitchPort) => {
        if (!port.gbic) return null;

        // --- MODO DIRECT ---
        if (port.directLink) {
            const peer = resolveDirectPeer(
                port, allSwitches, olts, currentPopId ?? '', '', port.gbic, catalog,
            );
            if (!peer) return null;
            // Patch cord curto — 3m default; user pode override via linkLossConfig
            const patchKm = port.linkLossConfig?.conectores !== undefined ? undefined : undefined;
            const link = buildLinkOptico({ coordinates: [] }, {
                distanciaKm: 0.003, // 3m default
                conectores: port.linkLossConfig?.conectores ?? 2,
                fusoes: port.linkLossConfig?.fusoes ?? 0,
                atenuacaoFibraDbPorKm: port.linkLossConfig?.atenuacaoFibraDbPorKm,
                perdaPorConectorDb: port.linkLossConfig?.perdaPorConectorDb,
                perdaPorFusaoDb: port.linkLossConfig?.perdaPorFusaoDb,
            });
            return {
                result: analyzeOpticalLink(port.gbic, link),
                link,
                losses: computeLosses(link),
                cable: null as any, // N/A em direct
                fiberIndex: 0,
                path: null as SwitchLinkPath | null,
                peer,
                isDirect: true as const,
            };
        }

        // --- MODO DIO ---
        if (!port.allocation) return null;
        const trace = traceDioPortToCable(port.allocation.txDioPortId, connections);
        if (!trace) return null;
        const myCable = cables.find(c => c.id === trace.cableId);
        if (!myCable) return null;

        const lossOpts = {
            conectores: port.linkLossConfig?.conectores,
            fusoes: port.linkLossConfig?.fusoes,
            atenuacaoFibraDbPorKm: port.linkLossConfig?.atenuacaoFibraDbPorKm,
            perdaPorConectorDb: port.linkLossConfig?.perdaPorConectorDb,
            perdaPorFusaoDb: port.linkLossConfig?.perdaPorFusaoDb,
        };

        // Tenta achar peer pelo path completo (inclui sangrias)
        const pathTrace = allPops
            ? traceSwitchLinkPath({
                myPortId: port.id,
                fromDioPortId: port.allocation.txDioPortId,
                pops: allPops,
                ctos: allCtos,
                cables,
            })
            : null;

        if (pathTrace) {
            const link = buildPathLinkOptico(pathTrace.path, lossOpts);
            return {
                result: analyzeOpticalLink(port.gbic, link),
                link,
                losses: computeLosses(link),
                cable: myCable,
                fiberIndex: trace.fiberIndex,
                path: pathTrace.path as SwitchLinkPath,
                peer: pathTrace.peer,
                isDirect: false as const,
            };
        }

        const link = buildLinkOptico(myCable, lossOpts);
        return {
            result: analyzeOpticalLink(port.gbic, link),
            link,
            losses: computeLosses(link),
            cable: myCable,
            fiberIndex: trace.fiberIndex,
            path: null as SwitchLinkPath | null,
            peer: null as SwitchEndpoint | null,
            isDirect: false as const,
        };
    };

    /**
     * Resolve o peer na outra ponta e calcula os dois sentidos do link com as
     * potências/sensibilidades de cada lado. Usa o `link` já construído pelo
     * portOptical (que pode vir do path completo).
     */
    const portPeer = (port: SwitchPort, optical: ReturnType<typeof portOptical>) => {
        if (!port.gbic || !optical) return null;
        const peer = optical.peer;
        if (!peer) {
            return { peer: null as SwitchEndpoint | null, forward: null, reverse: null, issues: [] as PeerCompatIssue[] };
        }
        const peerGbic = peer.port.gbic;
        if (!peerGbic) {
            return { peer, forward: null, reverse: null, issues: [] };
        }
        const forward = analyzeOpticalLink(
            { potenciaTx: port.gbic.potenciaTx, sensibilidadeRx: peerGbic.sensibilidadeRx },
            optical.link,
        );
        const reverse = analyzeOpticalLink(
            { potenciaTx: peerGbic.potenciaTx, sensibilidadeRx: port.gbic.sensibilidadeRx },
            optical.link,
        );
        const issues = checkPeerCompatibility(port.gbic, peerGbic);
        return { peer, forward, reverse, issues };
    };

    const hasAnyError = useMemo(
        () => local.ports.some(p => {
            const v = portValidation(p);
            return v != null && !v.ok;
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [local.ports, occupiedDioPorts, dios]
    );

    const handleSave = () => {
        if (readOnly || hasAnyError) return;
        onSave({ ...local, portCount: local.ports.length });
    };

    return (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-6xl h-[90vh] bg-white dark:bg-[#0d1117] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/40 flex items-center justify-between bg-gradient-to-r from-emerald-50 dark:from-emerald-900/20 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <Network className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {local.name || 'Switch'}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {(() => {
                                    const label: Record<string, string> = {
                                        SWITCH: 'Switch', ROUTER: 'Roteador',
                                        SERVER: 'Servidor', OTHER: 'Ativo',
                                    };
                                    const t = label[local.type ?? 'SWITCH'] ?? 'Ativo';
                                    return `${t} · ${local.ports.length} porta(s) · conexão via DIO`;
                                })()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={readOnly || hasAnyError}
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold transition-colors"
                        >
                            <Save className="w-4 h-4" /> Salvar
                        </button>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 grid grid-cols-[minmax(280px,360px)_1fr] min-h-0">
                    {/* LEFT: Ports list */}
                    <div className="border-r border-slate-200 dark:border-slate-700/40 flex flex-col min-h-0">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/40">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Portas
                            </h3>
                            {!readOnly && (
                                <button
                                    onClick={handleAddPort}
                                    className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Porta
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {local.ports.map(port => {
                                const v = portValidation(port);
                                const o = portOptical(port);
                                const isSelected = port.id === selectedPortId;
                                const hasGbic = !!port.gbic;
                                const hasAlloc = !!port.allocation;
                                const oc = o ? statusColor(o.result.status) : null;
                                return (
                                    <button
                                        key={port.id}
                                        onClick={() => setSelectedPortId(port.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                                            isSelected
                                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
                                                : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/40 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white">
                                                    {port.label}
                                                </span>
                                                {hasGbic && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 uppercase">
                                                        {port.gbic!.tipo}
                                                    </span>
                                                )}
                                                {hasGbic && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                                                        port.gbic!.transmissao === 'bidi'
                                                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                                            : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                                    }`}>
                                                        {port.gbic!.transmissao === 'bidi' ? 'BiDi' : 'Duplex'}
                                                    </span>
                                                )}
                                            </div>
                                            {v && !v.ok && (
                                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                            )}
                                            {v && v.ok && o && oc && (
                                                <span
                                                    title={`${statusLabel(o.result.status)} · RX ${o.result.potenciaRx.toFixed(1)} dBm · margem ${o.result.margem.toFixed(1)} dB`}
                                                    className={`w-2.5 h-2.5 rounded-full ${oc.dot} shrink-0`}
                                                />
                                            )}
                                            {v && v.ok && !o && hasAlloc && (
                                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                                    DIO ok
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                                            {hasGbic
                                                ? port.gbic!.name ?? 'GBIC personalizado'
                                                : 'Sem GBIC'}
                                            {o && (
                                                <span className="ml-1 text-[10px] font-mono">
                                                    · RX {o.result.potenciaRx.toFixed(1)} dBm
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                            {local.ports.length === 0 && (
                                <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                                    Sem portas. Clique em "+ Porta" para adicionar.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Port details */}
                    <div className="flex flex-col min-h-0">
                        {selectedPort ? (() => {
                            const optical = portOptical(selectedPort);
                            const peer = portPeer(selectedPort, optical);
                            return (
                                <PortDetail
                                    key={selectedPort.id}
                                    port={selectedPort}
                                    localName={local.name}
                                    onRenameSwitch={v => setLocal(prev => ({ ...prev, name: v }))}
                                    onRenamePort={label => updatePort(selectedPort.id, { label })}
                                    catalogLoading={catalogLoading}
                                    gbicOptions={gbicOptions}
                                    dioOptions={dioOptions}
                                    dios={dios}
                                    occupiedDioPorts={occupiedDioPorts}
                                    occupiedSwitchPorts={occupiedSwitchPorts}
                                    peerEligibleSwitches={allSwitches}
                                    olts={olts}
                                    gbicCatalog={catalog}
                                    selfSwitchId={local.id}
                                    onAssignGbic={id => handleAssignGbic(selectedPort.id, id)}
                                    onDioChange={id => handleDioChange(selectedPort.id, id)}
                                    onDioPortChange={(which, v) =>
                                        handleDioPortChange(selectedPort.id, which, v)
                                    }
                                    onSetMode={mode => handleSetMode(selectedPort.id, mode)}
                                    onDirectPeerChange={(peerSw, peerPt, peerKind) =>
                                        handleDirectPeerChange(selectedPort.id, peerSw, peerPt, peerKind)
                                    }
                                    onPeerGbicChange={id => handlePeerGbicChange(selectedPort.id, id)}
                                    onLossConfigChange={patch =>
                                        handleLossConfigChange(selectedPort.id, patch)
                                    }
                                    onRemovePort={() => handleRemovePort(selectedPort.id)}
                                    validation={portValidation(selectedPort)}
                                    optical={optical}
                                    peer={peer}
                                    readOnly={readOnly}
                                />
                            );
                        })() : (
                            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                                Selecione uma porta à esquerda.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ---------- PortDetail sub-component ----------

interface PortDetailProps {
    port: SwitchPort;
    localName: string;
    onRenameSwitch: (v: string) => void;
    onRenamePort: (v: string) => void;
    catalogLoading: boolean;
    gbicOptions: { value: string; label: string; sublabel?: string }[];
    dioOptions: { value: string; label: string; sublabel?: string }[];
    dios: DIO[];
    occupiedDioPorts: OccupiedDioPort[];
    occupiedSwitchPorts: OccupiedSwitchPort[];
    peerEligibleSwitches: SwitchData[];
    olts: OLT[];
    gbicCatalog: GbicCatalogItem[];
    selfSwitchId: string;
    onAssignGbic: (catalogId: string) => void;
    onDioChange: (dioId: string) => void;
    onDioPortChange: (which: 'tx' | 'rx', dioPortId: string) => void;
    onSetMode: (mode: 'dio' | 'direct') => void;
    onDirectPeerChange: (peerSwitchId: string, peerPortId: string, peerKind: 'switch' | 'olt') => void;
    onPeerGbicChange: (catalogId: string) => void;
    onLossConfigChange: (patch: Partial<LinkLossConfig>) => void;
    onRemovePort: () => void;
    validation: ReturnType<typeof validateAllocation> | null;
    optical: {
        result: ReturnType<typeof analyzeOpticalLink>;
        link: ReturnType<typeof buildLinkOptico>;
        losses: ReturnType<typeof computeLosses>;
        cable: CableData | null;
        fiberIndex: number;
        path: SwitchLinkPath | null;
        peer: SwitchEndpoint | null;
        isDirect: boolean;
    } | null;
    peer: {
        peer: SwitchEndpoint | null;
        forward: ReturnType<typeof analyzeOpticalLink> | null;
        reverse: ReturnType<typeof analyzeOpticalLink> | null;
        issues: PeerCompatIssue[];
    } | null;
    readOnly: boolean;
}

const PortDetail: React.FC<PortDetailProps> = ({
    port, localName, onRenameSwitch, onRenamePort,
    catalogLoading, gbicOptions, dioOptions, dios, occupiedDioPorts,
    occupiedSwitchPorts, peerEligibleSwitches, olts, gbicCatalog, selfSwitchId,
    onAssignGbic, onDioChange, onDioPortChange, onSetMode, onDirectPeerChange,
    onPeerGbicChange, onLossConfigChange,
    onRemovePort, validation, optical, peer, readOnly,
}) => {
    const gbic = port.gbic;
    const alloc = port.allocation;
    const selectedDio = alloc ? dios.find(d => d.id === alloc.dioId) : undefined;
    const portsNeeded = gbic ? portsNeededForGbic(gbic) : 0;

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Switch-level rename */}
            <div className="grid grid-cols-2 gap-3">
                <CustomInput
                    label="Nome do switch"
                    value={localName}
                    onChange={e => onRenameSwitch(e.target.value)}
                    disabled={readOnly}
                />
                <CustomInput
                    label="Label da porta"
                    value={port.label ?? ''}
                    onChange={e => onRenamePort(e.target.value)}
                    disabled={readOnly}
                />
            </div>

            {/* GBIC */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700/40 p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        GBIC / SFP
                    </h4>
                </div>
                <CustomSelect
                    label={catalogLoading ? 'Carregando catálogo...' : 'Modelo'}
                    options={gbicOptions}
                    value={gbic?.catalogId ?? ''}
                    onChange={onAssignGbic}
                    placeholder="Selecione um GBIC do catálogo"
                />
                {gbic && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <InfoRow label="Transmissão">
                            {gbic.transmissao === 'bidi' ? 'BiDi (1 porta)' : 'Duplex (2 portas)'}
                        </InfoRow>
                        <InfoRow label="Modo">{gbic.modoFibra}</InfoRow>
                        <InfoRow label="Potência TX">{gbic.potenciaTx} dBm</InfoRow>
                        <InfoRow label="Sensibilidade RX">{gbic.sensibilidadeRx} dBm</InfoRow>
                        {gbic.waveTxNm && <InfoRow label="λ TX">{gbic.waveTxNm} nm</InfoRow>}
                        {gbic.waveRxNm && <InfoRow label="λ RX">{gbic.waveRxNm} nm</InfoRow>}
                        {gbic.reachKm && <InfoRow label="Alcance">{gbic.reachKm} km</InfoRow>}
                        <InfoRow label="Portas DIO usadas">
                            <span className="font-semibold">{portsNeeded}</span>
                        </InfoRow>
                    </div>
                )}
            </div>

            {/* Mode toggle + allocation */}
            {gbic && (() => {
                const mode: 'dio' | 'direct' = port.directLink ? 'direct' : 'dio';
                return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CircuitBoard className="w-4 h-4 text-emerald-500" />
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    Conexão
                                </h4>
                            </div>
                            {/* Mode toggle */}
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-md p-0.5 text-[10px] font-semibold">
                                <button
                                    type="button"
                                    onClick={() => onSetMode('dio')}
                                    disabled={readOnly}
                                    className={`px-2 py-1 rounded transition-colors ${
                                        mode === 'dio'
                                            ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Via DIO
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onSetMode('direct')}
                                    disabled={readOnly}
                                    className={`px-2 py-1 rounded transition-colors ${
                                        mode === 'direct'
                                            ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Direto
                                </button>
                            </div>
                        </div>

                        {mode === 'dio' ? (
                            <>
                                <CustomSelect
                                    label="DIO"
                                    options={dioOptions}
                                    value={alloc?.dioId ?? ''}
                                    onChange={onDioChange}
                                    placeholder="Selecione o DIO"
                                />

                                {alloc && selectedDio && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400">
                                                Porta TX
                                            </label>
                                            <DioPortPicker
                                                dio={selectedDio}
                                                value={alloc.txDioPortId}
                                                onChange={v => onDioPortChange('tx', v)}
                                                occupied={occupiedDioPorts}
                                                disabled={readOnly}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400">
                                                Porta RX {gbic.transmissao === 'bidi' && (
                                                    <span className="italic text-[10px]">(mesma de TX)</span>
                                                )}
                                            </label>
                                            <DioPortPicker
                                                dio={selectedDio}
                                                value={alloc.rxDioPortId}
                                                onChange={v => onDioPortChange('rx', v)}
                                                occupied={occupiedDioPorts}
                                                disabled={readOnly || gbic.transmissao === 'bidi'}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <DirectLinkPicker
                                selfPortId={port.id}
                                selfSwitchId={selfSwitchId}
                                allSwitches={peerEligibleSwitches}
                                olts={olts}
                                gbicCatalog={gbicCatalog}
                                directLink={port.directLink ?? null}
                                occupied={occupiedSwitchPorts}
                                onChange={(peerSwitchId, peerPortId, peerKind) =>
                                    onDirectPeerChange(peerSwitchId, peerPortId, peerKind)
                                }
                                onPeerGbicChange={onPeerGbicChange}
                                disabled={readOnly}
                            />
                        )}

                        {validation && !validation.ok && (
                            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3 space-y-1">
                                {validation.messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300"
                                    >
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span>{msg}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {validation && validation.ok && mode === 'dio' && alloc && selectedDio && (
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5" />
                                {gbic.transmissao === 'bidi'
                                    ? `Conectado à porta ${portLabel(selectedDio, alloc.txDioPortId)} do DIO.`
                                    : `Conectado às portas ${portLabel(selectedDio, alloc.txDioPortId)}/${portLabel(selectedDio, alloc.rxDioPortId)} do DIO.`}
                            </div>
                        )}

                        {validation && validation.ok && mode === 'direct' && port.directLink && (
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                <Cable className="w-3.5 h-3.5" />
                                Link direto configurado (patch cord entre ativos).
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Optical power budget */}
            {gbic && optical && validation?.ok && (() => {
                const { result, link, losses, cable, fiberIndex, path, isDirect } = optical;
                const color = statusColor(result.status);
                const lossCfg = port.linkLossConfig ?? {};
                const geoKm = isDirect
                    ? link.distanciaKm
                    : path
                        ? path.totalDistanceKm
                        : cable
                            ? cableLengthKm(cable)
                            : 0;
                return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-fuchsia-500" />
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    Potência óptica
                                </h4>
                            </div>
                            <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color.bg} ${color.text} ${color.border}`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                                {statusLabel(result.status)}
                            </span>
                        </div>

                        {/* Traçado — varia por modo */}
                        {isDirect ? (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Link direto via patch cord ({(link.distanciaKm * 1000).toFixed(0)} m)
                            </div>
                        ) : path && path.cables.length > 1 ? (
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/40 p-2 text-[11px] space-y-1">
                                <div className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
                                    Caminho: {path.cables.length} cabos · {path.sangriaCount} sangria{path.sangriaCount > 1 ? 's' : ''}
                                </div>
                                {path.cables.map((c, idx) => (
                                    <div key={`${c.cableId}-${idx}`} className="flex justify-between text-slate-600 dark:text-slate-300">
                                        <span className="truncate">
                                            <span className="font-mono">{c.cableName}</span>
                                            <span className="text-slate-400"> · fibra {c.fiberIndex + 1}</span>
                                        </span>
                                        <span className="font-mono shrink-0">{c.lengthKm.toFixed(3)} km</span>
                                    </div>
                                ))}
                            </div>
                        ) : cable ? (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Traçado: DIO → cabo <span className="font-mono">{cable.name}</span>, fibra {fiberIndex + 1}
                            </div>
                        ) : null}

                        <div className="grid grid-cols-3 gap-2">
                            <NumInput
                                label="Distância (km)"
                                step={0.01}
                                min={0}
                                value={Number(link.distanciaKm.toFixed(3))}
                                placeholder={geoKm.toFixed(3)}
                                defaultHint={`Geodésica: ${geoKm.toFixed(3)}`}
                                onChange={() => { /* distance é computada — informativa */ }}
                                disabled
                            />
                            <NumInput
                                label="Conectores"
                                step={1}
                                min={0}
                                value={lossCfg.conectores ?? 2}
                                placeholder="2"
                                onChange={v => onLossConfigChange({ conectores: Number.isFinite(v) ? v : undefined })}
                                disabled={readOnly}
                            />
                            <NumInput
                                label="Fusões"
                                step={1}
                                min={0}
                                value={lossCfg.fusoes ?? 0}
                                placeholder="0"
                                onChange={v => onLossConfigChange({ fusoes: Number.isFinite(v) ? v : undefined })}
                                disabled={readOnly}
                            />
                            <NumInput
                                label="Atenuação fibra (dB/km)"
                                step={0.01}
                                min={0}
                                value={lossCfg.atenuacaoFibraDbPorKm ?? DEFAULT_FIBER_ATTENUATION_DB_PER_KM}
                                placeholder={String(DEFAULT_FIBER_ATTENUATION_DB_PER_KM)}
                                onChange={v => onLossConfigChange({ atenuacaoFibraDbPorKm: Number.isFinite(v) ? v : undefined })}
                                disabled={readOnly}
                            />
                            <NumInput
                                label="Perda/conector (dB)"
                                step={0.01}
                                min={0}
                                value={lossCfg.perdaPorConectorDb ?? DEFAULT_CONNECTOR_LOSS_DB}
                                placeholder={String(DEFAULT_CONNECTOR_LOSS_DB)}
                                onChange={v => onLossConfigChange({ perdaPorConectorDb: Number.isFinite(v) ? v : undefined })}
                                disabled={readOnly}
                            />
                            <NumInput
                                label="Perda/fusão (dB)"
                                step={0.01}
                                min={0}
                                value={lossCfg.perdaPorFusaoDb ?? DEFAULT_FUSION_LOSS_DB}
                                placeholder={String(DEFAULT_FUSION_LOSS_DB)}
                                onChange={v => onLossConfigChange({ perdaPorFusaoDb: Number.isFinite(v) ? v : undefined })}
                                disabled={readOnly}
                            />
                        </div>

                        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/40 p-3 text-xs space-y-1">
                            <BudgetRow label={`Fibra (${link.distanciaKm.toFixed(3)} km)`} value={losses.fiber} sign="-" />
                            <BudgetRow label={`Conectores (${link.conectores})`} value={losses.connectors} sign="-" />
                            <BudgetRow label={`Fusões (${link.fusoes})`} value={losses.fusions} sign="-" />
                            <div className="border-t border-slate-200 dark:border-slate-700/40 pt-1 mt-1">
                                <BudgetRow label="Perda total" value={losses.total} sign="-" bold />
                            </div>
                        </div>

                        <div className={`rounded-lg p-3 border ${color.bg} ${color.border}`}>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">TX:</span>
                                    <span className="font-mono font-semibold">{result.potenciaTx.toFixed(2)} dBm</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Sensibilidade RX:</span>
                                    <span className="font-mono">{result.sensibilidadeRx.toFixed(2)} dBm</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">RX calculado:</span>
                                    <span className={`font-mono font-bold ${color.text}`}>{result.potenciaRx.toFixed(2)} dBm</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400">Margem:</span>
                                    <span className={`font-mono font-bold ${color.text}`}>
                                        {result.margem >= 0 ? '+' : ''}{result.margem.toFixed(2)} dB
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Info state when DIO port isn't spliced to a cable yet */}
            {gbic && validation?.ok && !optical && alloc && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <Activity className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Potência óptica não pôde ser calculada — a porta do DIO ainda não está spliceada a uma fibra de cabo.
                </div>
            )}

            {/* Peer / outra ponta do cabo */}
            {gbic && optical && peer && (
                <PeerPanel peer={peer} />
            )}

            {!readOnly && (
                <div className="flex justify-end">
                    <button
                        onClick={onRemovePort}
                        className="px-3 py-1.5 text-xs rounded-md bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 flex items-center gap-1"
                    >
                        <Trash2 className="w-3 h-3" /> Remover porta
                    </button>
                </div>
            )}
        </div>
    );
};

function portLabel(dio: DIO, portId: string): string {
    const idx = dio.portIds.indexOf(portId);
    return idx >= 0 ? `${idx + 1}` : '?';
}

// ---------- Peer (outra ponta do cabo) ----------

const PeerPanel: React.FC<{
    peer: NonNullable<PortDetailProps['peer']>;
}> = ({ peer }) => {
    // Sem peer encontrado — fibra dangling ou outra ponta não é switch.
    if (!peer.peer) {
        return (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700/40 p-4 space-y-2">
                <div className="flex items-center gap-2">
                    <Unplug className="w-4 h-4 text-slate-400" />
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Outra ponta do cabo
                    </h4>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700/50 p-3 text-xs text-slate-500 dark:text-slate-400">
                    Nenhum switch identificado na outra ponta da fibra. Pode estar conectada a OLT, CTO, outro equipamento sem GBIC, ou simplesmente sem terminação.
                </div>
            </div>
        );
    }

    const peerInfo = peer.peer;
    const peerGbic = peerInfo.port.gbic;

    // Peer existe mas não tem GBIC — sinal não tem receptor
    if (!peerGbic || !peer.forward || !peer.reverse) {
        return (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700/40 p-4 space-y-2">
                <div className="flex items-center gap-2">
                    <Unplug className="w-4 h-4 text-amber-500" />
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Outra ponta do cabo
                    </h4>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                    Peer encontrado: <span className="font-semibold">{peerInfo.switchName}</span> · porta{' '}
                    <span className="font-mono">{peerInfo.port.label ?? peerInfo.port.id}</span> em{' '}
                    <span className="font-semibold">{peerInfo.popName}</span>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300">
                    ⚠ Porta do peer está sem GBIC — sinal chegando mas sem receptor configurado.
                </div>
            </div>
        );
    }

    // Status global = pior dos dois sentidos
    const worst = statusRankMax(peer.forward.status, peer.reverse.status);
    const color = statusColor(worst);
    const hasIssues = peer.issues.length > 0;

    return (
        <div className={`rounded-xl border p-4 space-y-3 ${color.bg} ${color.border}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ArrowLeftRight className={`w-4 h-4 ${color.text}`} />
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Outra ponta do cabo
                    </h4>
                </div>
                <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color.bg} ${color.text} ${color.border}`}
                >
                    <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                    Link {statusLabel(worst)}
                </span>
            </div>

            {/* Peer identity */}
            <div className="text-xs space-y-1">
                <div className="flex items-center gap-1.5">
                    <Network className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {peerInfo.switchName}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-700 dark:text-slate-200">
                        {peerInfo.port.label ?? peerInfo.port.id}
                    </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 pl-4">
                    POP: {peerInfo.popName} · GBIC: {peerGbic.name ?? `${peerGbic.tipo} ${peerGbic.transmissao}`}
                </div>
            </div>

            {/* Compatibility warnings */}
            {hasIssues && (
                <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-2 space-y-1">
                    {peer.issues.map((iss, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-700 dark:text-red-300">
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{describePeerCompatIssue(iss)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Forward direction: me → peer */}
            <DirectionRow
                label="Envio (você → peer)"
                from="sua TX"
                to={`sensibilidade do peer (${peerGbic.sensibilidadeRx.toFixed(1)} dBm)`}
                result={peer.forward}
            />
            {/* Reverse direction: peer → me */}
            <DirectionRow
                label="Recepção (peer → você)"
                from={`TX do peer (${peerGbic.potenciaTx.toFixed(1)} dBm)`}
                to="sua sensibilidade"
                result={peer.reverse}
            />
        </div>
    );
};

const DirectionRow: React.FC<{
    label: string;
    from: string;
    to: string;
    result: ReturnType<typeof analyzeOpticalLink>;
}> = ({ label, from, to, result }) => {
    const c = statusColor(result.status);
    return (
        <div className={`rounded-lg border p-2.5 ${c.bg} ${c.border}`}>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {label}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${c.text}`}>
                    <span className={`w-1 h-1 rounded-full ${c.dot}`} />
                    {statusLabel(result.status)}
                </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                {from} → {to}
            </div>
            <div className="grid grid-cols-2 gap-x-3 text-[11px] font-mono">
                <div className="flex justify-between">
                    <span className="text-slate-500">Chega:</span>
                    <span className={`font-bold ${c.text}`}>{result.potenciaRx.toFixed(2)} dBm</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">Margem:</span>
                    <span className={`font-bold ${c.text}`}>
                        {result.margem >= 0 ? '+' : ''}{result.margem.toFixed(2)} dB
                    </span>
                </div>
            </div>
        </div>
    );
};

// Ranking helper — pior status domina
function statusRankMax(a: 'OK' | 'MARGINAL' | 'NO_SIGNAL', b: 'OK' | 'MARGINAL' | 'NO_SIGNAL') {
    const rank = { OK: 0, MARGINAL: 1, NO_SIGNAL: 2 };
    return rank[a] >= rank[b] ? a : b;
}

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between">
        <span className="text-slate-500 dark:text-slate-400">{label}:</span>
        <span className="text-slate-800 dark:text-slate-200">{children}</span>
    </div>
);

// ---------- DIO port picker ----------

interface DioPortPickerProps {
    dio: DIO;
    value: string;
    onChange: (portId: string) => void;
    occupied: OccupiedDioPort[];
    disabled?: boolean;
}

const DioPortPicker: React.FC<DioPortPickerProps> = ({
    dio, value, onChange, occupied, disabled = false
}) => {
    const usedInDio = useMemo(
        () => new Set(occupied.filter(o => !o.dioId || o.dioId === dio.id).map(o => o.dioPortId)),
        [occupied, dio.id]
    );

    return (
        <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700/40 p-2 grid grid-cols-6 gap-1.5">
            {dio.portIds.map((portId, i) => {
                const isSelected = portId === value;
                const isUsed = usedInDio.has(portId);
                return (
                    <button
                        key={portId}
                        type="button"
                        onClick={() => !disabled && !isUsed && onChange(portId)}
                        disabled={disabled || isUsed}
                        title={`Porta ${i + 1}${isUsed ? ' (em uso)' : ''}`}
                        className={`relative h-7 rounded flex items-center justify-center text-[10px] font-semibold border transition-all ${
                            isSelected
                                ? 'bg-emerald-500 text-white border-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-500/40'
                                : isUsed
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-red-400/40 opacity-60 cursor-not-allowed'
                                : 'bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                    >
                        {i + 1}
                    </button>
                );
            })}
            {dio.portIds.length === 0 && (
                <div className="col-span-6 text-center py-2 text-[11px] text-slate-500">
                    DIO sem portas configuradas.
                </div>
            )}
        </div>
    );
};

// ---------- Direct-link peer picker ----------

interface DirectLinkPickerProps {
    selfPortId: string;
    selfSwitchId: string;
    allSwitches: SwitchData[];
    olts: OLT[];
    gbicCatalog: GbicCatalogItem[];
    directLink: DirectSwitchLink | null;
    occupied: OccupiedSwitchPort[];
    onChange: (peerSwitchId: string, peerPortId: string, peerKind: 'switch' | 'olt') => void;
    onPeerGbicChange: (catalogId: string) => void;
    disabled?: boolean;
}

// Encoda kind+id num valor único pra o CustomSelect: "s:<id>" (switch) ou "o:<id>" (OLT).
function encodePeerValue(kind: 'switch' | 'olt', id: string): string {
    return `${kind === 'olt' ? 'o' : 's'}:${id}`;
}
function decodePeerValue(v: string): { kind: 'switch' | 'olt'; id: string } | null {
    if (!v) return null;
    if (v.startsWith('o:')) return { kind: 'olt', id: v.slice(2) };
    if (v.startsWith('s:')) return { kind: 'switch', id: v.slice(2) };
    return null;
}

// Deriva uplink port IDs de uma OLT, tolerante a dados legados onde
// `uplinkPortIds` pode estar faltando mesmo com `uplinkPorts > 0`.
function oltUplinkIds(olt: OLT): string[] {
    if (olt.uplinkPortIds && olt.uplinkPortIds.length > 0) return olt.uplinkPortIds;
    const count = olt.uplinkPorts ?? 0;
    return Array.from({ length: count }, (_, i) => `${olt.id}-uplink-${i + 1}`);
}

const DirectLinkPicker: React.FC<DirectLinkPickerProps> = ({
    selfPortId, selfSwitchId, allSwitches, olts, gbicCatalog,
    directLink, occupied, onChange, onPeerGbicChange, disabled,
}) => {
    const typeLabel: Record<string, string> = {
        SWITCH: 'Switch', ROUTER: 'Roteador',
        SERVER: 'Servidor', OTHER: 'Ativo',
    };

    // Switches + OLTs (só com uplinks) como opções do mesmo seletor
    const peerOptions = useMemo(() => {
        const opts: { value: string; label: string; sublabel?: string }[] = [
            { value: '', label: '— Selecione o equipamento —' },
        ];
        for (const s of allSwitches) {
            const label = typeLabel[s.type ?? 'SWITCH'] ?? 'Ativo';
            opts.push({
                value: encodePeerValue('switch', s.id),
                label: s.name,
                sublabel: `${label} · ${s.ports.length} portas`,
            });
        }
        for (const o of olts) {
            const uplinks = o.uplinkPorts ?? 0;
            if (uplinks === 0) continue; // OLT sem uplink não aparece
            opts.push({
                value: encodePeerValue('olt', o.id),
                label: o.name,
                sublabel: `OLT · ${uplinks} uplink${uplinks > 1 ? 's' : ''}`,
            });
        }
        return opts;
    }, [allSwitches, olts]);

    const currentKind: 'switch' | 'olt' = directLink?.peerKind ?? 'switch';
    const currentValue = directLink?.peerSwitchId
        ? encodePeerValue(currentKind, directLink.peerSwitchId)
        : '';

    const selectedSwitch = currentKind === 'switch' && directLink
        ? allSwitches.find(s => s.id === directLink.peerSwitchId)
        : null;
    const selectedOlt = currentKind === 'olt' && directLink
        ? olts.find(o => o.id === directLink.peerSwitchId)
        : null;

    const handlePeerChange = (encoded: string) => {
        const dec = decodePeerValue(encoded);
        if (!dec) {
            onChange('', '', 'switch');
            return;
        }
        if (dec.kind === 'switch') {
            const sw = allSwitches.find(s => s.id === dec.id);
            if (!sw) return;
            const firstFree = sw.ports.find(p => {
                if (p.id === selfPortId) return false;
                return !occupied.some(o => o.portId === p.id);
            });
            onChange(dec.id, firstFree?.id ?? '', 'switch');
        } else {
            const olt = olts.find(o => o.id === dec.id);
            if (!olt) return;
            const uplinkIds = oltUplinkIds(olt);
            // Sugere o primeiro uplink livre (ou '' se todas estão em uso —
            // handleDirectPeerChange mantém a OLT selecionada pro user escolher manualmente)
            const firstFree = uplinkIds.find(pid => !occupied.some(o => o.portId === pid));
            onChange(dec.id, firstFree ?? '', 'olt');
        }
    };

    // Lista de portas do peer selecionado (switch ports OU OLT uplink ports).
    // Pra OLT: se `uplinkPortIds` estiver faltando (dados legados), gera on-the-fly
    // a partir de `uplinkPorts` pra o picker sempre mostrar as portas disponíveis.
    const peerPorts: { id: string; label: string }[] = selectedSwitch
        ? selectedSwitch.ports.map((p, i) => ({ id: p.id, label: p.label ?? `P${i + 1}` }))
        : selectedOlt
        ? oltUplinkIds(selectedOlt).map((id, i) => ({ id, label: `uplink ${i + 1}` }))
        : [];

    const peerName = selectedSwitch?.name ?? selectedOlt?.name ?? '';

    return (
        <div className="space-y-3">
            <CustomSelect
                label="Equipamento peer"
                options={peerOptions}
                value={currentValue}
                onChange={handlePeerChange}
                placeholder="Switch, Roteador, Servidor ou OLT (uplink)"
            />
            {peerPorts.length > 0 && directLink && (
                <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">
                        Porta {selectedOlt ? 'de uplink' : ''} no {peerName}
                    </label>
                    <div className={`mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700/40 p-2 grid gap-1.5 ${selectedOlt ? 'grid-cols-4' : 'grid-cols-8'}`}>
                        {peerPorts.map((p, i) => {
                            const isSelected = p.id === directLink.peerPortId;
                            const isSelf = p.id === selfPortId;
                            const usedByOther = occupied.some(o => o.portId === p.id && o.ownerId !== selfPortId);
                            const disabled2 = disabled || isSelf || usedByOther;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => !disabled2 && onChange(
                                        (selectedSwitch?.id ?? selectedOlt?.id)!,
                                        p.id,
                                        selectedOlt ? 'olt' : 'switch',
                                    )}
                                    disabled={disabled2}
                                    title={`${p.label}${usedByOther ? ' (em uso)' : isSelf ? ' (própria)' : ''}`}
                                    className={`relative h-7 rounded flex items-center justify-center text-[10px] font-semibold border transition-all ${
                                        isSelected
                                            ? 'bg-emerald-500 text-white border-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-500/40'
                                            : usedByOther
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-red-400/40 opacity-60 cursor-not-allowed'
                                            : isSelf
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 opacity-60 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                                    }`}
                                >
                                    {selectedOlt ? `U${i + 1}` : i + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* GBIC do uplink da OLT — o SFP instalado na porta uplink */}
            {selectedOlt && directLink?.peerPortId && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/40 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            GBIC do uplink da OLT
                        </span>
                    </div>
                    <CustomSelect
                        options={[
                            { value: '', label: '— Usar valores estimados (TX 0 / RX −24 dBm) —' },
                            ...gbicCatalog.map(g => ({
                                value: g.id,
                                label: g.name,
                                sublabel: `${g.tipo} · ${g.transmissao} · TX ${g.potenciaTx} dBm · RX ${g.sensibilidadeRx} dBm`,
                            })),
                        ]}
                        value={directLink.peerGbicCatalogId ?? ''}
                        onChange={onPeerGbicChange}
                        placeholder="GBIC do lado da OLT"
                    />
                    <div className="text-[10px] text-slate-500 italic">
                        Selecione o modelo do SFP instalado na uplink pra cálculo preciso.
                        Sem seleção, usamos defaults conservadores.
                    </div>
                </div>
            )}
        </div>
    );
};

const NumInput: React.FC<{
    label: string;
    value: number;
    onChange: (v: number) => void;
    step?: number;
    min?: number;
    placeholder?: string;
    defaultHint?: string;
    disabled?: boolean;
}> = ({ label, value, onChange, step = 1, min, placeholder, defaultHint, disabled }) => (
    <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
        </span>
        <input
            type="number"
            step={step}
            min={min}
            value={Number.isFinite(value) ? value : ''}
            placeholder={placeholder}
            disabled={disabled}
            onChange={e => {
                const raw = e.target.value;
                onChange(raw === '' ? NaN : Number(raw));
            }}
            className="mt-0.5 w-full px-2 py-1 text-xs rounded-md bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/40 focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 dark:text-white"
        />
        {defaultHint && (
            <span className="block text-[10px] text-slate-400 mt-0.5 truncate">{defaultHint}</span>
        )}
    </label>
);

const BudgetRow: React.FC<{ label: string; value: number; sign?: '-' | '+'; bold?: boolean }> = ({
    label, value, sign = '-', bold = false,
}) => (
    <div className={`flex justify-between ${bold ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
        <span>{label}</span>
        <span className="font-mono">{sign}{value.toFixed(2)} dB</span>
    </div>
);
