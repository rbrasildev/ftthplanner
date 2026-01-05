
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUGGING PLANS & COMPANIES ---');

    console.log('\n1. ALL PLANS:');
    const plans = await prisma.plan.findMany();
    for (const p of plans) {
        console.log(`Plan: ${p.name}`);
        console.log(`ID: ${p.id}`);
        console.log(`Limits:`, JSON.stringify(p.limits));
        console.log('---');
    }

    console.log('\n2. USERS & SUCCESSFUL COMPANIES:');
    const users = await prisma.user.findMany({
        include: {
            company: {
                include: {
                    plan: true
                }
            }
        }
    });

    for (const u of users) {
        console.log(`User: ${u.username} (${u.role})`);
        if (u.company) {
            console.log(`  Company: ${u.company.name}`);
            console.log(`  Plan Linked: ${u.company.plan ? u.company.plan.name : 'NONE'}`);
            console.log(`  Plan ID: ${u.company.planId}`);
            if (u.company.plan) {
                console.log(`  Effective Limits:`, JSON.stringify(u.company.plan.limits));
            }
        } else {
            console.log('  No Company');
        }
        console.log('---');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
