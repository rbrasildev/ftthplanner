import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { createSupportSession, endSupportSession } from '../controllers/supportController';

const router = Router();

router.use(authenticateToken);

router.post('/session', createSupportSession);
router.post('/end', endSupportSession);

export default router;
