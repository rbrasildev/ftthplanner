import express from 'express';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';
import { getPlans, createPlan, updatePlan, getCompanies, updateCompanyStatus, getGlobalMapData, deleteCompany, getGlobalUsers, updateGlobalUser, getPublicPlans } from '../controllers/saasController';

const router = express.Router();



// Plans
// Public pricing access
// Public pricing access
router.get('/public/plans', getPublicPlans);
router.get('/plans', authenticateToken, getPlans);
router.post('/plans', authenticateToken, requireSuperAdmin, createPlan);
router.put('/plans/:id', authenticateToken, requireSuperAdmin, updatePlan);

// Map Data
router.get('/map-data', authenticateToken, requireSuperAdmin, getGlobalMapData);

// Companies
router.get('/companies', authenticateToken, requireSuperAdmin, getCompanies);
router.put('/companies/:id', authenticateToken, requireSuperAdmin, updateCompanyStatus);
router.delete('/companies/:id', authenticateToken, requireSuperAdmin, deleteCompany);

// Users (Super Admin)
router.get('/users', authenticateToken, requireSuperAdmin, getGlobalUsers);
router.put('/users/:id', authenticateToken, requireSuperAdmin, updateGlobalUser);

export default router;
