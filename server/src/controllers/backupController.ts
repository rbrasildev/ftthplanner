
import { Request, Response } from 'express';
import { BackupService } from '../services/BackupService';

// Assuming req.user is populated by auth middleware
// interface AuthenticatedRequest extends Request {
//     user?: {
//         id: string;
//         role: string;
//         companyId: string;
//     }
// }
// We can use (req as any).user
import { prisma } from '../lib/prisma';

const checkBackupPermission = async (companyId: string) => {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { plan: true }
    });
    return company?.plan?.backupEnabled || false;
};

export const listBackups = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized: No company ID' });
        }

        if (!(await checkBackupPermission(user.companyId)) && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Seu plano atual não inclui a funcionalidade de backup.' });
        }

        const backups = await BackupService.listBackups(user.companyId);
        res.json(backups);
    } catch (error: any) {
        console.error('[ListBackups] Failed:', error);
        res.status(500).json({
            error: 'Falha ao listar backups',
            details: error?.message || String(error)
        });
    }
};

export const createBackup = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized: No company ID' });
        }

        if (!(await checkBackupPermission(user.companyId)) && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Seu plano atual não inclui a funcionalidade de backup.' });
        }

        const backup = await BackupService.createBackup(user.companyId, true); // true = manual
        res.json(backup);
    } catch (error: any) {
        console.error('[CreateBackup] Failed:', error);
        res.status(500).json({
            error: 'Falha ao criar backup',
            details: error?.message || String(error)
        });
    }
};

export const deleteBackup = async (req: Request, res: Response) => {
    try {
        const { filename } = req.params;
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const success = await BackupService.deleteBackup(filename, user.companyId);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Backup not found or unauthorized' });
        }
    } catch (error: any) {
        console.error('[DeleteBackup] Failed:', error);
        res.status(500).json({
            error: 'Falha ao excluir backup',
            details: error?.message || String(error)
        });
    }
};

export const downloadBackup = async (req: Request, res: Response) => {
    try {
        const { filename } = req.params;
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Decifra + descomprime server-side e envia JSON plano. Cliente sempre
        // recebe formato legível independente de como tá salvo no disco
        // (legado .json, gzip ou criptografado).
        const jsonStr = await BackupService.getBackupAsPlainJson(filename, user.companyId);
        if (jsonStr === null) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        // Nome de download sempre .json — abstrai o formato interno.
        const downloadName = filename.replace(/\.(json\.gz\.enc|json\.gz|json)$/, '.json');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.send(jsonStr);
    } catch (error: any) {
        console.error('[DownloadBackup] Failed:', error);
        res.status(500).json({
            error: 'Falha ao baixar backup',
            details: error?.message || String(error)
        });
    }
};

export const restoreBackup = async (req: Request, res: Response) => {
    try {
        const { filename } = req.params;
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!(await checkBackupPermission(user.companyId)) && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Seu plano atual não inclui a funcionalidade de backup.' });
        }

        // Security check: ensure file belongs to company
        if (!filename.includes(user.companyId)) {
            return res.status(403).json({ error: 'Invalid backup file for this company' });
        }

        const data = await BackupService.readBackupFile(filename);
        await BackupService.restoreBackup(user.companyId, data);

        res.json({ success: true, message: 'Restore completed successfully' });

    } catch (error: any) {
        // Loga stack completo + manda o motivo real pra UI (admin/owner é
        // confiável e precisa do detalhe pra diagnosticar). Generic 500 sem
        // mensagem deixava o user/dev no escuro.
        console.error('[Restore] Failed:', error);
        res.status(500).json({
            error: 'Falha ao restaurar backup',
            details: error?.message || String(error)
        });
    }
};

// Handle file upload and restore
export const uploadAndRestore = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!(await checkBackupPermission(user.companyId)) && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Seu plano atual não inclui a funcionalidade de backup.' });
        }

        // Aceita 2 formatos:
        //   1. application/octet-stream + header X-Backup-Filename → arquivo
        //      binário (.json.gz ou .json.gz.enc), server decodifica
        //   2. application/json com { data: {...} } → JSON plain (legado/UI)
        let backupData: any;
        const contentType = req.headers['content-type'] || '';

        if (contentType.includes('application/octet-stream')) {
            const filename = (req.headers['x-backup-filename'] as string) || '';
            if (!filename) {
                return res.status(400).json({ error: 'Header X-Backup-Filename obrigatório pra upload binário' });
            }
            const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
            backupData = BackupService.parseUploadedBackup(filename, buffer);
        } else {
            if (!req.body || !req.body.data) {
                return res.status(400).json({ error: 'No backup data provided' });
            }
            backupData = req.body.data;
        }

        await BackupService.restoreBackup(user.companyId, backupData);

        res.json({ success: true });
    } catch (error: any) {
        console.error('[UploadRestore] Failed:', error);
        res.status(500).json({
            error: 'Falha ao fazer upload + restore',
            details: error?.message || String(error)
        });
    }
};
