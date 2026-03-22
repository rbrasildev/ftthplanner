
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const prisma = new PrismaClient();

async function check() {
  const settings = await prisma.integrationSettings.findMany({
    select: {
      id: true,
      userId: true,
      sgpType: true,
      active: true,
      apiUrl: true,
      updatedAt: true
    }
  });
  fs.writeFileSync('settings_debug.json', JSON.stringify(settings, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
