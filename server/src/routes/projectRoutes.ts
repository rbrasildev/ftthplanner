import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    getProjects,
    createProject,
    getProject,
    deleteProject,
    syncProject,
    updateProject
} from '../controllers/projectController';

const router = Router();

router.use(authenticateToken);

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/sync', syncProject);

export default router;
