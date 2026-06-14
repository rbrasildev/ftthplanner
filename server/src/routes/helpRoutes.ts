import express from 'express';
import { getHelpContent } from '../controllers/helpController';

const router = express.Router();

// Único endpoint público — retorna FAQs ativas + artigos ativos + vídeos + contato
// numa request só. Cache client-side é responsabilidade do frontend.
router.get('/content', getHelpContent);

export default router;
