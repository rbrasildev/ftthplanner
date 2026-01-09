import { Router } from 'express';
import * as catalogController from '../controllers/catalogController';

const router = Router();

router.get('/splitters', catalogController.getSplitters);
router.post('/splitters', catalogController.createSplitter);
router.put('/splitters/:id', catalogController.updateSplitter);
router.delete('/splitters/:id', catalogController.deleteSplitter);

router.get('/cables', catalogController.getCables);
router.post('/cables', catalogController.createCable);
router.put('/cables/:id', catalogController.updateCable);
router.delete('/cables/:id', catalogController.deleteCable);



router.get('/boxes', catalogController.getBoxes);
router.post('/boxes', catalogController.createBox);
router.put('/boxes/:id', catalogController.updateBox);
router.delete('/boxes/:id', catalogController.deleteBox);

router.get('/poles', catalogController.getPoles);
router.post('/poles', catalogController.createPole);
router.put('/poles/:id', catalogController.updatePole);
router.delete('/poles/:id', catalogController.deletePole);

router.get('/fusions', catalogController.getFusions);
router.post('/fusions', catalogController.createFusion);
router.delete('/fusions/:id', catalogController.deleteFusion);


router.get('/olts', catalogController.getOLTs);
router.post('/olts', catalogController.createOLT);
router.put('/olts/:id', catalogController.updateOLT);
router.delete('/olts/:id', catalogController.deleteOLT);

export default router;
