import express from 'express';
import { registerVisit, lookupConsultant } from '../controllers/referralController';

const router = express.Router();

// Endpoints públicos (sem auth) — usados pelo frontend quando alguém abre
// um link ?ref=<code> na landing page.
router.post('/visit/:code', registerVisit);
router.get('/lookup/:code', lookupConsultant);

export default router;
