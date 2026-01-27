import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Create default plans
    const plans = [
        {
            name: 'Plano Trial',
            price: 0.0,
            type: 'TRIAL',
            trialDurationDays: 7,
            features: JSON.stringify(['all_features']),
            limits: JSON.stringify({ projects: 5, users: 3, ctos: 100, pops: 5 }),
            stripeId: 'price_trial_example',
        },
        {
            name: 'Plano Ilimitado',
            price: 99.90,
            type: 'ENTERPRISE',
            features: JSON.stringify(['all_features']),
            limits: JSON.stringify({ projects: 999, users: 999, ctos: 9999, pops: 999 }),
            stripeId: 'price_H5ggYJDqBQ4', // Updated field name
        },
    ];

    for (const plan of plans) {
        const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
        if (!existing) {
            await prisma.plan.create({ data: plan });
            console.log(`Created plan: ${plan.name}`);
        }
    }

    // --- SEED TEMPLATES ---
    console.log('Seeding templates...');

    // 1. Template Cables
    const cables = [
        { name: 'Cabo AS 6F', fiberCount: 6, looseTubeCount: 1, fibersPerTube: 6, deployedSpec: { color: '#ff00ff', width: 3 }, defaultLevel: 'DISTRIBUICAO' },
        { name: 'Cabo AS 12F', fiberCount: 12, looseTubeCount: 1, fibersPerTube: 12, deployedSpec: { color: '#0000ff', width: 3 }, defaultLevel: 'TRONCO' },
        { name: 'Cabo AS 24F', fiberCount: 24, looseTubeCount: 4, fibersPerTube: 6, deployedSpec: { color: '#ffff00', width: 3 }, defaultLevel: 'TRONCO' },
        { name: 'Cabo AS 36F', fiberCount: 36, looseTubeCount: 6, fibersPerTube: 6, deployedSpec: { color: '#aa00ff', width: 3 }, defaultLevel: 'TRONCO' },
        { name: 'Cabo AS 48F', fiberCount: 48, looseTubeCount: 4, fibersPerTube: 6, deployedSpec: { color: '#55aa00', width: 3 }, defaultLevel: 'TRONCO' },
        { name: 'Cabo AS 72F', fiberCount: 72, looseTubeCount: 6, fibersPerTube: 12, deployedSpec: { color: '#6366f1', width: 3 }, defaultLevel: 'TRONCO' },
    ];
    for (const c of cables) {
        const exists = await prisma.templateCable.findFirst({ where: { name: c.name } });
        if (!exists) await prisma.templateCable.create({ data: c as any });
    }

    // 2. Template Splitters
    const splitters = [
        { name: 'Splitter 1:8 PLC', type: 'PLC', mode: 'Balanced', outputs: 8, attenuation: { loss: 10.5 } },
        { name: 'Splitter 1:16 PLC', type: 'PLC', mode: 'Balanced', outputs: 16, attenuation: { loss: 13.8 } },
        { name: 'Splitter 10/90 FBT', type: 'FBT', mode: 'Unbalanced', outputs: 2, attenuation: { ports: { "1": 10.5, "2": 0.5 } } },
    ];
    for (const s of splitters) {
        const exists = await prisma.templateSplitter.findFirst({ where: { name: s.name } });
        if (!exists) await prisma.templateSplitter.create({ data: s as any });
    }

    // 3. Template Boxes
    const boxes = [
        { name: 'CTO 16 Portas', type: 'CTO', model: 'Padrão', color: '#64748b' },
        { name: 'CEO 48 Fibras', type: 'CEO', model: 'Padrão', color: '#334155' },
    ];
    for (const b of boxes) {
        const exists = await prisma.templateBox.findFirst({ where: { name: b.name } });
        if (!exists) await prisma.templateBox.create({ data: b as any });
    }

    // 4. Template Poles
    const poles = [
        { name: 'Poste Concreto Circular 11m/300daN', type: 'Concreto', height: 11, strength: 300, shape: 'Circular' },
    ];
    for (const p of poles) {
        const exists = await prisma.templatePole.findFirst({ where: { name: p.name } });
        if (!exists) await prisma.templatePole.create({ data: p });
    }

    // 5. Template Fusions
    const fusions = [
        { name: 'Fusão Padrão', attenuation: 0.05 },
    ];
    for (const f of fusions) {
        const exists = await prisma.templateFusion.findFirst({ where: { name: f.name } });
        if (!exists) await prisma.templateFusion.create({ data: f });
    }

    // 6. Template OLTs
    const olts = [
        { name: 'OLT GPON 16 Portas', slots: 1, portsPerSlot: 16, outputPower: 3.0 },
    ];
    for (const o of olts) {
        const exists = await prisma.templateOLT.findFirst({ where: { name: o.name } });
        if (!exists) await prisma.templateOLT.create({ data: o });
    }

    console.log('Templates seeded successfully.');

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
