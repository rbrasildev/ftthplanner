import express from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';

const router = express.Router();

// Get all logs (Super Admin only)
router.get('/', authenticateToken, requireSuperAdmin, getAuditLogs);

export default router;
