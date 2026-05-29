import express from 'express';
import { listOutages, getOutageDetail, getActiveCtoIds, simulateOutage } from '../controllers/outageController';
import { authenticateToken } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';

const router = express.Router();

router.use(authenticateToken);

// Ordem importa — /active-ctos antes de /:id pra não cair no detail por engano.
router.get('/active-ctos', getActiveCtoIds);
router.post('/simulate/:ctoId', checkRole(['OWNER', 'ADMIN']), simulateOutage);
router.get('/:id', getOutageDetail);
router.get('/', listOutages);

export default router;
