import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Create default plans
    const plans = [
        {
            name: 'Plano Trial',
            price: 0.0,
            type: 'TRIAL',
            trialDurationDays: 7,
            features: JSON.stringify(['all_features']),
            limits: JSON.stringify({ projects: 5, users: 3, ctos: 100, pops: 5 }),
            stripeId: 'price_trial_example',
        },
        {
            name: 'Plano Ilimitado',
            price: 99.90,
            type: 'ENTERPRISE',
            features: JSON.stringify(['all_features']),
            limits: JSON.stringify({ projects: 999, users: 999, ctos: 9999, pops: 999 }),
            stripeId: 'price_H5ggYJDqBQ4', // Updated field name
        },
    ];

    for (const plan of plans) {
        const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
        if (!existing) {
            await prisma.plan.create({ data: plan });
            console.log(`Created plan: ${plan.name}`);
        }
    }

    // --- SEED TEMPLATES ---
    console.log('Seeding templates...');

    // 1. Template Cables
    console.log('Clearing and seeding template cables...');
    await prisma.templateCable.deleteMany();
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
                attenuation: 0.3,
                fiberProfile: "G.657A2",
                description: "Cabo Drop para assinante",
                deployedSpec: { color: "#000000", width: 2 },
                plannedSpec: { color: "#999999", width: 2 }
            },
            {
                name: "Cabo 6FO AS-80",
                brand: "Genérico",
                model: "AS-80",
                defaultLevel: "DISTRIBUICAO",
                fiberCount: 6,
                looseTubeCount: 1,
                fibersPerTube: 6,
                attenuation: 0.35,
                fiberProfile: "G.652D",
                description: "Cabo de distribuição 6 fibras",
                deployedSpec: { color: "#ff00ff", width: 4 },
                plannedSpec: { color: "#f1f1f154", width: 4 }
            },
            {
                name: "Cabo 12FO AS-80",
                brand: "Genérico",
                model: "AS-80",
                defaultLevel: "DISTRIBUICAO",
                fiberCount: 12,
                looseTubeCount: 1,
                fibersPerTube: 12,
                attenuation: 0.35,
                fiberProfile: "G.652D",
                description: "Cabo de distribuição 12 fibras",
                deployedSpec: { color: "#0000ff", width: 4 },
                plannedSpec: { color: "#f1f1f154", width: 4 }
            },
            {
                name: "Cabo 36FO AS-120",
                brand: "Genérico",
                model: "AS-120",
                defaultLevel: "TRONCO",
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
                name: "Cabo 48FO AS-120",
                brand: "Genérico",
                model: "AS-120",
                defaultLevel: "TRONCO",
                fiberCount: 48,
                looseTubeCount: 4,
                fibersPerTube: 12,
                attenuation: 0.35,
                fiberProfile: "G.652D",
                description: "Cabo troncal 48 fibras",
                deployedSpec: { color: "#0000FF", width: 6 },
                plannedSpec: { color: "#87CEFA", width: 6 }
            },
            {
                name: "Cabo 72FO AS-120",
                brand: "Genérico",
                model: "AS-120",
                defaultLevel: "TRONCO",
                fiberCount: 72,
                looseTubeCount: 6,
                fibersPerTube: 12,
                attenuation: 0.35,
                fiberProfile: "G.652D",
                description: "Cabo troncal 72 fibras",
                deployedSpec: { color: "#6366f1", width: 6 },
                plannedSpec: { color: "#a5b4fc", width: 6 }
            }
        ]
    });

    // 2. Template Splitters
    console.log('Clearing and seeding template splitters...');
    await prisma.templateSplitter.deleteMany();
    await prisma.templateSplitter.createMany({
        data: [
            { name: "Splitter 1:2", type: "PLC", mode: "Balanced", inputs: 1, outputs: 2, attenuation: { "1": 3.7, "2": 3.7 }, description: "Divisor Balanceado 1:2" },
            { name: "Splitter 1:4", type: "PLC", mode: "Balanced", inputs: 1, outputs: 4, attenuation: { "x": 7.3 }, description: "Divisor Balanceado 1:4" },
            { name: "Splitter 1:8", type: "PLC", mode: "Balanced", inputs: 1, outputs: 8, attenuation: { "x": 10.5 }, description: "Divisor Balanceado 1:8" },
            { name: "Splitter 1:16", type: "PLC", mode: "Balanced", inputs: 1, outputs: 16, attenuation: { "x": 13.7 }, description: "Divisor Balanceado 1:16" },
            { name: "Splitter 10/90 FBT", type: "FBT", mode: "Unbalanced", inputs: 1, outputs: 2, attenuation: { "1": 10.5, "2": 0.5 }, description: "Divisor Desbalanceado 10/90" }
        ]
    });

    // 3. Template Boxes
    console.log('Clearing and seeding template boxes...');
    await prisma.templateBox.deleteMany();
    await prisma.templateBox.createMany({
        data: [
            { name: "CTO NAP-16", brand: "Genérico", model: "NAP-16", type: "CTO", reserveLoopLength: 30, color: "#00FF00", description: "Caixa Terminal Óptica para 16 assinantes" },
            { name: "CEO Domo 144", brand: "Genérico", model: "Domo 144", type: "CEO", reserveLoopLength: 50, color: "#00ffff", description: "Caixa de Emenda Óptica tipo Domo" }
        ]
    });

    // 4. Template Poles
    console.log('Clearing and seeding template poles...');
    await prisma.templatePole.deleteMany();
    await prisma.templatePole.createMany({
        data: [
            { name: "Poste DT 09/300", type: "Concreto", height: 9, strength: 300, shape: "Duplo T", description: "Poste padrão distribuição" },
            { name: "Poste Circular 11/600", type: "Concreto", height: 11, strength: 600, shape: "Circular", description: "Poste reforçado" }
        ]
    });

    // 5. Template Fusions
    console.log('Clearing and seeding template fusions...');
    await prisma.templateFusion.deleteMany();
    await prisma.templateFusion.createMany({
        data: [
            { name: "Fusão Padrão", attenuation: 0.02 },
            { name: "Conector APC", attenuation: 0.5 },
            { name: "Conector UPC", attenuation: 0.3 }
        ]
    });

    // 6. Template OLTs
    console.log('Clearing and seeding template olts...');
    await prisma.templateOLT.deleteMany();
    await prisma.templateOLT.createMany({
        data: [
            { name: "OLT Chassis High-End", outputPower: 3, slots: 2, portsPerSlot: 16, description: "OLT Chassis 2 Slots" },
            { name: "OLT Pizza Box 8 Portas", outputPower: 5, slots: 1, portsPerSlot: 8, description: "OLT Compacta 8 Portas" }
        ]
    });

    console.log('Templates seeded successfully.');

    // 7. Email Templates
    console.log('Seeding Email Templates...');
    const emailTemplates = [
        {
            slug: 'admin-new-client-notification',
            name: 'Notificação de Novo Cliente (Admin)',
            subject: 'Novo Cliente Cadastrado: {{company}}',
            body: 'Um novo cliente se cadastrou no sistema.<br><br><b>Detalhes:</b><br><ul><li><b>Usuário:</b> {{username}}</li><li><b>Empresa:</b> {{company}}</li><li><b>E-mail:</b> {{email}}</li><li><b>Telefone:</b> {{phone}}</li><li><b>Plano:</b> {{plan}}</li><li><b>Origem:</b> {{source}}</li></ul>',
            variables: JSON.stringify(['username', 'company', 'email', 'phone', 'plan', 'source'])
        },
        {
            slug: 'welcome-email',
            name: 'Bem-vindo ao FTTx Planner',
            subject: 'Bem vindo ao FTTx Planner, {{username}}',
            body: '<div style="font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #f8fafc;"><div style="text-align: center; padding: 20px 0;"><h1 style="color: #4f46e5; margin: 10px 0 0 0; font-size: 24px;">FTTH Planner Pro</h1></div><div style="background-color: #ffffff; padding: 40px; border-radius: 24px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;"><h2 style="color: #0f172a; margin-top: 0; font-size: 22px;">Olá, {{username}}! 👋</h2><p style="line-height: 1.6; font-size: 16px; color: #475569;">É um prazer ter você conosco! Sua conta na empresa <strong>{{company_name}}</strong> foi criada com sucesso no <strong>FTTH Planner Pro</strong>.</p><div style="text-align: center; margin: 35px 0;"><a href="{{login_url}}" style="background-color: #4f46e5; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Acessar Meu Painel</a></div></div></div>',
            variables: JSON.stringify(['username', 'company_name', 'login_url', 'company_logo'])
        }
    ];

    for (const t of emailTemplates) {
        const exists = await prisma.emailTemplate.findUnique({ where: { slug: t.slug } });
        if (!exists) {
            await prisma.emailTemplate.create({ data: t as any });
            console.log(`Created email template: ${t.slug}`);
        } else {
            await prisma.emailTemplate.update({ where: { slug: t.slug }, data: t as any });
            console.log(`Updated email template: ${t.slug}`);
        }
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
