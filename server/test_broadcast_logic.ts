
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testBroadcast() {
    const id = 'ced8cfb3-6aac-4409-93ae-1bc9ca3a0d3b';
    try {
        console.log('Testing broadcast for template:', id);
        const template = await (prisma as any).emailTemplate.findUnique({ where: { id } });
        if (!template) {
            console.log('Template not found');
            // Let's find any template
            const anyTemplate = await (prisma as any).emailTemplate.findFirst();
            if (anyTemplate) {
                console.log('Found another template:', anyTemplate.id);
            } else {
                console.log('No templates at all');
            }
            return;
        }

        console.log('Template found:', template.slug);

        const users = await (prisma as any).user.findMany({
            where: { active: true, email: { not: '' } },
            select: {
                email: true,
                username: true,
                company: {
                    select: { name: true }
                }
            }
        });
        console.log('Found users:', users.length);
        if (users.length > 0) {
            console.log('First user company:', users[0].company);
        }
    } catch (err: any) {
        console.error('Broadcast test error:', err);
    }
}

testBroadcast();
