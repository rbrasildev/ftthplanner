/**
 * One-time migration script to encrypt existing IntegrationSettings
 * sensitive fields (apiToken, webhookSecret) in the database.
 *
 * Usage: npx ts-node scripts/encrypt-existing-settings.ts
 *
 * Safe to run multiple times — skips already encrypted values.
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

import { encryptIfNeeded, isEncrypted } from '../src/lib/encryption';

const prisma = new PrismaClient();

async function main() {
    const settings = await prisma.integrationSettings.findMany();
    let updated = 0;

    for (const s of settings) {
        const updates: Record<string, string> = {};

        if (s.apiToken && !isEncrypted(s.apiToken)) {
            updates.apiToken = encryptIfNeeded(s.apiToken);
        }
        if (s.webhookSecret && !isEncrypted(s.webhookSecret)) {
            updates.webhookSecret = encryptIfNeeded(s.webhookSecret);
        }

        if (Object.keys(updates).length > 0) {
            await prisma.integrationSettings.update({
                where: { id: s.id },
                data: updates,
            });
            updated++;
            console.log(`[OK] Encrypted settings for id=${s.id} (user=${s.userId}, type=${s.sgpType})`);
        } else {
            console.log(`[SKIP] Already encrypted: id=${s.id}`);
        }
    }

    console.log(`\nDone. Updated ${updated} of ${settings.length} records.`);
}

main()
    .catch((e) => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
