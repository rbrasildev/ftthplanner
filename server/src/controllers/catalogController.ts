import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getSplitters = async (req: Request, res: Response) => {
    try {
        const splitters = await prisma.catalogSplitter.findMany({
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
        const { name, type, mode, inputs, outputs, attenuation, description } = req.body;

        const newSplitter = await prisma.catalogSplitter.create({
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

        res.status(201).json(newSplitter);
    } catch (error) {
        console.error("Error creating splitter:", error);
        res.status(500).json({ error: "Failed to create splitter" });
    }
};

export const updateSplitter = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, type, mode, inputs, outputs, attenuation, description } = req.body;

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
        const { id } = req.params;
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
        const cables = await prisma.catalogCable.findMany({
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
        const {
            name, brand, model, defaultLevel, fiberCount, looseTubeCount,
            fibersPerTube, attenuation, fiberProfile, description,
            deployedSpec, plannedSpec
        } = req.body;

        const newCable = await prisma.catalogCable.create({
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

        res.status(201).json(newCable);
    } catch (error) {
        console.error("Error creating cable:", error);
        res.status(500).json({ error: "Failed to create cable" });
    }
};

export const updateCable = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name, brand, model, defaultLevel, fiberCount, looseTubeCount,
            fibersPerTube, attenuation, fiberProfile, description,
            deployedSpec, plannedSpec
        } = req.body;

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
        const { id } = req.params;
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
        const boxes = await prisma.catalogBox.findMany({
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
        const {
            name, brand, model, type, reserveLoopLength, color, description
        } = req.body;

        const newBox = await prisma.catalogBox.create({
            data: {
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
        const { id } = req.params;
        const {
            name, brand, model, type, reserveLoopLength, color, description
        } = req.body;

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
        const { id } = req.params;
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
        const poles = await prisma.catalogPole.findMany({
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
        const { name, type, height, strength, shape, description } = req.body;
        const pole = await prisma.catalogPole.create({
            data: { name, type, height: Number(height), strength: Number(strength), shape, description }
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
        const { name, type, height, strength, shape, description } = req.body;
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
        await prisma.catalogPole.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete Pole Error:", error);
        res.status(500).json({ error: 'Failed to delete pole' });
    }
};
