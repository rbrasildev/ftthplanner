// @ts-nocheck
const { PrismaClient } = require('./prisma/client_temp');
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BACKUP_FILE = 'backup-925f972f-dc38-49b3-9195-aed4972fe764-auto-2026-01-10T06-00-49-641Z.json';
const BACKUP_PATH = path.join(__dirname, 'backups', BACKUP_FILE);

async function main() {
    console.log("Starting Full Verify & Restore...");

    // 1. Create Plans
    const plans = [
        { name: 'Plano Grátis', price: 0.0, limits: {} },
        { name: 'Plano Ilimitado', price: 99.90, limits: {} }
    ];

    for (const p of plans) {
        await prisma.plan.upsert({
            where: { id: 'temp-id-ignore' },
            update: {},
            create: p,
        }).catch(async (e) => {
            const exists = await prisma.plan.findFirst({ where: { name: p.name } });
            if (!exists) await prisma.plan.create({ data: p });
            // If ID matches but name? upsert via ID is tricky here as we don't know IDs.
            // But this try-catch block handles the unique constraint if schema had it.
        });
    }

    // ensure plans exist cleanly
    const freePlan = await prisma.plan.findFirst({ where: { name: 'Plano Grátis' } });
    if (!freePlan) await prisma.plan.create({ data: plans[0] });

    // 2. Create Recovery User & Company
    const passwordHash = await bcrypt.hash('123456', 10);

    // Check if user exists (after reset, it shouldn't, but restart partial runs)
    let user = await prisma.user.findFirst({ where: { username: 'admin' } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                username: 'admin',
                passwordHash,
                role: 'OWNER'
            }
        });
    }

    let company = await prisma.company.findFirst({ where: { users: { some: { id: user.id } } } });
    if (!company) {
        company = await prisma.company.create({
            data: {
                name: 'Recuperada LTDA',
                users: { connect: { id: user.id } },
                planId: freePlan?.id, // Assumes freePlan was found/created
                status: 'ACTIVE'
            }
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { companyId: company.id }
        });
    }

    console.log(`Created User: admin / 123456`);
    console.log(`Created Company: ${company.name} (${company.id})`);

    // 2.5 Clean existing data (Idempotency)
    console.log("Cleaning existing company data...");
    // Delete in order of dependency?
    // Cables depend on Nodes (CTO/POP) and Catalog
    // Catalog depends on nothing (but referenced by instances)
    // Instances depend on Project
    // So: Cables -> Instances -> Projects -> Catalog
    await prisma.cable.deleteMany({ where: { companyId: company.id } });
    await prisma.pole.deleteMany({ where: { companyId: company.id } });
    await prisma.cto.deleteMany({ where: { companyId: company.id } });
    await prisma.pop.deleteMany({ where: { companyId: company.id } });
    await prisma.project.deleteMany({ where: { companyId: company.id } });

    await prisma.catalogCable.deleteMany({ where: { companyId: company.id } });
    await prisma.catalogBox.deleteMany({ where: { companyId: company.id } });
    await prisma.catalogPole.deleteMany({ where: { companyId: company.id } });
    // Add others if needed

    // 3. Read Backup
    console.log(`Reading backup: ${BACKUP_PATH}`);
    const content = fs.readFileSync(BACKUP_PATH, 'utf-8');
    const data = JSON.parse(content);

    // 4. Extract UUIDs for Catalog Reconstruction
    const catalogCableIds = new Set<string>();
    const catalogBoxIds = new Set<string>();
    const catalogPoleIds = new Set<string>();

    if (data.cables) {
        data.cables.forEach((c: any) => {
            if (c.catalogId) catalogCableIds.add(c.catalogId);
            c.companyId = company.id; // Fix Company ID
        });
    }
    if (data.ctos) {
        data.ctos.forEach((c: any) => {
            if (c.catalogId) catalogBoxIds.add(c.catalogId);
            c.companyId = company.id;
        });
    }
    if (data.pops) {
        data.pops.forEach((c: any) => {
            c.companyId = company.id;
        });
    }
    if (data.poles) {
        data.poles.forEach((c: any) => {
            if (c.catalogId) catalogPoleIds.add(c.catalogId);
            c.companyId = company.id;
        });
    }
    if (data.projects) {
        data.projects.forEach((c: any) => {
            c.companyId = company.id;
            // c.userId = user.id; // Correctly map below
        });
    }

    // 5. Reconstruct Catalogs (Restored Generic Items)
    console.log(`Reconstructing ${catalogCableIds.size} Cable Types...`);
    for (const id of catalogCableIds) {
        await prisma.catalogCable.create({
            data: {
                id, // PRESERVE UUID
                name: "Restored Cable " + id.substring(0, 6),
                fiberCount: 12, // Default
                looseTubeCount: 1,
                fibersPerTube: 12,
                companyId: company.id
            }
        });
    }

    console.log(`Reconstructing ${catalogBoxIds.size} Box Types...`);
    for (const id of catalogBoxIds) {
        await prisma.catalogBox.create({
            data: {
                id,
                name: "Restored Box " + id.substring(0, 6),
                type: "CTO",
                companyId: company.id
            }
        });
    }

    console.log(`Reconstructing ${catalogPoleIds.size} Pole Types...`);
    for (const id of catalogPoleIds) {
        await prisma.catalogPole.create({
            data: {
                id,
                name: "Restored Pole " + id.substring(0, 6),
                type: "Concreto",
                height: 10,
                strength: 100,
                shape: "Circular",
                companyId: company.id
            }
        });
    }

    // 6. Insert Data
    if (data.projects) {
        console.log(`Restoring ${data.projects.length} projects...`);
        const cleanProjects = data.projects.map((p: any) => ({
            id: p.id,
            userId: user.id, // OVERRIDE to new user
            name: p.name,
            centerLat: p.centerLat,
            centerLng: p.centerLng,
            zoom: p.zoom,
            settings: p.settings || "{}",
            createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
            companyId: company.id
        }));

        await prisma.project.createMany({ data: cleanProjects });
    }

    // Dependencies
    if (data.pops && data.pops.length) await prisma.pop.createMany({ data: data.pops });
    if (data.ctos && data.ctos.length) await prisma.cto.createMany({ data: data.ctos });
    if (data.poles && data.poles.length) await prisma.pole.createMany({ data: data.poles });
    if (data.cables && data.cables.length) await prisma.cable.createMany({ data: data.cables });

    // 7. Populate Templates (Clone from Restored Catalog)
    console.log("Populating Template Tables...");
    const cables = await prisma.catalogCable.findMany({ where: { companyId: company.id } });
    for (const c of cables) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, companyId, ...rest } = c;
        await prisma.templateCable.create({ data: { ...rest } });
    }

    const boxes = await prisma.catalogBox.findMany({ where: { companyId: company.id } });
    for (const b of boxes) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, companyId, ...rest } = b;
        await prisma.templateBox.create({ data: { ...rest } });
    }

    const poles = await prisma.catalogPole.findMany({ where: { companyId: company.id } });
    for (const p of poles) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, companyId, ...rest } = p;
        await prisma.templatePole.create({ data: { ...rest } });
    }

    console.log("Restore Success!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
