
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export interface BackupFile {
    filename: string;
    size: number;
    createdAt: Date;
    companyId?: string; // Metadata usually in filename or content, but here just file stats
}

export class BackupService {

    // Create a new backup (dump filtered data to JSON)
    static async createBackup(companyId: string, isManual = false): Promise<BackupFile> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const type = isManual ? 'manual' : 'auto';
            // Include companyId in filename for safety/identification: backup-cols-{companyId}-manual-date.json
            const filename = `backup-${companyId}-${type}-${timestamp}.json`;
            const filepath = path.join(BACKUP_DIR, filename);

            // Fetch ONLY company data
            const data = {
                meta: {
                    createdAt: new Date(),
                    version: '1.0',
                    companyId: companyId
                },
                // We do NOT backup Users or Company record itself to prevent lockout/overwrite issues.
                // We backup the NETWORK DATA.
                projects: await prisma.project.findMany({ where: { companyId } }),
                ctos: await prisma.cto.findMany({ where: { companyId } }),
                pops: await prisma.pop.findMany({ where: { companyId } }),
                cables: await prisma.cable.findMany({ where: { companyId } }),
                poles: await prisma.pole.findMany({ where: { companyId } }),
                // Catalogs are usually shared or we need to check if they have companyId.
                // Based on schema, catalogs don't have companyId (except maybe some custom ones?). 
                // Schema check: CatalogSplitter/Cable/Box/Pole/Fusion/OLT do NOT have companyId. They are global.
                // So we do NOT backup them here (or we assume they are static). 
            };

            await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));

            const stats = await fs.promises.stat(filepath);

            console.log(`[BackupService] Backup created: ${filename} (Company: ${companyId})`);

            return {
                filename,
                size: stats.size,
                createdAt: stats.birthtime
            };

        } catch (error) {
            console.error('[BackupService] Failed to create backup:', error);
            throw error;
        }
    }

    // Restore backup
    static async restoreBackup(companyId: string, jsonData: any): Promise<void> {
        // Validation
        if (jsonData.meta?.companyId && jsonData.meta.companyId !== companyId) {
            throw new Error(`Backup belongs to company ${jsonData.meta.companyId}, but you are trying to restore to ${companyId}`);
        }

        // Transactional Restore
        await prisma.$transaction(async (tx) => {
            // 1. Delete existing data for this company
            // Order matters due to Foreign Keys. 
            // Cables depend on Nodes (CTO/POP). CTO/POP depend on Project.
            // But simpler: Cascade delete on Project usually handles it?
            // Schema check: Project->onDelete:Cascade -> Cto/Pop/Cable?
            // Cto: project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
            // Cable: project Project @relation(...) onDelete: Cascade
            // So deleting Projects should clear most things.
            // However, orphan items (not in project?) might exist if we allow that.
            // Ideally we query items by companyId and delete.

            console.log(`[Restore] Clearing data for company ${companyId}...`);

            // Delete Cables first (refers to Nodes)
            await tx.cable.deleteMany({ where: { companyId } });

            // Delete CTRs/POPs/Poles
            await tx.pole.deleteMany({ where: { companyId } });
            await tx.cto.deleteMany({ where: { companyId } });
            await tx.pop.deleteMany({ where: { companyId } });

            // Delete Projects (which would cascade delete anyway, but explicit is safe)
            await tx.project.deleteMany({ where: { companyId } });

            console.log(`[Restore] inserting data...`);

            // 2. Insert Data
            // Projects
            if (jsonData.projects?.length) {
                await tx.project.createMany({ data: jsonData.projects });
            }

            // Poles
            if (jsonData.poles?.length) {
                await tx.pole.createMany({ data: jsonData.poles });
            }

            // POPs (Create first as they might be parents?)
            if (jsonData.pops?.length) {
                await tx.pop.createMany({ data: jsonData.pops });
            }

            // CTOs
            if (jsonData.ctos?.length) {
                await tx.cto.createMany({ data: jsonData.ctos });
            }

            // Cables
            if (jsonData.cables?.length) {
                await tx.cable.createMany({ data: jsonData.cables });
            }

            console.log(`[Restore] Restore complete for company ${companyId}`);
        });
    }

    // List all backups for a company
    static async listBackups(companyId: string): Promise<BackupFile[]> {
        try {
            const files = await fs.promises.readdir(BACKUP_DIR);

            const fileStats = await Promise.all(
                files
                    .filter(f => f.endsWith('.json') && f.includes(`backup-${companyId}-`)) // Filter by companyId in filename
                    .map(async (f) => {
                        const stats = await fs.promises.stat(path.join(BACKUP_DIR, f));
                        return {
                            filename: f,
                            size: stats.size,
                            createdAt: stats.birthtime
                        };
                    })
            );

            // Sort by newst first
            return fileStats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        } catch (error) {
            console.error('[BackupService] Failed to list backups:', error);
            return [];
        }
    }

    // Delete a backup
    static async deleteBackup(filename: string, companyId: string): Promise<boolean> {
        try {
            if (!filename.includes(companyId)) {
                // basic security check to prevent deleting others backups
                throw new Error("Unauthorized access to this backup file");
            }

            const cleanName = path.basename(filename);
            const filepath = path.join(BACKUP_DIR, cleanName);

            if (fs.existsSync(filepath)) {
                await fs.promises.unlink(filepath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[BackupService] Failed to delete backup:', error);
            throw error;
        }
    }

    // Get absolute path for download
    static getBackupPath(filename: string, companyId: string): string | null {
        if (!filename.includes(companyId)) return null;

        const cleanName = path.basename(filename);
        const filepath = path.join(BACKUP_DIR, cleanName);
        if (fs.existsSync(filepath)) {
            return filepath;
        }
        return null;
    }

    // Read backup file content
    static async readBackupFile(filename: string): Promise<any> {
        const filepath = path.join(BACKUP_DIR, filename);
        const content = await fs.promises.readFile(filepath, 'utf-8');
        return JSON.parse(content);
    }

    // Daily Schedule - This needs to run for ALL companies.
    // Since we don't have a list of all active companies easily in a static method without query,
    // we can iterate all companies.
    static initScheduledBackups() {
        console.log('[BackupService] Initializing scheduled backups (Time: 02:00 AM)');

        setInterval(async () => {
            const now = new Date();
            // Run at 02:00 AM
            if (now.getHours() === 2 && now.getMinutes() === 0) {
                try {
                    const companies = await prisma.company.findMany({ where: { status: 'ACTIVE' } });
                    for (const comp of companies) {
                        await this.createBackup(comp.id, false);
                    }
                } catch (err) {
                    console.error("Scheduled backup failed", err);
                }
            }
        }, 60 * 1000);
    }
}
