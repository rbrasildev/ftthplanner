import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../LanguageContext';
import { Link as LinkIcon, AlertTriangle, CheckCircle2, Zap, Server, Settings, RefreshCw, X, WifiOff, Circle } from 'lucide-react';
import { Button } from '../common/Button';
import api from '../../services/api';
import { SgpSettingsModal } from './SgpSettingsModal';
import { SgpConflictsTab } from './SgpConflictsTab';

type ProviderType = 'IXC' | 'GENERIC';

interface ProviderStatus {
    active: boolean;
    configured: boolean;
    conflictCount: number;
}

interface ToastData {
    msg: string;
    type: 'success' | 'error' | 'info';
}

export const IntegrationsPage: React.FC = () => {
    const { t } = useLanguage();
    const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
    const [activeTab, setActiveTab] = useState<'settings' | 'conflicts'>('settings');
    const [toast, setToast] = useState<ToastData | null>(null);
    const [providerStatuses, setProviderStatuses] = useState<Record<ProviderType, ProviderStatus>>({
        IXC: { active: false, configured: false, conflictCount: 0 },
        GENERIC: { active: false, configured: false, conflictCount: 0 },
    });

    const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const fetchStatuses = useCallback(async () => {
        try {
            const [ixcRes, genericRes, conflictsRes] = await Promise.all([
                api.get('/integrations/sgp/settings/IXC').catch(() => ({ data: null })),
                api.get('/integrations/sgp/settings/GENERIC').catch(() => ({ data: null })),
                api.get('/integrations/sgp/conflicts').catch(() => ({ data: [] })),
            ]);

            const conflicts = conflictsRes.data || [];
            const pendingCount = Array.isArray(conflicts) ? conflicts.filter((c: any) => c.status === 'PENDING').length : 0;

            setProviderStatuses({
                IXC: {
                    active: !!ixcRes.data?.active,
                    configured: !!(ixcRes.data?.apiUrl && ixcRes.data?.apiToken),
                    conflictCount: pendingCount,
                },
                GENERIC: {
                    active: !!genericRes.data?.active,
                    configured: !!(genericRes.data?.apiUrl && genericRes.data?.apiToken),
                    conflictCount: pendingCount,
                },
            });
        } catch {
            // Silently fail - statuses just won't show
        }
    }, []);

    useEffect(() => {
        fetchStatuses();
    }, [fetchStatuses]);

    const handleCloseModal = () => {
        setSelectedProvider(null);
        fetchStatuses(); // Refresh statuses after closing
    };

    const getStatusBadge = (status: ProviderStatus) => {
        if (!status.configured) {
            return (
                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-slate-100 dark:bg-[#22262e] text-slate-400 rounded-full uppercase tracking-wider">
                    <Circle className="w-2 h-2" />
                    {t('integration_status_not_configured')}
                </span>
            );
        }
        if (status.active) {
            return (
                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full uppercase tracking-wider">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {t('integration_status_active')}
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full uppercase tracking-wider">
                <WifiOff className="w-2.5 h-2.5" />
                {t('integration_status_inactive')}
            </span>
        );
    };

    const renderProviderCard = (type: ProviderType, icon: React.ReactNode, title: string, description: string, tagLabel: string, tagColor: string, iconBg: string) => {
        const status = providerStatuses[type];
        return (
            <div
                onClick={() => { setSelectedProvider(type); setActiveTab('settings'); }}
                className="group bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 hover:border-emerald-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center`}>
                        {icon}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 ${tagColor} rounded-full uppercase tracking-wider`}>
                            {tagLabel}
                        </span>
                        {getStatusBadge(status)}
                    </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 flex-1">
                    {description}
                </p>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/30 pt-4 mt-auto">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 group-hover:gap-2 transition-all">
                        <Settings className="w-4 h-4" /> {t('configure_button')}
                    </span>
                    {status.conflictCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full animate-in fade-in duration-300">
                            <AlertTriangle className="w-3 h-3" />
                            {t('integration_conflicts_badge', { count: status.conflictCount })}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const renderProviderModal = () => {
        if (!selectedProvider) return null;

        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
                <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/30 animate-in fade-in zoom-in-95">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/30 bg-gradient-to-r from-slate-50 to-white dark:from-slate-950/50 dark:to-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                {selectedProvider === 'IXC' ? <Server className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {t('integration_modal_title', { provider: selectedProvider === 'IXC' ? 'IXC Provedor' : 'SGP' })}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {t('integration_modal_subtitle')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCloseModal}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex px-5 bg-white dark:bg-[#1a1d23] border-b border-slate-200 dark:border-slate-700/30">
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <span className="flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                {t('integration_tab_settings')}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('conflicts')}
                            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'conflicts' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <span className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {t('integration_tab_conflicts')}
                                {providerStatuses[selectedProvider].conflictCount > 0 && (
                                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 bg-red-500 text-white rounded-full min-w-[18px] text-center">
                                        {providerStatuses[selectedProvider].conflictCount}
                                    </span>
                                )}
                            </span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-[#151820]/30">
                        {activeTab === 'settings' && <SgpSettingsModal providerType={selectedProvider} showToast={showToast} />}
                        {activeTab === 'conflicts' && <SgpConflictsTab providerType={selectedProvider} showToast={showToast} onConflictChange={fetchStatuses} />}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Inline Toast */}
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[999999] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
                    toast.type === 'success' ? 'bg-emerald-600 text-white' :
                    toast.type === 'error' ? 'bg-red-600 text-white' :
                    'bg-sky-600 text-white'
                }`}>
                    {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {toast.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {toast.type === 'info' && <Zap className="w-4 h-4 shrink-0" />}
                    {toast.msg}
                    <button onClick={() => setToast(null)} className="ml-2 p-0.5 rounded hover:bg-white/20 transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <LinkIcon className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                        {t('integrations_title')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('integrations_description')}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {renderProviderCard(
                    'IXC',
                    <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
                    t('ixc_provider_title'),
                    t('ixc_provider_description'),
                    'Webhook',
                    'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
                    'bg-blue-50 dark:bg-blue-900/20'
                )}

                {renderProviderCard(
                    'GENERIC',
                    <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
                    'SGP',
                    t('sgp_provider_description'),
                    'API Polling',
                    'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
                    'bg-purple-50 dark:bg-purple-900/20'
                )}
            </div>

            {renderProviderModal()}
        </div>
    );
};
