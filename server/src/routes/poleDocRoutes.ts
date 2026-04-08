import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/checkPermission';
import * as poleDocController from '../controllers/poleDocController';

const router = Router();

router.use(authenticateToken);

const requireMapEdit = checkPermission('map:edit');

// Pole documentation details
router.get('/:projectId/poles/:poleId/details', poleDocController.getPoleDetails);
router.put('/:projectId/poles/:poleId/details', requireMapEdit, poleDocController.updatePoleDetails);

// Pole equipments
router.get('/:projectId/poles/:poleId/equipments', poleDocController.getPoleEquipments);
router.post('/:projectId/poles/:poleId/equipments', requireMapEdit, poleDocController.createPoleEquipment);
router.put('/:projectId/poles/:poleId/equipments/:equipmentId', requireMapEdit, poleDocController.updatePoleEquipment);
router.delete('/:projectId/poles/:poleId/equipments/:equipmentId', requireMapEdit, poleDocController.deletePoleEquipment);

// Pole checklist
router.get('/:projectId/poles/:poleId/checklist', poleDocController.getPoleChecklist);
router.put('/:projectId/poles/:poleId/checklist', requireMapEdit, poleDocController.upsertPoleChecklist);

// Pole photos
router.get('/:projectId/poles/:poleId/photos', poleDocController.getPolePhotos);
router.post('/:projectId/poles/:poleId/photos', requireMapEdit, poleDocController.addPolePhoto);
router.delete('/:projectId/poles/:poleId/photos/:photoId', requireMapEdit, poleDocController.deletePolePhoto);

// Spans (Vãos)
router.get('/:projectId/spans', poleDocController.getProjectSpans);
router.post('/:projectId/spans', requireMapEdit, poleDocController.createSpan);
router.put('/:projectId/spans/:spanId', requireMapEdit, poleDocController.updateSpan);
router.delete('/:projectId/spans/:spanId', requireMapEdit, poleDocController.deleteSpan);

// Project report
router.get('/:projectId/report', poleDocController.getProjectReport);

export default router;
