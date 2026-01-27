
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$connect();
        console.log('CONEXÃO BEM SUCEDIDA!');
        const users = await prisma.user.count();
        console.log('Total de usuários:', users);
    } catch (e) {
        console.error('ERRO DE CONEXÃO:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
