
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api'; // Assuming server runs on 3000

async function main() {
    console.log("Starting Multi-Tenancy Verification...");

    // cleanup
    // await prisma.user.deleteMany({ where: { username: { in: ['tenant_a_user', 'tenant_b_user'] } } });
    // await prisma.company.deleteMany({ where: { name: { in: ["tenant_a_user's Company", "tenant_b_user's Company"] } } });

    // 1. Register User A
    console.log("1. Registering User A...");
    let tokenA = "";
    try {
        await axios.post(`${API_URL}/auth/register`, { username: 'tenant_a_user', password: 'password123' });
    } catch (e: any) {
        // console.log("User A might already exist, trying login");
    }

    const loginA = await axios.post(`${API_URL}/auth/login`, { username: 'tenant_a_user', password: 'password123' });
    tokenA = loginA.data.token;
    const companyIdA = loginA.data.user.companyId;
    console.log(`   User A Logged in. Company: ${companyIdA}`);

    // 2. Register User B
    console.log("2. Registering User B...");
    let tokenB = "";
    try {
        await axios.post(`${API_URL}/auth/register`, { username: 'tenant_b_user', password: 'password123' });
    } catch (e: any) {
        // User B might exist
    }

    const loginB = await axios.post(`${API_URL}/auth/login`, { username: 'tenant_b_user', password: 'password123' });
    tokenB = loginB.data.token;
    const companyIdB = loginB.data.user.companyId;
    console.log(`   User B Logged in. Company: ${companyIdB}`);

    if (companyIdA === companyIdB) {
        console.error("CRITICAL: Companies should be different!");
        process.exit(1);
    }

    // 3. User A creates Project A
    console.log("3. User A creates Project A...");
    const projA = await axios.post(`${API_URL}/projects`, {
        name: "Project A Secret",
        centerLat: 0,
        centerLng: 0
    }, { headers: { Authorization: `Bearer ${tokenA}` } });
    const projectAId = projA.data.id;
    console.log(`   Project A created: ${projectAId}`);

    // 4. User B lists projects (Should NOT see Project A)
    console.log("4. User B listing projects...");
    const listB = await axios.get(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const userBHasProjectA = listB.data.some((p: any) => p.id === projectAId);

    if (userBHasProjectA) {
        console.error("FAIL: User B can see User A's project in list!");
        process.exit(1);
    } else {
        console.log("   PASS: User B cannot see Project A in list.");
    }

    // 5. User B tries to get Project A directly
    console.log("5. User B trying to access Project A details...");
    try {
        await axios.get(`${API_URL}/projects/${projectAId}`, { headers: { Authorization: `Bearer ${tokenB}` } });
        console.error("FAIL: User B accessed Project A details (Should be 404/403)!");
        process.exit(1);
    } catch (e: any) {
        if (e.response && e.response.status === 404) {
            console.log("   PASS: User B got 404 when accessing Project A.");
        } else {
            console.error(`   FAIL: Unexpected error code: ${e.response?.status}`);
            process.exit(1);
        }
    }

    console.log("VERIFICATION SUCCESSFUL: Multi-tenancy isolation confirmed.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
