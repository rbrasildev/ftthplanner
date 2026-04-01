import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, ArrowLeftRight, Check, X, Zap, Clock, Trash2 } from 'lucide-react';
import api from '../../services/api';

interface SgpConflictsTabProps {
    providerType: 'IXC' | 'GENERIC';
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    onConflictChange?: () => void;
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

const TYPE_STYLES: Record<string, { key: string; color: string }> = {
    PORT_MISMATCH: { key: 'conflict_type_port_mismatch', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
    NOT_FOUND: { key: 'conflict_type_not_found', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
    INVALID_DATA: { key: 'conflict_type_invalid_data', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
    PORT_CONFLICT: { key: 'conflict_type_port_conflict', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
    PROCESSING_ERROR: { key: 'conflict_type_error', color: 'bg-slate-100 dark:bg-[#22262e] text-slate-500 dark:text-slate-400' },
};

export const SgpConflictsTab: React.FC<SgpConflictsTabProps> = ({ providerType, showToast, onConflictChange }) => {
    const { t } = useLanguage();
    const [conflicts, setConflicts] = useState<IntegrationConflict[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [actingIds, setActingIds] = useState<Set<string>>(new Set());
    const [batchActing, setBatchActing] = useState(false);

    const fetchConflicts = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/integrations/sgp/conflicts');
            const all = res.data || [];
            // Filter conflicts by provider type
            const filtered = all.filter((c: any) => {
                const conflictType = c.payload?.sgpType;
                if (providerType === 'IXC') return conflictType === 'IXC';
                return conflictType !== 'IXC'; // GENERIC gets everything that's not IXC
            });
            setConflicts(filtered);
        } catch {
            // Silent fail
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConflicts();
    }, [providerType]);

    const markActing = (id: string, acting: boolean) => {
        setActingIds(prev => {
            const next = new Set(prev);
            acting ? next.add(id) : next.delete(id);
            return next;
        });
    };

    const handleResolve = async (id: string, action: 'RESOLVED' | 'IGNORED') => {
        markActing(id, true);
        try {
            await api.put(`/integrations/sgp/conflicts/${id}`, { status: action });
            setConflicts(prev => prev.filter(c => c.id !== id));
            onConflictChange?.();
        } catch {
            showToast(t('conflict_resolve_error'), 'error');
        } finally {
            markActing(id, false);
        }
    };

    const handleApply = async (id: string) => {
        markActing(id, true);
        try {
            const res = await api.post(`/integrations/sgp/conflicts/${id}/apply`);
            setConflicts(prev => prev.filter(c => c.id !== id));
            showToast(res.data?.message || t('conflict_apply_success'), 'success');
            onConflictChange?.();
        } catch (error: any) {
            showToast(error.response?.data?.error || t('conflict_apply_error'), 'error');
        } finally {
            markActing(id, false);
        }
    };

    const handleBatchAction = async (action: 'RESOLVED' | 'IGNORED') => {
        const pending = conflicts.filter(c => c.status === 'PENDING');
        if (pending.length === 0) return;

        const actionLabel = action === 'RESOLVED' ? t('conflict_resolve_all').toLowerCase() : t('conflict_ignore_all').toLowerCase();
        if (!confirm(t('conflict_batch_confirm', { action: actionLabel, count: pending.length }))) return;

        setBatchActing(true);
        let successCount = 0;
        for (const conflict of pending) {
            try {
                await api.put(`/integrations/sgp/conflicts/${conflict.id}`, { status: action });
                successCount++;
            } catch {
                // Continue with remaining
            }
        }
        setConflicts(prev => prev.filter(c => c.status !== 'PENDING'));
        showToast(t('conflict_batch_success', { success: successCount, total: pending.length, action: action.toLowerCase() }), 'success');
        onConflictChange?.();
        setBatchActing(false);
    };

    const formatTimeAgo = (dateStr: string) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMin < 1) return t('time_now');
        if (diffMin < 60) return t('time_minutes', { n: diffMin });
        if (diffHours < 24) return t('time_hours', { n: diffHours });
        if (diffDays < 30) return t('time_days', { n: diffDays });
        return date.toLocaleDateString();
    };

    const pendingCount = conflicts.filter(c => c.status === 'PENDING').length;

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Header with count and actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {pendingCount > 0 ? (
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {t('conflict_count_header', { count: pendingCount })}
                        </span>
                    ) : (
                        <span className="text-sm text-slate-400">{t('conflict_tab_description')}</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {pendingCount > 1 && (
                        <>
                            <button
                                onClick={() => handleBatchAction('RESOLVED')}
                                disabled={batchActing}
                                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 transition-colors"
                            >
                                <Check className="w-3 h-3" />
                                {t('conflict_resolve_all')}
                            </button>
                            <button
                                onClick={() => handleBatchAction('IGNORED')}
                                disabled={batchActing}
                                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 bg-slate-50 dark:bg-[#22262e] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                                {t('conflict_ignore_all')}
                            </button>
                        </>
                    )}
                    <button
                        onClick={fetchConflicts}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors disabled:opacity-50"
                        title={t('refresh')}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-500' : ''}`} />
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2.5 animate-in fade-in duration-300">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-[#22262e]/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700/50 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-32 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                        <div className="h-4 w-20 bg-slate-100 dark:bg-slate-700/50 rounded-full" />
                                    </div>
                                    <div className="h-3 w-48 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                </div>
                                <div className="h-8 w-20 bg-slate-100 dark:bg-slate-700/50 rounded-lg shrink-0" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : conflicts.length === 0 ? (
                <div className="text-center py-14 border-2 border-dashed border-slate-200 dark:border-slate-700/30 rounded-xl flex flex-col items-center gap-2">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">{t('conflict_none_pending')}</p>
                    <p className="text-xs text-slate-400">{t('conflict_tab_description')}</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {conflicts.map(conflict => {
                        const payload = conflict.payload || {};
                        const customerName = payload.customerName || t('conflict_unknown_customer');
                        const isPortMismatch = conflict.type === 'PORT_MISMATCH';
                        const isBusy = actingIds.has(conflict.id) || batchActing;
                        const typeInfo = TYPE_STYLES[conflict.type] || TYPE_STYLES['PROCESSING_ERROR'];

                        return (
                            <div
                                key={conflict.id}
                                className="bg-white dark:bg-[#22262e]/50 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 transition-all group"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Left: Customer Info */}
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                                isPortMismatch ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
                                            }`}>
                                                <AlertTriangle className={`w-4 h-4 ${isPortMismatch ? 'text-red-500' : 'text-amber-500'}`} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{customerName}</p>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${typeInfo.color}`}>
                                                        {t(typeInfo.key)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {conflict.customerId && (
                                                        <span className="text-[10px] text-slate-400 font-mono bg-slate-50 dark:bg-[#22262e] px-1.5 py-0.5 rounded">{conflict.customerId}</span>
                                                    )}
                                                    {payload.ctoName && (
                                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{payload.ctoName}</span>
                                                    )}
                                                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {formatTimeAgo(conflict.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Port Comparison */}
                                        {isPortMismatch && (
                                            <div className="flex items-center gap-2 shrink-0 bg-slate-50 dark:bg-[#22262e]/50 rounded-lg px-3 py-2">
                                                <div className="text-center">
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">{t('conflict_planner_label')}</p>
                                                    <span className="inline-block bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                                                        {payload.plannerPort ?? '—'}
                                                    </span>
                                                </div>
                                                <ArrowLeftRight className="w-3.5 h-3.5 text-red-400 mx-1" />
                                                <div className="text-center">
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">{t('conflict_erp_label')}</p>
                                                    <span className="inline-block bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold text-sm px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800">
                                                        {payload.sgpPort ?? '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Bar */}
                                <div className="flex items-center justify-end gap-1.5 px-4 py-2.5 bg-slate-50/50 dark:bg-[#22262e]/30 border-t border-slate-100 dark:border-slate-700/50">
                                    {isPortMismatch && (
                                        <button
                                            onClick={() => handleApply(conflict.id)}
                                            disabled={isBusy}
                                            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors font-semibold"
                                            title={t('conflict_apply_hint')}
                                        >
                                            {actingIds.has(conflict.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                            {t('conflict_apply')}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleResolve(conflict.id, 'RESOLVED')}
                                        disabled={isBusy}
                                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
                                    >
                                        <Check className="w-3 h-3" />
                                        {t('conflict_mark_resolved')}
                                    </button>
                                    <button
                                        onClick={() => handleResolve(conflict.id, 'IGNORED')}
                                        disabled={isBusy}
                                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg disabled:opacity-50 transition-colors font-medium"
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
