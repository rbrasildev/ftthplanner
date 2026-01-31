import { Router } from 'express';
import { authenticateToken, requireAdminOrOwner } from '../middleware/auth';
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
router.post('/', requireAdminOrOwner, createProject);
router.get('/:id', getProject);
router.put('/:id', requireAdminOrOwner, updateProject);
router.delete('/:id', requireAdminOrOwner, deleteProject);
router.post('/:id/sync', requireAdminOrOwner, syncProject);

export default router;
