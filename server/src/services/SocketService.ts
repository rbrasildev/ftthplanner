import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../lib/logger';

interface AuthenticatedSocket extends Socket {
    user?: any;
}

export class SocketService {
    private static io: SocketIOServer;
    private static userSockets: Map<string, string[]> = new Map(); // userId -> socketIds

    public static init(httpServer: HttpServer) {
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: allowedOrigins.length > 0 ? allowedOrigins : true,
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['polling', 'websocket'],
            pingTimeout: 60000,
            pingInterval: 25000,
            connectTimeout: 45000,
            allowEIO3: true
        });

        this.io.use((socket: AuthenticatedSocket, next) => {
            let token = socket.handshake.auth.token;
            
            // Check cookie if token is missing or generic 'session'
            if (!token || token === 'session') {
                const cookieHeader = socket.handshake.headers.cookie || '';
                const match = cookieHeader.match(/(?:^|;)\s*auth_token=([^;]+)/);
                if (match) token = match[1];
            }

            if (!token || token === 'session') return next();

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
                socket.user = decoded;
                next();
            } catch (err) {
                next();
            }
        });

        this.io.on('connection', (socket: AuthenticatedSocket) => {
            const userId = socket.user?.id;

            if (userId) {
                const sockets = this.userSockets.get(userId) || [];
                sockets.push(socket.id);
                this.userSockets.set(userId, sockets);
                logger.info(`[Socket] Registered userId: ${userId} (Socket: ${socket.id})`);

                this.io.emit('user_presence_change', { userId, status: 'ONLINE' });
            }

            socket.on('join_conversation', (conversationId: string) => {
                socket.join(`conversation_${conversationId}`);
            });

            socket.on('disconnect', () => {
                if (userId) {
                    let sockets = this.userSockets.get(userId) || [];
                    sockets = sockets.filter(id => id !== socket.id);
                    if (sockets.length === 0) {
                        this.userSockets.delete(userId);
                        this.io.emit('user_presence_change', { userId, status: 'OFFLINE' });
                    } else {
                        this.userSockets.set(userId, sockets);
                    }
                }
            });
        });

        return this.io;
    }

    public static getIO(): SocketIOServer {
        if (!this.io) throw new Error('Socket.io not initialized');
        return this.io;
    }

    public static isUserOnline(userId: string): boolean {
        return this.userSockets.has(userId);
    }

    public static getOnlineUserIds(): string[] {
        return Array.from(this.userSockets.keys());
    }

    public static emitToConversation(conversationId: string, event: string, data: any) {
        this.io.to(`conversation_${conversationId}`).emit(event, data);
    }

    public static emitToUser(userId: string, event: string, data: any) {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
            sockets.forEach(sid => this.io.to(sid).emit(event, data));
        }
    }
}
