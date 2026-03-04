import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import api from '../../services/api';
import { CustomSelect } from '../common/CustomSelect';

// Componente isolado para gerenciar o estado de erro do logo, evitando que o React
// restore o fallback escondido durante re-renders
const CompanyLogo: React.FC<{ logoUrl?: string | null; name?: string; size?: 'sm' | 'md' }> = ({ logoUrl, name, size = 'sm' }) => {
    const [error, setError] = useState(false);
    const dim = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-10 h-10 text-base';

    if (logoUrl && !error) {
        return (
            <img
                src={logoUrl}
                alt={name || ''}
                className={`${dim} rounded-full object-contain bg-white border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm`}
                onError={() => setError(true)}
            />
        );
    }

    return (
        <div className={`${dim} rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold`}>
            {name?.[0]?.toUpperCase() || '?'}
        </div>
    );
};


interface Conversation {
    id: string;
    userId: string;
    status: string;
    updatedAt: string;
    user: {
        id: string;
        username: string;
        email?: string;
        company?: {
            id: string;
            name: string;
            logoUrl?: string | null;
        } | null;
    };
    messages: {
        content: string;
        createdAt: string;
        senderId: string;
    }[];
}

interface Message {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    conversationId: string;
}

export const SupportAdminPanel: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [onlineUsersList, setOnlineUsersList] = useState<{ id: string, username: string, email: string, company?: { id: string, name: string, logoUrl?: string | null } | null }[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [selectedOnlineUser, setSelectedOnlineUser] = useState<{ id: string, username: string } | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [reply, setReply] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [availability, setAvailability] = useState('OFFLINE');
    const [activeTab, setActiveTab] = useState<'chats' | 'online'>('chats');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Helper to format time relative
    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'agora';
        if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)}h`;
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    const filteredConversations = conversations.filter(conv => {
        const matchesSearch =
            conv.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (conv as any).user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = conv.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const filteredOnlineUsers = onlineUsersList.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const supportToken = localStorage.getItem('ftth_support_token');
        const mainToken = localStorage.getItem('ftth_planner_token_v1');
        const token = supportToken || mainToken;

        const apiUrl = (import.meta as any).env.VITE_API_URL || '';
        const socketUrl = apiUrl
            ? apiUrl.replace(/\/api$/, '')
            : (window.location.hostname === 'localhost' ? 'http://127.0.0.1:3001' : window.location.origin);

        socketRef.current = io(socketUrl, {
            auth: { token },
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            timeout: 20000
        });

        socketRef.current.on('connect', () => {
            console.log('[AdminChat] Connected to WebSocket server');
            loadOnlineUsers();
        });

        socketRef.current.on('user_presence_change', ({ userId, status }: { userId: string, status: string }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (status === 'ONLINE') next.add(userId);
                else next.delete(userId);
                return next;
            });
            loadOnlineUsers();
        });

        socketRef.current.on('new_message', (msg: Message) => {
            // Toca som apenas para mensagens do cliente (não do próprio admin)
            if (msg.senderId !== 'admin') {
                try {
                    const audio = new Audio('/sounds/notify.mp3');
                    audio.volume = 0.4;
                    audio.play().catch(() => { }); // silencioso se autoplay bloqueado
                } catch (e) {
                    // não crítico
                }
            }

            setMessages(prev => {
                if (prev.find(m => m.id === msg.id)) return prev;
                if (selectedConv?.id === msg.conversationId) return [...prev, msg];
                return prev;
            });

            // Atualiza lista de conversas inline (sem chamada API extra)
            // Apenas move a conversa para o topo e atualiza a última mensagem
            setConversations(prev => {
                const idx = prev.findIndex(c => c.id === msg.conversationId);
                if (idx === -1) {
                    // Nova conversa que ainda não está na lista — busca do servidor apenas nesse caso
                    loadConversations();
                    return prev;
                }
                const updated = [...prev];
                const conv = { ...updated[idx] };
                conv.messages = [{ content: msg.content, createdAt: msg.createdAt, senderId: msg.senderId }];
                conv.updatedAt = msg.createdAt;
                updated.splice(idx, 1);
                return [conv, ...updated];
            });
        });

        socketRef.current.on('conversation_closed', ({ conversationId }: { conversationId: string }) => {
            if (selectedConv?.id === conversationId) {
                setSelectedConv(null);
                setMessages([]);
            }
            loadConversations();
        });

        loadConversations();
        loadOnlineUsers();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [selectedConv?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const loadConversations = async () => {
        try {
            const res = await api.get('/support/chat/conversations');
            setConversations(res.data);
        } catch (err) {
            console.error("[AdminChat] Failed to load conversations", err);
        }
    };

    const loadOnlineUsers = async () => {
        try {
            const res = await api.get('/support/chat/online-users');
            setOnlineUsersList(res.data);
        } catch (err) {
            console.error("[AdminChat] Failed to load online users", err);
        }
    };

    const handleToggleAvailability = async (newStatus: string) => {
        try {
            await api.post('/support/chat/availability', { status: newStatus });
            setAvailability(newStatus);
        } catch (err) {
            console.error("[AdminChat] Failed to update availability", err);
        }
    };

    const handleCloseTicket = async () => {
        if (!selectedConv) return;
        if (!confirm('Deseja realmente encerrar este atendimento?')) return;

        try {
            await api.post(`/support/chat/close/${selectedConv.id}`);
            setSelectedConv(null);
            setMessages([]);
            loadConversations();
        } catch (err) {
            console.error("[AdminChat] Failed to close ticket", err);
        }
    };

    const loadMessages = async (convId: string) => {
        setIsLoading(true);
        try {
            const res = await api.get(`/support/chat/messages/${convId}`);
            setMessages(res.data);
            socketRef.current?.emit('join_conversation', convId);
        } catch (err) {
            console.error("[AdminChat] Failed to load messages", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectConv = (conv: Conversation) => {
        setSelectedOnlineUser(null);
        setSelectedConv(conv);
        loadMessages(conv.id);
    };

    const handleSelectOnlineUser = (user: { id: string, username: string }) => {
        setSelectedConv(null);
        setSelectedOnlineUser(user);
        setMessages([]);
    };

    const handleSend = async () => {
        if (!reply.trim()) return;

        try {
            const body: any = { content: reply };
            if (selectedConv) body.conversationId = selectedConv.id;
            else if (selectedOnlineUser) body.targetUserId = selectedOnlineUser.id;
            else return;

            await api.post('/support/chat/messages', { ...body });

            if (selectedOnlineUser) {
                loadConversations();
            }

            setReply('');
        } catch (err) {
            console.error("[AdminChat] Failed to send reply", err);
        }
    };

    return (
        <div className="flex h-[calc(100vh-200px)] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Sidebar */}
            <div className="w-2/5 sm:w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900/50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                    <div className="flex justify-between items-center mb-5">
                        <div className="flex flex-col">
                            <h2 className="font-extrabold dark:text-white uppercase tracking-widest text-[10px] text-slate-400">Atendimento</h2>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Central de Ajuda</span>
                        </div>
                        <div className="w-36 relative z-10">
                            <CustomSelect
                                options={[
                                    { value: 'OFFLINE', label: 'Offline', sublabel: 'Não disponível' },
                                    { value: 'ONLINE', label: 'Disponível', sublabel: 'Receber chats' },
                                    { value: 'AWAY', label: 'Ausente', sublabel: 'Pausado' }
                                ]}
                                value={availability}
                                onChange={handleToggleAvailability}
                                showSearch={false}
                                className="scale-90 origin-right transition-transform hover:scale-95"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-3">
                        <button
                            onClick={() => { setActiveTab('chats'); setFilterStatus('OPEN'); }}
                            className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeTab === 'chats' && filterStatus === 'OPEN' ? 'bg-white dark:bg-slate-700 shadow-sm dark:text-white' : 'text-slate-500'}`}
                        >
                            Abertos
                        </button>
                        <button
                            onClick={() => { setActiveTab('chats'); setFilterStatus('CLOSED'); }}
                            className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeTab === 'chats' && filterStatus === 'CLOSED' ? 'bg-white dark:bg-slate-700 shadow-sm dark:text-white' : 'text-slate-500'}`}
                        >
                            Resolvidos
                        </button>
                        <button
                            onClick={() => setActiveTab('online')}
                            className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeTab === 'online' ? 'bg-white dark:bg-slate-700 shadow-sm dark:text-white' : 'text-slate-500'}`}
                        >
                            Online ({onlineUsersList.length})
                        </button>
                    </div>

                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none dark:text-slate-200"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <User className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'chats' ? (
                        filteredConversations.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 opacity-40">
                                <Clock className="w-10 h-10 mx-auto mb-2" />
                                <p className="text-xs">Nenhum atendimento {filterStatus === 'CLOSED' ? 'resolvido' : 'em aberto'}</p>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => {
                                const isOnline = onlineUsers.has(conv.userId);
                                const isClosed = conv.status === 'CLOSED';
                                const lastMsg = conv.messages[0];
                                const isUnread = lastMsg && lastMsg.senderId !== 'admin';

                                return (
                                    <button
                                        key={conv.id}
                                        onClick={() => handleSelectConv(conv)}
                                        className={`w-full p-3 flex gap-3 items-center text-left border-b border-slate-100 dark:border-slate-800 transition-all ${selectedConv?.id === conv.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                            } ${isClosed ? 'opacity-60' : ''}`}
                                    >
                                        <div className="relative shrink-0">
                                            <CompanyLogo logoUrl={conv.user?.company?.logoUrl} name={conv.user?.username} size="sm" />
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <span className={`font-bold text-sm truncate ${isUnread ? 'text-emerald-600 dark:text-emerald-400' : 'dark:text-slate-200'}`}>
                                                    {conv.user?.username}
                                                    {isUnread && !isClosed && (
                                                        <span className="inline-block ml-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
                                                    )}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium ml-2 shrink-0">{formatRelativeTime(conv.updatedAt)}</span>
                                            </div>
                                            {conv.user?.company?.name && (
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-semibold truncate">{conv.user.company.name}</p>
                                            )}
                                            <p className={`text-xs truncate ${isUnread ? 'text-slate-700 dark:text-slate-300 font-semibold' : 'text-slate-400'}`}>
                                                {lastMsg?.content || 'Iniciou conversa'}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )
                    ) : (
                        filteredOnlineUsers.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 opacity-40">
                                <User className="w-10 h-10 mx-auto mb-2" />
                                <p className="text-xs">Nenhum usuário encontrado</p>
                            </div>
                        ) : (
                            filteredOnlineUsers.map((user) => {
                                const hasChat = conversations.some(c => c.userId === user.id);
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelectOnlineUser(user)}
                                        className={`w-full p-3 flex gap-3 items-center text-left border-b border-slate-100 dark:border-slate-800 transition-all ${selectedOnlineUser?.id === user.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                            }`}
                                    >
                                        <div className="relative shrink-0">
                                            <CompanyLogo logoUrl={user.company?.logoUrl} name={user.username} size="sm" />
                                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-sm dark:text-slate-200 truncate">{user.username}</span>
                                                {hasChat && <MessageSquare className="w-3 h-3 text-emerald-500 shrink-0" />}
                                            </div>
                                            {user.company?.name && (
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-semibold truncate">{user.company.name}</p>
                                            )}
                                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                        </div>
                                    </button>
                                );
                            })
                        )
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-slate-50/20 dark:bg-slate-900/20">
                {(selectedConv || selectedOnlineUser) ? (
                    <>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center z-10 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <CompanyLogo
                                        logoUrl={selectedConv?.user?.company?.logoUrl || (selectedOnlineUser as any)?.company?.logoUrl}
                                        name={selectedConv?.user?.username || selectedOnlineUser?.username}
                                        size="md"
                                    />
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${onlineUsers.has(selectedConv?.userId || selectedOnlineUser?.id || '') ? 'bg-green-500' : 'bg-slate-300'}`} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm dark:text-white">{selectedConv?.user?.username || selectedOnlineUser?.username}</h3>
                                    <p className="text-[10px] text-slate-500 lowercase font-medium">
                                        {selectedConv?.user?.email || (selectedOnlineUser as any)?.email || ''}
                                    </p>
                                    <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-tighter mt-0.5">
                                        {onlineUsers.has(selectedConv?.userId || selectedOnlineUser?.id || '') ? '• Disponível Online' : '• Offline'}
                                    </p>
                                </div>
                            </div>

                            {selectedConv && selectedConv.status !== 'CLOSED' && (
                                <button
                                    onClick={handleCloseTicket}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold transition-all"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Resolver
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {isLoading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600 opacity-20" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                                    <MessageSquare className="w-12 h-12 mb-2" />
                                    <p className="text-sm font-medium">Inicie o atendimento por aqui.</p>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const userId = selectedConv?.userId || selectedOnlineUser?.id;
                                    const isMe = msg.senderId !== userId;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${isMe
                                                ? 'bg-emerald-600 text-white rounded-br-none'
                                                : 'bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-none'
                                                }`}>
                                                {msg.content}
                                                <div className={`text-[9px] mt-1.5 flex items-center gap-1 ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {isMe && <CheckCircle className="w-2.5 h-2.5 opacity-50" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {(!selectedConv || selectedConv.status !== 'CLOSED') ? (
                            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                                <div className="relative flex items-center gap-3">
                                    <textarea
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder="Digite sua resposta..."
                                        className="flex-1 min-h-[44px] max-h-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white shadow-inner resize-none"
                                        rows={1}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!reply.trim()}
                                        className="shrink-0 w-11 h-11 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center group"
                                    >
                                        <Send className="w-5 h-5 ml-0.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest py-3">
                                Atendimento encerrado
                            </div>
                        )}
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 text-slate-400 opacity-20">
                        <MessageSquare className="w-16 h-16 mb-4" />
                        <h3 className="font-bold text-lg">Suporte Proativo</h3>
                        <p className="text-sm max-w-xs mt-2">Selecione uma conversa ou veja os usuários online para interagir.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
