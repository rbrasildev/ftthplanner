import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { SocketService } from '../services/SocketService';



export const getConversations = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user) return res.status(401).send();

    try {
        const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

        const conversations = await prisma.supportConversation.findMany({
            where: isAdmin ? {} : { userId: user.id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        email: true,
                        company: {
                            select: { id: true, name: true, logoUrl: true }
                        }
                    }
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(conversations);
    } catch (error) {
        console.error("Get Conversations Error:", error);
        res.status(500).json({ error: 'Erro ao carregar conversas' });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { conversationId } = req.params;
    if (!user) return res.status(401).send();

    try {
        const conversation = await prisma.supportConversation.findUnique({
            where: { id: conversationId }
        });

        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada' });

        if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && conversation.userId !== user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const messages = await prisma.supportMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' }
        });

        res.json(messages);
    } catch (error) {
        console.error("Get Messages Error:", error);
        res.status(500).json({ error: 'Erro ao carregar mensagens' });
    }
};

export const sendMessage = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { content, conversationId, targetUserId } = req.body;
    if (!user) return res.status(401).send();

    try {
        let conversation;

        if (conversationId) {
            conversation = await prisma.supportConversation.findUnique({
                where: { id: conversationId }
            });
        } else if (targetUserId) {
            // Proactive interaction from Admin
            conversation = await prisma.supportConversation.findFirst({
                where: { userId: targetUserId, status: 'OPEN' }
            });

            if (!conversation) {
                conversation = await prisma.supportConversation.create({
                    data: { userId: targetUserId }
                });
            }
        } else {
            // Find or create an open conversation for this regular user
            conversation = await prisma.supportConversation.findFirst({
                where: { userId: user.id, status: 'OPEN' }
            });

            if (!conversation) {
                conversation = await prisma.supportConversation.create({
                    data: { userId: user.id }
                });
            }
        }

        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada' });

        const message = await prisma.supportMessage.create({
            data: {
                conversationId: conversation.id,
                senderId: user.id,
                content
            },
            include: {
                sender: {
                    select: { id: true, username: true, role: true }
                }
            }
        });

        await prisma.supportConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() }
        });

        SocketService.emitToConversation(conversation.id, 'new_message', message);

        if (!conversationId && targetUserId) {
            SocketService.emitToUser(targetUserId, 'new_message', message);
        }

        res.json(message);
    } catch (error) {
        console.error("Send Message Error:", error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
};

export const updateAvailability = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { status } = req.body;
    if (!user) return res.status(401).send();

    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { chatAvailability: status },
            select: { id: true, username: true, chatAvailability: true }
        });

        SocketService.getIO().emit('agent_status_change', {
            userId: user.id,
            username: user.username,
            status
        });

        res.json(updatedUser);
    } catch (error) {
        console.error("Update Availability Error:", error);
        res.status(500).json({ error: 'Erro ao atualizar disponibilidade' });
    }
};

export const getMyAvailability = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user) return res.status(401).send();

    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { chatAvailability: true }
        });

        res.json({ status: dbUser?.chatAvailability || 'OFFLINE' });
    } catch (error) {
        console.error("Get Availability Error:", error);
        res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
    }
};

export const closeConversation = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    const { conversationId } = req.params;
    if (!user) return res.status(401).send();

    try {
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const updatedConv = await prisma.supportConversation.update({
            where: { id: conversationId },
            data: { status: 'CLOSED' }
        });

        SocketService.emitToConversation(conversationId, 'conversation_closed', { conversationId });

        res.json(updatedConv);
    } catch (error) {
        console.error("Close Conversation Error:", error);
        res.status(500).json({ error: 'Erro ao fechar conversa' });
    }
};

export const getOnlineAgents = async (req: Request, res: Response) => {
    try {
        const agents = await prisma.user.findMany({
            where: {
                role: { in: ['ADMIN', 'SUPER_ADMIN'] },
                chatAvailability: 'ONLINE'
            },
            select: { id: true, username: true, chatAvailability: true }
        });

        // Usa apenas o campo do banco — confiável entre restarts e deploys
        res.json(agents);
    } catch (error) {
        console.error("Get Online Agents Error:", error);
        res.status(500).json({ error: 'Erro ao buscar atendentes' });
    }
};

export const getOnlineUsers = async (req: Request, res: Response) => {
    try {
        const onlineUserIds = SocketService.getOnlineUserIds();

        const users = await prisma.user.findMany({
            where: {
                id: { in: onlineUserIds },
                role: { in: ['MEMBER', 'OWNER'] }
            },
            select: {
                id: true,
                username: true,
                email: true,
                company: {
                    select: { id: true, name: true, logoUrl: true }
                }
            }
        });

        res.json(users);
    } catch (error) {
        console.error("Get Online Users Error:", error);
        res.status(500).json({ error: 'Erro ao buscar usuários online' });
    }
};
