import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando Seed do Super Admin ---');

    const adminEmail = 'admin@ftthplanner.com';
    const adminUsername = 'admin';
    const adminPassword = 'admin';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // 1. Garantir que uma Empresa de Sistema exista (opcional, para integridade)
    let company = await prisma.company.findFirst({ where: { name: 'Admin System' } });

    if (!company) {
        const anyCompany = await prisma.company.findFirst();
        if (anyCompany) {
            company = anyCompany;
        } else {
            console.log('Criando Empresa do Administrador...');
            company = await prisma.company.create({
                data: {
                    name: 'Admin System',
                    status: 'ACTIVE'
                }
            });
        }
    }

    // 2. Criar ou Atualizar UsuÃ¡rio Admin
    // Verificamos pelo e-mail que Ã© um campo Ãºnico obrigatÃ³rio
    const user = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            username: adminUsername,
            passwordHash: hashedPassword,
            role: UserRole.SUPER_ADMIN,
            companyId: company?.id,
            active: true
        },
        create: {
            email: adminEmail,
            username: adminUsername,
            passwordHash: hashedPassword,
            role: UserRole.SUPER_ADMIN,
            companyId: company?.id,
            active: true
        }
    });

    console.log(`
    âœ… Super Admin configurado com sucesso!
    Login (E-mail): ${user.email}
    Senha: ${adminPassword}
    Nome de UsuÃ¡rio: ${user.username}
    Role: ${user.role}
    `);
}

main()
    .catch((e) => {
        console.error('âŒ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
