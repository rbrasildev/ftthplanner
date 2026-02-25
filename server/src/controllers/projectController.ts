import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getProjects = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user || !user.companyId) {
        console.log("[getProjects] Unauthorized: No user/companyId");
        return res.status(401).send();
    }

    try {
        console.log(`[getProjects] Fetching projects for company ${user.companyId}...`);

        // Fetch projects summaries
        const projects = await prisma.project.findMany({
            where: { companyId: user.companyId },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                name: true,
                updatedAt: true,
                createdAt: true,
                centerLat: true,
                centerLng: true,
                zoom: true,
                settings: true,
                _count: {
                    select: {
                        ctos: true,
                        cables: true,
                        pops: true,
                        poles: true
                    }
                }
            }
        });

        // Fetch deployed counts efficiently in aggregate
        const ctoCounts = await prisma.cto.groupBy({
            by: ['projectId', 'status'],
            where: { companyId: user.companyId, status: { in: ['DEPLOYED', 'CERTIFIED'] } },
            _count: { id: true }
        });

        const cableCounts = await prisma.cable.groupBy({
            by: ['projectId', 'status'],
            where: { companyId: user.companyId, status: 'DEPLOYED' },
            _count: { id: true }
        });

        // Map counts for easy access
        const deployedMap: any = {};
        ctoCounts.forEach(c => {
            if (!deployedMap[c.projectId]) deployedMap[c.projectId] = { ctos: 0, cables: 0 };
            deployedMap[c.projectId].ctos += c._count.id;
        });
        cableCounts.forEach(c => {
            if (!deployedMap[c.projectId]) deployedMap[c.projectId] = { ctos: 0, cables: 0 };
            deployedMap[c.projectId].cables += c._count.id;
        });

        console.log(`[getProjects] Found ${projects.length} projects.`);

        res.json(projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            updatedAt: p.updatedAt ? p.updatedAt.getTime() : Date.now(),
            createdAt: p.createdAt ? p.createdAt.getTime() : Date.now(),
            counts: {
                ctos: p._count.ctos,
                pops: p._count.pops,
                cables: p._count.cables,
                poles: p._count.poles,
                deployedCtos: deployedMap[p.id]?.ctos || 0,
                deployedCables: deployedMap[p.id]?.cables || 0
            },
            mapState: {
                center: { lat: p.centerLat, lng: p.centerLng },
                zoom: p.zoom
            },
            settings: p.settings
        })));
    } catch (error: any) {
        console.error("Get Projects Error:", error);
        res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
    }
};

export const createProject = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { name, centerLat, centerLng } = req.body;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        // Check Plan Limits
        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            include: {
                plan: true,
                _count: { select: { projects: true } }
            }
        });

        if (!company) return res.status(404).json({ error: 'Company not found' });
        if (company.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'Assinatura suspensa. Por favor, regularize seu plano para criar novos projetos.' });
        }
        if (company.subscriptionExpiresAt && new Date() > company.subscriptionExpiresAt) {
            return res.status(403).json({ error: 'Seu período de teste (trial) expirou. Por favor, assine um plano para continuar.' });
        }

        if (company.plan && company.plan.limits) {
            const limits = company.plan.limits as any;
            if (limits.maxProjects && company._count.projects >= limits.maxProjects) {
                return res.status(403).json({
                    error: 'Limite de projetos atingido para seu plano',
                    details: `Máximo de projetos: ${limits.maxProjects}`
                });
            }
        }

        const project = await prisma.project.create({
            data: {
                userId: user.id,
                companyId: user.companyId,
                name,
                centerLat,
                centerLng
            }
        });
        res.json({
            id: project.id,
            name: project.name,
            createdAt: project.createdAt.getTime(),
            updatedAt: project.updatedAt.getTime(),
            network: { ctos: [], pops: [], cables: [], poles: [] },
            mapState: { center: { lat: project.centerLat, lng: project.centerLng }, zoom: project.zoom },
            settings: project.settings || { snapDistance: 30 }
        });
    } catch (error) {
        console.error("Create Project Error:", error);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

export const getProject = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        const project = await prisma.project.findFirst({
            where: { id, companyId: user.companyId },
            include: {
                ctos: true,
                pops: true,
                cables: true,
                poles: true,
                company: true
            }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (project.company) {
            if (project.company.status === 'SUSPENDED') {
                return res.status(403).json({ error: 'Assinatura suspensa. Por favor, regularize seu plano para acessar este projeto.' });
            }
            if (project.company.subscriptionExpiresAt && new Date() > project.company.subscriptionExpiresAt) {
                return res.status(403).json({ error: 'Seu período de teste (trial) expirou. Por favor, assine um plano para acessar seus projetos.' });
            }
        }

        // Map DB entities to NetworkState
        const network = {
            ctos: project.ctos.map((c: any) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                coordinates: { lat: c.lat, lng: c.lng },
                splitters: c.splitters || [],
                fusions: c.fusions || [],
                connections: c.connections || [],
                inputCableIds: c.inputCableIds,
                layout: c.layout || {},
                clientCount: c.clientCount,
                catalogId: c.catalogId,
                type: c.type,
                color: c.color,
                reserveLoopLength: c.reserveLoopLength,
                poleId: c.poleId
            })),
            pops: project.pops.map((p: any) => ({
                id: p.id,
                name: p.name,
                status: p.status,
                coordinates: { lat: p.lat, lng: p.lng },
                olts: p.olts || [],
                dios: p.dios || [],
                fusions: p.fusions || [],
                connections: p.connections || [],
                inputCableIds: p.inputCableIds,
                layout: p.layout || {},
                color: p.color,
                size: p.size,
                poleId: p.poleId
            })),
            cables: project.cables.map((c: any) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                fiberCount: c.fiberCount,
                looseTubeCount: c.looseTubeCount,
                color: c.color,
                colorStandard: c.colorStandard,
                coordinates: c.coordinates, // Json
                fromNodeId: c.fromNodeId,
                toNodeId: c.toNodeId,
                catalogId: c.catalogId,
                technicalReserve: c.technicalReserve,
                reserveLocation: c.reserveLocation,
                showReserveLabel: c.showReserveLabel
            })),
            poles: project.poles.map((p: any) => ({
                id: p.id,
                name: p.name,
                status: p.status,
                coordinates: { lat: p.lat, lng: p.lng },
                catalogId: p.catalogId,
                type: p.type,
                height: p.height,
                linkedCableIds: p.linkedCableIds
            }))
        };

        res.json({
            id: project.id,
            name: project.name,
            createdAt: project.createdAt.getTime(),
            updatedAt: project.updatedAt.getTime(),
            network,
            mapState: { center: { lat: project.centerLat, lng: project.centerLng }, zoom: project.zoom },
            settings: project.settings
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
}

export const updateProject = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params;
    const { name, centerLat, centerLng } = req.body;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        const project = await prisma.project.update({
            where: { id, companyId: user.companyId } as any, // Prisma quirk with composite unique or implicit
            data: {
                name,
                centerLat,
                centerLng
            }
        });

        res.json({
            id: project.id,
            name: project.name,
            createdAt: project.createdAt.getTime(),
            updatedAt: project.updatedAt.getTime(),
            network: { ctos: [], pops: [], cables: [] },
            mapState: { center: { lat: project.centerLat, lng: project.centerLng }, zoom: project.zoom },
            settings: project.settings
        });
    } catch (error) {
        console.error("Update project error:", error);
        res.status(500).json({ error: 'Failed to update project' });
    }
};

export const deleteProject = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        // Verify ownership/tenancy first to avoid unauthorized delete of resources
        const project = await prisma.project.findFirst({ where: { id, companyId: user.companyId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Explicitly delete related resources first to ensure no orphans
        // This is a safety measure in case DB cascade is not configured
        await prisma.cable.deleteMany({ where: { projectId: id, companyId: user.companyId } });
        await prisma.cto.deleteMany({ where: { projectId: id, companyId: user.companyId } });
        await prisma.pop.deleteMany({ where: { projectId: id, companyId: user.companyId } });
        await prisma.pole.deleteMany({ where: { projectId: id, companyId: user.companyId } });

        // Delete the project
        await prisma.project.delete({ where: { id } }); // We already verified checks above
        res.json({ success: true });
    } catch (e) {
        console.error("Delete project error:", e);
        res.status(500).json({ error: 'Failed' });
    }
}

export const syncProject = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params;
    const { network, mapState, settings } = req.body;

    if (!network) return res.status(400).json({ error: 'No network data provided' });
    if (!user || !user.companyId) return res.status(401).send();

    // --- PAYLOAD DEDUPLICATION ---
    // Ensure the incoming arrays don't have internal duplicates (same ID twice in the list)
    if (network.ctos) {
        const seen = new Set();
        network.ctos = network.ctos.filter((c: any) => {
            const duplicate = seen.has(c.id);
            seen.add(c.id);
            return !duplicate;
        });
    }
    if (network.pops) {
        const seen = new Set();
        network.pops = network.pops.filter((p: any) => {
            const duplicate = seen.has(p.id);
            seen.add(p.id);
            return !duplicate;
        });
    }
    if (network.cables) {
        const seen = new Set();
        network.cables = network.cables.filter((c: any) => {
            const duplicate = seen.has(c.id);
            seen.add(c.id);
            return !duplicate;
        });
    }
    if (network.poles) {
        const seen = new Set();
        network.poles = network.poles.filter((p: any) => {
            const duplicate = seen.has(p.id);
            seen.add(p.id);
            return !duplicate;
        });
    }

    try {
        console.log(`[Sync] Project ${id} | User ${user.username} | Company ${user.companyId}`);

        if (network.ctos && network.ctos.length > 0) {
            const sampleCTO = network.ctos[0];
            console.log(`[Sync Debug] Sample CTO: ${sampleCTO.name} (${sampleCTO.id})`);
            console.log(`[Sync Debug] Fusions: ${sampleCTO.fusions?.length}, Layout Keys: ${Object.keys(sampleCTO.layout || {}).length}`);
            if (sampleCTO.fusions?.length > 0) {
                console.log(`[Sync Debug] First Fusion ID: ${sampleCTO.fusions[0].id}`);
                console.log(`[Sync Debug] Layout Entry:`, sampleCTO.layout?.[sampleCTO.fusions[0].id]);
            }
        }

        const CHUNK_SIZE = 1000;

        // Check limits before transaction
        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            include: { plan: true }
        });

        if (company) {
            if (company.status === 'SUSPENDED') {
                return res.status(403).json({ error: 'Assinatura suspensa. Sincronização bloqueada.' });
            }
            if (company.subscriptionExpiresAt && new Date() > company.subscriptionExpiresAt) {
                return res.status(403).json({ error: 'Trial expirado. Sincronização bloqueada.' });
            }
        }

        if (company?.plan?.limits) {
            const limits = company.plan.limits as any;

            // Calculate DELTA (Net New Items) logic for Soft Lock
            // a) New Items in this Payload
            const payloadCTOCount = network.ctos ? network.ctos.length : 0;
            const payloadPOPCount = network.pops ? network.pops.length : 0;

            // b) Items currently in this Project (that will be replaced)
            const currentProjectCTOs = await prisma.cto.count({ where: { projectId: id } });
            const currentProjectPOPs = await prisma.pop.count({ where: { projectId: id } });

            // c) Delta = (Payload - CurrentProject). If > 0, we are adding items.
            const deltaCTO = payloadCTOCount - currentProjectCTOs;
            const deltaPOP = payloadPOPCount - currentProjectPOPs;

            // d) Global Items (All Projects)
            const totalGlobalCTOs = await prisma.cto.count({ where: { companyId: user.companyId } });
            const totalGlobalPOPs = await prisma.pop.count({ where: { companyId: user.companyId } });

            // e) Check Limit: If Delta > 0 AND (Global + Delta) > Limit
            // Note: 'totalGlobal' includes 'currentProject'. 
            // So FutureTotal = (Global - CurrentProject) + Payload
            //                = Global + (Payload - CurrentProject)
            //                = Global + Delta.

            const maxCTOs = Number(limits.maxCTOs || 0);
            const maxPOPs = Number(limits.maxPOPs || 0);

            console.log(`[Sync Check] Comp: ${company.name}, Plan: ${company.plan?.name}`);
            console.log(`[Sync Check] Global CTOs: ${totalGlobalCTOs}, Proj: ${currentProjectCTOs}, Pay: ${payloadCTOCount}, Delta: ${deltaCTO}`);
            console.log(`[Sync Check] Limits: MaxCTOs ${maxCTOs}, MaxPOPs ${maxPOPs}`);

            if (deltaCTO > 0 && maxCTOs > 0 && (totalGlobalCTOs + deltaCTO) > maxCTOs) {
                console.error(`[Sync Blocked] CTO Limit: Global ${totalGlobalCTOs} + Delta ${deltaCTO} > ${maxCTOs}`);
                return res.status(403).json({ error: `Limite de CTOs excedido. Máximo: ${maxCTOs}. Você tem: ${totalGlobalCTOs}. Tentando adicionar: ${deltaCTO}.` });
            }

            if (deltaPOP > 0 && maxPOPs > 0 && (totalGlobalPOPs + deltaPOP) > maxPOPs) {
                console.error(`[Sync Blocked] POP Limit: Global ${totalGlobalPOPs} + Delta ${deltaPOP} > ${maxPOPs}`);
                return res.status(403).json({ error: `Limite de POPs excedido (${maxPOPs})` });
            }
        }

        const project = await prisma.project.findFirst({ where: { id, companyId: user.companyId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // --- ID COLLISION HANDLING (CHUNKED) ---
        // Collect all IDs from payload
        const payloadIds = new Set<string>();
        if (network.ctos) network.ctos.forEach((c: any) => payloadIds.add(c.id));
        if (network.pops) network.pops.forEach((p: any) => payloadIds.add(p.id));
        if (network.cables) network.cables.forEach((c: any) => payloadIds.add(c.id));
        if (network.poles) network.poles.forEach((p: any) => payloadIds.add(p.id));

        const allIds = Array.from(payloadIds);
        const CHECK_CHUNK = 2000;
        const collidingIds = new Set<string>();

        // We must check collisions in chunks to avoid parameter limit errors
        for (let i = 0; i < allIds.length; i += CHECK_CHUNK) {
            const batch = allIds.slice(i, i + CHECK_CHUNK);

            // Fetch everything that matches IDs, we will filter in memory
            const [cRows, pRows, cabRows, poleRows] = await Promise.all([
                prisma.cto.findMany({
                    where: { id: { in: batch } },
                    select: { id: true, projectId: true, companyId: true }
                }),
                prisma.pop.findMany({
                    where: { id: { in: batch } },
                    select: { id: true, projectId: true, companyId: true }
                }),
                prisma.cable.findMany({
                    where: { id: { in: batch } },
                    select: { id: true, projectId: true, companyId: true }
                }),
                prisma.pole.findMany({
                    where: { id: { in: batch } },
                    select: { id: true, projectId: true, companyId: true }
                })
            ]);

            // Helper to check if row is "Mine" (will be deleted safely)
            // If it is NOT mine, it is a collision
            const isMine = (row: any) => row.projectId === id && row.companyId === user.companyId;

            cRows.forEach(row => {
                if (!isMine(row)) collidingIds.add(row.id);
            });
            pRows.forEach(row => {
                if (!isMine(row)) collidingIds.add(row.id);
            });
            cabRows.forEach(row => {
                if (!isMine(row)) collidingIds.add(row.id);
            });
            poleRows.forEach(row => {
                if (!isMine(row)) collidingIds.add(row.id);
            });
        }

        // Remap Logic if collisions exist
        const idMap = new Map<string, string>(); // oldId -> newId
        if (collidingIds.size > 0) {
            console.log(`[Sync] Found ${collidingIds.size} ID collisions. Remapping...`);

            // Generate new IDs
            collidingIds.forEach(oldId => {
                // simple UUID-like generator or actual UUID
                const newId = `remap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                idMap.set(oldId, newId);
            });

            // Helper to remap a string ID
            const remap = (oid: string) => idMap.has(oid) ? idMap.get(oid)! : oid;

            // RECURSIVE REMAP IN PAYLOAD
            // 1. CTOs
            if (network.ctos) {
                network.ctos.forEach((c: any) => {
                    if (idMap.has(c.id)) c.id = idMap.get(c.id);
                    // layout keys
                    if (c.layout) {
                        const newLayout: any = {};
                        Object.keys(c.layout).forEach(k => newLayout[remap(k)] = c.layout[k]);
                        c.layout = newLayout;
                    }
                    // inputCableIds
                    if (c.inputCableIds) c.inputCableIds = c.inputCableIds.map(remap);
                    // connections? If connections store IDs. 
                    if (c.connections) c.connections.forEach((conn: any) => {
                        conn.sourceId = remap(conn.sourceId);
                        conn.targetId = remap(conn.targetId);
                    });
                    // splitters ports? Usually IDs are internal.
                    if (c.splitters) c.splitters.forEach((s: any) => {
                        s.inputPortId = remap(s.inputPortId);
                        s.outputPortIds = s.outputPortIds.map(remap);
                    });
                });
            }
            // 2. POPs
            if (network.pops) {
                network.pops.forEach((p: any) => {
                    if (idMap.has(p.id)) p.id = idMap.get(p.id);
                    if (p.inputCableIds) p.inputCableIds = p.inputCableIds.map(remap);
                    if (p.connections) p.connections.forEach((conn: any) => {
                        conn.sourceId = remap(conn.sourceId);
                        conn.targetId = remap(conn.targetId);
                    });
                });
            }
            // 3. Cables
            if (network.cables) {
                network.cables.forEach((c: any) => {
                    if (idMap.has(c.id)) c.id = idMap.get(c.id);
                    if (c.fromNodeId) c.fromNodeId = remap(c.fromNodeId);
                    if (c.toNodeId) c.toNodeId = remap(c.toNodeId);
                });
            }
            // 4. Poles
            if (network.poles) {
                network.poles.forEach((p: any) => {
                    if (idMap.has(p.id)) p.id = idMap.get(p.id);
                    if (p.linkedCableIds) p.linkedCableIds = p.linkedCableIds.map(remap);
                });
            }
        }

        await prisma.$transaction(async (tx: any) => {
            // 0. Update Map State (unchanged)
            if (mapState || settings) {
                await tx.project.update({
                    where: { id },
                    data: {
                        ...(mapState ? {
                            centerLat: mapState.center.lat,
                            centerLng: mapState.center.lng,
                            zoom: mapState.zoom
                        } : {}),
                        ...(settings ? { settings } : {})
                    }
                });
            }

            // 1. CLEANUP PHASE - Delete Cables, POPs, Poles (CTOs handled separately via Upsert)
            // We delete in reverse dependency order: Cables -> POPs
            await tx.cable.deleteMany({ where: { projectId: id } });
            await tx.pop.deleteMany({ where: { projectId: id } });
            // await tx.cto.deleteMany({ where: { projectId: id } }); // CHANGED: Managed via Upsert to preserve relations
            await tx.pole.deleteMany({ where: { projectId: id } });

            // 2. INSERT/UPDATE PHASE - CTOs
            // We use Upsert to avoid breaking Foreign Key constraints (Drops, Customers)
            if (network.ctos) {
                // A. Identify CTOs to delete (present in DB but missing in payload)
                const payloadIds = new Set(network.ctos.map((c: any) => c.id));
                const existingCtos = await tx.cto.findMany({
                    where: { projectId: id },
                    select: { id: true }
                });

                const toDelete = existingCtos
                    .map((c: any) => c.id)
                    .filter((dbId: string) => !payloadIds.has(dbId));

                if (toDelete.length > 0) {
                    await tx.cto.deleteMany({ where: { id: { in: toDelete } } });
                }

                // B. Upsert payload CTOs
                // Note: We cannot use createMany with Upsert, so we iterate.
                for (const c of network.ctos) {
                    await tx.cto.upsert({
                        where: { id: c.id },
                        create: {
                            id: c.id,
                            projectId: id,
                            companyId: user.companyId,
                            name: c.name,
                            status: c.status,
                            lat: c.coordinates.lat,
                            lng: c.coordinates.lng,
                            splitters: c.splitters || [],
                            fusions: c.fusions || [],
                            connections: c.connections || [],
                            inputCableIds: c.inputCableIds || [],
                            layout: c.layout || {},
                            clientCount: c.clientCount || 0,
                            catalogId: c.catalogId,
                            type: c.type,
                            color: c.color,
                            reserveLoopLength: c.reserveLoopLength,
                            poleId: c.poleId
                        },
                        update: {
                            name: c.name,
                            status: c.status,
                            lat: c.coordinates.lat,
                            lng: c.coordinates.lng,
                            splitters: c.splitters || [],
                            fusions: c.fusions || [],
                            connections: c.connections || [],
                            inputCableIds: c.inputCableIds || [],
                            layout: c.layout || {},
                            clientCount: c.clientCount || 0,
                            catalogId: c.catalogId,
                            type: c.type,
                            color: c.color,
                            reserveLoopLength: c.reserveLoopLength,
                            poleId: c.poleId
                        }
                    });
                }
            }

            // 3. INSERT PHASE - POPs
            if (network.pops && network.pops.length > 0) {
                const uniquePOPs = Array.from(new Map(network.pops.map((p: any) => [p.id, p])).values());
                for (let i = 0; i < uniquePOPs.length; i += CHUNK_SIZE) {
                    const chunk = uniquePOPs.slice(i, i + CHUNK_SIZE);
                    await tx.pop.createMany({
                        data: chunk.map((p: any) => ({
                            id: p.id,
                            projectId: id,
                            companyId: user.companyId,
                            name: p.name,
                            status: p.status,
                            lat: p.coordinates.lat,
                            lng: p.coordinates.lng,
                            olts: p.olts || [],
                            dios: p.dios || [],
                            fusions: p.fusions || [],
                            connections: p.connections || [],
                            inputCableIds: p.inputCableIds || [],
                            layout: p.layout || {},
                            color: p.color,
                            size: p.size,
                            poleId: p.poleId
                        }))
                    });
                }
            }

            // 4. INSERT PHASE - Cables
            if (network.cables && network.cables.length > 0) {
                const uniqueCables = Array.from(new Map(network.cables.map((c: any) => [c.id, c])).values());
                for (let i = 0; i < uniqueCables.length; i += CHUNK_SIZE) {
                    const chunk = uniqueCables.slice(i, i + CHUNK_SIZE);
                    await tx.cable.createMany({
                        data: chunk.map((c: any) => ({
                            id: c.id,
                            projectId: id,
                            companyId: user.companyId,
                            name: c.name,
                            status: c.status,
                            fiberCount: c.fiberCount,
                            looseTubeCount: c.looseTubeCount || 1,
                            color: c.color,
                            colorStandard: c.colorStandard || 'ABNT',
                            coordinates: c.coordinates,
                            fromNodeId: c.fromNodeId,
                            toNodeId: c.toNodeId,
                            catalogId: c.catalogId,
                            technicalReserve: c.technicalReserve || 0,
                            reserveLocation: c.reserveLocation || null,
                            showReserveLabel: c.showReserveLabel !== undefined ? c.showReserveLabel : true
                        }))
                    });
                }
            }

            // 5. INSERT PHASE - Poles
            if (network.poles && network.poles.length > 0) {
                const uniquePoles = Array.from(new Map(network.poles.map((p: any) => [p.id, p])).values());
                for (let i = 0; i < uniquePoles.length; i += CHUNK_SIZE) {
                    const chunk = uniquePoles.slice(i, i + CHUNK_SIZE);
                    await tx.pole.createMany({
                        data: chunk.map((pole: any) => ({
                            id: pole.id,
                            projectId: id,
                            companyId: user.companyId,
                            name: pole.name,
                            status: pole.status,
                            lat: pole.coordinates.lat,
                            lng: pole.coordinates.lng,
                            catalogId: pole.catalogId || null,
                            type: pole.type,
                            height: pole.height,
                            linkedCableIds: pole.linkedCableIds || []
                        }))
                    });
                }
            }
        }, {
            timeout: 300000 // 5 minutes
        });

        res.json({ success: true, timestamp: Date.now() });

    } catch (error: any) {
        console.error("Sync Error:", error);
        res.status(500).json({ error: 'Sync failed', details: error.message || 'Unknown error' });
    }
};
