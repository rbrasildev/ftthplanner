import express from 'express';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth';
import { getPlans, createPlan, updatePlan, getCompanies, updateCompanyStatus, getGlobalMapData, deleteCompany, getGlobalUsers, updateGlobalUser, getPublicPlans } from '../controllers/saasController';
import { getVideos, getPublicVideos, createVideo, updateVideo, deleteVideo } from '../controllers/videoController';
import { getSmtpConfig, updateSmtpConfig, testSmtp, getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, broadcastTemplate } from '../controllers/emailController';

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

// Demo Videos
router.get('/public/videos', getPublicVideos);
router.get('/videos', authenticateToken, requireSuperAdmin, getVideos);
router.post('/videos', authenticateToken, requireSuperAdmin, createVideo);
router.put('/videos/:id', authenticateToken, requireSuperAdmin, updateVideo);
router.delete('/videos/:id', authenticateToken, requireSuperAdmin, deleteVideo);

// Email Settings
router.get('/email/smtp', authenticateToken, requireSuperAdmin, getSmtpConfig);
router.post('/email/smtp', authenticateToken, requireSuperAdmin, updateSmtpConfig);
router.post('/email/smtp/test', authenticateToken, requireSuperAdmin, testSmtp);

// Email Templates
router.get('/email/templates', authenticateToken, requireSuperAdmin, getEmailTemplates);
router.post('/email/templates', authenticateToken, requireSuperAdmin, createEmailTemplate);
router.put('/email/templates/:id', authenticateToken, requireSuperAdmin, updateEmailTemplate);
router.delete('/email/templates/:id', authenticateToken, requireSuperAdmin, deleteEmailTemplate);
router.post('/email/templates/:id/broadcast', authenticateToken, requireSuperAdmin, broadcastTemplate);


export default router;
