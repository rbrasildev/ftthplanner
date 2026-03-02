import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minus, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import api from '../../services/api';

interface Message {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    conversationId: string;
}

export const SupportChatBubble: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isAgentOnline, setIsAgentOnline] = useState(false);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isClosed, setIsClosed] = useState(false);
    const [supportPhone, setSupportPhone] = useState('');
    const [companyLogo, setCompanyLogo] = useState('');
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Global Socket Connection - Run as soon as mounted if token exists
    useEffect(() => {
        const supportToken = localStorage.getItem('ftth_support_token');
        const mainToken = localStorage.getItem('ftth_planner_token_v1');
        const token = supportToken || mainToken;

        loadSaaSConfig();

        if (token && !socketRef.current) {
            // Deriva a URL do socket do VITE_API_URL para funcionar com frontend na Vercel 
            // e backend em outra VPS (URLs diferentes)
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const socketUrl = apiUrl
                ? apiUrl.replace(/\/api$/, '') // remove o sufixo /api se existir
                : (window.location.hostname === 'localhost' ? 'http://127.0.0.1:3001' : window.location.origin);

            console.log(`[SupportChat] Global Presence Connect to ${socketUrl}`);

            socketRef.current = io(socketUrl, {
                auth: { token },
                transports: ['polling', 'websocket'],
                reconnection: true,
                reconnectionAttempts: 10,
                timeout: 20000
            });

            socketRef.current.on('connect', () => {
                console.log('[SupportChat] Connected to WebSocket server');
                checkAgents();
                if (isOpen) loadHistory();
            });

            socketRef.current.on('agent_status_change', ({ status }: { status: string }) => {
                setIsAgentOnline(status === 'ONLINE');
            });

            socketRef.current.on('new_message', (msg: Message) => {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;

                    setIsOpen(true);
                    setIsMinimized(false);

                    // Play notification sound — arquivo local para evitar dependência externa
                    try {
                        const audio = new Audio('/sounds/notify.mp3');
                        audio.volume = 0.5;
                        audio.play().catch(() => { }); // ignora erro silenciosamente (e.g. autoplay bloqueado)
                    } catch (e) {
                        // Silent fail — não crítico
                    }

                    return [...prev, msg];
                });
            });

            socketRef.current.on('conversation_closed', () => {
                setIsClosed(true);
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []); // Run only once on mount

    const loadSaaSConfig = async () => {
        try {
            const res = await api.get('/saas/config');
            if (res.data?.supportPhone) {
                setSupportPhone(res.data.supportPhone);
            }
            if (res.data?.appLogoUrl) {
                setCompanyLogo(res.data.appLogoUrl);
            }
        } catch (err) {
            console.error("[SupportChat] Failed to load SaaS config", err);
        }
    };

    // Load history when chat is opened
    useEffect(() => {
        if (isOpen && socketRef.current?.connected) {
            loadHistory();
        }
    }, [isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const checkAgents = async () => {
        try {
            const res = await api.get('/support/chat/agents/online');
            setIsAgentOnline(res.data && res.data.length > 0);
        } catch (err) {
            console.error("[SupportChat] Failed to check agents", err);
        }
    };

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/support/chat/conversations');
            if (res.data && res.data.length > 0) {
                const activeConv = res.data.find((c: any) => c.status === 'OPEN');
                if (activeConv) {
                    setIsClosed(false);
                    const msgRes = await api.get(`/support/chat/messages/${activeConv.id}`);
                    setMessages(msgRes.data);
                    socketRef.current?.emit('join_conversation', activeConv.id);
                } else {
                    const lastConv = res.data[0];
                    if (lastConv.status === 'CLOSED') {
                        setIsClosed(true);
                        const msgRes = await api.get(`/support/chat/messages/${lastConv.id}`);
                        setMessages(msgRes.data);
                    }
                }
            }
        } catch (err) {
            console.error("[SupportChat] Failed to load history", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!message.trim() || isClosed) return;

        try {
            const currentConvId = (!isClosed && messages.length > 0) ? messages[0].conversationId : undefined;
            const res = await api.post('/support/chat/messages', {
                content: message,
                conversationId: currentConvId
            });

            if (res.data) {
                const newMsg = res.data;
                setIsClosed(false);
                setMessage('');
                if (messages.length === 0 || isClosed) {
                    socketRef.current?.emit('join_conversation', newMsg.conversationId);
                }
                setMessages(prev => [...prev.filter(m => m.id !== newMsg.id), newMsg]);
            }
        } catch (err) {
            console.error("[SupportChat] Failed to send message", err);
        }
    };

    const openWhatsApp = () => {
        const cleanPhone = supportPhone.replace(/\D/g, '');
        if (!cleanPhone) return;
        const text = encodeURIComponent('Olá! Gostaria de suporte com o FTTH Planner.');
        window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-[3000] group"
            >
                <MessageCircle className="w-7 h-7" />
                {isAgentOnline && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-bounce shadow-sm" />
                )}
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-emerald-800 flex flex-col z-[3000] overflow-hidden transition-all ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
            {/* Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                    {companyLogo ? (
                        <div className="relative">
                            <img src={companyLogo} alt="Logo" className="w-8 h-8 rounded-full bg-white object-contain p-1 border border-white/20 shadow-sm" />
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-emerald-600 ${isAgentOnline ? 'bg-green-400 animate-pulse' : 'bg-slate-300'}`} />
                        </div>
                    ) : (
                        <div className={`w-2 h-2 rounded-full ${isAgentOnline ? 'bg-green-400 animate-pulse' : 'bg-slate-300'}`} />
                    )}
                    <div className="flex flex-col">
                        <span className="font-bold text-sm leading-tight text-white">Suporte ao Cliente</span>
                        <span className="text-[10px] text-emerald-100">{isAgentOnline ? 'Disponível Agora' : 'Aguardando Atendente'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                        <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
                        {!isAgentOnline && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 rounded-xl text-center mb-2">
                                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-3">
                                    Nossos atendentes estão offline no momento. Se preferir um atendimento mais rápido, fale conosco pelo WhatsApp!
                                </p>
                                <button
                                    onClick={openWhatsApp}
                                    disabled={!supportPhone}
                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Falar no WhatsApp
                                </button>
                            </div>
                        )}

                        {isLoading && messages.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                                <MessageCircle className="w-12 h-12 mb-2 text-emerald-600" />
                                <p className="text-sm font-medium">Olá! Como podemos ajudar hoje?</p>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg) => {
                                    const isMe = msg.senderId !== 'admin';
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${isMe
                                                ? 'bg-emerald-600 text-white rounded-br-none'
                                                : 'bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-none'
                                                }`}>
                                                {msg.content}
                                                <div className={`text-[10px] mt-1.5 ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {isClosed && (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <div className="h-px w-full bg-slate-200 dark:bg-slate-800" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 px-2 -mt-3.5">Atendimento Encerrado</span>
                                        <button
                                            onClick={() => { setMessages([]); setIsClosed(false); }}
                                            className="text-[10px] text-emerald-600 hover:underline font-bold"
                                        >
                                            Iniciar nova conversa
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                        <div className="relative flex items-center gap-2">
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={isClosed}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={isClosed ? "Encerramos este atendimento" : "Digite sua dúvida..."}
                                className="flex-1 min-h-[40px] max-h-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white resize-none disabled:opacity-50"
                                rows={1}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!message.trim() || isClosed}
                                className="shrink-0 w-10 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-lg flex items-center justify-center transition-all active:scale-95"
                            >
                                <Send className="w-5 h-5 ml-0.5" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
