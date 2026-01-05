import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/adminController';

const router = express.Router();



// Apply auth middleware to all routes
router.use(authenticateToken);

// Apply role check (OWNER or ADMIN only)
router.use(checkRole(['OWNER', 'ADMIN']));

// User Management Routes
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);


export default router;
