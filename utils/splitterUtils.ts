import { Splitter } from '../types';
import { SplitterCatalogItem } from '../services/catalogService';

/**
 * Derive the output port count of a splitter consistently across the app.
 * Priority:
 *  1. `outputPortIds.length` when populated — this is the authoritative value once
 *     the splitter has been initialized (ports are allocated and tracked by ID).
 *  2. Regex parse of `type` (e.g. "1x8" → 8) as fallback for splitters that exist
 *     in data but haven't had their output ports materialized yet.
 *  3. Default 8 when nothing else is available.
 *
 * Before this helper, `ConnectCustomerModal` used only `outputPortIds.length` (returning
 * 0 for uninitialized splitters) while `CustomerModal` mixed regex + array length, so the
 * two modals could show different port grids for the same splitter.
 */
export const getSplitterPortCount = (splitter: Pick<Splitter, 'type' | 'outputPortIds'> | null | undefined): number => {
    if (!splitter) return 0;

    const arrayLen = splitter.outputPortIds?.length ?? 0;
    if (arrayLen > 0) return arrayLen;

    if (splitter.type) {
        const match = splitter.type.match(/1x(\d+)/i);
        if (match) return parseInt(match[1], 10);
    }

    return 8;
};

/**
 * Resolve o item do catálogo de um splitter usando a mesma prioridade do
 * `traceOpticalPath` (em opticalUtils.ts):
 *   1. `catalogId` — link canônico, sobrevive a renomear o catálogo.
 *   2. `name` exato — para registros antigos sem catalogId.
 *   3. `name` normalizado (case/trim) — pequenas variações.
 *   4. Fallback por contagem de saídas — best-effort.
 *
 * Antes desse helper, CTOEditor (modal de orçamento) e SplitterRenderer (high-power
 * port marker) faziam matching só por name/type, divergindo do trace e quebrando
 * sempre que o item do catálogo era renomeado.
 */
export const findSplitterCatalog = (
    splitter: Pick<Splitter, 'type' | 'catalogId' | 'outputPortIds'> | null | undefined,
    catalog: SplitterCatalogItem[]
): SplitterCatalogItem | undefined => {
    if (!splitter) return undefined;

    if (splitter.catalogId) {
        const byId = catalog.find(c => c.id === splitter.catalogId);
        if (byId) return byId;
    }

    if (splitter.type) {
        const byName = catalog.find(c => c.name === splitter.type);
        if (byName) return byName;

        const norm = splitter.type.trim().toLowerCase();
        const byNormName = catalog.find(c => c.name.trim().toLowerCase() === norm);
        if (byNormName) return byNormName;
    }

    const outCount = splitter.outputPortIds?.length ?? 0;
    if (outCount > 0) {
        return catalog.find(c => c.outputs === outCount);
    }

    return undefined;
};
