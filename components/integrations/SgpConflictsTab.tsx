import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { Button } from '../common/Button';

interface SgpConflictsTabProps {
    providerType: 'IXC' | 'GENERIC';
}

interface IntegrationConflict {
    id: string;
    customerId: string | null;
    type: string;
    payload: {
        customerName?: string;
        plannerPort?: number;
        sgpPort?: number;
        [key: string]: any;
    };
    status: 'PENDING' | 'RESOLVED' | 'IGNORED';
    createdAt: string;
}

export const SgpConflictsTab: React.FC<SgpConflictsTabProps> = ({ providerType }) => {
    const { t } = useLanguage();
    const [conflicts, setConflicts] = useState<IntegrationConflict[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    const fetchConflicts = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/integrations/sgp/conflicts');
            setConflicts(res.data || []);
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConflicts();
    }, [providerType]);

    const handleResolve = async (id: string, action: 'RESOLVED' | 'IGNORED') => {
        setResolvingId(id);
        try {
            await api.put(`/integrations/sgp/conflicts/${id}`, { status: action });
            setConflicts(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            alert('Erro ao resolver conflito.');
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <div className="space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Divergências entre os dados no ERP e no FTTH Planner.</p>
                <button
                    onClick={fetchConflicts}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-50"
                    title="Atualizar"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
            ) : conflicts.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                    <p className="text-slate-500 text-sm font-medium">Nenhum conflito pendente!</p>
                </div>
            ) : (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Cliente</th>
                                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Planner</th>
                                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">SGP</th>
                                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {conflicts.map(conflict => {
                                const payload = conflict.payload || {};
                                const customerName = payload.customerName || 'Desconhecido';
                                const isResolving = resolvingId === conflict.id;

                                return (
                                    <tr key={conflict.id} className="hover:bg-red-50/50 dark:hover:bg-red-900/5 transition-colors">
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-slate-200 text-xs leading-tight">{customerName}</p>
                                                    {conflict.customerId && (
                                                        <p className="text-xs text-slate-400 font-mono leading-tight">{conflict.customerId}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm px-2 py-0.5 rounded">
                                                {payload.plannerPort ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="inline-block bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold text-sm px-2 py-0.5 rounded">
                                                {payload.sgpPort ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleResolve(conflict.id, 'RESOLVED')}
                                                    disabled={isResolving}
                                                    className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                                                >
                                                    {isResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Resolvido'}
                                                </button>
                                                <button
                                                    onClick={() => handleResolve(conflict.id, 'IGNORED')}
                                                    disabled={isResolving}
                                                    className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-50 transition-colors"
                                                >
                                                    Ignorar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
