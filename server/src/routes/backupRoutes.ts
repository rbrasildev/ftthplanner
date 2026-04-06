
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
router.post('/upload-restore', backupController.uploadAndRestore);

export default router;
