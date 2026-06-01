/**
 * Migração heurística pra recuperar overrides de cor/espessura de cabos
 * existentes pós-mudança que separou customColor/customWidth de color/width.
 *
 * VERSÃO CONSERVADORA: só marca como override quando cable.color está na
 * palette explícita do picker (CABLE_MAP_COLORS no CableEditor) — ou seja,
 * o usuário OBVIAMENTE clicou pra customizar. Cores fora da palette
 * (hex custom típicos de "snapshot de catálogo" antigo) ficam intocadas
 * pra evitar criar overrides fantasmas que travariam o cabo numa cor
 * antiga em vez de seguir o catálogo atual.
 *
 * TRADE-OFF: usuários que customizaram via input hex ou color picker
 * nativo (cores fora da palette) NÃO terão override recuperado. Eles
 * precisam re-customizar manualmente pelo CableEditor (1 clique).
 *
 * Rodar uma vez: npx ts-node scripts/migrate-cable-custom-color.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mesma palette do CableEditor (components/CableEditor.tsx). Mantenha em sync.
const CABLE_MAP_COLORS = new Set([
    '#0ea5e9', // Blue
    '#f97316', // Orange
    '#10b981', // Green
    '#a97142', // Brown
    '#64748b', // Slate
    '#ffffff', // White
    '#ef4444', // Red
    '#000000', // Black
    '#eab308', // Yellow
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Aqua
]);

const norm = (hex: string | null | undefined) => (hex || '').toLowerCase().trim();

async function main() {
    const cables = await prisma.cable.findMany({
        where: { catalogId: { not: null }, deletedAt: null },
        select: { id: true, status: true, color: true, width: true, catalogId: true }
    });

    if (cables.length === 0) {
        console.log('Nenhum cabo com catalogId. Nada a migrar.');
        return;
    }

    const catalogIds = [...new Set(cables.map(c => c.catalogId!))];
    const catalogs = await prisma.catalogCable.findMany({
        where: { id: { in: catalogIds } },
        select: { id: true, deployedSpec: true, plannedSpec: true }
    });
    const catalogMap = new Map(catalogs.map(c => [c.id, c]));

    let migratedColor = 0, migratedWidth = 0, skipped = 0;

    for (const cable of cables) {
        const cat = catalogMap.get(cable.catalogId!);
        if (!cat) { skipped++; continue; }

        const isPlanned = cable.status === 'NOT_DEPLOYED';
        const catAny = cat as any;
        const spec = isPlanned ? catAny.plannedSpec : catAny.deployedSpec;
        if (!spec) { skipped++; continue; }

        const specColor = norm(spec.color);
        const specWidth = spec.width as number | undefined;
        const cabColor = norm(cable.color);

        // Override de cor: cable.color tem que estar na palette explícita
        // E ser diferente do que o catálogo aponta hoje.
        const colorOverride = cabColor
            && CABLE_MAP_COLORS.has(cabColor)
            && cabColor !== specColor
            ? cable.color!
            : null;

        // Override de espessura: usuário rara vez muda width pra valor
        // "incomum" — qualquer divergência do catálogo é considerada override.
        const widthOverride = cable.width != null
            && specWidth != null
            && cable.width !== specWidth
            ? cable.width
            : null;

        if (colorOverride === null && widthOverride === null) {
            skipped++;
            continue;
        }

        await prisma.cable.update({
            where: { id: cable.id },
            data: {
                customColor: colorOverride,
                customWidth: widthOverride
            } as any
        });

        if (colorOverride !== null) migratedColor++;
        if (widthOverride !== null) migratedWidth++;
    }

    console.log(`Migração concluída:`);
    console.log(`  ${migratedColor} cabos com override de cor recuperado`);
    console.log(`  ${migratedWidth} cabos com override de espessura recuperado`);
    console.log(`  ${skipped} cabos sem override (ou sem catálogo válido)`);
    console.log(`\nNOTA: cabos customizados com hex fora da palette (ex: #FF00FF) não foram migrados.`);
    console.log(`Esses precisam ser re-customizados manualmente no CableEditor.`);
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
