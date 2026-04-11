import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

    // 2. Criar ou Atualizar Usuário Admin.
    // upsert({ where: { email } }) não é mais confiável porque o índice
    // único de email virou parcial (só entre ativos). Usamos findFirst
    // filtrando deletedAt:null e depois create/update explícito.
    const existing = await prisma.user.findFirst({
        where: { email: adminEmail, deletedAt: null }
    });

    const user = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: {
                username: adminUsername,
                passwordHash: hashedPassword,
                role: UserRole.SUPER_ADMIN,
                companyId: company?.id,
                active: true
            }
        })
        : await prisma.user.create({
            data: {
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
