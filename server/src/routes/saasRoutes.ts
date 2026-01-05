import express from 'express';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';
import { getPlans, createPlan, updatePlan, getCompanies, updateCompanyStatus, getGlobalMapData } from '../controllers/saasController';

const router = express.Router();



// Plans
// Public pricing access
router.get('/plans', authenticateToken, getPlans);
router.post('/plans', authenticateToken, requireSuperAdmin, createPlan);
router.put('/plans/:id', authenticateToken, requireSuperAdmin, updatePlan);

// Map Data
router.get('/map-data', authenticateToken, requireSuperAdmin, getGlobalMapData);

// Companies
router.get('/companies', authenticateToken, requireSuperAdmin, getCompanies);
router.put('/companies/:id', authenticateToken, requireSuperAdmin, updateCompanyStatus);

export default router;
