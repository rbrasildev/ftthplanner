
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
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

// Quantos dias manter um backup AUTOMÁTICO antes de podar. Manuais ficam pra
// sempre. Sem isso, o disco crescia indefinidamente (auto-backup diário × N
// empresas × anos).
const BACKUP_RETENTION_DAYS = 7;

// Criptografia at-rest. Se BACKUP_ENCRYPTION_KEY estiver setada no .env, o
// backup é salvo como .json.gz.enc (gzip + AES-256-GCM). Sem a key, cai pro
// .json.gz (só gzip). Backups legados em .json plain continuam sendo lidos.
//
// Formato .json.gz.enc: [iv 12B][authTag 16B][ciphertext...]
//   Plaintext = gzip(json)
//
// IMPORTANTE: a key precisa ser estável entre deploys. Se mudar, backups
// antigos viram lixo. Recomendo gerar com `openssl rand -hex 32` e nunca
// commitar (só no .env do servidor).
const ALGO = 'aes-256-gcm';
const KEY: Buffer | null = process.env.BACKUP_ENCRYPTION_KEY
    ? crypto.createHash('sha256').update(process.env.BACKUP_ENCRYPTION_KEY).digest()
    : null;
if (!KEY) {
    logger.warn('[BackupService] BACKUP_ENCRYPTION_KEY não definida — backups serão salvos só com gzip (sem criptografia em repouso).');
}

const EXT_LEGACY = '.json';
const EXT_GZIP = '.json.gz';
const EXT_ENC = '.json.gz.enc';

function encodeBackup(jsonStr: string): { buffer: Buffer; ext: string } {
    const gzipped = zlib.gzipSync(jsonStr, { level: 9 });
    if (!KEY) return { buffer: gzipped, ext: EXT_GZIP };

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, KEY, iv);
    const ciphertext = Buffer.concat([cipher.update(gzipped), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { buffer: Buffer.concat([iv, authTag, ciphertext]), ext: EXT_ENC };
}

function decodeBackup(filename: string, buffer: Buffer): string {
    // Detecta formato pelos magic bytes em vez de confiar na extensão.
    // Motivos: browser pode renomear no download, user pode renomear manual,
    // arquivo pode ser baixado e re-uploaded com extensão "errada".
    //   0x7B `{` ou 0x5B `[` → plain JSON (ASCII)
    //   0x1F 0x8B          → gzip magic
    //   resto              → assume encrypted (IV + authTag + ciphertext)
    const first = buffer[0];
    const second = buffer[1];

    // Plain JSON
    if (first === 0x7B || first === 0x5B) {
        return buffer.toString('utf-8');
    }

    // Gzip puro
    if (first === 0x1F && second === 0x8B) {
        return zlib.gunzipSync(buffer).toString('utf-8');
    }

    // Senão, trata como encrypted (.json.gz.enc)
    if (!KEY) {
        throw new Error('Backup parece criptografado mas BACKUP_ENCRYPTION_KEY não está definida.');
    }
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(authTag);
    const gzipped = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return zlib.gunzipSync(gzipped).toString('utf-8');
}

export class BackupService {

    // Create a new backup (dump filtered data to JSON)
    static async createBackup(companyId: string, isManual = false): Promise<BackupFile> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const type = isManual ? 'manual' : 'auto';

            // Fetch ONLY company data.
            // Customers e Drops adicionados na v1.1 — sem eles o restore apagava
            // a base de clientes inteira sem recuperar nada (impacto operacional
            // catastrófico). Drops filtrados via relação customer.companyId.
            // Catalogs PERMITEM companyId (todas as 7 tabelas — splitter/cable/box/
            // pole/fusion/olt/gbic). Itens com companyId null são globais e ignorados.
            // IntegrationSettings é por user — filtrado via user.companyId.
            // Credenciais (apiToken/webhookSecret) já vêm encriptadas do DB —
            // backup carrega valores encriptados, restore funciona se a chave
            // de criptografia (ENCRYPTION_KEY) for a mesma.
            const data = {
                meta: {
                    createdAt: new Date(),
                    version: '1.2',
                    companyId: companyId
                },
                projects: await prisma.project.findMany({ where: { companyId } }),
                ctos: await prisma.cto.findMany({ where: { companyId } }),
                pops: await prisma.pop.findMany({ where: { companyId } }),
                cables: await prisma.cable.findMany({ where: { companyId } }),
                poles: await prisma.pole.findMany({ where: { companyId } }),
                customers: await prisma.customer.findMany({ where: { companyId, deletedAt: null } }),
                // Filtra drops cujo customer foi soft-deleted — sem isso, ficavam
                // órfãos no backup (FK violation no restore, já que o customer
                // não é re-inserido por causa do filtro deletedAt: null acima).
                drops: await prisma.drop.findMany({ where: { customer: { companyId, deletedAt: null } } }),
                catalogSplitters: await prisma.catalogSplitter.findMany({ where: { companyId } }),
                catalogCables: await prisma.catalogCable.findMany({ where: { companyId } }),
                catalogBoxes: await prisma.catalogBox.findMany({ where: { companyId } }),
                catalogPoles: await prisma.catalogPole.findMany({ where: { companyId } }),
                catalogFusions: await prisma.catalogFusion.findMany({ where: { companyId } }),
                catalogOLTs: await prisma.catalogOLT.findMany({ where: { companyId } }),
                catalogGbics: await prisma.catalogGbic.findMany({ where: { companyId } }),
                integrationSettings: await prisma.integrationSettings.findMany({ where: { user: { companyId } } }),
            };

            // Encode: gzip + (opcionalmente) AES-256-GCM. Extensão indica o formato.
            // JSON sem indentação no encode pra reduzir o tamanho antes do gzip.
            const { buffer, ext } = encodeBackup(JSON.stringify(data));
            const filename = `backup-${companyId}-${type}-${timestamp}${ext}`;
            const filepath = path.join(BACKUP_DIR, filename);

            await fs.promises.writeFile(filepath, buffer);

            const stats = await fs.promises.stat(filepath);

            const catalogTotal = data.catalogSplitters.length + data.catalogCables.length + data.catalogBoxes.length + data.catalogPoles.length + data.catalogFusions.length + data.catalogOLTs.length + data.catalogGbics.length;
            logger.info(`[BackupService] Backup created: ${filename} (Company: ${companyId}) — ${data.customers.length} clientes, ${data.drops.length} drops, ${catalogTotal} catalog items, ${data.integrationSettings.length} integrations, ${(stats.size / 1024).toFixed(1)} KB`);

            // Retenção: poda backups antigos pra disco não estourar. Roda em
            // best-effort — falha aqui não invalida o backup recém-criado.
            this.pruneOldBackups(companyId).catch(err =>
                logger.warn(`[BackupService] Pruning failed for ${companyId}: ${err.message}`)
            );

            return {
                filename,
                size: stats.size,
                createdAt: stats.birthtime
            };

        } catch (error: any) {
            logger.error(`[BackupService] Failed to create backup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Apaga backups AUTOMÁTICOS com mais de BACKUP_RETENTION_DAYS dias pra
     * empresa. Manuais ficam pra sempre — usuário criou pra ser snapshot,
     * deletar surpreenderia. Roda automaticamente depois de cada createBackup.
     */
    static async pruneOldBackups(companyId: string): Promise<number> {
        const all = await this.listBackups(companyId);
        const cutoff = Date.now() - (BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const toDelete = all.filter(f =>
            f.filename.includes('-auto-') && f.createdAt.getTime() < cutoff
        );
        if (toDelete.length === 0) return 0;

        let deleted = 0;
        for (const f of toDelete) {
            try {
                await fs.promises.unlink(path.join(BACKUP_DIR, f.filename));
                deleted++;
            } catch (err: any) {
                logger.warn(`[BackupService] Failed to prune ${f.filename}: ${err.message}`);
            }
        }
        if (deleted > 0) {
            logger.info(`[BackupService] Pruned ${deleted} backups >${BACKUP_RETENTION_DAYS} dias for company ${companyId}`);
        }
        return deleted;
    }

    // Restore backup
    static async restoreBackup(companyId: string, jsonData: any): Promise<void> {
        // Validation
        if (jsonData.meta?.companyId && jsonData.meta.companyId !== companyId) {
            throw new Error(`Backup belongs to company ${jsonData.meta.companyId}, but you are trying to restore to ${companyId}`);
        }

        // Transactional Restore — timeout estendido pra 2 minutos. O restore
        // faz ~17 deleteMany + ~17 createMany (catalogs, network, customers,
        // drops, integrations); empresas grandes podem facilmente passar dos
        // 5s default e cair em P2028. maxWait estendido também porque empresa
        // ativa pode estar concorrendo com sync SGP, dragging etc.
        await prisma.$transaction(async (tx) => {
            // 1. Delete existing data for this company.
            // Ordem importa por causa de FKs:
            //   drops → customer (FK CASCADE) — apaga drops primeiro
            //   customers → cto (FK não-cascade)
            //   cables → nodes
            //   ctos/pops/poles → project
            logger.info(`[Restore] Clearing data for company ${companyId}...`);

            // Drops cascateiam quando o customer some, mas apaga explicitamente
            // por garantia (caso o customer tenha sido orfanado em algum bug).
            await tx.drop.deleteMany({ where: { customer: { companyId } } });
            await tx.customer.deleteMany({ where: { companyId } });

            await tx.cable.deleteMany({ where: { companyId } });
            await tx.pole.deleteMany({ where: { companyId } });
            await tx.cto.deleteMany({ where: { companyId } });
            await tx.pop.deleteMany({ where: { companyId } });
            await tx.project.deleteMany({ where: { companyId } });

            // Catalogs (v1.2+) — só os da própria empresa. Catalogs globais
            // (companyId null) ficam intocados, são compartilhados entre tenants.
            await tx.catalogSplitter.deleteMany({ where: { companyId } });
            await tx.catalogCable.deleteMany({ where: { companyId } });
            await tx.catalogBox.deleteMany({ where: { companyId } });
            await tx.catalogPole.deleteMany({ where: { companyId } });
            await tx.catalogFusion.deleteMany({ where: { companyId } });
            await tx.catalogOLT.deleteMany({ where: { companyId } });
            await tx.catalogGbic.deleteMany({ where: { companyId } });

            // IntegrationSettings — via user.companyId. Se o user que tinha a
            // integração foi deletado, o registro órfão também some.
            await tx.integrationSettings.deleteMany({ where: { user: { companyId } } });

            logger.info(`[Restore] inserting data...`);

            // 2. Insert Data — ordem reversa pra respeitar FKs.
            // Catalogs primeiro (são referenciados por cables/etc via catalogId).
            if (jsonData.catalogSplitters?.length) {
                await tx.catalogSplitter.createMany({ data: jsonData.catalogSplitters, skipDuplicates: true });
            }
            if (jsonData.catalogCables?.length) {
                await tx.catalogCable.createMany({ data: jsonData.catalogCables, skipDuplicates: true });
            }
            if (jsonData.catalogBoxes?.length) {
                await tx.catalogBox.createMany({ data: jsonData.catalogBoxes, skipDuplicates: true });
            }
            if (jsonData.catalogPoles?.length) {
                await tx.catalogPole.createMany({ data: jsonData.catalogPoles, skipDuplicates: true });
            }
            if (jsonData.catalogFusions?.length) {
                await tx.catalogFusion.createMany({ data: jsonData.catalogFusions, skipDuplicates: true });
            }
            if (jsonData.catalogOLTs?.length) {
                await tx.catalogOLT.createMany({ data: jsonData.catalogOLTs, skipDuplicates: true });
            }
            if (jsonData.catalogGbics?.length) {
                await tx.catalogGbic.createMany({ data: jsonData.catalogGbics, skipDuplicates: true });
            }

            if (jsonData.projects?.length) {
                await tx.project.createMany({ data: jsonData.projects });
            }
            if (jsonData.poles?.length) {
                await tx.pole.createMany({ data: jsonData.poles });
            }
            if (jsonData.pops?.length) {
                await tx.pop.createMany({ data: jsonData.pops });
            }
            if (jsonData.ctos?.length) {
                await tx.cto.createMany({ data: jsonData.ctos });
            }
            if (jsonData.cables?.length) {
                await tx.cable.createMany({ data: jsonData.cables });
            }
            // v1.1+: customers depende de cto (FK opcional), tem que vir depois.
            // Drops dependem de customer + cto.
            if (jsonData.customers?.length) {
                await tx.customer.createMany({ data: jsonData.customers });
            }
            if (jsonData.drops?.length) {
                // Filtra drops órfãos defensivamente — backups antigos podem ter
                // drops cujo customer foi excluído entre o snapshot e o restore,
                // OU cuja customer foi filtrada por soft-delete (bug em backups
                // criados antes do fix de filtro). Insere só o que tem customer
                // válido no JSON.
                const customerIds = new Set((jsonData.customers || []).map((c: any) => c.id));
                const validDrops = jsonData.drops.filter((d: any) => customerIds.has(d.customerId));
                const orphans = jsonData.drops.length - validDrops.length;
                if (orphans > 0) {
                    logger.warn(`[Restore] Skipping ${orphans} orphaned drops (customer não está no backup)`);
                }
                if (validDrops.length > 0) {
                    await tx.drop.createMany({ data: validDrops });
                }
            }

            // IntegrationSettings — depende de user existir. Filtra os que ainda
            // têm user válido pra não quebrar FK (user pode ter sido deletado
            // entre o backup e o restore).
            if (jsonData.integrationSettings?.length) {
                const userIds = [...new Set(jsonData.integrationSettings.map((i: any) => i.userId))];
                const existingUsers = await tx.user.findMany({
                    where: { id: { in: userIds as string[] }, companyId },
                    select: { id: true }
                });
                const validUserIds = new Set(existingUsers.map(u => u.id));
                const validIntegrations = jsonData.integrationSettings.filter((i: any) => validUserIds.has(i.userId));
                if (validIntegrations.length > 0) {
                    await tx.integrationSettings.createMany({ data: validIntegrations, skipDuplicates: true });
                }
            }

            const restoreVersion = jsonData.meta?.version || '1.0';
            logger.info(`[Restore] Restore complete for company ${companyId} (backup v${restoreVersion}): ${jsonData.customers?.length || 0} clientes, ${jsonData.drops?.length || 0} drops, ${jsonData.integrationSettings?.length || 0} integrations`);
        }, {
            timeout: 120_000, // 2 min (default 5s) — restore é big-batch, várias dezenas de createMany
            maxWait: 10_000   // 10s pra adquirir conexão (default 2s)
        });
    }

    // List all backups for a company
    static async listBackups(companyId: string): Promise<BackupFile[]> {
        try {
            const files = await fs.promises.readdir(BACKUP_DIR);
            const validExts = [EXT_LEGACY, EXT_GZIP, EXT_ENC];

            const fileStats = await Promise.all(
                files
                    .filter(f => validExts.some(ext => f.endsWith(ext)) && f.includes(`backup-${companyId}-`))
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

        } catch (error: any) {
            logger.error(`[BackupService] Failed to list backups: ${error.message}`);
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
        } catch (error: any) {
            logger.error(`[BackupService] Failed to delete backup: ${error.message}`);
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

    // Read backup file content — decifra/descomprime automaticamente baseado
    // na extensão. Funciona com legados (.json), compressão simples (.json.gz)
    // e criptografados (.json.gz.enc).
    static async readBackupFile(filename: string): Promise<any> {
        const filepath = path.join(BACKUP_DIR, filename);
        const buffer = await fs.promises.readFile(filepath);
        const jsonStr = decodeBackup(filename, buffer);
        return JSON.parse(jsonStr);
    }

    /**
     * Decodifica buffer cru de um arquivo de backup uploadeado. Detecta o
     * formato pela extensão no filename — usado pelo uploadAndRestore quando
     * o usuário sobe direto um .json.gz ou .json.gz.enc do disco do servidor
     * (em vez do .json baixado pelo painel).
     */
    static parseUploadedBackup(filename: string, buffer: Buffer): any {
        const jsonStr = decodeBackup(filename, buffer);
        return JSON.parse(jsonStr);
    }

    /**
     * Retorna o JSON plain do backup pra streaming no download. O endpoint
     * envia esse string como anexo .json — usuário baixa um arquivo legível.
     * Sem isso, o user baixaria bytes criptografados/gzipados que não dão
     * pra inspecionar nem re-upload em outro ambiente.
     */
    static async getBackupAsPlainJson(filename: string, companyId: string): Promise<string | null> {
        if (!filename.includes(companyId)) return null;
        const cleanName = path.basename(filename);
        const filepath = path.join(BACKUP_DIR, cleanName);
        if (!fs.existsSync(filepath)) return null;
        const buffer = await fs.promises.readFile(filepath);
        return decodeBackup(cleanName, buffer);
    }

    /**
     * Roda os backups automáticos pra todas as empresas ACTIVE com plan.backupEnabled.
     * Chamado pelo cronJobs.ts (node-cron) — antes era um setInterval interno que
     * polleva a cada minuto checando se eram 02h, frágil se o servidor reiniciasse
     * no horário (perdia o backup do dia).
     */
    static async runScheduledBackups(): Promise<void> {
        try {
            const companies = await prisma.company.findMany({
                where: { status: 'ACTIVE' },
                include: { plan: true }
            });
            let created = 0, skipped = 0, failed = 0;
            for (const comp of companies) {
                if (!comp.plan?.backupEnabled) {
                    skipped++;
                    continue;
                }
                try {
                    await this.createBackup(comp.id, false);
                    created++;
                } catch (err: any) {
                    failed++;
                    logger.error(`[BackupService] Scheduled backup failed for ${comp.id}: ${err.message}`);
                }
            }
            logger.info(`[BackupService] Scheduled backups: ${created} created, ${skipped} skipped (no plan), ${failed} failed`);
        } catch (err: any) {
            logger.error(`[BackupService] runScheduledBackups failed: ${err.message}`);
        }
    }
}
