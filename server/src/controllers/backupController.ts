
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

export const listBackups = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized: No company ID' });
        }
        const backups = await BackupService.listBackups(user.companyId);
        res.json(backups);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list backups' });
    }
};

export const createBackup = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized: No company ID' });
        }
        const backup = await BackupService.createBackup(user.companyId, true); // true = manual
        res.json(backup);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create backup' });
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
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete backup' });
    }
};

export const downloadBackup = async (req: Request, res: Response) => {
    try {
        const { filename } = req.params;
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const filepath = BackupService.getBackupPath(filename, user.companyId);

        if (filepath) {
            res.download(filepath);
        } else {
            res.status(404).json({ error: 'Backup not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to download backup' });
    }
};

export const restoreBackup = async (req: Request, res: Response) => {
    try {
        const { filename } = req.params;
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Security check: ensure file belongs to company
        if (!filename.includes(user.companyId)) {
            return res.status(403).json({ error: 'Invalid backup file for this company' });
        }

        const data = await BackupService.readBackupFile(filename);
        await BackupService.restoreBackup(user.companyId, data);

        res.json({ success: true, message: 'Restore completed successfully' });

    } catch (error) {
        console.error('Restore error', error);
        res.status(500).json({ error: 'Failed to restore backup' });
    }
};

// Handle file upload and restore
export const uploadAndRestore = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!req.body || !req.body.data) {
            return res.status(400).json({ error: 'No backup data provided' });
        }

        // We expect JSON body with { data: ...backupContent }
        // Or if using multer, we read the file. 
        // For simplicity with "json" limit 100mb, we can accept JSON body directly.

        const backupData = req.body.data;
        await BackupService.restoreBackup(user.companyId, backupData);

        res.json({ success: true });
    } catch (error) {
        console.error('Upload restore error', error);
        res.status(500).json({ error: 'Failed to upload and restore' });
    }
};
