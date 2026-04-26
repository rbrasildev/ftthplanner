import { prisma } from '../lib/prisma';

// One-shot backfill for `cables.type`. Fills the new column on legacy cables
// using two strategies, in order:
//   1) If the cable has a `catalog_id`, copy `catalog_cables.defaultLevel`.
//   2) Otherwise, infer from `fiber_count` using the same thresholds as
//      utils/cableTypeUtils.ts (≤2 = DROP, ≤48 = DISTRIBUTION, else FEEDER).
//
// Existing non-null `type` values are NEVER overwritten.
//
// Usage (from /server):
//   npx ts-node src/scripts/backfillCableTypes.ts                # dry-run + apply
//   npx ts-node src/scripts/backfillCableTypes.ts --dry-run      # preview only
//   npx ts-node src/scripts/backfillCableTypes.ts --no-infer     # catalog-only
//   npx ts-node src/scripts/backfillCableTypes.ts --company <id> # scope one tenant

const DROP_MAX_FIBERS = 2;
const DISTRIBUTION_MAX_FIBERS = 48;

function inferFromFiberCount(fiberCount: number): 'DROP' | 'DISTRIBUTION' | 'FEEDER' {
    if (fiberCount <= DROP_MAX_FIBERS) return 'DROP';
    if (fiberCount <= DISTRIBUTION_MAX_FIBERS) return 'DISTRIBUTION';
    return 'FEEDER';
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const skipInfer = args.includes('--no-infer');
    const companyIdx = args.indexOf('--company');
    const companyId = companyIdx >= 0 ? args[companyIdx + 1] : null;

    console.log('--- Cable Type Backfill ---');
    console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'APPLY'}`);
    console.log(`Infer from fiberCount: ${skipInfer ? 'NO (catalog-only)' : 'YES'}`);
    if (companyId) console.log(`Scope: companyId = ${companyId}`);

    // 1. Load every cable that still has type = NULL.
    // Cast `where` to any: the new `type` column requires a `prisma generate`
    // run after the migration; before that, the generated client doesn't know
    // about the field. Casting lets the script compile in either state.
    const candidateCables: Array<{ id: string; catalogId: string | null; fiberCount: number; companyId: string | null }> = await prisma.cable.findMany({
        where: {
            type: null,
            deletedAt: null,
            ...(companyId ? { companyId } : {}),
        } as any,
        select: { id: true, catalogId: true, fiberCount: true, companyId: true },
    });
    console.log(`Found ${candidateCables.length} cable(s) with type = NULL.`);
    if (candidateCables.length === 0) return;

    // 2. Resolve the catalog map in one query (only the catalogs we need).
    const catalogIds = Array.from(new Set(candidateCables.map(c => c.catalogId).filter((id): id is string => !!id)));
    const catalogs = catalogIds.length
        ? await prisma.catalogCable.findMany({
            where: { id: { in: catalogIds } },
            select: { id: true, defaultLevel: true },
        })
        : [];
    const defaultLevelById = new Map(catalogs.map(c => [c.id, c.defaultLevel]));
    console.log(`Loaded ${catalogs.length} catalog model(s) referenced by these cables.`);

    // 3. Bucket each cable into its target type and source.
    const buckets = new Map<string, { source: 'catalog' | 'inferred'; ids: string[] }>();
    let unresolved = 0;
    for (const cable of candidateCables) {
        let target: string | null = null;
        let source: 'catalog' | 'inferred' = 'catalog';

        if (cable.catalogId) {
            const lvl = defaultLevelById.get(cable.catalogId);
            if (lvl) target = lvl;
        }
        if (!target && !skipInfer) {
            target = inferFromFiberCount(cable.fiberCount || 0);
            source = 'inferred';
        }
        if (!target) { unresolved++; continue; }

        const bucketKey = `${source}::${target}`;
        const bucket = buckets.get(bucketKey) || { source, ids: [] };
        bucket.ids.push(cable.id);
        buckets.set(bucketKey, bucket);
    }

    // 4. Report bucket summary.
    console.log('\n--- Plan ---');
    let totalToWrite = 0;
    for (const [key, bucket] of Array.from(buckets.entries())) {
        const [, target] = key.split('::');
        console.log(`  [${bucket.source.padEnd(8)}] ${bucket.ids.length.toString().padStart(6)} cables → type = "${target}"`);
        totalToWrite += bucket.ids.length;
    }
    if (unresolved > 0) console.log(`  [SKIPPED] ${unresolved} cable(s) — no catalog match and infer disabled.`);
    console.log(`  TOTAL to update: ${totalToWrite}`);

    if (dryRun) {
        console.log('\nDry-run finished. Re-run without --dry-run to apply.');
        return;
    }

    // 5. Apply in chunks. Per-bucket bulk update is much faster than per-row.
    console.log('\n--- Applying ---');
    let written = 0;
    for (const [key, bucket] of Array.from(buckets.entries())) {
        const [, target] = key.split('::');
        // Chunk to keep parameter list under typical Postgres limits.
        const CHUNK = 1000;
        for (let i = 0; i < bucket.ids.length; i += CHUNK) {
            const slice = bucket.ids.slice(i, i + CHUNK);
            const result = await prisma.cable.updateMany({
                where: { id: { in: slice }, type: null } as any,
                data: { type: target } as any,
            });
            written += result.count;
            console.log(`  wrote ${result.count.toString().padStart(6)} → "${target}" (${bucket.source})`);
        }
    }
    console.log(`\nDone. ${written} cable(s) updated.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
