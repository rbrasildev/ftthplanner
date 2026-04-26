import { CableData, CableType } from '../types';

// Heuristic thresholds used when a cable has no explicit `type` set.
// These match common Brazilian FTTH practice: drop = 1-2fo, distribution
// = 6-48fo (12/24/48 are typical), feeder/backbone = 72fo and above.
const DROP_MAX_FIBERS = 2;
const DISTRIBUTION_MAX_FIBERS = 48;

// Alias map: catalog `defaultLevel` and seed values use a mix of PT/EN labels
// (TRONCO, Troncal, BACKBONE, FEEDER / DISTRIBUICAO, Distribuição / DROP, Acesso).
// We normalize anything reasonable to the canonical CableType so the layer
// filter works regardless of how the type was originally entered.
const TYPE_ALIASES: Record<string, CableType> = {
    // FEEDER (Backbone)
    'FEEDER': CableType.FEEDER,
    'BACKBONE': CableType.FEEDER,
    'TRONCO': CableType.FEEDER,
    'TRONCAL': CableType.FEEDER,
    // DISTRIBUTION
    'DISTRIBUTION': CableType.DISTRIBUTION,
    'DISTRIBUICAO': CableType.DISTRIBUTION,
    'DISTRIBUTIVO': CableType.DISTRIBUTION,
    // DROP (Acesso)
    'DROP': CableType.DROP,
    'ACESSO': CableType.DROP,
    'ACCESS': CableType.DROP,
};

function normalizeType(raw: string | null | undefined): CableType | null {
    if (!raw) return null;
    // Strip diacritics ("Distribuição" → "DISTRIBUICAO") and uppercase, so the
    // alias lookup matches regardless of accents or casing in the source data.
    const key = raw
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toUpperCase();
    return TYPE_ALIASES[key] || null;
}

export function getEffectiveCableType(cable: Pick<CableData, 'type' | 'fiberCount'>): CableType {
    const normalized = normalizeType(cable.type as any);
    if (normalized) return normalized;
    const fc = cable.fiberCount || 0;
    if (fc <= DROP_MAX_FIBERS) return CableType.DROP;
    if (fc <= DISTRIBUTION_MAX_FIBERS) return CableType.DISTRIBUTION;
    return CableType.FEEDER;
}

export function isCableTypeVisible(
    cable: Pick<CableData, 'type' | 'fiberCount'>,
    visibility: { backbone: boolean; distribution: boolean; drop: boolean }
): boolean {
    const t = getEffectiveCableType(cable);
    if (t === CableType.FEEDER) return visibility.backbone;
    if (t === CableType.DISTRIBUTION) return visibility.distribution;
    return visibility.drop;
}
