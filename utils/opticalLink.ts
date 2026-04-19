import type {
    CableData,
    Gbic,
    LinkOptico,
    OpticalLinkResult,
    OpticalLinkStatus,
} from '../types';
import { calculateDistance } from './geometryUtils';

// ITU-T G.652.D / industry defaults — override via LinkOptico or cable catalog.
export const DEFAULT_FIBER_ATTENUATION_DB_PER_KM = 0.35; // 1310 nm; 0.22 for 1550 nm
export const DEFAULT_CONNECTOR_LOSS_DB = 0.5;
export const DEFAULT_FUSION_LOSS_DB = 0.1;

// Margin thresholds (dB). OK >= 3, MARGINAL 0..3, below zero → NO_SIGNAL.
export const MARGIN_OK_DB = 3;
export const MARGIN_MARGINAL_DB = 0;

export function cableLengthKm(cable: Pick<CableData, 'coordinates'>): number {
    const coords = cable.coordinates || [];
    let meters = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        meters += calculateDistance(coords[i], coords[i + 1]);
    }
    return meters / 1000;
}

export interface BuildLinkOpticoOpts {
    conectores?: number;
    fusoes?: number;
    atenuacaoFibraDbPorKm?: number;
    perdaPorConectorDb?: number;
    perdaPorFusaoDb?: number;
    /** Override total distance; defaults to geodesic length of cable.coordinates. */
    distanciaKm?: number;
}

export function buildLinkOptico(
    cable: Pick<CableData, 'coordinates'>,
    opts: BuildLinkOpticoOpts = {}
): LinkOptico {
    return {
        distanciaKm: opts.distanciaKm ?? cableLengthKm(cable),
        conectores: opts.conectores ?? 2,   // 1 conector em cada ponta (par)
        fusoes: opts.fusoes ?? 0,
        atenuacaoFibraDbPorKm: opts.atenuacaoFibraDbPorKm,
        perdaPorConectorDb: opts.perdaPorConectorDb,
        perdaPorFusaoDb: opts.perdaPorFusaoDb,
    };
}

/**
 * Constrói um `LinkOptico` a partir de um caminho multi-cabo (com sangrias).
 *
 * Soma comprimentos de todos os cabos, acrescenta as sangrias à contagem de
 * fusões e mantém conectores (default 2 — um em cada ponta do link).
 */
export function buildPathLinkOptico(
    path: { cables: Array<{ lengthKm: number }>; sangriaCount: number },
    opts: BuildLinkOpticoOpts = {}
): LinkOptico {
    const totalKm = path.cables.reduce((s, c) => s + c.lengthKm, 0);
    return {
        distanciaKm: opts.distanciaKm ?? totalKm,
        conectores: opts.conectores ?? 2,
        fusoes: (opts.fusoes ?? 0) + path.sangriaCount,
        atenuacaoFibraDbPorKm: opts.atenuacaoFibraDbPorKm,
        perdaPorConectorDb: opts.perdaPorConectorDb,
        perdaPorFusaoDb: opts.perdaPorFusaoDb,
    };
}

export interface LossBreakdown {
    fiber: number;
    connectors: number;
    fusions: number;
    total: number;
}

export function computeLosses(link: LinkOptico): LossBreakdown {
    const fiberRate = link.atenuacaoFibraDbPorKm ?? DEFAULT_FIBER_ATTENUATION_DB_PER_KM;
    const connectorLoss = link.perdaPorConectorDb ?? DEFAULT_CONNECTOR_LOSS_DB;
    const fusionLoss = link.perdaPorFusaoDb ?? DEFAULT_FUSION_LOSS_DB;

    const fiber = link.distanciaKm * fiberRate;
    const connectors = link.conectores * connectorLoss;
    const fusions = link.fusoes * fusionLoss;
    return {
        fiber,
        connectors,
        fusions,
        total: fiber + connectors + fusions,
    };
}

export function classifyMargin(margem: number): OpticalLinkStatus {
    if (margem < MARGIN_MARGINAL_DB) return 'NO_SIGNAL';
    if (margem < MARGIN_OK_DB) return 'MARGINAL';
    return 'OK';
}

/**
 * Calcula potência RX a partir da TX do GBIC menos as perdas do link.
 *
 *   Potência RX = Potência TX − (αf · L + αc · Nc + αf · Nf)
 *
 * A margem é potenciaRx − sensibilidadeRx. Margem negativa = link inviável.
 */
export function analyzeOpticalLink(
    gbic: Pick<Gbic, 'potenciaTx' | 'sensibilidadeRx'>,
    link: LinkOptico
): OpticalLinkResult {
    const losses = computeLosses(link);
    const potenciaRx = gbic.potenciaTx - losses.total;
    const margem = potenciaRx - gbic.sensibilidadeRx;
    return {
        potenciaTx: gbic.potenciaTx,
        potenciaRx,
        perdaTotal: losses.total,
        sensibilidadeRx: gbic.sensibilidadeRx,
        margem,
        status: classifyMargin(margem),
    };
}

/**
 * Cálculo simples como o da especificação original — mantém compatibilidade
 * com código que só quer o número de RX final sem o breakdown.
 */
export function calcularPotenciaRx(
    gbic: Pick<Gbic, 'potenciaTx'>,
    link: LinkOptico
): number {
    return gbic.potenciaTx - computeLosses(link).total;
}

export function statusLabel(status: OpticalLinkStatus): string {
    switch (status) {
        case 'OK': return 'OK';
        case 'MARGINAL': return 'MARGINAL';
        case 'NO_SIGNAL': return 'SEM SINAL';
    }
}

/**
 * Cor Tailwind para badge/indicador de status.
 * Retorna classe utilitária compatível com o design do SwitchEditor.
 */
export function statusColor(status: OpticalLinkStatus): {
    bg: string; text: string; border: string; dot: string;
} {
    switch (status) {
        case 'OK':
            return {
                bg: 'bg-emerald-50 dark:bg-emerald-500/10',
                text: 'text-emerald-700 dark:text-emerald-300',
                border: 'border-emerald-200 dark:border-emerald-500/30',
                dot: 'bg-emerald-500',
            };
        case 'MARGINAL':
            return {
                bg: 'bg-amber-50 dark:bg-amber-500/10',
                text: 'text-amber-700 dark:text-amber-300',
                border: 'border-amber-200 dark:border-amber-500/30',
                dot: 'bg-amber-500',
            };
        case 'NO_SIGNAL':
            return {
                bg: 'bg-red-50 dark:bg-red-500/10',
                text: 'text-red-700 dark:text-red-300',
                border: 'border-red-200 dark:border-red-500/30',
                dot: 'bg-red-500',
            };
    }
}
