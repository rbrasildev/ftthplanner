import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

export const getSplitters = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const splitters = await prisma.catalogSplitter.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: 'asc' }
        });
        res.json(splitters);
    } catch (error: any) {
        logger.error(`[CatalogController] Error: ${error.message}`);
        res.status(500).json({ error: "Failed" });
    }
};

export const createSplitter = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, type, mode, inputs, outputs, attenuation, description, connectorType, polishType, allowCustomConnections } = req.body;

        const newSplitter = await prisma.catalogSplitter.create({
            data: {
                companyId: user.companyId,
                name,
                type,
                mode,
                inputs: Number(inputs),
                outputs: Number(outputs),
                connectorType: connectorType || 'Unconnectorized',
                polishType: polishType || null,
                allowCustomConnections: allowCustomConnections !== undefined ? allowCustomConnections : false,
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
        const { name, type, mode, inputs, outputs, attenuation, description, connectorType, polishType, allowCustomConnections } = req.body;

        const exists = await prisma.catalogSplitter.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Splitter not found" });

        // Partial update — only set fields explicitly provided in the body.
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (type !== undefined) data.type = type;
        if (mode !== undefined) data.mode = mode;
        if (inputs !== undefined) data.inputs = Number(inputs);
        if (outputs !== undefined) data.outputs = Number(outputs);
        if (connectorType !== undefined) data.connectorType = connectorType;
        if (polishType !== undefined) data.polishType = polishType;
        if (allowCustomConnections !== undefined) data.allowCustomConnections = allowCustomConnections;
        if (attenuation !== undefined) data.attenuation = attenuation;
        if (description !== undefined) data.description = description;

        const updatedSplitter = await prisma.catalogSplitter.update({
            where: { id },
            data
        });

        // Propagate changes to existing splitters in CTOs
        try {
            const ctos = await prisma.cto.findMany({
                where: { companyId: user.companyId, deletedAt: null }
            });

            for (const cto of ctos) {
                let splitters = cto.splitters as any[];
                if (!Array.isArray(splitters)) continue;

                let changed = false;
                const updatedSplitters = splitters.map(s => {
                    // Match by catalogId (preferred) or by type/name fallback (for existing objects)
                    const isMatch = s.catalogId === id || (!s.catalogId && s.type === exists.name);

                    if (isMatch) {
                        changed = true;
                        return {
                            ...s,
                            catalogId: id, // Ensure it's now linked for future updates
                            type: name,    // Update model name if changed
                            connectorType: connectorType,
                            allowCustomConnections: allowCustomConnections
                        };
                    }
                    return s;
                });

                if (changed) {
                    await prisma.cto.update({
                        where: { id: cto.id },
                        data: { splitters: updatedSplitters }
                    });
                }
            }
        } catch (propError) {
            logger.error(`[CatalogController] Error propagating splitter changes: ${propError}`);
        }

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

        // Partial update — only set fields explicitly provided in the body.
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (brand !== undefined) data.brand = brand;
        if (model !== undefined) data.model = model;
        if (defaultLevel !== undefined) data.defaultLevel = defaultLevel;
        if (fiberCount !== undefined) data.fiberCount = Number(fiberCount);
        if (looseTubeCount !== undefined) data.looseTubeCount = Number(looseTubeCount);
        if (fibersPerTube !== undefined) data.fibersPerTube = Number(fibersPerTube);
        if (attenuation !== undefined) data.attenuation = Number(attenuation);
        if (fiberProfile !== undefined) data.fiberProfile = fiberProfile;
        if (description !== undefined) data.description = description;
        if (deployedSpec !== undefined) data.deployedSpec = deployedSpec;
        if (plannedSpec !== undefined) data.plannedSpec = plannedSpec;

        const updatedCable = await prisma.catalogCable.update({
            where: { id },
            data
        });

        // Propagate color changes to existing cables
        try {
            if (deployedSpec?.color) {
                await prisma.cable.updateMany({
                    where: { catalogId: id, companyId: user.companyId, status: 'DEPLOYED', deletedAt: null },
                    data: { color: deployedSpec.color }
                });
            }
            if (plannedSpec?.color) {
                await prisma.cable.updateMany({
                    where: { catalogId: id, companyId: user.companyId, status: 'PLANNED', deletedAt: null },
                    data: { color: plannedSpec.color }
                });
            }
        } catch (propError) {
            logger.error(`[CatalogController] Error propagating cable color: ${propError}`);
            // Non-blocking error
        }

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

        // Partial update — only set fields explicitly provided in the body.
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (brand !== undefined) data.brand = brand;
        if (model !== undefined) data.model = model;
        if (type !== undefined) data.type = type;
        if (reserveLoopLength !== undefined) data.reserveLoopLength = Number(reserveLoopLength);
        if (color !== undefined) data.color = color;
        if (description !== undefined) data.description = description;

        const updatedBox = await prisma.catalogBox.update({
            where: { id },
            data
        });

        // Propagate changes to existing CTOs — only fields that were explicitly provided.
        try {
            const propagateData: any = {};
            if (color !== undefined) propagateData.color = color;
            if (type !== undefined) propagateData.type = type;
            if (reserveLoopLength !== undefined) {
                propagateData.reserveLoopLength = reserveLoopLength ? Number(reserveLoopLength) : null;
            }
            if (Object.keys(propagateData).length > 0) {
                await prisma.cto.updateMany({
                    where: { catalogId: id, companyId: user.companyId, deletedAt: null },
                    data: propagateData
                });
            }
        } catch (propError) {
            logger.error(`[CatalogController] Error propagating box changes: ${propError}`);
            // Non-blocking error
        }

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

        // Partial update — only set fields explicitly provided in the body.
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (type !== undefined) data.type = type;
        if (height !== undefined) data.height = Number(height);
        if (strength !== undefined) data.strength = Number(strength);
        if (shape !== undefined) data.shape = shape;
        if (description !== undefined) data.description = description;

        const pole = await prisma.catalogPole.update({
            where: { id },
            data
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
        const category = req.query.category as string | undefined;
        const where: any = { companyId: user.companyId };
        if (category) where.category = category;
        const fusions = await prisma.catalogFusion.findMany({
            where,
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
        const { name, attenuation, category, polishType } = req.body;
        const fusion = await prisma.catalogFusion.create({
            data: { companyId: user.companyId, name, attenuation: Number(attenuation), category: category || 'fusion', polishType: polishType || null }
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
        const { name, attenuation, category, polishType } = req.body;

        const exists = await prisma.catalogFusion.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "Fusion not found" });

        // Partial update — only set fields explicitly provided in the body.
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (attenuation !== undefined) data.attenuation = Number(attenuation);
        if (category !== undefined) data.category = category;
        if (polishType !== undefined) data.polishType = polishType;

        const fusion = await prisma.catalogFusion.update({
            where: { id },
            data
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

// Sanitize portPowers: keep only entries whose key is "slot-port" (1-indexed)
// and value is a finite number. Returns undefined if the result is empty or input invalid.
const sanitizePortPowers = (raw: any): Record<string, number> | undefined => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!/^\d+-\d+$/.test(key)) continue;
        const num = typeof value === 'number' ? value : parseFloat(value as string);
        if (Number.isFinite(num)) out[key] = num;
    }
    return Object.keys(out).length > 0 ? out : undefined;
};

export const createOLT = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const { name, type, outputPower, slots, portsPerSlot, uplinkPorts, portPowers, description } = req.body;
        const olt = await prisma.catalogOLT.create({
            data: {
                companyId: user.companyId,
                name,
                type: type || 'OLT',
                outputPower: Number(outputPower),
                slots: Number(slots) || 1,
                portsPerSlot: Number(portsPerSlot),
                uplinkPorts: Number(uplinkPorts) || 0,
                portPowers: sanitizePortPowers(portPowers) ?? undefined,
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
        const { name, type, outputPower, slots, portsPerSlot, uplinkPorts, portPowers, description } = req.body;

        const exists = await prisma.catalogOLT.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "OLT not found" });

        // Partial update — only set fields explicitly provided in the body.
        const data: any = {};
        if (name !== undefined) data.name = name;
        if (type !== undefined) data.type = type;
        if (outputPower !== undefined) data.outputPower = Number(outputPower);
        if (slots !== undefined) data.slots = Number(slots) || 1;
        if (portsPerSlot !== undefined) data.portsPerSlot = Number(portsPerSlot);
        if (uplinkPorts !== undefined) data.uplinkPorts = Number(uplinkPorts) || 0;
        if (portPowers !== undefined) {
            const cleaned = sanitizePortPowers(portPowers);
            data.portPowers = cleaned ?? Prisma.JsonNull;
        }
        if (description !== undefined) data.description = description;

        const olt = await prisma.catalogOLT.update({
            where: { id },
            data
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

// --- GBICS (SFP / SFP+ / BiDi) ---

const GBIC_TIPOS = new Set(['SFP', 'SFP+', 'SFP28', 'QSFP+', 'QSFP28', 'XFP', 'GBIC']);
const GBIC_MODOS = new Set(['monomodo', 'multimodo']);
const GBIC_TRANSMISSOES = new Set(['duplex', 'bidi']);

function normalizeGbicPayload(body: any) {
    const tipo = String(body.tipo || 'SFP');
    const modoFibra = String(body.modoFibra || 'monomodo');
    const transmissao = String(body.transmissao || 'duplex');
    if (!GBIC_TIPOS.has(tipo)) throw new Error(`Invalid tipo: ${tipo}`);
    if (!GBIC_MODOS.has(modoFibra)) throw new Error(`Invalid modoFibra: ${modoFibra}`);
    if (!GBIC_TRANSMISSOES.has(transmissao)) throw new Error(`Invalid transmissao: ${transmissao}`);
    return {
        name: String(body.name),
        brand: body.brand ?? null,
        model: body.model ?? null,
        tipo,
        modoFibra,
        transmissao,
        rateGbps: body.rateGbps != null ? Number(body.rateGbps) : null,
        waveTxNm: body.waveTxNm != null ? Number(body.waveTxNm) : null,
        waveRxNm: body.waveRxNm != null ? Number(body.waveRxNm) : null,
        reachKm: body.reachKm != null ? Number(body.reachKm) : null,
        potenciaTx: Number(body.potenciaTx),
        sensibilidadeRx: Number(body.sensibilidadeRx),
        description: body.description ?? null,
    };
}

export const getGbics = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const gbics = await prisma.catalogGbic.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: 'asc' }
        });
        res.json(gbics);
    } catch (error) {
        console.error("Get GBICs Error:", error);
        res.status(500).json({ error: 'Failed to fetch GBICs' });
    }
};

export const createGbic = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();
        const data = normalizeGbicPayload(req.body);
        const gbic = await prisma.catalogGbic.create({
            data: { ...data, companyId: user.companyId }
        });
        res.status(201).json(gbic);
    } catch (error: any) {
        console.error("Create GBIC Error:", error);
        res.status(400).json({ error: 'Failed to create GBIC', details: error.message });
    }
};

export const updateGbic = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const exists = await prisma.catalogGbic.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "GBIC not found" });

        const data = normalizeGbicPayload(req.body);
        const gbic = await prisma.catalogGbic.update({ where: { id }, data });
        res.json(gbic);
    } catch (error: any) {
        console.error("Update GBIC Error:", error);
        res.status(400).json({ error: 'Failed to update GBIC', details: error.message });
    }
};

export const deleteGbic = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = (req as AuthRequest).user;
        if (!user || !user.companyId) return res.status(401).send();

        const exists = await prisma.catalogGbic.findFirst({ where: { id, companyId: user.companyId } });
        if (!exists) return res.status(404).json({ error: "GBIC not found" });

        await prisma.catalogGbic.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error("Delete GBIC Error:", error);
        res.status(500).json({ error: 'Failed to delete GBIC' });
    }
};
