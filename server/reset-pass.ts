
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function reset() {
    const hashedPassword = await bcrypt.hash('123456', 10);
    const user = await prisma.user.findFirst();
    if (user) {
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword, active: true }
        });
        console.log(`Password reset for: ${user.email}`);
    }
}
reset().finally(() => prisma.$disconnect());
