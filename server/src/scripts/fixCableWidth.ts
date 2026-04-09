import { prisma } from '../lib/prisma';

async function main() {
    console.log('Fixing cable widths in catalog_cables...');

    // Busca todos os cabos do catálogo de todas as empresas
    const cables = await prisma.catalogCable.findMany({
        select: { id: true, fiberCount: true, deployedSpec: true, plannedSpec: true }
    });

    let updated = 0;

    for (const cable of cables) {
        const targetWidth = cable.fiberCount > 24 ? 3 : 2;
        const deployed = (cable.deployedSpec as any) || {};
        const planned = (cable.plannedSpec as any) || {};

        if (deployed.width === targetWidth && planned.width === targetWidth) continue;

        await prisma.catalogCable.update({
            where: { id: cable.id },
            data: {
                deployedSpec: { ...deployed, width: targetWidth },
                plannedSpec: { ...planned, width: targetWidth }
            }
        });

        updated++;
        console.log(`  [${cable.fiberCount}FO] ${cable.id} -> ${targetWidth}px`);
    }

    console.log(`Done! ${updated} cables updated out of ${cables.length} total.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
