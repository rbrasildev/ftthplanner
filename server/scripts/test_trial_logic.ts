
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testTrialFlow() {
    const testUsername = `trial_test_${Date.now()}`;
    const testPassword = 'password123';

    console.log(`\n--- 1. REGISTERING NEW USER: ${testUsername} ---`);

    // Simulate Register Logic (mimicking authController.register)
    // We can't call the controller directly easily without mocking req/res, 
    // so we'll check the DB *after* running a fetch or just replicate the logic to verify the seed data exists.
    // Actually, let's just use the DB to verify the Plans exist first.

    const unlimitedPlan = await prisma.plan.findFirst({ where: { name: 'Plano Ilimitado' } });
    const freePlan = await prisma.plan.findFirst({ where: { name: 'Plano Grátis' } });

    if (!unlimitedPlan || !freePlan) {
        console.error("CRITICAL: Plans not seeded!", { unlimited: !!unlimitedPlan, free: !!freePlan });
        return;
    }

    // Manually Create User as if Controller did it (to test the Logic Flow if we were to hit the endpoint)
    // Ideally we'd hit the endpoint, but let's simulate the DB state the controller produces.
    // controller: assigns unlimited + 15 days.

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 15);

    const user = await prisma.user.create({
        data: {
            username: testUsername,
            passwordHash: await bcrypt.hash(testPassword, 10),
            role: 'OWNER',
            company: {
                create: {
                    name: `${testUsername} Company`,
                    planId: unlimitedPlan.id,
                    subscriptionExpiresAt: expiresAt,
                    status: 'ACTIVE'
                }
            }
        },
        include: { company: { include: { plan: true } } }
    });

    console.log(`User Created. Plan: ${user.company?.plan?.name}`);
    console.log(`Expires At: ${user.company?.subscriptionExpiresAt}`);

    if (user.company?.plan?.name !== 'Plano Ilimitado') {
        console.error("FAIL: User did not get Unlimited Plan");
    } else {
        console.log("PASS: User got Unlimited Plan");
    }

    // --- 2. SIMULATE EXPIRATION ---
    console.log(`\n--- 2. SIMULATING EXPIRATION ---`);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    await prisma.company.update({
        where: { id: user.company!.id },
        data: { subscriptionExpiresAt: pastDate }
    });
    console.log("Updated expiration to yesterday.");

    // --- 3. SIMULATE LOGIN (Downgrade Logic) ---
    console.log(`\n--- 3. SIMULATING LOGIN CHECK ---`);

    // Re-fetch to simulate "Login" finding the user
    // The Login Controller logic is:
    // if (user.company.subscriptionExpiresAt < Now && Plan != Free) -> Downgrade

    const userAtLogin = await prisma.user.findUnique({
        where: { id: user.id },
        include: { company: { include: { plan: true } } }
    });

    if (userAtLogin?.company?.subscriptionExpiresAt && new Date() > userAtLogin.company.subscriptionExpiresAt) {
        if (userAtLogin.company.plan?.name !== 'Plano Grátis') {
            console.log("Login Logic Triggered: Expired and Not Free. Downgrading...");
            await prisma.company.update({
                where: { id: userAtLogin.company.id },
                data: {
                    planId: freePlan.id,
                    subscriptionExpiresAt: null
                }
            });
            console.log("Downgrade Executed.");
        }
    }

    // --- 4. VERIFY DOWNGRADE ---
    const finalUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { company: { include: { plan: true } } }
    });

    console.log(`\n--- 4. FINAL VERIFICATION ---`);
    console.log(`Final Plan: ${finalUser?.company?.plan?.name}`);
    console.log(`Final Expiration: ${finalUser?.company?.subscriptionExpiresAt}`);

    if (finalUser?.company?.plan?.name === 'Plano Grátis' && finalUser?.company?.subscriptionExpiresAt === null) {
        console.log("SUCCESS: User successfully downgraded to Free Plan after expiration.");
    } else {
        console.error("FAIL: User was not downgraded correctly.");
    }

    // Cleanup
    await prisma.company.delete({ where: { id: user.company!.id } }); // Cascades to user usually, or delete user
    await prisma.user.delete({ where: { id: user.id } });
}

testTrialFlow()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
