import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getProjects = async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).user?.id;
    try {
        const projects = await prisma.project.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            include: {
                ctos: true,
                cables: true,
                pops: true
            }
        });

        res.json(projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            updatedAt: p.updatedAt.getTime(),
            createdAt: p.createdAt.getTime(),
            network: {
                ctos: p.ctos,
                pops: p.pops,
                cables: p.cables
            }
        })));
    } catch (error) {
        console.error("Get projects error:", error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

export const createProject = async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).user?.id;
    const { name, centerLat, centerLng } = req.body;

    if (!userId) return res.status(401).send();

    try {
        const project = await prisma.project.create({
            data: {
                userId,
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
            settings: project.settings || { snapDistance: 30 }
        });
    } catch (error) {
        console.error("Create project error:", error);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

export const getProject = async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;

    try {
        const project = await prisma.project.findFirst({
            where: { id, userId },
            include: {
                ctos: true,
                pops: true,
                cables: true
            }
        });

        if (!project) return res.status(404).json({ error: 'Project not found' });

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
                clientCount: c.clientCount
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
                size: p.size
            })),
            cables: project.cables.map((c: any) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                fiberCount: c.fiberCount,
                looseTubeCount: c.looseTubeCount,
                color: c.color,
                coordinates: c.coordinates, // Json
                fromNodeId: c.fromNodeId,
                toNodeId: c.toNodeId
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
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    const { name, centerLat, centerLng } = req.body;

    if (!userId) return res.status(401).send();

    try {
        const project = await prisma.project.update({
            where: { id, userId },
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
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    try {
        // Explicitly delete related resources first to ensure no orphans
        // This is a safety measure in case DB cascade is not configured
        await prisma.cable.deleteMany({ where: { projectId: id } });
        await prisma.cto.deleteMany({ where: { projectId: id } });
        await prisma.pop.deleteMany({ where: { projectId: id } });

        // Delete the project
        await prisma.project.deleteMany({ where: { id, userId } });
        res.json({ success: true });
    } catch (e) {
        console.error("Delete project error:", e);
        res.status(500).json({ error: 'Failed' });
    }
}

export const syncProject = async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    const { network, mapState, settings } = req.body;

    if (!network) return res.status(400).json({ error: 'No network data provided' });

    try {
        console.log(`[Sync] Project ${id} | User ${userId}`);

        // Verify ownership
        const project = await prisma.project.findFirst({ where: { id, userId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        await prisma.$transaction(async (tx: any) => {
            // 1. Update Map State
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

            // 2. Sync CTOs
            // Delete all current CTOs for this project and batch insert new ones
            await tx.cto.deleteMany({ where: { projectId: id } });
            if (network.ctos && network.ctos.length > 0) {
                await tx.cto.createMany({
                    data: network.ctos.map((c: any) => ({
                        id: c.id,
                        projectId: id,
                        name: c.name,
                        status: c.status,
                        lat: c.coordinates.lat,
                        lng: c.coordinates.lng,
                        splitters: c.splitters || [],
                        fusions: c.fusions || [],
                        connections: c.connections || [],
                        inputCableIds: c.inputCableIds || [],
                        layout: c.layout || {},
                        clientCount: c.clientCount || 0
                    }))
                });
            }

            // 3. Sync POPs
            await tx.pop.deleteMany({ where: { projectId: id } });
            if (network.pops && network.pops.length > 0) {
                await tx.pop.createMany({
                    data: network.pops.map((p: any) => ({
                        id: p.id,
                        projectId: id,
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
                        size: p.size
                    }))
                });
            }

            // 4. Sync Cables
            await tx.cable.deleteMany({ where: { projectId: id } });
            if (network.cables && network.cables.length > 0) {
                await tx.cable.createMany({
                    data: network.cables.map((c: any) => ({
                        id: c.id,
                        projectId: id,
                        name: c.name,
                        status: c.status,
                        fiberCount: c.fiberCount,
                        looseTubeCount: c.looseTubeCount || 1,
                        color: c.color,
                        coordinates: c.coordinates,
                        fromNodeId: c.fromNodeId,
                        toNodeId: c.toNodeId
                    }))
                });
            }
        }, {
            timeout: 30000 // 30 seconds
        });

        res.json({ success: true, timestamp: Date.now() });

    } catch (error) {
        console.error("Sync Error:", error);
        res.status(500).json({ error: 'Sync failed' });
    }
};
