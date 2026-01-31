import { Router } from 'express';
import { authenticateToken, requireAdminOrOwner } from '../middleware/auth';
import * as catalogController from '../controllers/catalogController';

const router = Router();

router.use(authenticateToken);

router.get('/splitters', catalogController.getSplitters);
router.post('/splitters', requireAdminOrOwner, catalogController.createSplitter);
router.put('/splitters/:id', requireAdminOrOwner, catalogController.updateSplitter);
router.delete('/splitters/:id', requireAdminOrOwner, catalogController.deleteSplitter);

router.get('/cables', catalogController.getCables);
router.post('/cables', requireAdminOrOwner, catalogController.createCable);
router.put('/cables/:id', requireAdminOrOwner, catalogController.updateCable);
router.delete('/cables/:id', requireAdminOrOwner, catalogController.deleteCable);

router.get('/boxes', catalogController.getBoxes);
router.post('/boxes', requireAdminOrOwner, catalogController.createBox);
router.put('/boxes/:id', requireAdminOrOwner, catalogController.updateBox);
router.delete('/boxes/:id', requireAdminOrOwner, catalogController.deleteBox);

router.get('/poles', catalogController.getPoles);
router.post('/poles', requireAdminOrOwner, catalogController.createPole);
router.put('/poles/:id', requireAdminOrOwner, catalogController.updatePole);
router.delete('/poles/:id', requireAdminOrOwner, catalogController.deletePole);

router.get('/fusions', catalogController.getFusions);
router.post('/fusions', requireAdminOrOwner, catalogController.createFusion);
router.put('/fusions/:id', requireAdminOrOwner, catalogController.updateFusion);
router.delete('/fusions/:id', requireAdminOrOwner, catalogController.deleteFusion);

router.get('/olts', catalogController.getOLTs);
router.post('/olts', requireAdminOrOwner, catalogController.createOLT);
router.put('/olts/:id', requireAdminOrOwner, catalogController.updateOLT);
router.delete('/olts/:id', requireAdminOrOwner, catalogController.deleteOLT);

export default router;
