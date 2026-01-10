import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const cloneTemplatesToCompany = async (companyId: string) => {
    try {
        // Clone Cables
        const templateCables = await prisma.templateCable.findMany();
        if (templateCables.length > 0) {
            await prisma.catalogCable.createMany({
                data: templateCables.map(t => ({
                    companyId,
                    name: t.name,
                    brand: t.brand,
                    model: t.model,
                    defaultLevel: t.defaultLevel,
                    fiberCount: t.fiberCount,
                    looseTubeCount: t.looseTubeCount,
                    fibersPerTube: t.fibersPerTube,
                    attenuation: t.attenuation,
                    fiberProfile: t.fiberProfile,
                    description: t.description,
                    deployedSpec: t.deployedSpec || {},
                    plannedSpec: t.plannedSpec || {}
                }))
            });
        }

        // Clone Splitters
        const templateSplitters = await prisma.templateSplitter.findMany();
        if (templateSplitters.length > 0) {
            await prisma.catalogSplitter.createMany({
                data: templateSplitters.map(t => ({
                    companyId,
                    name: t.name,
                    type: t.type,
                    mode: t.mode,
                    inputs: t.inputs,
                    outputs: t.outputs,
                    attenuation: t.attenuation || {},
                    description: t.description
                }))
            });
        }

        // Clone Boxes
        const templateBoxes = await prisma.templateBox.findMany();
        if (templateBoxes.length > 0) {
            await prisma.catalogBox.createMany({
                data: templateBoxes.map(t => ({
                    companyId,
                    name: t.name,
                    brand: t.brand,
                    model: t.model,
                    type: t.type,
                    reserveLoopLength: t.reserveLoopLength,
                    color: t.color,
                    description: t.description
                }))
            });
        }

        // Clone Poles
        const templatePoles = await prisma.templatePole.findMany();
        if (templatePoles.length > 0) {
            await prisma.catalogPole.createMany({
                data: templatePoles.map(t => ({
                    companyId,
                    name: t.name,
                    type: t.type,
                    height: t.height,
                    strength: t.strength,
                    shape: t.shape,
                    description: t.description
                }))
            });
        }

        // Clone Fusions
        const templateFusions = await prisma.templateFusion.findMany();
        if (templateFusions.length > 0) {
            await prisma.catalogFusion.createMany({
                data: templateFusions.map(t => ({
                    companyId,
                    name: t.name,
                    attenuation: t.attenuation
                }))
            });
        }

        // Clone OLTs
        const templateOLTs = await prisma.templateOLT.findMany();
        if (templateOLTs.length > 0) {
            await prisma.catalogOLT.createMany({
                data: templateOLTs.map(t => ({
                    companyId,
                    name: t.name,
                    outputPower: t.outputPower,
                    slots: t.slots,
                    portsPerSlot: t.portsPerSlot,
                    description: t.description
                }))
            });
        }

        console.log(`Successfully cloned templates for company ${companyId}`);
    } catch (error) {
        console.error("Error cloning templates:", error);
        // Don't throw, just log. We don't want to fail registration if templates fail.
    }
};
