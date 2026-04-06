import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/checkPermission';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/adminController';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Apply permission check (users:manage)
router.use(checkPermission('users:manage'));

// User Management Routes
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);


export default router;
