
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/checkPermission';
import { getCompanyProfile, updateCompanyProfile, uploadCompanyLogo } from '../controllers/companyController';

const router = express.Router();

router.get('/profile', authenticateToken, getCompanyProfile);
router.put('/profile', authenticateToken, checkPermission('settings:company'), updateCompanyProfile);
router.post('/logo', authenticateToken, checkPermission('settings:company'), uploadCompanyLogo);

export default router;
