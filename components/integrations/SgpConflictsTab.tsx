import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, ArrowLeftRight, Check, X, Zap } from 'lucide-react';
import api from '../../services/api';

interface SgpConflictsTabProps {
    providerType: 'IXC' | 'GENERIC';
}

interface IntegrationConflict {
    id: string;
    customerId: string | null;
    type: string;
    payload: {
        customerName?: string;
        ctoName?: string;
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
    const [actingId, setActingId] = useState<string | null>(null);
    const [applyingId, setApplyingId] = useState<string | null>(null);

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
        setActingId(id);
        try {
            await api.put(`/integrations/sgp/conflicts/${id}`, { status: action });
            setConflicts(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            alert(t('conflict_resolve_error'));
        } finally {
            setActingId(null);
        }
    };

    const handleApply = async (id: string) => {
        setApplyingId(id);
        try {
            const res = await api.post(`/integrations/sgp/conflicts/${id}/apply`);
            setConflicts(prev => prev.filter(c => c.id !== id));
            alert(res.data?.message || t('conflict_apply_success'));
        } catch (error: any) {
            alert(error.response?.data?.error || t('conflict_apply_error'));
        } finally {
            setApplyingId(null);
        }
    };

    return (
        <div className="space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{t('conflict_tab_description')}</p>
                <button
                    onClick={fetchConflicts}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-50"
                    title={t('refresh')}
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
            ) : conflicts.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                    <p className="text-slate-500 text-sm font-medium">{t('conflict_none_pending')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {conflicts.map(conflict => {
                        const payload = conflict.payload || {};
                        const customerName = payload.customerName || t('conflict_unknown_customer');
                        const isPortMismatch = conflict.type === 'PORT_MISMATCH';
                        const isActing = actingId === conflict.id;
                        const isApplying = applyingId === conflict.id;
                        const isBusy = isActing || isApplying;

                        return (
                            <div key={conflict.id} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-red-300 dark:hover:border-red-800 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    {/* Left: Customer Info */}
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="mt-0.5 w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-tight truncate">{customerName}</p>
                                            {conflict.customerId && (
                                                <p className="text-xs text-slate-400 font-mono leading-tight">{conflict.customerId}</p>
                                            )}
                                            {payload.ctoName && (
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold leading-tight mt-0.5">📍 {payload.ctoName}</p>
                                            )}
                                            <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                {conflict.type.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Center: Port Comparison (only for PORT_MISMATCH) */}
                                    {isPortMismatch && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-center">
                                                <p className="text-[9px] font-semibold text-slate-400 uppercase mb-1">{t('conflict_planner_label')}</p>
                                                <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm px-2.5 py-1 rounded-lg">
                                                    {payload.plannerPort ?? '—'}
                                                </span>
                                            </div>
                                            <ArrowLeftRight className="w-3.5 h-3.5 text-red-400" />
                                            <div className="text-center">
                                                <p className="text-[9px] font-semibold text-slate-400 uppercase mb-1">{t('conflict_erp_label')}</p>
                                                <span className="inline-block bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold text-sm px-2.5 py-1 rounded-lg">
                                                    {payload.sgpPort ?? '—'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                    {isPortMismatch && (
                                        <button
                                            onClick={() => handleApply(conflict.id)}
                                            disabled={isBusy}
                                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors font-semibold"
                                            title={t('conflict_apply_hint')}
                                        >
                                            {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                            {t('conflict_apply')}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleResolve(conflict.id, 'RESOLVED')}
                                        disabled={isBusy}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                                    >
                                        {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                        {t('conflict_mark_resolved')}
                                    </button>
                                    <button
                                        onClick={() => handleResolve(conflict.id, 'IGNORED')}
                                        disabled={isBusy}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-50 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                        {t('conflict_ignore')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
