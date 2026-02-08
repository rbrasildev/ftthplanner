
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seed() {
    const resetTemplate = {
        slug: 'password-reset',
        name: 'Recuperação de Senha',
        subject: 'Recuperação de Senha - {{company_name}}',
        body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg: 12px;">
        <h2 style="color: #4f46e5;">Olá, {{username}}!</h2>
        <p>Recebemos uma solicitação para redefinir sua senha no <strong>{{company_name}}</strong>.</p>
        <p>Clique no botão abaixo para escolher uma nova senha. Este link expira em 1 hora.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{reset_url}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Redefinir Senha</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #94a3b8; font-size: 12px;">Equipe {{company_name}}</p>
      </div>
    `,
        variables: ['username', 'reset_url', 'company_name']
    };

    try {
        const existing = await prisma.emailTemplate.findUnique({ where: { slug: resetTemplate.slug } });
        if (existing) {
            console.log('Template password-reset already exists. Updating...');
            await prisma.emailTemplate.update({
                where: { slug: resetTemplate.slug },
                data: resetTemplate
            });
        } else {
            console.log('Creating password-reset template...');
            await prisma.emailTemplate.create({ data: resetTemplate });
        }
        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
