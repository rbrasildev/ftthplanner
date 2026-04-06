import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/checkPermission';
import {
    getProjects,
    createProject,
    getProject,
    deleteProject,
    syncProject,
    updateProject,
    updateCTO,
    updatePOP,
    searchCTO,
    getCTOPower
} from '../controllers/projectController';

const router = Router();

router.use(authenticateToken);

router.get('/ctos/search', searchCTO);
router.get('/', getProjects);
router.post('/', checkPermission('projects:create'), createProject);
router.get('/:id', getProject);
router.put('/:id', checkPermission('projects:edit'), updateProject);
router.delete('/:id', checkPermission('projects:delete'), deleteProject);
router.post('/:id/sync', syncProject);
router.get('/:id/ctos/:ctoId/power', getCTOPower);
router.put('/:id/ctos/:ctoId', checkPermission('map:edit'), updateCTO);
router.put('/:id/pops/:popId', checkPermission('map:edit'), updatePOP);

export default router;
