
import express from 'express';
import * as backupController from '../controllers/backupController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all backup routes
// This ensures req.user is populated with companyId
router.use(authenticateToken);

router.get('/', backupController.listBackups);
router.post('/', backupController.createBackup);
router.delete('/:filename', backupController.deleteBackup);
router.get('/:filename/download', backupController.downloadBackup);

// Restore routes
router.post('/:filename/restore', backupController.restoreBackup);
router.post('/upload-restore', backupController.uploadAndRestore);

export default router;
