
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const settings = await prisma.integrationSettings.findMany({
    include: { user: true }
  });
  console.log(JSON.stringify(settings, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
