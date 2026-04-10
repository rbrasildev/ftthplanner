import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';
import { traceOpticalPower } from '../services/opticalCalcService';

export const getProjects = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user || !user.companyId) {
        logger.warn("[getProjects] Unauthorized: No user/companyId");
        return res.status(401).send();
    }

    try {
        logger.info(`[getProjects] Fetching projects for company ${user.companyId}...`);

        // Fetch projects summaries
        const projects = await prisma.project.findMany({
            where: { companyId: user.companyId, deletedAt: null },
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
                parentProjectId: true,
                inheritedElements: true,
                parentProject: { select: { id: true, name: true } },
                _count: {
                    select: {
                        ctos: { where: { deletedAt: null } },
                        cables: { where: { deletedAt: null } },
                        pops: { where: { deletedAt: null } },
                        poles: { where: { deletedAt: null } },
                        childProjects: { where: { deletedAt: null } }
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

        logger.info(`[getProjects] Found ${projects.length} projects.`);

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
                deployedCables: deployedMap[p.id]?.cables || 0,
                childProjects: p._count.childProjects || 0
            },
            mapState: {
                center: { lat: p.centerLat, lng: p.centerLng },
                zoom: p.zoom
            },
            settings: p.settings,
            parentProjectId: p.parentProjectId || null,
            parentProject: p.parentProject || null,
            inheritedElements: p.inheritedElements
        })));
    } catch (error: any) {
        logger.error(`Get Projects Error: ${error.message}`);
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
                _count: { select: { projects: { where: { deletedAt: null } } } }
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
    } catch (error: any) {
        logger.error(`Create Project Error: ${error.message}`);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

export const getProject = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        const project = await prisma.project.findFirst({
            where: { id, companyId: user.companyId, deletedAt: null },
            include: {
                ctos: { where: { deletedAt: null } },
                pops: { where: { deletedAt: null } },
                cables: { where: { deletedAt: null } },
                poles: { where: { deletedAt: null } },
                company: true,
                parentProject: { select: { id: true, name: true } }
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
                catalogId: c.catalogId || null,
                type: c.type,
                color: c.color,
                reserveLoopLength: c.reserveLoopLength,
                poleId: c.poleId || null
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
                poleId: p.poleId || null
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
                fromNodeId: c.fromNodeId || null,
                toNodeId: c.toNodeId || null,
                catalogId: c.catalogId || null,
                technicalReserve: c.technicalReserve,
                reserveLocation: c.reserveLocation,
                showReserveLabel: c.showReserveLabel,
                reserves: c.reserves || [],
                width: c.width || null,
            })),
            poles: project.poles.map((p: any) => ({
                id: p.id,
                name: p.name,
                status: p.status,
                coordinates: { lat: p.lat, lng: p.lng },
                catalogId: p.catalogId || null,
                type: p.type,
                height: p.height,
                linkedCableIds: p.linkedCableIds,
                utilityCode: p.utilityCode || null,
                shape: p.shape || null,
                strength: p.strength || null,
                situation: p.situation || null,
                roadSide: p.roadSide || null,
                addressReference: p.addressReference || null,
                observations: p.observations || null,
                approvalStatus: p.approvalStatus || 'PENDING',
                hasPhoto: p.hasPhoto || false,
                lastInspectionDate: p.lastInspectionDate || null,
            }))
        };

        // If this project has a parent, fetch parent network inline (single request)
        let parentNetworkData: any = null;
        const parentId = (project as any).parentProjectId;
        if (parentId) {
            const inheritConfig = ((project as any).inheritedElements as any) || {};
            const parent = await prisma.project.findFirst({
                where: { id: parentId, companyId: user.companyId, deletedAt: null },
                include: {
                    ctos: inheritConfig.ctos !== false || inheritConfig.ceos !== false ? { where: { deletedAt: null } } : false,
                    pops: inheritConfig.pops !== false ? { where: { deletedAt: null } } : false,
                    cables: inheritConfig.cables !== false || inheritConfig.backbone !== false ? { where: { deletedAt: null } } : false,
                    poles: inheritConfig.poles !== false ? { where: { deletedAt: null } } : false,
                }
            });
            if (parent) {
                parentNetworkData = {
                    ctos: parent.ctos ? (parent.ctos as any[]).filter((c: any) => {
                        if (c.type === 'CEO') return inheritConfig.ceos !== false;
                        return inheritConfig.ctos !== false;
                    }).map((c: any) => ({
                        id: c.id, name: c.name, status: c.status,
                        coordinates: { lat: c.lat, lng: c.lng },
                        splitters: c.splitters || [], fusions: c.fusions || [],
                        connections: c.connections || [], inputCableIds: c.inputCableIds,
                        layout: c.layout || {}, clientCount: c.clientCount,
                        catalogId: c.catalogId || null, type: c.type,
                        color: c.color, reserveLoopLength: c.reserveLoopLength,
                        poleId: c.poleId || null
                    })) : [],
                    pops: parent.pops ? (parent.pops as any[]).map((p: any) => ({
                        id: p.id, name: p.name, status: p.status,
                        coordinates: { lat: p.lat, lng: p.lng },
                        olts: p.olts || [], dios: p.dios || [],
                        fusions: p.fusions || [], connections: p.connections || [],
                        inputCableIds: p.inputCableIds, layout: p.layout || {},
                        color: p.color, size: p.size, poleId: p.poleId || null
                    })) : [],
                    cables: parent.cables ? (parent.cables as any[]).map((c: any) => ({
                        id: c.id, name: c.name, status: c.status,
                        fiberCount: c.fiberCount, looseTubeCount: c.looseTubeCount,
                        color: c.color, colorStandard: c.colorStandard,
                        coordinates: c.coordinates, fromNodeId: c.fromNodeId || null,
                        toNodeId: c.toNodeId || null, catalogId: c.catalogId || null,
                        reserves: c.reserves || [], width: c.width || null
                    })) : [],
                    poles: parent.poles ? (parent.poles as any[]).map((p: any) => ({
                        id: p.id, name: p.name, status: p.status,
                        coordinates: { lat: p.lat, lng: p.lng },
                        catalogId: p.catalogId || null, type: p.type,
                        height: p.height, linkedCableIds: p.linkedCableIds
                    })) : [],
                    parentProjectName: parent.name
                };
            }
        }

        // Also fetch child cables inline
        let childCablesData: any[] = [];
        const childProjects = await prisma.project.findMany({
            where: { parentProjectId: id, companyId: user.companyId, deletedAt: null },
            select: { id: true, name: true }
        });
        if (childProjects.length > 0) {
            const allNodeIds = [
                ...project.ctos.map((c: any) => c.id),
                ...project.pops.map((p: any) => p.id),
                ...project.poles.map((p: any) => p.id),
            ];
            if (allNodeIds.length > 0) {
                const childProjectIds = childProjects.map(p => p.id);
                const childProjectNameMap = new Map(childProjects.map(p => [p.id, p.name]));
                const cables = await prisma.cable.findMany({
                    where: {
                        projectId: { in: childProjectIds },
                        deletedAt: null,
                        OR: [
                            { fromNodeId: { in: allNodeIds } },
                            { toNodeId: { in: allNodeIds } },
                        ]
                    }
                });
                childCablesData = cables.map((c: any) => ({
                    id: c.id, name: c.name, status: c.status,
                    fiberCount: c.fiberCount, looseTubeCount: c.looseTubeCount,
                    color: c.color, colorStandard: c.colorStandard,
                    coordinates: c.coordinates, fromNodeId: c.fromNodeId || null,
                    toNodeId: c.toNodeId || null, catalogId: c.catalogId || null,
                    reserves: c.reserves || [], width: c.width || null,
                    projectName: childProjectNameMap.get(c.projectId) || 'Projeto Vinculado',
                }));
            }
        }

        res.json({
            id: project.id,
            name: project.name,
            createdAt: project.createdAt.getTime(),
            updatedAt: project.updatedAt.getTime(),
            network,
            mapState: { center: { lat: project.centerLat, lng: project.centerLng }, zoom: project.zoom },
            settings: project.settings,
            parentProjectId: (project as any).parentProjectId || null,
            parentProject: (project as any).parentProject || null,
            inheritedElements: (project as any).inheritedElements,
            parentNetwork: parentNetworkData,
            childCables: childCablesData
        });

    } catch (error: any) {
        logger.error(`Get Project Error: ${error.message}`);
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
    } catch (error: any) {
        logger.error(`Update project error: ${error.message}`);
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

        // Prevent deleting a project that has children
        const childCount = await prisma.project.count({
            where: { parentProjectId: id, deletedAt: null }
        });
        if (childCount > 0) {
            return res.status(400).json({
                error: `Este projeto possui ${childCount} projeto(s) vinculado(s). Desvincule-os antes de excluir.`
            });
        }

        // Explicitly delete related resources first to ensure no orphans
        // This is a safety measure in case DB cascade is not configured
        // Explicitly soft-delete related resources
        await prisma.cable.updateMany({ 
            where: { projectId: id, companyId: user.companyId, deletedAt: null },
            data: { deletedAt: new Date() }
        });
        await prisma.cto.updateMany({ 
            where: { projectId: id, companyId: user.companyId, deletedAt: null },
            data: { deletedAt: new Date() }
        });
        await prisma.pop.updateMany({ 
            where: { projectId: id, companyId: user.companyId, deletedAt: null },
            data: { deletedAt: new Date() }
        });
        await prisma.pole.updateMany({ 
            where: { projectId: id, companyId: user.companyId, deletedAt: null },
            data: { deletedAt: new Date() }
        });

        // Soft-delete the project
        await prisma.project.update({ 
            where: { id },
            data: { deletedAt: new Date() }
        });
        res.json({ success: true });
    } catch (e: any) {
        logger.error(`Delete project error: ${e.message}`);
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
        logger.info(`[Sync] Project ${id} | User ${user.username} | Company ${user.companyId}`);

        if (network.ctos && network.ctos.length > 0) {
            const sampleCTO = network.ctos[0];
            logger.debug(`[Sync Debug] Sample CTO: ${sampleCTO.name} (${sampleCTO.id})`);
            logger.debug(`[Sync Debug] Fusions: ${sampleCTO.fusions?.length}, Layout Keys: ${Object.keys(sampleCTO.layout || {}).length}`);
            if (sampleCTO.fusions?.length > 0) {
                logger.debug(`[Sync Debug] First Fusion ID: ${sampleCTO.fusions[0].id}`);
                logger.debug(`[Sync Debug] Layout Entry: ${JSON.stringify(sampleCTO.layout?.[sampleCTO.fusions[0].id])}`);
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
            const totalGlobalCTOs = await prisma.cto.count({ where: { companyId: user.companyId, deletedAt: null } });
            const totalGlobalPOPs = await prisma.pop.count({ where: { companyId: user.companyId, deletedAt: null } });

            // e) Check Limit: If Delta > 0 AND (Global + Delta) > Limit
            // Note: 'totalGlobal' includes 'currentProject'. 
            // So FutureTotal = (Global - CurrentProject) + Payload
            //                = Global + (Payload - CurrentProject)
            //                = Global + Delta.

            const maxCTOs = Number(limits.maxCTOs || 0);
            const maxPOPs = Number(limits.maxPOPs || 0);

            logger.info(`[Sync Check] Comp: ${company.name}, Plan: ${company.plan?.name}`);
            logger.info(`[Sync Check] Global CTOs: ${totalGlobalCTOs}, Proj: ${currentProjectCTOs}, Pay: ${payloadCTOCount}, Delta: ${deltaCTO}`);
            logger.info(`[Sync Check] Limits: MaxCTOs ${maxCTOs}, MaxPOPs ${maxPOPs}`);

            if (deltaCTO > 0 && maxCTOs > 0 && (totalGlobalCTOs + deltaCTO) > maxCTOs) {
                logger.warn(`[Sync Blocked] CTO Limit: Global ${totalGlobalCTOs} + Delta ${deltaCTO} > ${maxCTOs}`);
                return res.status(403).json({ error: `Limite de CTOs excedido. Máximo: ${maxCTOs}. Você tem: ${totalGlobalCTOs}. Tentando adicionar: ${deltaCTO}.` });
            }

            if (deltaPOP > 0 && maxPOPs > 0 && (totalGlobalPOPs + deltaPOP) > maxPOPs) {
                logger.warn(`[Sync Blocked] POP Limit: Global ${totalGlobalPOPs} + Delta ${deltaPOP} > ${maxPOPs}`);
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
            logger.info(`[Sync] Found ${collidingIds.size} ID collisions. Remapping...`);

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

            // 1. CLEANUP PHASE - Handled via Diffing in respective phases below
            // No more blanket deleteMany for all entities to preserve data integrity and performance.

            // 2. INSERT/UPDATE PHASE - CTOs (Optimized with Diffing)
            if (network.ctos) {
                const payloadCTOs = network.ctos;
                const payloadIds = new Set(payloadCTOs.map((c: any) => c.id));

                // Fetch ALL existing ACTIVE CTOs in this project to compute diff
                const existingCTOsInDB = await tx.cto.findMany({
                    where: { projectId: id, deletedAt: null },
                });
                const dbCTOMap = new Map(existingCTOsInDB.map((c: any) => [c.id, c]));

                const toDelete = existingCTOsInDB
                    .filter((c: any) => !payloadIds.has(c.id))
                    .map((c: any) => c.id);

                const toCreate: any[] = [];
                const toUpdate: any[] = [];

                for (const c of payloadCTOs as any[]) {
                    const dbC = dbCTOMap.get(c.id) as any;
                    if (!dbC) {
                        toCreate.push({
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
                            catalogId: c.catalogId || null,
                            type: c.type,
                            color: c.color,
                            reserveLoopLength: c.reserveLoopLength,
                            poleId: c.poleId || null
                        });
                    } else {
                        // DIFFING: Compare crucial fields to decide if update is needed
                        // Coordinates might come as lat/lng properties directly or nested
                        const incomingLat = c.coordinates?.lat ?? c.lat;
                        const incomingLng = c.coordinates?.lng ?? c.lng;

                        const hasChanged =
                            dbC.name !== c.name ||
                            dbC.status !== c.status ||
                            Math.abs((dbC.lat || 0) - incomingLat) > 0.0000001 ||
                            Math.abs((dbC.lng || 0) - incomingLng) > 0.0000001 ||
                            dbC.clientCount !== (c.clientCount || 0) ||
                            dbC.catalogId !== c.catalogId ||
                            dbC.type !== c.type ||
                            dbC.color !== c.color ||
                            dbC.poleId !== c.poleId ||
                            dbC.reserveLoopLength !== c.reserveLoopLength ||
                            JSON.stringify(dbC.splitters) !== JSON.stringify(c.splitters || []) ||
                            JSON.stringify(dbC.fusions) !== JSON.stringify(c.fusions || []) ||
                            JSON.stringify(dbC.connections) !== JSON.stringify(c.connections || []) ||
                            JSON.stringify(dbC.inputCableIds) !== JSON.stringify(c.inputCableIds || []) ||
                            JSON.stringify(dbC.layout) !== JSON.stringify(c.layout || {});

                        if (hasChanged) {
                            toUpdate.push(c);
                        }
                    }
                }

                // Execute Operations
                if (toDelete.length > 0) {
                    await tx.cto.deleteMany({ where: { id: { in: toDelete } } });
                }

                if (toCreate.length > 0) {
                    await tx.cto.createMany({ data: toCreate });
                }

                if (toUpdate.length > 0) {
                    // Updates still need to be individual in Prisma for now, but we only do them for CHANGED items
                    for (const c of toUpdate as any[]) {
                        // Only include fields that were actually sent to avoid overwriting diagram data
                        const data: any = {
                            name: c.name,
                            status: c.status,
                            lat: c.coordinates?.lat ?? c.lat,
                            lng: c.coordinates?.lng ?? c.lng,
                            clientCount: c.clientCount || 0,
                            catalogId: c.catalogId || null,
                            type: c.type,
                            color: c.color,
                            reserveLoopLength: c.reserveLoopLength,
                            poleId: c.poleId || null
                        };
                        // Only overwrite diagram fields if explicitly provided (not undefined)
                        if (c.splitters !== undefined) data.splitters = c.splitters;
                        if (c.fusions !== undefined) data.fusions = c.fusions;
                        if (c.connections !== undefined) data.connections = c.connections;
                        if (c.inputCableIds !== undefined) data.inputCableIds = c.inputCableIds;
                        if (c.layout !== undefined) data.layout = c.layout;
                        // notes and viewState are frontend-only fields (not in Prisma schema), do not send to DB

                        await tx.cto.update({
                            where: { id: c.id },
                            data,
                        });
                    }
                }
                console.log(`[Sync Diff] CTOs: ${toCreate.length} created, ${toUpdate.length} updated, ${toDelete.length} deleted.`);
            }

            // 3. INSERT/UPDATE PHASE - POPs (Optimized with Diffing)
            if (network.pops) {
                const payloadIds = new Set(network.pops.map((p: any) => p.id));
                const existingInDB = await tx.pop.findMany({ where: { projectId: id, deletedAt: null } });
                const dbMap = new Map(existingInDB.map((p: any) => [p.id, p]));

                const toDelete = existingInDB.filter((p: any) => !payloadIds.has(p.id)).map((p: any) => p.id);
                const toCreate: any[] = [];
                const toUpdate: any[] = [];

                for (const p of network.pops as any[]) {
                    const dbP = dbMap.get(p.id) as any;
                    if (!dbP) {
                        toCreate.push({
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
                            poleId: p.poleId || null
                        });
                    } else {
                        const hasChanged =
                            dbP.name !== p.name ||
                            dbP.status !== p.status ||
                            Math.abs((dbP.lat || 0) - (p.coordinates?.lat ?? p.lat)) > 0.0000001 ||
                            Math.abs((dbP.lng || 0) - (p.coordinates?.lng ?? p.lng)) > 0.0000001 ||
                            dbP.color !== p.color ||
                            dbP.size !== p.size ||
                            dbP.poleId !== p.poleId ||
                            JSON.stringify(dbP.olts) !== JSON.stringify(p.olts || []) ||
                            JSON.stringify(dbP.dios) !== JSON.stringify(p.dios || []) ||
                            JSON.stringify(dbP.fusions) !== JSON.stringify(p.fusions || []) ||
                            JSON.stringify(dbP.connections) !== JSON.stringify(p.connections || []) ||
                            JSON.stringify(dbP.inputCableIds) !== JSON.stringify(p.inputCableIds || []) ||
                            JSON.stringify(dbP.layout) !== JSON.stringify(p.layout || {});

                        if (hasChanged) toUpdate.push(p);
                    }
                }

                if (toDelete.length > 0) await tx.pop.deleteMany({ where: { id: { in: toDelete } } });
                if (toCreate.length > 0) await tx.pop.createMany({ data: toCreate });
                for (const p of toUpdate as any[]) {
                    const data: any = {
                        name: p.name,
                        status: p.status,
                        lat: p.coordinates?.lat ?? p.lat,
                        lng: p.coordinates?.lng ?? p.lng,
                        color: p.color,
                        size: p.size,
                        poleId: p.poleId || null
                    };
                    if (p.olts !== undefined) data.olts = p.olts;
                    if (p.dios !== undefined) data.dios = p.dios;
                    if (p.fusions !== undefined) data.fusions = p.fusions;
                    if (p.connections !== undefined) data.connections = p.connections;
                    if (p.inputCableIds !== undefined) data.inputCableIds = p.inputCableIds;
                    if (p.layout !== undefined) data.layout = p.layout;
                    if (p.notes !== undefined) data.notes = p.notes;
                    if (p.patchingLayout !== undefined) data.patchingLayout = p.patchingLayout;

                    await tx.pop.update({ where: { id: p.id }, data });
                }
                console.log(`[Sync Diff] POPs: ${toCreate.length} created, ${toUpdate.length} updated, ${toDelete.length} deleted.`);
            }

            // 4. INSERT/UPDATE PHASE - Cables (Optimized with Diffing)
            if (network.cables) {
                const payloadIds = new Set(network.cables.map((c: any) => c.id));
                const existingInDB = await tx.cable.findMany({ where: { projectId: id, deletedAt: null } });
                const dbMap = new Map(existingInDB.map((c: any) => [c.id, c]));

                const toDelete = existingInDB.filter((c: any) => !payloadIds.has(c.id)).map((c: any) => c.id);
                const toCreate: any[] = [];
                const toUpdate: any[] = [];

                for (const c of network.cables as any[]) {
                    const dbC = dbMap.get(c.id) as any;
                    if (!dbC) {
                        toCreate.push({
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
                            fromNodeId: c.fromNodeId || null,
                            toNodeId: c.toNodeId || null,
                            catalogId: c.catalogId || null,
                            technicalReserve: c.technicalReserve || 0,
                            reserveLocation: c.reserveLocation || null,
                            showReserveLabel: c.showReserveLabel !== undefined ? c.showReserveLabel : true,
                            reserves: c.reserves || [],
                            width: c.width || null,
                        });
                    } else {
                        const hasChanged =
                            dbC.name !== c.name ||
                            dbC.status !== c.status ||
                            dbC.fiberCount !== c.fiberCount ||
                            (dbC.looseTubeCount || 1) !== (c.looseTubeCount || 1) ||
                            dbC.color !== c.color ||
                            dbC.fromNodeId !== c.fromNodeId ||
                            dbC.toNodeId !== c.toNodeId ||
                            dbC.catalogId !== c.catalogId ||
                            dbC.technicalReserve !== (c.technicalReserve || 0) ||
                            dbC.showReserveLabel !== (c.showReserveLabel !== undefined ? c.showReserveLabel : true) ||
                            dbC.width !== (c.width || null) ||
                            JSON.stringify(dbC.coordinates) !== JSON.stringify(c.coordinates) ||
                            JSON.stringify(dbC.reserveLocation) !== JSON.stringify(c.reserveLocation || null) ||
                            JSON.stringify(dbC.reserves) !== JSON.stringify(c.reserves || []);

                        if (hasChanged) toUpdate.push(c);
                    }
                }

                if (toDelete.length > 0) await tx.cable.deleteMany({ where: { id: { in: toDelete } } });
                if (toCreate.length > 0) await tx.cable.createMany({ data: toCreate });
                for (const c of toUpdate as any[]) {
                    await tx.cable.update({
                        where: { id: c.id },
                        data: {
                            name: c.name,
                            status: c.status,
                            fiberCount: c.fiberCount,
                            looseTubeCount: c.looseTubeCount || 1,
                            color: c.color,
                            colorStandard: c.colorStandard || 'ABNT',
                            coordinates: c.coordinates,
                            fromNodeId: c.fromNodeId || null,
                            toNodeId: c.toNodeId || null,
                            catalogId: c.catalogId || null,
                            technicalReserve: c.technicalReserve || 0,
                            reserveLocation: c.reserveLocation || null,
                            showReserveLabel: c.showReserveLabel !== undefined ? c.showReserveLabel : true,
                            reserves: c.reserves || [],
                            width: c.width || null,
                        }
                    });
                }
                console.log(`[Sync Diff] Cables: ${toCreate.length} created, ${toUpdate.length} updated, ${toDelete.length} deleted.`);
            }

            // 5. INSERT/UPDATE PHASE - Poles (Optimized with Diffing)
            if (network.poles) {
                const payloadIds = new Set(network.poles.map((p: any) => p.id));
                const existingInDB = await tx.pole.findMany({ where: { projectId: id, deletedAt: null } });
                const dbMap = new Map(existingInDB.map((p: any) => [p.id, p]));

                const toDelete = existingInDB.filter((p: any) => !payloadIds.has(p.id)).map((p: any) => p.id);
                const toCreate: any[] = [];
                const toUpdate: any[] = [];

                for (const p of network.poles as any[]) {
                    const dbP = dbMap.get(p.id) as any;
                    if (!dbP) {
                        toCreate.push({
                            id: p.id,
                            projectId: id,
                            companyId: user.companyId,
                            name: p.name,
                            status: p.status,
                            lat: p.coordinates.lat,
                            lng: p.coordinates.lng,
                            catalogId: p.catalogId || null,
                            type: p.type,
                            height: p.height,
                            linkedCableIds: p.linkedCableIds || [],
                            utilityCode: p.utilityCode || null,
                            shape: p.shape || null,
                            strength: p.strength || null,
                            situation: p.situation || null,
                            roadSide: p.roadSide || null,
                            addressReference: p.addressReference || null,
                            observations: p.observations || null,
                            approvalStatus: p.approvalStatus || 'PENDING',
                            hasPhoto: p.hasPhoto || false,
                            lastInspectionDate: p.lastInspectionDate ? new Date(p.lastInspectionDate) : null,
                        });
                    } else {
                        const hasChanged =
                            dbP.name !== p.name ||
                            dbP.status !== p.status ||
                            Math.abs((dbP.lat || 0) - (p.coordinates?.lat ?? p.lat)) > 0.0000001 ||
                            Math.abs((dbP.lng || 0) - (p.coordinates?.lng ?? p.lng)) > 0.0000001 ||
                            dbP.catalogId !== (p.catalogId || null) ||
                            dbP.type !== p.type ||
                            dbP.height !== p.height ||
                            JSON.stringify(dbP.linkedCableIds) !== JSON.stringify(p.linkedCableIds || []) ||
                            dbP.utilityCode !== (p.utilityCode || null) ||
                            dbP.shape !== (p.shape || null) ||
                            dbP.strength !== (p.strength || null) ||
                            dbP.situation !== (p.situation || null) ||
                            dbP.roadSide !== (p.roadSide || null) ||
                            dbP.addressReference !== (p.addressReference || null) ||
                            dbP.observations !== (p.observations || null) ||
                            dbP.approvalStatus !== (p.approvalStatus || 'PENDING');

                        if (hasChanged) toUpdate.push(p);
                    }
                }

                if (toDelete.length > 0) await tx.pole.deleteMany({ where: { id: { in: toDelete } } });
                if (toCreate.length > 0) await tx.pole.createMany({ data: toCreate });
                for (const p of toUpdate as any[]) {
                    await tx.pole.update({
                        where: { id: p.id },
                        data: {
                            name: p.name,
                            status: p.status,
                            lat: p.coordinates?.lat ?? p.lat,
                            lng: p.coordinates?.lng ?? p.lng,
                            catalogId: p.catalogId || null,
                            type: p.type,
                            height: p.height,
                            linkedCableIds: p.linkedCableIds || [],
                            utilityCode: p.utilityCode || null,
                            shape: p.shape || null,
                            strength: p.strength || null,
                            situation: p.situation || null,
                            roadSide: p.roadSide || null,
                            addressReference: p.addressReference || null,
                            observations: p.observations || null,
                            approvalStatus: p.approvalStatus || 'PENDING',
                            hasPhoto: p.hasPhoto || false,
                            lastInspectionDate: p.lastInspectionDate ? new Date(p.lastInspectionDate) : null,
                        }
                    });
                }
                console.log(`[Sync Diff] Poles: ${toCreate.length} created, ${toUpdate.length} updated, ${toDelete.length} deleted.`);
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

export const updateCTO = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id, ctoId } = req.params;
    const cto = req.body;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        console.log(`[updateCTO] Project ${id} | CTO ${ctoId} | User ${user.username}`);

        // Verify project ownership
        const project = await prisma.project.findFirst({
            where: { id, companyId: user.companyId }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Verify CTO exists in this project
        const existingCto = await prisma.cto.findFirst({
            where: { id: ctoId, projectId: id, companyId: user.companyId }
        });

        if (!existingCto) {
            return res.status(404).json({ error: 'CTO not found in this project' });
        }

        // Update single CTO
        const updated = await prisma.cto.update({
            where: { id: ctoId },
            data: {
                name: cto.name,
                status: cto.status,
                lat: cto.coordinates?.lat ?? cto.lat,
                lng: cto.coordinates?.lng ?? cto.lng,
                splitters: cto.splitters || [],
                fusions: cto.fusions || [],
                connections: cto.connections || [],
                inputCableIds: cto.inputCableIds || [],
                layout: cto.layout || {},
                clientCount: cto.clientCount || 0,
                catalogId: cto.catalogId || null,
                type: cto.type,
                color: cto.color,
                reserveLoopLength: cto.reserveLoopLength,
                poleId: cto.poleId || null
            }
        });

        // Touch project updatedAt
        await prisma.project.update({
            where: { id },
            data: { updatedAt: new Date() }
        });

        res.json({ success: true, timestamp: Date.now(), cto: updated });

    } catch (error: any) {
        console.error("Update CTO Error:", error);
        res.status(500).json({ error: 'Failed to update CTO', details: error.message || 'Unknown error' });
    }
};

export const updatePOP = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id, popId } = req.params;
    const pop = req.body;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        console.log(`[updatePOP] Project ${id} | POP ${popId} | User ${user.username}`);

        // Verify project ownership
        const project = await prisma.project.findFirst({
            where: { id, companyId: user.companyId }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Verify POP exists in this project
        const existingPop = await prisma.pop.findFirst({
            where: { id: popId, projectId: id, companyId: user.companyId }
        });

        if (!existingPop) {
            return res.status(404).json({ error: 'POP not found in this project' });
        }

        // Update single POP
        const updated = await prisma.pop.update({
            where: { id: popId },
            data: {
                name: pop.name,
                status: pop.status,
                lat: pop.coordinates?.lat ?? pop.lat,
                lng: pop.coordinates?.lng ?? pop.lng,
                olts: pop.olts || [],
                dios: pop.dios || [],
                fusions: pop.fusions || [],
                connections: pop.connections || [],
                inputCableIds: pop.inputCableIds || [],
                layout: pop.layout || {},
                color: pop.color,
                size: pop.size,
                poleId: pop.poleId || null
            }
        });

        // Touch project updatedAt
        await prisma.project.update({
            where: { id },
            data: { updatedAt: new Date() }
        });

        res.json({ success: true, timestamp: Date.now(), pop: updated });

    } catch (error: any) {
        console.error("Update POP Error:", error);
        res.status(500).json({ error: 'Failed to update POP', details: error.message || 'Unknown error' });
    }
};

export const getCTOPower = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id, ctoId } = req.params;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        // Load project with full network
        const project = await prisma.project.findFirst({
            where: { id, companyId: user.companyId, deletedAt: null },
            include: {
                ctos: { where: { deletedAt: null } },
                pops: { where: { deletedAt: null } },
                cables: { where: { deletedAt: null } },
            }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Load catalogs for this company
        const [catSplitters, catCables, catFusions, catOlts] = await Promise.all([
            prisma.catalogSplitter.findMany({ where: { companyId: user.companyId } }),
            prisma.catalogCable.findMany({ where: { companyId: user.companyId } }),
            prisma.catalogFusion.findMany({ where: { companyId: user.companyId } }),
            prisma.catalogOLT.findMany({ where: { companyId: user.companyId } }),
        ]);

        // Build network state
        const network = {
            ctos: project.ctos.map((c: any) => ({
                id: c.id, name: c.name, splitters: c.splitters || [], fusions: c.fusions || [],
                connections: c.connections || [], inputCableIds: c.inputCableIds || [],
            })),
            pops: project.pops.map((p: any) => ({
                id: p.id, name: p.name, olts: p.olts || [], dios: p.dios || [],
                fusions: p.fusions || [], connections: p.connections || [], inputCableIds: p.inputCableIds || [],
            })),
            cables: project.cables.map((c: any) => ({
                id: c.id, name: c.name, fiberCount: c.fiberCount,
                coordinates: c.coordinates || [], fromNodeId: c.fromNodeId, toNodeId: c.toNodeId,
                catalogId: c.catalogId,
            })),
        };

        const catalogs = {
            splitters: catSplitters.map((s: any) => ({ id: s.id, name: s.name, outputs: s.outputs, attenuation: s.attenuation })),
            cables: catCables.map((c: any) => ({ id: c.id, name: c.name, attenuation: c.attenuation })),
            fusions: catFusions.map((f: any) => ({ id: f.id, name: f.name, attenuation: f.attenuation })),
            olts: catOlts.map((o: any) => ({ id: o.id, name: o.name, outputPower: o.outputPower })),
        };

        // Find the CTO and trace each splitter
        const cto = network.ctos.find(c => c.id === ctoId);
        if (!cto) return res.status(404).json({ error: 'CTO not found' });

        const results = cto.splitters.map((sp: any) => {
            try {
                const result = traceOpticalPower(sp.id, ctoId, network, catalogs);
                return { splitterId: sp.id, splitterName: sp.name, ...result };
            } catch (e: any) {
                logger.warn(`[getCTOPower] Trace failed for splitter ${sp.name}: ${e.message}`);
                return { splitterId: sp.id, splitterName: sp.name, finalPower: null, oltPower: 0, totalLoss: 0, status: 'FAIL', sourceName: 'ERROR', path: [] };
            }
        });

        // Find the deepest splitter (lowest power = most loss = service/atendimento splitter)
        // This is the final power that matters to customers
        const validResults = results.filter((r: any) => r.finalPower !== null && isFinite(r.finalPower) && r.finalPower > -Infinity);
        const main = validResults.length > 0
            ? validResults.reduce((best: any, r: any) => (r.totalLoss > best.totalLoss ? r : best), validResults[0])
            : (results.length > 0 ? results[0] : null);

        // Sanitize -Infinity for JSON
        const safePower = (v: any) => (v === null || v === undefined || !isFinite(v)) ? null : v;

        res.json({
            ctoId,
            ctoName: cto.name,
            finalPower: safePower(main?.finalPower),
            oltPower: main?.oltPower ?? 0,
            totalLoss: main?.totalLoss ?? 0,
            status: main?.status ?? 'FAIL',
            sourceName: main?.sourceName ?? 'NO_SIGNAL',
            oltDetails: main?.oltDetails ?? null,
            splitters: results.map((r: any) => ({ ...r, finalPower: safePower(r.finalPower) })),
        });

    } catch (error: any) {
        logger.error(`[getCTOPower] Error: ${error.message}`);
        res.status(500).json({ error: 'Failed to calculate power' });
    }
};

// ====== PARENT PROJECT ENDPOINTS ======

export const setParentProject = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params;
    const { parentProjectId, inheritedElements } = req.body;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        // Verify both projects exist and belong to the same company
        const [project, parentProject] = await Promise.all([
            prisma.project.findFirst({ where: { id, companyId: user.companyId, deletedAt: null } }),
            parentProjectId ? prisma.project.findFirst({ where: { id: parentProjectId, companyId: user.companyId, deletedAt: null } }) : null
        ]);

        if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

        if (parentProjectId) {
            if (!parentProject) return res.status(404).json({ error: 'Projeto base não encontrado' });

            // Prevent self-reference
            if (parentProjectId === id) {
                return res.status(400).json({ error: 'Um projeto não pode ser base de si mesmo' });
            }

            // Prevent parent project from being a child (no chains)
            if (parentProject.parentProjectId) {
                return res.status(400).json({ error: 'O projeto selecionado já está vinculado a outro projeto base. Não é permitido encadear.' });
            }

            // Prevent making a parent into a child (if this project already has children)
            const childCount = await prisma.project.count({
                where: { parentProjectId: id, deletedAt: null }
            });
            if (childCount > 0) {
                return res.status(400).json({ error: 'Este projeto já possui projetos vinculados. Um projeto base não pode ser vinculado a outro.' });
            }
        }

        const updated = await prisma.project.update({
            where: { id },
            data: {
                parentProjectId: parentProjectId || null,
                inheritedElements: inheritedElements || undefined
            }
        });

        res.json({
            parentProjectId: updated.parentProjectId,
            inheritedElements: updated.inheritedElements
        });
    } catch (error: any) {
        logger.error(`Set Parent Project Error: ${error.message}`);
        res.status(500).json({ error: 'Falha ao definir projeto base' });
    }
};

export const getParentProjectNetwork = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        // Get this project to find its parent
        const project = await prisma.project.findFirst({
            where: { id, companyId: user.companyId, deletedAt: null },
            select: { parentProjectId: true, inheritedElements: true }
        });

        if (!project || !project.parentProjectId) {
            return res.json({ network: null, parentProjectId: null, inheritedElements: null });
        }

        const inheritConfig = (project.inheritedElements as any) || {};

        // Fetch the parent project's network
        const parent = await prisma.project.findFirst({
            where: { id: project.parentProjectId, companyId: user.companyId, deletedAt: null },
            include: {
                ctos: inheritConfig.ctos !== false || inheritConfig.ceos !== false ? { where: { deletedAt: null } } : false,
                pops: inheritConfig.pops !== false ? { where: { deletedAt: null } } : false,
                cables: inheritConfig.cables !== false || inheritConfig.backbone !== false ? { where: { deletedAt: null } } : false,
                poles: inheritConfig.poles !== false ? { where: { deletedAt: null } } : false,
            }
        });

        if (!parent) {
            return res.json({ network: null, parentProjectId: project.parentProjectId, inheritedElements: project.inheritedElements });
        }

        // Build filtered network based on inheritance config
        const network: any = { ctos: [], pops: [], cables: [], poles: [] };

        if (parent.ctos) {
            network.ctos = (parent.ctos as any[])
                .filter((c: any) => {
                    if (c.type === 'CEO') return inheritConfig.ceos !== false;
                    return inheritConfig.ctos !== false;
                })
                .map((c: any) => ({
                    id: c.id, name: c.name, status: c.status,
                    coordinates: { lat: c.lat, lng: c.lng },
                    splitters: c.splitters || [], fusions: c.fusions || [],
                    connections: c.connections || [], inputCableIds: c.inputCableIds,
                    layout: c.layout || {}, clientCount: c.clientCount,
                    catalogId: c.catalogId || null, type: c.type,
                    color: c.color, reserveLoopLength: c.reserveLoopLength,
                    poleId: c.poleId || null
                }));
        }

        if (parent.pops) {
            network.pops = (parent.pops as any[]).map((p: any) => ({
                id: p.id, name: p.name, status: p.status,
                coordinates: { lat: p.lat, lng: p.lng },
                olts: p.olts || [], dios: p.dios || [],
                fusions: p.fusions || [], connections: p.connections || [],
                inputCableIds: p.inputCableIds, layout: p.layout || {},
                color: p.color, size: p.size, poleId: p.poleId || null
            }));
        }

        if (parent.cables) {
            network.cables = (parent.cables as any[]).map((c: any) => ({
                id: c.id, name: c.name, status: c.status,
                fiberCount: c.fiberCount, looseTubeCount: c.looseTubeCount,
                color: c.color, colorStandard: c.colorStandard,
                coordinates: c.coordinates, fromNodeId: c.fromNodeId || null,
                toNodeId: c.toNodeId || null, catalogId: c.catalogId || null,
                reserves: c.reserves || [], width: c.width || null
            }));
        }

        if (parent.poles) {
            network.poles = (parent.poles as any[]).map((p: any) => ({
                id: p.id, name: p.name, status: p.status,
                coordinates: { lat: p.lat, lng: p.lng },
                catalogId: p.catalogId || null, type: p.type,
                height: p.height, linkedCableIds: p.linkedCableIds,
                utilityCode: p.utilityCode || null, shape: p.shape || null,
                strength: p.strength || null, situation: p.situation || null,
                roadSide: p.roadSide || null, addressReference: p.addressReference || null,
                observations: p.observations || null,
                approvalStatus: p.approvalStatus || 'PENDING',
                hasPhoto: p.hasPhoto || false,
                lastInspectionDate: p.lastInspectionDate || null
            }));
        }

        res.json({
            network,
            parentProjectId: project.parentProjectId,
            parentProjectName: parent.name,
            inheritedElements: project.inheritedElements
        });
    } catch (error: any) {
        logger.error(`Get Parent Project Network Error: ${error.message}`);
        res.status(500).json({ error: 'Falha ao buscar rede do projeto base' });
    }
};

export const getChildProjects = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params;

    if (!user || !user.companyId) return res.status(401).send();

    try {
        const children = await prisma.project.findMany({
            where: { parentProjectId: id, companyId: user.companyId, deletedAt: null },
            select: { id: true, name: true, updatedAt: true }
        });
        res.json(children);
    } catch (error: any) {
        logger.error(`Get Child Projects Error: ${error.message}`);
        res.status(500).json({ error: 'Falha ao buscar projetos vinculados' });
    }
};

export const getChildCables = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { id } = req.params; // parent project id

    if (!user || !user.companyId) return res.status(401).send();

    try {
        // Get all node IDs from this (parent) project
        const [ctos, pops, poles] = await Promise.all([
            prisma.cto.findMany({ where: { projectId: id, deletedAt: null }, select: { id: true } }),
            prisma.pop.findMany({ where: { projectId: id, deletedAt: null }, select: { id: true } }),
            prisma.pole.findMany({ where: { projectId: id, deletedAt: null }, select: { id: true } }),
        ]);
        const parentNodeIds = [
            ...ctos.map(c => c.id),
            ...pops.map(p => p.id),
            ...poles.map(p => p.id),
        ];

        if (parentNodeIds.length === 0) {
            return res.json({ cables: [] });
        }

        // Find child projects
        const childProjects = await prisma.project.findMany({
            where: { parentProjectId: id, companyId: user.companyId, deletedAt: null },
            select: { id: true, name: true }
        });

        if (childProjects.length === 0) {
            return res.json({ cables: [] });
        }

        const childProjectIds = childProjects.map(p => p.id);
        const childProjectNameMap = new Map(childProjects.map(p => [p.id, p.name]));

        // Find cables from child projects referencing parent nodes
        const cables = await prisma.cable.findMany({
            where: {
                projectId: { in: childProjectIds },
                deletedAt: null,
                OR: [
                    { fromNodeId: { in: parentNodeIds } },
                    { toNodeId: { in: parentNodeIds } },
                ]
            }
        });

        res.json({
            cables: cables.map((c: any) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                fiberCount: c.fiberCount,
                looseTubeCount: c.looseTubeCount,
                color: c.color,
                colorStandard: c.colorStandard,
                coordinates: c.coordinates,
                fromNodeId: c.fromNodeId || null,
                toNodeId: c.toNodeId || null,
                catalogId: c.catalogId || null,
                reserves: c.reserves || [],
                width: c.width || null,
                projectId: c.projectId,
                projectName: childProjectNameMap.get(c.projectId) || 'Projeto Vinculado',
            }))
        });
    } catch (error: any) {
        logger.error(`Get Child Cables Error: ${error.message}`);
        res.status(500).json({ error: 'Falha ao buscar cabos dos projetos vinculados' });
    }
};

export const searchCTO = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user || !user.companyId) return res.status(401).send();

    const name = (req.query.name as string || '').trim();
    if (!name) return res.status(400).json({ error: 'Name query parameter is required' });

    try {
        const cto = await prisma.cto.findFirst({
            where: {
                companyId: user.companyId,
                name: { equals: name, mode: 'insensitive' },
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                projectId: true,
                status: true,
                lat: true,
                lng: true,
            },
        });

        if (!cto) return res.status(404).json({ error: 'CTO not found' });

        res.json(cto);
    } catch (error: any) {
        console.error("Search CTO Error:", error);
        res.status(500).json({ error: 'Failed to search CTO' });
    }
};

