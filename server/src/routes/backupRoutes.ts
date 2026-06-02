
import express from 'express';
import * as backupController from '../controllers/backupController';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/checkPermission';

const router = express.Router();

router.use(authenticateToken);
router.use(checkPermission('backup:manage'));

router.get('/', backupController.listBackups);
router.post('/', backupController.createBackup);
router.delete('/:filename', backupController.deleteBackup);
router.get('/:filename/download', backupController.downloadBackup);

// Restore routes
router.post('/:filename/restore', backupController.restoreBackup);
// Aceita dois formatos:
//   - application/json: { data: { ...backup } } — legado, plain JSON
//   - application/octet-stream + header X-Backup-Filename — binário comprimido/cripto
// Body parser raw configurado inline pra esta rota (não afeta o express.json global).
router.post(
    '/upload-restore',
    express.raw({ type: 'application/octet-stream', limit: '50mb' }),
    backupController.uploadAndRestore
);

export default router;
