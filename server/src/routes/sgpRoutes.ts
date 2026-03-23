import { Router } from 'express';
import { handleWebhook, getIntegrationSettings, saveIntegrationSettings, getIntegrationConflicts, resolveIntegrationConflict, applyIntegrationConflict, searchSgpCustomer, syncAllStatuses } from '../integrations/sgp/sgp.controller';
import { authenticateToken } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';

const router = Router();

// --- External Incoming Webhooks ---
// Endpoint for receiving SGP Webhooks based on tenant ID and type (IXC or GENERIC)
router.post('/webhook/:tenantId/:sgpType', handleWebhook);

// --- Internal Admin API Endpoints ---
router.get('/settings/:sgpType', authenticateToken, checkRole(['OWNER', 'ADMIN']), getIntegrationSettings);
router.post('/settings/:sgpType', authenticateToken, checkRole(['OWNER', 'ADMIN']), saveIntegrationSettings);
router.post('/search-customer/:sgpType', authenticateToken, searchSgpCustomer);
router.post('/sync-all/:sgpType', authenticateToken, checkRole(['OWNER', 'ADMIN']), syncAllStatuses);


router.get('/conflicts', authenticateToken, checkRole(['OWNER', 'ADMIN']), getIntegrationConflicts);
router.put('/conflicts/:id', authenticateToken, checkRole(['OWNER', 'ADMIN']), resolveIntegrationConflict);
router.post('/conflicts/:id/apply', authenticateToken, checkRole(['OWNER', 'ADMIN']), applyIntegrationConflict);

export default router;
