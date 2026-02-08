
import React, { useState, useEffect } from 'react';
import { X, Send, Users, Building2, User, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as saasService from '../../../services/saasService';

interface SendTemplateModalProps {
    template: any;
    isOpen: boolean;
    onClose: () => void;
}

export const SendTemplateModal: React.FC<SendTemplateModalProps> = ({ template, isOpen, onClose }) => {
    const [targetType, setTargetType] = useState<'ALL' | 'COMPANY' | 'USER'>('ALL');
    const [targetId, setTargetId] = useState('');
    const [companies, setCompanies] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [companiesData, usersData] = await Promise.all([
                saasService.getCompanies(),
                saasService.getUsers()
            ]);
            setCompanies(companiesData);
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load data for send modal', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if ((targetType === 'COMPANY' || targetType === 'USER') && !targetId) {
            setStatus({ type: 'error', message: 'Por favor, selecione um destinatário.' });
            return;
        }

        setSending(true);
        setStatus(null);
        try {
            const res = await saasService.sendTemplate({
                templateId: template.id,
                targetType,
                targetId: targetType === 'ALL' ? undefined : targetId
            });
            setStatus({ type: 'success', message: res.message });
            setTimeout(onClose, 3000);
        } catch (error: any) {
            setStatus({ type: 'error', message: error.response?.data?.error || 'Erro ao realizar disparo' });
            setSending(false);
        }
    };

    if (!isOpen) return null;

    const filteredUsers = users.filter(u =>
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredCompanies = companies.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Send className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Disparar Template</h3>
                            <p className="text-xs text-slate-500 font-medium">Template: {template.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Alvo do Disparo */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Alvo do Disparo</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => { setTargetType('ALL'); setTargetId(''); }}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${targetType === 'ALL'
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                            >
                                <Users className="w-6 h-6" />
                                <span className="text-xs font-bold">Todos</span>
                            </button>
                            <button
                                onClick={() => { setTargetType('COMPANY'); setTargetId(''); }}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${targetType === 'COMPANY'
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                            >
                                <Building2 className="w-6 h-6" />
                                <span className="text-xs font-bold">Empresa</span>
                            </button>
                            <button
                                onClick={() => { setTargetType('USER'); setTargetId(''); }}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${targetType === 'USER'
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
                            >
                                <User className="w-6 h-6" />
                                <span className="text-xs font-bold">Usuário</span>
                            </button>
                        </div>
                    </div>

                    {/* Seleção de Destinatário */}
                    {targetType !== 'ALL' && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Selecionar {targetType === 'COMPANY' ? 'Empresa' : 'Usuário'}
                            </label>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={`Buscar ${targetType === 'COMPANY' ? 'empresa' : 'usuário'}...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                />
                            </div>

                            <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-50 dark:divide-slate-800">
                                {loading ? (
                                    <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                                    </div>
                                ) : targetType === 'COMPANY' ? (
                                    filteredCompanies.length > 0 ? filteredCompanies.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setTargetId(c.id)}
                                            className={`w-full flex items-center justify-between p-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${targetId === c.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400' : ''}`}
                                        >
                                            <span className="font-medium">{c.name}</span>
                                            {targetId === c.id && <CheckCircle2 className="w-4 h-4" />}
                                        </button>
                                    )) : <div className="p-4 text-center text-slate-400 text-xs">Nenhuma empresa encontrada</div>
                                ) : (
                                    filteredUsers.length > 0 ? filteredUsers.map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => setTargetId(u.id)}
                                            className={`w-full flex items-center justify-between p-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${targetId === u.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400' : ''}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{u.username}</span>
                                                <span className="text-[10px] text-slate-500">{u.email}</span>
                                            </div>
                                            {targetId === u.id && <CheckCircle2 className="w-4 h-4" />}
                                        </button>
                                    )) : <div className="p-4 text-center text-slate-400 text-xs">Nenhum usuário encontrado</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Status Feedback */}
                    {status && (
                        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50' :
                                'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50'
                            }`}>
                            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            {status.message}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        disabled={sending}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || (targetType !== 'ALL' && !targetId)}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Confirmar Disparo
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
