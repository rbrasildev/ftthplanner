import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

// ==================== POLE DOCUMENTATION ====================

// GET /api/projects/:projectId/poles/:poleId/details
export const getPoleDetails = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId } = req.params;
        const pole = await prisma.pole.findFirst({
            where: { id: poleId, companyId: user.companyId, deletedAt: null },
            include: {
                equipments: { orderBy: { createdAt: 'asc' } },
                photos: { orderBy: { createdAt: 'desc' } },
                checklist: true,
                spansAsOrigin: true,
                spansAsDestination: true,
            }
        });

        if (!pole) return res.status(404).json({ error: 'Pole not found' });

        res.json(pole);
    } catch (error) {
        logger.error('[getPoleDetails] Error:', error);
        res.status(500).json({ error: 'Failed to get pole details' });
    }
};

// PUT /api/projects/:projectId/poles/:poleId/details
export const updatePoleDetails = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId } = req.params;
        const {
            utilityCode, shape, strength, situation, roadSide,
            addressReference, observations, approvalStatus,
            hasPhoto, lastInspectionDate
        } = req.body;

        const pole = await prisma.pole.findFirst({
            where: { id: poleId, companyId: user.companyId, deletedAt: null }
        });
        if (!pole) return res.status(404).json({ error: 'Pole not found' });

        const updated = await prisma.pole.update({
            where: { id: poleId },
            data: {
                ...(utilityCode !== undefined && { utilityCode }),
                ...(shape !== undefined && { shape }),
                ...(strength !== undefined && { strength }),
                ...(situation !== undefined && { situation }),
                ...(roadSide !== undefined && { roadSide }),
                ...(addressReference !== undefined && { addressReference }),
                ...(observations !== undefined && { observations }),
                ...(approvalStatus !== undefined && { approvalStatus }),
                ...(hasPhoto !== undefined && { hasPhoto }),
                ...(lastInspectionDate !== undefined && { lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : null }),
            }
        });

        res.json(updated);
    } catch (error) {
        logger.error('[updatePoleDetails] Error:', error);
        res.status(500).json({ error: 'Failed to update pole details' });
    }
};

// ==================== POLE EQUIPMENTS ====================

// GET /api/projects/:projectId/poles/:poleId/equipments
export const getPoleEquipments = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId } = req.params;
        const equipments = await prisma.poleEquipment.findMany({
            where: { poleId },
            orderBy: { createdAt: 'asc' }
        });
        res.json(equipments);
    } catch (error) {
        logger.error('[getPoleEquipments] Error:', error);
        res.status(500).json({ error: 'Failed to get pole equipments' });
    }
};

// POST /api/projects/:projectId/poles/:poleId/equipments
export const createPoleEquipment = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId } = req.params;
        const { type, name, description, quantity } = req.body;

        const equipment = await prisma.poleEquipment.create({
            data: { poleId, type, name, description, quantity: quantity || 1 }
        });
        res.status(201).json(equipment);
    } catch (error) {
        logger.error('[createPoleEquipment] Error:', error);
        res.status(500).json({ error: 'Failed to create pole equipment' });
    }
};

// PUT /api/projects/:projectId/poles/:poleId/equipments/:equipmentId
export const updatePoleEquipment = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { equipmentId } = req.params;
        const { type, name, description, quantity } = req.body;

        const updated = await prisma.poleEquipment.update({
            where: { id: equipmentId },
            data: {
                ...(type !== undefined && { type }),
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(quantity !== undefined && { quantity }),
            }
        });
        res.json(updated);
    } catch (error) {
        logger.error('[updatePoleEquipment] Error:', error);
        res.status(500).json({ error: 'Failed to update pole equipment' });
    }
};

// DELETE /api/projects/:projectId/poles/:poleId/equipments/:equipmentId
export const deletePoleEquipment = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { equipmentId } = req.params;
        await prisma.poleEquipment.delete({ where: { id: equipmentId } });
        res.json({ success: true });
    } catch (error) {
        logger.error('[deletePoleEquipment] Error:', error);
        res.status(500).json({ error: 'Failed to delete pole equipment' });
    }
};

// ==================== POLE CHECKLIST ====================

// GET /api/projects/:projectId/poles/:poleId/checklist
export const getPoleChecklist = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId } = req.params;
        const checklist = await prisma.poleChecklist.findUnique({ where: { poleId } });
        res.json(checklist || {
            poleId,
            hasIdentification: false,
            hasPhoto: false,
            distanceVerified: false,
            heightInformed: false,
            cableLinked: false,
            ctoOrBoxLinked: false,
            noElectricalConflict: false,
            readyToSubmit: false
        });
    } catch (error) {
        logger.error('[getPoleChecklist] Error:', error);
        res.status(500).json({ error: 'Failed to get pole checklist' });
    }
};

// PUT /api/projects/:projectId/poles/:poleId/checklist
export const upsertPoleChecklist = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId } = req.params;
        const data = req.body;

        const checklist = await prisma.poleChecklist.upsert({
            where: { poleId },
            create: {
                poleId,
                hasIdentification: data.hasIdentification || false,
                hasPhoto: data.hasPhoto || false,
                distanceVerified: data.distanceVerified || false,
                heightInformed: data.heightInformed || false,
                cableLinked: data.cableLinked || false,
                ctoOrBoxLinked: data.ctoOrBoxLinked || false,
                noElectricalConflict: data.noElectricalConflict || false,
                readyToSubmit: data.readyToSubmit || false,
            },
            update: {
                hasIdentification: data.hasIdentification,
                hasPhoto: data.hasPhoto,
                distanceVerified: data.distanceVerified,
                heightInformed: data.heightInformed,
                cableLinked: data.cableLinked,
                ctoOrBoxLinked: data.ctoOrBoxLinked,
                noElectricalConflict: data.noElectricalConflict,
                readyToSubmit: data.readyToSubmit,
            }
        });
        res.json(checklist);
    } catch (error) {
        logger.error('[upsertPoleChecklist] Error:', error);
        res.status(500).json({ error: 'Failed to save pole checklist' });
    }
};

// ==================== POLE SPANS (VÃOS) ====================

// GET /api/projects/:projectId/spans
export const getProjectSpans = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { projectId } = req.params;
        const spans = await prisma.poleSpan.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' }
        });
        res.json(spans);
    } catch (error) {
        logger.error('[getProjectSpans] Error:', error);
        res.status(500).json({ error: 'Failed to get spans' });
    }
};

// POST /api/projects/:projectId/spans
export const createSpan = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { projectId } = req.params;
        const { originPoleId, destinationPoleId, distanceMeters, cableType, fiberCount, sag, minHeight, sharing, observations } = req.body;

        const span = await prisma.poleSpan.create({
            data: {
                projectId,
                originPoleId,
                destinationPoleId,
                distanceMeters,
                cableType,
                fiberCount,
                sag,
                minHeight,
                sharing,
                observations
            }
        });
        res.status(201).json(span);
    } catch (error) {
        logger.error('[createSpan] Error:', error);
        res.status(500).json({ error: 'Failed to create span' });
    }
};

// PUT /api/projects/:projectId/spans/:spanId
export const updateSpan = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { spanId } = req.params;
        const data = req.body;

        const updated = await prisma.poleSpan.update({
            where: { id: spanId },
            data: {
                ...(data.distanceMeters !== undefined && { distanceMeters: data.distanceMeters }),
                ...(data.cableType !== undefined && { cableType: data.cableType }),
                ...(data.fiberCount !== undefined && { fiberCount: data.fiberCount }),
                ...(data.sag !== undefined && { sag: data.sag }),
                ...(data.minHeight !== undefined && { minHeight: data.minHeight }),
                ...(data.sharing !== undefined && { sharing: data.sharing }),
                ...(data.observations !== undefined && { observations: data.observations }),
            }
        });
        res.json(updated);
    } catch (error) {
        logger.error('[updateSpan] Error:', error);
        res.status(500).json({ error: 'Failed to update span' });
    }
};

// DELETE /api/projects/:projectId/spans/:spanId
export const deleteSpan = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { spanId } = req.params;
        await prisma.poleSpan.delete({ where: { id: spanId } });
        res.json({ success: true });
    } catch (error) {
        logger.error('[deleteSpan] Error:', error);
        res.status(500).json({ error: 'Failed to delete span' });
    }
};

// ==================== POLE PHOTOS ====================

// GET /api/projects/:projectId/poles/:poleId/photos
export const getPolePhotos = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId } = req.params;
        const photos = await prisma.polePhoto.findMany({
            where: { poleId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(photos);
    } catch (error) {
        logger.error('[getPolePhotos] Error:', error);
        res.status(500).json({ error: 'Failed to get pole photos' });
    }
};

// POST /api/projects/:projectId/poles/:poleId/photos
export const addPolePhoto = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId } = req.params;
        const { url, caption } = req.body;

        const photo = await prisma.polePhoto.create({
            data: { poleId, url, caption }
        });

        // Update hasPhoto flag on pole
        await prisma.pole.update({
            where: { id: poleId },
            data: { hasPhoto: true }
        });

        res.status(201).json(photo);
    } catch (error) {
        logger.error('[addPolePhoto] Error:', error);
        res.status(500).json({ error: 'Failed to add pole photo' });
    }
};

// DELETE /api/projects/:projectId/poles/:poleId/photos/:photoId
export const deletePolePhoto = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { poleId, photoId } = req.params;
        await prisma.polePhoto.delete({ where: { id: photoId } });

        // Check if pole still has photos
        const remaining = await prisma.polePhoto.count({ where: { poleId } });
        if (remaining === 0) {
            await prisma.pole.update({ where: { id: poleId }, data: { hasPhoto: false } });
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('[deletePolePhoto] Error:', error);
        res.status(500).json({ error: 'Failed to delete pole photo' });
    }
};

// ==================== PROJECT REPORT ====================

// GET /api/projects/:projectId/report
export const getProjectReport = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user?.companyId) return res.status(401).send();

    try {
        const { projectId } = req.params;

        const [poles, cables, ctos, spans] = await Promise.all([
            prisma.pole.findMany({ where: { projectId, deletedAt: null }, include: { checklist: true } }),
            prisma.cable.findMany({ where: { projectId, deletedAt: null } }),
            prisma.cto.findMany({ where: { projectId, deletedAt: null } }),
            prisma.poleSpan.findMany({ where: { projectId } }),
        ]);

        const totalPoles = poles.length;
        const newPoles = poles.filter(p => p.situation === 'NEW').length;
        const existingPoles = poles.filter(p => p.situation === 'EXISTING').length;
        const sharedPoles = poles.filter(p => p.situation === 'SHARED').length;
        const replacePoles = poles.filter(p => p.situation === 'REPLACE').length;
        const approvedPoles = poles.filter(p => p.approvalStatus === 'APPROVED').length;
        const pendingPoles = poles.filter(p => p.approvalStatus === 'PENDING').length;
        const irregularPoles = poles.filter(p => p.approvalStatus === 'IRREGULAR').length;
        const polesWithPhoto = poles.filter(p => p.hasPhoto).length;

        const totalCables = cables.length;
        const totalCTOs = ctos.filter(c => (c as any).type === 'CTO').length;
        const totalCEOs = ctos.filter(c => (c as any).type === 'CEO').length;

        // Calculate total network length from spans
        const totalNetworkLength = spans.reduce((sum, s) => sum + (s.distanceMeters || 0), 0);

        // Calculate from cable coordinates as fallback
        let totalCableLength = 0;
        for (const cable of cables) {
            const coords = cable.coordinates as any[];
            if (coords && coords.length >= 2) {
                for (let i = 1; i < coords.length; i++) {
                    const [lat1, lng1] = [coords[i - 1].lat || coords[i - 1][0], coords[i - 1].lng || coords[i - 1][1]];
                    const [lat2, lng2] = [coords[i].lat || coords[i][0], coords[i].lng || coords[i][1]];
                    totalCableLength += haversineDistance(lat1, lng1, lat2, lng2);
                }
            }
        }

        // Checklist completion
        const checklistComplete = poles.filter(p => p.checklist?.readyToSubmit).length;

        // Poles table data
        const polesTable = poles.map(p => ({
            id: p.id,
            name: p.name,
            utilityCode: p.utilityCode,
            type: p.type,
            height: p.height,
            strength: p.strength,
            shape: p.shape,
            situation: p.situation,
            approvalStatus: p.approvalStatus,
            roadSide: p.roadSide,
            hasPhoto: p.hasPhoto,
            lat: p.lat,
            lng: p.lng,
            addressReference: p.addressReference,
            linkedCableIds: p.linkedCableIds,
            checklistComplete: p.checklist?.readyToSubmit || false,
        }));

        res.json({
            summary: {
                totalPoles,
                newPoles,
                existingPoles,
                sharedPoles,
                replacePoles,
                approvedPoles,
                pendingPoles,
                irregularPoles,
                polesWithPhoto,
                totalCables,
                totalCTOs,
                totalCEOs,
                totalNetworkLength: Math.round(totalNetworkLength),
                totalCableLength: Math.round(totalCableLength),
                checklistComplete,
                totalSpans: spans.length,
            },
            poles: polesTable,
            spans: spans.map(s => ({
                id: s.id,
                originPoleId: s.originPoleId,
                destinationPoleId: s.destinationPoleId,
                distanceMeters: s.distanceMeters,
                cableType: s.cableType,
                fiberCount: s.fiberCount,
            })),
        });
    } catch (error) {
        logger.error('[getProjectReport] Error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

// Haversine distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
