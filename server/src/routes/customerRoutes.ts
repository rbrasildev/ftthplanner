import express from 'express';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../controllers/customerController';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/checkPermission';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCustomers);
router.post('/', checkPermission('customers:manage'), createCustomer);
router.put('/:id', checkPermission('customers:manage'), updateCustomer);
router.delete('/:id', checkPermission('customers:manage'), deleteCustomer);

export default router;
