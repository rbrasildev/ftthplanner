import { prisma } from '../lib/prisma';

async function main() {
    console.log("Seeding Default Templates...");

    // --- CABLES ---
    console.log("Seeding Template Cables...");
    await prisma.templateCable.deleteMany(); // Clear existing to avoid dupes/stale
    await prisma.templateCable.createMany({
        data: [
            {
                name: "Cabo Drop Flat 1FO",
                brand: "Genérico",
                model: "Drop Flat",
                defaultLevel: "Acesso",
                fiberCount: 1,
                looseTubeCount: 1,
                fibersPerTube: 1,
                attenuation: 0.3, // dB/km
                fiberProfile: "G.657A2",
                description: "Cabo Drop para assinante",
                deployedSpec: { color: "#000000", width: 2 },
                plannedSpec: { color: "#999999", width: 2 }
            },
            {
                name: "Cabo 6FO",
                brand: "Genérico",
                model: "AS-80",
                defaultLevel: "Distribuição",
                fiberCount: 6,
                looseTubeCount: 1, // Ex: 1 tubo de 6
                fibersPerTube: 6,
                attenuation: 0.35,
                fiberProfile: "G.652D",
                description: "Cabo de distribuição 6 fibras",
                deployedSpec: { color: "#ff00ff", width: 4 }, // Orange
                plannedSpec: { color: "#f1f1f154", width: 4 }
            },
            {
                name: "Cabo 12FO",
                brand: "Genérico",
                model: "AS-80",
                defaultLevel: "Distribuição",
                fiberCount: 12,
                looseTubeCount: 1, // Ex: 1 tubo de 12
                fibersPerTube: 12,
                attenuation: 0.35,
                fiberProfile: "G.652D",
                description: "Cabo de distribuição 12 fibras",
                deployedSpec: { color: "#0000ff", width: 4 }, // Orange
                plannedSpec: { color: "#f1f1f154", width: 4 }
            },
            {
                name: "Cabo 24FO",
                brand: "Genérico",
                model: "AS-80",
                defaultLevel: "Distribuição",
                fiberCount: 24,
                looseTubeCount: 2, // Ex: 1 tubo de 12
                fibersPerTube: 12,
                attenuation: 0.35,
                fiberProfile: "G.652D",
                description: "Cabo de distribuição 12 fibras",
                deployedSpec: { color: "#390000", width: 4 }, // Orange
                plannedSpec: { color: "#f1f1f154", width: 4 }
            },
            {
                name: "Cabo 36FO",
                brand: "Genérico",
                model: "AS-120",
                defaultLevel: "Troncal",
                fiberCount: 36,
                looseTubeCount: 6,
                fibersPerTube: 6,
                attenuation: 0.354,
                fiberProfile: "G.652D",
                description: "Cabo troncal 36 fibras",
                deployedSpec: { color: "#aa00ff", width: 6 },
                plannedSpec: { color: "#f1f1f154", width: 6 }
            },
            {
                name: "Cabo 48FO",
                brand: "Genérico",
                model: "AS-120",
                defaultLevel: "Troncal",
                fiberCount: 48,
                looseTubeCount: 4,
                fibersPerTube: 12,
                attenuation: 0.35,
                fiberProfile: "G.652D",
                description: "Cabo troncal 48 fibras",
                deployedSpec: { color: "#0000FF", width: 6 }, // Blue
                plannedSpec: { color: "#87CEFA", width: 6 }
            }
        ]
    });

    // --- SPLITTERS ---
    console.log("Seeding Template Splitters...");
    await prisma.templateSplitter.deleteMany();
    await prisma.templateSplitter.createMany({
        data: [
            // RF = Rede Fusionado (não conectorizado, sem conexão de clientes)
            // AC = Atendimento Conectorizado (conectorizado, permite conexão de clientes)
            { name: "1:2 RF", type: "PLC", mode: "Balanced", inputs: 1, outputs: 2, attenuation: { "1": 3.7, "2": 3.7 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Splitter 1:2 Rede Fusionado" },
            { name: "1:2 AC UPC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 2, attenuation: { "1": 3.7, "2": 3.7 }, connectorType: "Connectorized", polishType: "UPC", allowCustomConnections: true, description: "Splitter 1:2 Atendimento Conectorizado UPC" },
            { name: "1:2 AC APC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 2, attenuation: { "1": 3.7, "2": 3.7 }, connectorType: "Connectorized", polishType: "APC", allowCustomConnections: true, description: "Splitter 1:2 Atendimento Conectorizado APC" },
            { name: "1:4 RF", type: "PLC", mode: "Balanced", inputs: 1, outputs: 4, attenuation: { "x": 7.3 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Splitter 1:4 Rede Fusionado" },
            { name: "1:4 AC UPC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 4, attenuation: { "x": 7.3 }, connectorType: "Connectorized", polishType: "UPC", allowCustomConnections: true, description: "Splitter 1:4 Atendimento Conectorizado UPC" },
            { name: "1:4 AC APC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 4, attenuation: { "x": 7.3 }, connectorType: "Connectorized", polishType: "APC", allowCustomConnections: true, description: "Splitter 1:4 Atendimento Conectorizado APC" },
            { name: "1:8 RF", type: "PLC", mode: "Balanced", inputs: 1, outputs: 8, attenuation: { "x": 10.5 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Splitter 1:8 Rede Fusionado" },
            { name: "1:8 AC UPC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 8, attenuation: { "x": 10.5 }, connectorType: "Connectorized", polishType: "UPC", allowCustomConnections: true, description: "Splitter 1:8 Atendimento Conectorizado UPC" },
            { name: "1:8 AC APC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 8, attenuation: { "x": 10.5 }, connectorType: "Connectorized", polishType: "APC", allowCustomConnections: true, description: "Splitter 1:8 Atendimento Conectorizado APC" },
            { name: "1:16 RF", type: "PLC", mode: "Balanced", inputs: 1, outputs: 16, attenuation: { "x": 13.7 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Splitter 1:16 Rede Fusionado" },
            { name: "1:16 AC UPC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 16, attenuation: { "x": 13.7 }, connectorType: "Connectorized", polishType: "UPC", allowCustomConnections: true, description: "Splitter 1:16 Atendimento Conectorizado UPC" },
            { name: "1:16 AC APC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 16, attenuation: { "x": 13.7 }, connectorType: "Connectorized", polishType: "APC", allowCustomConnections: true, description: "Splitter 1:16 Atendimento Conectorizado APC" },
            { name: "1:32 RF", type: "PLC", mode: "Balanced", inputs: 1, outputs: 32, attenuation: { "x": 17.0 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Splitter 1:32 Rede Fusionado" },
            { name: "1:32 AC UPC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 32, attenuation: { "x": 17.0 }, connectorType: "Connectorized", polishType: "UPC", allowCustomConnections: true, description: "Splitter 1:32 Atendimento Conectorizado UPC" },
            { name: "1:32 AC APC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 32, attenuation: { "x": 17.0 }, connectorType: "Connectorized", polishType: "APC", allowCustomConnections: true, description: "Splitter 1:32 Atendimento Conectorizado APC" },
            { name: "1:64 RF", type: "PLC", mode: "Balanced", inputs: 1, outputs: 64, attenuation: { "x": 20.5 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Splitter 1:64 Rede Fusionado" },
            { name: "1:64 AC UPC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 64, attenuation: { "x": 20.5 }, connectorType: "Connectorized", polishType: "UPC", allowCustomConnections: true, description: "Splitter 1:64 Atendimento Conectorizado UPC" },
            { name: "1:64 AC APC", type: "PLC", mode: "Balanced", inputs: 1, outputs: 64, attenuation: { "x": 20.5 }, connectorType: "Connectorized", polishType: "APC", allowCustomConnections: true, description: "Splitter 1:64 Atendimento Conectorizado APC" },

            // Desbalanceados RF - port1 = saída passante (maior potência), port2 = saída derivada (menor potência)
            { name: "1:2 1/99 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 0.1, "port1": 0.1, "port2": 20.0 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 1/99" },
            { name: "1:2 2/98 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 0.1, "port1": 0.1, "port2": 17.0 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 2/98" },
            { name: "1:2 5/95 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 0.2, "port1": 0.2, "port2": 13.0 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 5/95" },
            { name: "1:2 10/90 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 0.5, "port1": 0.5, "port2": 10.5 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 10/90" },
            { name: "1:2 15/85 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 0.7, "port1": 0.7, "port2": 8.5 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 15/85" },
            { name: "1:2 20/80 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 1.0, "port1": 1.0, "port2": 7.3 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 20/80" },
            { name: "1:2 25/75 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 1.3, "port1": 1.3, "port2": 6.2 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 25/75" },
            { name: "1:2 30/70 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 1.6, "port1": 1.6, "port2": 5.5 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 30/70" },
            { name: "1:2 40/60 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 2.2, "port1": 2.2, "port2": 4.0 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 40/60" },
            { name: "1:2 45/55 RF", type: "PLC", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "value": 2.6, "port1": 2.6, "port2": 3.5 }, connectorType: "Unconnectorized", allowCustomConnections: false, description: "Desbalanceado 45/55" }
        ]
    });

    // --- BOXES ---
    console.log("Seeding Template Boxes...");
    await prisma.templateBox.deleteMany();
    await prisma.templateBox.createMany({
        data: [
            {
                name: "CTO",
                brand: "Genérico",
                model: "NAP-16",
                type: "CTO",
                reserveLoopLength: 30,
                color: "#00FF00",
                description: "Caixa Terminal Óptica para 16 assinantes (equipada 1:8)"
            },
            {
                name: "CEO",
                brand: "Genérico",
                model: "Domo 144",
                type: "CEO",
                reserveLoopLength: 50,
                color: "#00ffff",
                description: "Caixa de Emenda Óptica tipo Domo"
            }
        ]
    });

    // --- POLES ---
    console.log("Seeding Template Poles...");
    await prisma.templatePole.deleteMany();
    await prisma.templatePole.createMany({
        data: [
            { name: "Poste DT 09/300", type: "Concreto", height: 9, strength: 300, shape: "Duplo T", description: "Poste padrÃ£o distribuiÃ§Ã£o" },
            { name: "Poste Circular 11/600", type: "Concreto", height: 11, strength: 600, shape: "Circular", description: "Poste reforÃ§ado" }
        ]
    });

    // --- FUSIONS ---
    console.log("Seeding Template Fusions...");
    await prisma.templateFusion.deleteMany();
    await prisma.templateFusion.createMany({
        data: [
            { name: "Fusão Padrão", category: "fusion", attenuation: 0.02 },
            { name: "Fusão Mecânica", category: "fusion", attenuation: 0.5 },
            { name: "Conector SC/APC", category: "connector", polishType: "APC", attenuation: 0.3 },
            { name: "Conector SC/UPC", category: "connector", polishType: "UPC", attenuation: 0.5 },
            { name: "Conector LC/APC", category: "connector", polishType: "APC", attenuation: 0.3 },
            { name: "Conector LC/UPC", category: "connector", polishType: "UPC", attenuation: 0.5 }
        ]
    });

    // --- OLTS ---
    console.log("Seeding Template OLTs...");
    await prisma.templateOLT.deleteMany();
    await prisma.templateOLT.createMany({
        data: [
            { name: "OLT Huawei MA5608T", outputPower: 3, slots: 2, portsPerSlot: 16, description: "OLT Chassis 2 Slots" },
            { name: "OLT ZTE C320", outputPower: 4, slots: 2, portsPerSlot: 16, description: "OLT Compacta" },
            { name: "OLT V-Sol 8 Portas", outputPower: 5, slots: 1, portsPerSlot: 8, description: "Box 8 Portas" }
        ]
    });

    console.log("Seeding Done!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
