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
    const cables = [
        { name: 'Cabo AS 6F', fiberCount: 6, looseTubeCount: 1, fibersPerTube: 6, deployedSpec: { color: '#ff00ff', width: 3 }, defaultLevel: 'DISTRIBUICAO' },
        { name: 'Cabo AS 12F', fiberCount: 12, looseTubeCount: 1, fibersPerTube: 12, deployedSpec: { color: '#0000ff', width: 3 }, defaultLevel: 'TRONCO' },
        { name: 'Cabo AS 24F', fiberCount: 24, looseTubeCount: 4, fibersPerTube: 6, deployedSpec: { color: '#ffff00', width: 3 }, defaultLevel: 'TRONCO' },
        { name: 'Cabo AS 36F', fiberCount: 36, looseTubeCount: 6, fibersPerTube: 6, deployedSpec: { color: '#aa00ff', width: 3 }, defaultLevel: 'TRONCO' },
        { name: 'Cabo AS 48F', fiberCount: 48, looseTubeCount: 4, fibersPerTube: 6, deployedSpec: { color: '#55aa00', width: 3 }, defaultLevel: 'TRONCO' },
        { name: 'Cabo AS 72F', fiberCount: 72, looseTubeCount: 6, fibersPerTube: 12, deployedSpec: { color: '#6366f1', width: 3 }, defaultLevel: 'TRONCO' },
    ];
    for (const c of cables) {
        const exists = await prisma.templateCable.findFirst({ where: { name: c.name } });
        if (!exists) await prisma.templateCable.create({ data: c as any });
    }

    // 2. Template Splitters
    const splitters = [
        { name: 'Splitter 1:8 PLC', type: 'PLC', mode: 'Balanced', outputs: 8, attenuation: { loss: 10.5 } },
        { name: 'Splitter 1:16 PLC', type: 'PLC', mode: 'Balanced', outputs: 16, attenuation: { loss: 13.8 } },
        { name: 'Splitter 10/90 FBT', type: 'FBT', mode: 'Unbalanced', outputs: 2, attenuation: { ports: { "1": 10.5, "2": 0.5 } } },
    ];
    for (const s of splitters) {
        const exists = await prisma.templateSplitter.findFirst({ where: { name: s.name } });
        if (!exists) await prisma.templateSplitter.create({ data: s as any });
    }

    // 3. Template Boxes
    const boxes = [
        { name: 'CTO', type: 'CTO', model: 'Padrão', color: '#64748b' },
        { name: 'CEO', type: 'CEO', model: 'Padrão', color: '#334155' },
    ];
    for (const b of boxes) {
        const exists = await prisma.templateBox.findFirst({ where: { name: b.name } });
        if (!exists) await prisma.templateBox.create({ data: b as any });
    }

    // 4. Template Poles
    const poles = [
        { name: 'Poste Concreto Circular 11m/300daN', type: 'Concreto', height: 11, strength: 300, shape: 'Circular' },
    ];
    for (const p of poles) {
        const exists = await prisma.templatePole.findFirst({ where: { name: p.name } });
        if (!exists) await prisma.templatePole.create({ data: p });
    }

    // 5. Template Fusions
    const fusions = [
        { name: 'Fusão Padrão', attenuation: 0.05 },
    ];
    for (const f of fusions) {
        const exists = await prisma.templateFusion.findFirst({ where: { name: f.name } });
        if (!exists) await prisma.templateFusion.create({ data: f });
    }

    // 6. Template OLTs
    const olts = [
        { name: 'OLT GPON 16 Portas', slots: 1, portsPerSlot: 16, outputPower: 3.0 },
    ];
    for (const o of olts) {
        const exists = await prisma.templateOLT.findFirst({ where: { name: o.name } });
        if (!exists) await prisma.templateOLT.create({ data: o });
    }

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
