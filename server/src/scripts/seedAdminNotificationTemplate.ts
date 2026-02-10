import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding Admin Notification Template...");

    const slug = 'admin-new-client-notification';

    // Default content (matches LanguageContext pt-BR)
    const templateData = {
        slug: slug,
        name: 'Notificação de Novo Cliente (Admin)',
        subject: 'Novo Cliente Cadastrado: {{company}}',
        body: 'Um novo cliente se cadastrou no sistema.<br><br><b>Detalhes:</b><br><ul><li><b>Usuário:</b> {{username}}</li><li><b>Empresa:</b> {{company}}</li><li><b>E-mail:</b> {{email}}</li><li><b>Telefone:</b> {{phone}}</li><li><b>Plano:</b> {{plan}}</li><li><b>Origem:</b> {{source}}</li></ul>',
        variables: ['username', 'company', 'email', 'phone', 'plan', 'source']
    };

    const template = await prisma.emailTemplate.upsert({
        where: { slug: slug },
        update: templateData,
        create: templateData
    });

    console.log(`Template ${template.slug} created/updated successfully.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
