import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getConversations, getMessages, sendMessage, updateAvailability, closeConversation, getOnlineAgents, getOnlineUsers } from '../controllers/supportChatController';

const router = Router();

router.use(authenticateToken);

router.get('/conversations', getConversations);
router.get('/messages/:conversationId', getMessages);
router.post('/messages', sendMessage);
router.post('/availability', updateAvailability);
router.post('/close/:conversationId', closeConversation);
router.get('/agents/online', getOnlineAgents);
router.get('/online-users', getOnlineUsers);

export default router;
