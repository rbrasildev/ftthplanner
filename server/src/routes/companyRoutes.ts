
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { getCompanyProfile, updateCompanyProfile, uploadCompanyLogo } from '../controllers/companyController';

const router = express.Router();

router.get('/profile', authenticateToken, getCompanyProfile);
router.put('/profile', authenticateToken, updateCompanyProfile);
router.post('/logo', authenticateToken, uploadCompanyLogo);

export default router;
