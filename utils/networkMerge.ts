import { NetworkState } from '../types';

/**
 * Mescla a network do projeto atual com a network do projeto base (parent),
 * dedupando por id (current vence em caso de conflito — assumimos que o usuário
 * está editando uma cópia local válida).
 *
 * Usado por todas as operações de tracing que precisam atravessar a fronteira
 * entre child e parent: orçamento óptico, OTDR, VFL, port-power map. Antes de
 * existir, cada call-site fazia merge inline com lógica ligeiramente diferente,
 * deixando algumas features (VFL e OTDR) ignorando o parent silenciosamente.
 *
 * Retorna `base` intacto se `parent` for null/undefined — pra que sites que
 * não dependem do parent não paguem custo nem mudem comportamento.
 */
export function mergeWithParentNetwork(
    base: NetworkState,
    parent: NetworkState | null | undefined
): NetworkState {
    if (!parent) return base;

    const dedup = <T extends { id: string }>(localList: T[], parentList: T[] | undefined): T[] => {
        if (!parentList || parentList.length === 0) return localList;
        const localIds = new Set(localList.map(x => x.id));
        const merged = [...localList];
        for (const item of parentList) {
            if (!localIds.has(item.id)) merged.push(item);
        }
        return merged;
    };

    return {
        ...base,
        ctos: dedup(base.ctos, parent.ctos),
        pops: dedup(base.pops, parent.pops),
        cables: dedup(base.cables, parent.cables),
        poles: dedup(base.poles || [], parent.poles),
    };
}
