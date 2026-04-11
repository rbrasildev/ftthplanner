import { Splitter } from '../types';

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
