import { PrismaClient } from '@prisma/client';

const defaultPrisma = new PrismaClient();

export const cloneTemplatesToCompany = async (companyId: string, prisma: any = defaultPrisma) => {
    try {
        console.log(`Cloning templates for company ${companyId}...`);

        // VERIFY COMPANY EXISTS FIRST
        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company) {
            console.error(`Company ${companyId} not found. Aborting template cloning.`);
            return;
        }

        // Clone Cables
        const templateCables = await prisma.templateCable.findMany();
        if (templateCables.length > 0) {
            const data = [];
            for (const t of templateCables) {
                data.push({
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
                    deployedSpec: (t as any).deployedSpec || {},
                    plannedSpec: (t as any).plannedSpec || {}
                });
            }
            await prisma.catalogCable.createMany({ data });
        }

        // Clone Splitters
        const templateSplitters = await prisma.templateSplitter.findMany();
        if (templateSplitters.length > 0) {
            const data = [];
            for (const t of templateSplitters) {
                data.push({
                    companyId,
                    name: t.name,
                    type: t.type,
                    mode: t.mode,
                    inputs: t.inputs,
                    outputs: t.outputs,
                    attenuation: t.attenuation || {},
                    description: t.description
                });
            }
            await prisma.catalogSplitter.createMany({ data });
        }

        // Clone Boxes
        const templateBoxes = await prisma.templateBox.findMany();
        if (templateBoxes.length > 0) {
            const data = [];
            for (const t of templateBoxes) {
                data.push({
                    companyId,
                    name: t.name,
                    brand: t.brand,
                    model: t.model,
                    type: t.type,
                    reserveLoopLength: t.reserveLoopLength,
                    color: t.color,
                    description: t.description
                });
            }
            await prisma.catalogBox.createMany({ data });
        }

        // Clone Poles
        const templatePoles = await prisma.templatePole.findMany();
        if (templatePoles.length > 0) {
            const data = [];
            for (const t of templatePoles) {
                data.push({
                    companyId,
                    name: t.name,
                    type: t.type,
                    height: t.height,
                    strength: t.strength,
                    shape: t.shape,
                    description: t.description
                });
            }
            await prisma.catalogPole.createMany({ data });
        }

        // Clone Fusions
        const templateFusions = await prisma.templateFusion.findMany();
        if (templateFusions.length > 0) {
            const data = [];
            for (const t of templateFusions) {
                data.push({
                    companyId,
                    name: t.name,
                    attenuation: t.attenuation
                });
            }
            await prisma.catalogFusion.createMany({ data });
        }

        // Clone OLTs
        const templateOLTs = await prisma.templateOLT.findMany();
        if (templateOLTs.length > 0) {
            const data = [];
            for (const t of templateOLTs) {
                data.push({
                    companyId,
                    name: t.name,
                    outputPower: t.outputPower,
                    slots: t.slots,
                    portsPerSlot: t.portsPerSlot,
                    description: t.description
                });
            }
            await prisma.catalogOLT.createMany({ data });
        }

        console.log(`Successfully cloned templates for company ${companyId}`);
    } catch (error) {
        console.error("Error cloning templates:", error);
    }
};
