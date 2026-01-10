import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getSplitters = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const splitters = await prisma.catalogSplitter.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: 'asc' }
        });
        res.json(splitters);
    } catch (error) {
        console.error("Error fetching splitters:", error);
        res.status(500).json({ error: "Failed to fetch splitters" });
    }
};

export const createSplitter = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, type, mode, inputs, outputs, attenuation, description } = req.body;

        const newSplitter = await prisma.catalogSplitter.create({
            data: {
                companyId: user.companyId,
                name,
                type,
                mode,
                inputs: Number(inputs),
                outputs: Number(outputs),
                attenuation: attenuation || {},
                description
            }
        });

        res.status(201).json(newSplitter);
    } catch (error) {
        console.error("Error creating splitter:", error);
        res.status(500).json({ error: "Failed to create splitter" });
    }
};

export const updateSplitter = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { id } = req.params;
        const { name, type, mode, inputs, outputs, attenuation, description } = req.body;

        const exists = await prisma.catalogSplitter.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Splitter not found" });

        const updatedSplitter = await prisma.catalogSplitter.update({
            where: { id },
            data: {
                name,
                type,
                mode,
                inputs: Number(inputs),
                outputs: Number(outputs),
                attenuation: attenuation || {},
                description
            }
        });

        res.json(updatedSplitter);
    } catch (error) {
        console.error("Error updating splitter:", error);
        res.status(500).json({ error: "Failed to update splitter" });
    }
};

export const deleteSplitter = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { id } = req.params;

        const exists = await prisma.catalogSplitter.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Splitter not found" });

        await prisma.catalogSplitter.delete({
            where: { id }
        });
        res.json({ message: "Splitter deleted successfully" });
    } catch (error) {
        console.error("Error deleting splitter:", error);
        res.status(500).json({ error: "Failed to delete splitter" });
    }
};

export const getCables = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const cables = await prisma.catalogCable.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: 'asc' }
        });
        res.json(cables);
    } catch (error) {
        console.error("Error fetching cables:", error);
        res.status(500).json({ error: "Failed to fetch cables" });
    }
};

export const createCable = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const {
            name, brand, model, defaultLevel, fiberCount, looseTubeCount,
            fibersPerTube, attenuation, fiberProfile, description,
            deployedSpec, plannedSpec
        } = req.body;

        const newCable = await prisma.catalogCable.create({
            data: {
                companyId: user.companyId,
                name, brand, model, defaultLevel,
                fiberCount: Number(fiberCount),
                looseTubeCount: Number(looseTubeCount),
                fibersPerTube: Number(fibersPerTube),
                attenuation: Number(attenuation),
                fiberProfile, description,
                deployedSpec: deployedSpec || {},
                plannedSpec: plannedSpec || {}
            }
        });

        res.status(201).json(newCable);
    } catch (error) {
        console.error("Error creating cable:", error);
        res.status(500).json({ error: "Failed to create cable" });
    }
};

export const updateCable = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const { id } = req.params;
        const {
            name, brand, model, defaultLevel, fiberCount, looseTubeCount,
            fibersPerTube, attenuation, fiberProfile, description,
            deployedSpec, plannedSpec
        } = req.body;

        const exists = await prisma.catalogCable.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Cable not found" });

        const updatedCable = await prisma.catalogCable.update({
            where: { id },
            data: {
                name, brand, model, defaultLevel,
                fiberCount: Number(fiberCount),
                looseTubeCount: Number(looseTubeCount),
                fibersPerTube: Number(fibersPerTube),
                attenuation: Number(attenuation),
                fiberProfile, description,
                deployedSpec: deployedSpec || {},
                plannedSpec: plannedSpec || {}
            }
        });

        res.json(updatedCable);
    } catch (error) {
        console.error("Error updating cable:", error);
        res.status(500).json({ error: "Failed to update cable" });
    }
};

export const deleteCable = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { id } = req.params;

        const exists = await prisma.catalogCable.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Cable not found" });

        await prisma.catalogCable.delete({
            where: { id }
        });
        res.json({ message: "Cable deleted successfully" });
    } catch (error) {
        console.error("Error deleting cable:", error);
        res.status(500).json({ error: "Failed to delete cable" });
    }
};

export const getBoxes = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const boxes = await prisma.catalogBox.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: 'asc' }
        });
        res.json(boxes);
    } catch (error) {
        console.error("Error fetching boxes:", error);
        res.status(500).json({ error: "Failed to fetch boxes" });
    }
};

export const createBox = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const {
            name, brand, model, type, reserveLoopLength, color, description
        } = req.body;

        const newBox = await prisma.catalogBox.create({
            data: {
                companyId: user.companyId,
                name, brand, model, type,
                reserveLoopLength: Number(reserveLoopLength),
                color: color || '#64748b',
                description
            }
        });

        res.status(201).json(newBox);
    } catch (error) {
        console.error("Error creating box:", error);
        res.status(500).json({ error: "Failed to create box" });
    }
};

export const updateBox = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { id } = req.params;
        const {
            name, brand, model, type, reserveLoopLength, color, description
        } = req.body;

        const exists = await prisma.catalogBox.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Box not found" });

        const updatedBox = await prisma.catalogBox.update({
            where: { id },
            data: {
                name, brand, model, type,
                reserveLoopLength: Number(reserveLoopLength),
                color: color || '#64748b',
                description
            }
        });

        res.json(updatedBox);
    } catch (error) {
        console.error("Error updating box:", error);
        res.status(500).json({ error: "Failed to update box" });
    }
};

export const deleteBox = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { id } = req.params;

        const exists = await prisma.catalogBox.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Box not found" });

        await prisma.catalogBox.delete({
            where: { id }
        });
        res.json({ message: "Box deleted successfully" });
    } catch (error) {
        console.error("Error deleting box:", error);
        res.status(500).json({ error: "Failed to delete box" });
    }
};

// --- POLES ---

export const getPoles = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const poles = await prisma.catalogPole.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: 'asc' }
        });
        res.json(poles);
    } catch (error) {
        console.error("Get Poles Error:", error);
        res.status(500).json({ error: 'Failed to fetch poles' });
    }
};

export const createPole = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, type, height, strength, shape, description } = req.body;
        const pole = await prisma.catalogPole.create({
            data: { companyId: user.companyId, name, type, height: Number(height), strength: Number(strength), shape, description }
        });
        res.json(pole);
    } catch (error) {
        console.error("Create Pole Error:", error);
        res.status(500).json({ error: 'Failed to create pole' });
    }
};

export const updatePole = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, type, height, strength, shape, description } = req.body;

        const exists = await prisma.catalogPole.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Pole not found" });

        const pole = await prisma.catalogPole.update({
            where: { id },
            data: { name, type, height: Number(height), strength: Number(strength), shape, description }
        });
        res.json(pole);
    } catch (error) {
        console.error("Update Pole Error:", error);
        res.status(500).json({ error: 'Failed to update pole' });
    }
};

export const deletePole = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const exists = await prisma.catalogPole.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Pole not found" });

        await prisma.catalogPole.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete Pole Error:", error);
        res.status(500).json({ error: 'Failed to delete pole' });
    }
};

// --- FUSIONS ---

export const getFusions = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const fusions = await prisma.catalogFusion.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: 'asc' }
        });
        res.json(fusions);
    } catch (error) {
        console.error("Get Fusions Error:", error);
        res.status(500).json({ error: 'Failed to fetch fusions' });
    }
};

export const createFusion = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, attenuation } = req.body;
        const fusion = await prisma.catalogFusion.create({
            data: { companyId: user.companyId, name, attenuation: Number(attenuation) }
        });
        res.json(fusion);
    } catch (error) {
        console.error("Create Fusion Error:", error);
        res.status(500).json({ error: 'Failed to create fusion' });
    }
};

export const updateFusion = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, attenuation } = req.body;

        const exists = await prisma.catalogFusion.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Fusion not found" });

        const fusion = await prisma.catalogFusion.update({
            where: { id },
            data: { name, attenuation: Number(attenuation) }
        });
        res.json(fusion);
    } catch (error) {
        console.error("Update Fusion Error:", error);
        res.status(500).json({ error: 'Failed to update fusion' });
    }
};

export const deleteFusion = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const exists = await prisma.catalogFusion.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Fusion not found" });

        await prisma.catalogFusion.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete Fusion Error:", error);
        res.status(500).json({ error: 'Failed to delete fusion' });
    }
};

// --- OLTS ---

export const getOLTs = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const olts = await prisma.catalogOLT.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: 'asc' }
        });
        res.json(olts);
    } catch (error) {
        console.error("Get OLTs Error:", error);
        res.status(500).json({ error: 'Failed to fetch OLTs' });
    }
};

export const createOLT = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, outputPower, slots, portsPerSlot, description } = req.body;
        const olt = await prisma.catalogOLT.create({
            data: {
                companyId: user.companyId,
                name,
                outputPower: Number(outputPower),
                slots: Number(slots) || 1,
                portsPerSlot: Number(portsPerSlot),
                description
            }
        });
        res.status(201).json(olt);
    } catch (error) {
        console.error("Create OLT Error:", error);
        res.status(500).json({ error: 'Failed to create OLT' });
    }
};

export const updateOLT = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, outputPower, slots, portsPerSlot, description } = req.body;

        const exists = await prisma.catalogOLT.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "OLT not found" });

        const olt = await prisma.catalogOLT.update({
            where: { id },
            data: {
                name,
                outputPower: Number(outputPower),
                slots: Number(slots) || 1,
                portsPerSlot: Number(portsPerSlot),
                description
            }
        });
        res.json(olt);
    } catch (error) {
        console.error("Update OLT Error:", error);
        res.status(500).json({ error: 'Failed to update OLT' });
    }
};

export const deleteOLT = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const exists = await prisma.catalogOLT.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "OLT not found" });

        await prisma.catalogOLT.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete OLT Error:", error);
        res.status(500).json({ error: 'Failed to delete OLT' });
    }
};
