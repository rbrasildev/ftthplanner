import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/checkPermission';
import * as catalogController from '../controllers/catalogController';

const requireCatalogManage = checkPermission('catalogs:manage');

const router = Router();

router.use(authenticateToken);

router.get('/splitters', catalogController.getSplitters);
router.post('/splitters', requireCatalogManage, catalogController.createSplitter);
router.put('/splitters/:id', requireCatalogManage, catalogController.updateSplitter);
router.delete('/splitters/:id', requireCatalogManage, catalogController.deleteSplitter);

router.get('/cables', catalogController.getCables);
router.post('/cables', requireCatalogManage, catalogController.createCable);
router.put('/cables/:id', requireCatalogManage, catalogController.updateCable);
router.delete('/cables/:id', requireCatalogManage, catalogController.deleteCable);

router.get('/boxes', catalogController.getBoxes);
router.post('/boxes', requireCatalogManage, catalogController.createBox);
router.put('/boxes/:id', requireCatalogManage, catalogController.updateBox);
router.delete('/boxes/:id', requireCatalogManage, catalogController.deleteBox);

router.get('/poles', catalogController.getPoles);
router.post('/poles', requireCatalogManage, catalogController.createPole);
router.put('/poles/:id', requireCatalogManage, catalogController.updatePole);
router.delete('/poles/:id', requireCatalogManage, catalogController.deletePole);

router.get('/fusions', catalogController.getFusions);
router.post('/fusions', requireCatalogManage, catalogController.createFusion);
router.put('/fusions/:id', requireCatalogManage, catalogController.updateFusion);
router.delete('/fusions/:id', requireCatalogManage, catalogController.deleteFusion);

router.get('/olts', catalogController.getOLTs);
router.post('/olts', requireCatalogManage, catalogController.createOLT);
router.put('/olts/:id', requireCatalogManage, catalogController.updateOLT);
router.delete('/olts/:id', requireCatalogManage, catalogController.deleteOLT);

export default router;
