import express from 'express';
import { listOutages, getOutageDetail, getActiveCtoIds } from '../controllers/outageController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

// Ordem importa — /active-ctos antes de /:id pra não cair no detail por engano.
router.get('/active-ctos', getActiveCtoIds);
router.get('/:id', getOutageDetail);
router.get('/', listOutages);

export default router;
