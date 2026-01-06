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

export default router;
