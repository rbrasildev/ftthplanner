import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../LanguageContext';
import { Link as LinkIcon, AlertTriangle, CheckCircle2, Zap, Settings, X, WifiOff, Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '../common/Button';
import api from '../../services/api';
import { SgpSettingsModal } from './SgpSettingsModal';
import { SgpConflictsTab } from './SgpConflictsTab';

type ProviderType = 'IXC' | 'GENERIC';

interface ProviderOption {
    type: ProviderType;
    label: string;
    description: string;
    icon: React.ReactNode;
    iconBg: string;
    tag: string;
    tagColor: string;
}

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
    const [showAddDropdown, setShowAddDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [providerStatuses, setProviderStatuses] = useState<Record<ProviderType, ProviderStatus>>({
        IXC: { active: false, configured: false, conflictCount: 0 },
        GENERIC: { active: false, configured: false, conflictCount: 0 },
    });

    const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const providers: ProviderOption[] = [
        {
            type: 'IXC',
            label: t('integration_provider_ixc'),
            description: t('ixc_provider_description'),
            icon: <img src="/integrations/ixc-logo.png" alt="IXC" className="w-full h-full object-cover" />,
            iconBg: 'overflow-hidden rounded-xl',
            tag: t('integration_tag_webhook'),
            tagColor: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        },
        {
            type: 'GENERIC',
            label: t('integration_provider_sgp'),
            description: t('sgp_provider_description'),
            icon: <img src="/integrations/sgp-logo.png" alt="SGP" className="w-full h-full object-contain p-1.5" />,
            iconBg: 'bg-slate-700 dark:bg-slate-700 overflow-hidden rounded-xl',
            tag: t('integration_tag_polling'),
            tagColor: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
        },
    ];

    const fetchStatuses = useCallback(async () => {
        try {
            const [ixcRes, genericRes, conflictsRes] = await Promise.all([
                api.get('/integrations/sgp/settings/IXC').catch(() => ({ data: null })),
                api.get('/integrations/sgp/settings/GENERIC').catch(() => ({ data: null })),
                api.get('/integrations/sgp/conflicts').catch(() => ({ data: [] })),
            ]);

            const conflicts = Array.isArray(conflictsRes.data) ? conflictsRes.data : [];
            // Split conflict counts by sgpType stored in payload
            const ixcConflicts = conflicts.filter((c: any) => c.status === 'PENDING' && c.payload?.sgpType === 'IXC').length;
            const genericConflicts = conflicts.filter((c: any) => c.status === 'PENDING' && c.payload?.sgpType !== 'IXC').length;

            setProviderStatuses({
                IXC: {
                    active: !!ixcRes.data?.active,
                    configured: !!(ixcRes.data?.apiUrl && ixcRes.data?.apiToken),
                    conflictCount: ixcConflicts,
                },
                GENERIC: {
                    active: !!genericRes.data?.active,
                    configured: !!(genericRes.data?.apiUrl && genericRes.data?.apiToken),
                    conflictCount: genericConflicts,
                },
            });
        } catch {
            // Silently fail
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatuses();
    }, [fetchStatuses]);

    const handleCloseModal = () => {
        setSelectedProvider(null);
        fetchStatuses();
    };

    const configuredProviders = providers.filter(p => providerStatuses[p.type].configured);
    const availableProviders = providers.filter(p => !providerStatuses[p.type].configured);

    const handleAddProvider = (type: ProviderType) => {
        setShowAddDropdown(false);
        setSelectedProvider(type);
        setActiveTab('settings');
    };

    const handleRemoveProvider = async (type: ProviderType) => {
        try {
            await api.post(`/integrations/sgp/settings/${type}`, {
                active: false,
                apiUrl: '',
                apiToken: '',
                apiApp: '',
                webhookSecret: '',
            });
            showToast(t('integration_removed_success') || 'Integration removed', 'info');
            fetchStatuses();
        } catch {
            showToast(t('sgp_save_error'), 'error');
        }
    };

    const getStatusIndicator = (status: ProviderStatus) => {
        if (status.active) {
            return (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {t('integration_status_active')}
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-500 dark:text-amber-400">
                <WifiOff className="w-3 h-3" />
                {t('integration_status_inactive')}
            </span>
        );
    };

    const renderProviderModal = () => {
        if (!selectedProvider) return null;
        const provider = providers.find(p => p.type === selectedProvider);

        return createPortal(
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
                <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/30 animate-in fade-in zoom-in-95">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/30 bg-gradient-to-r from-slate-50 to-white dark:from-slate-950/50 dark:to-slate-900">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${provider?.iconBg} flex items-center justify-center`}>
                                {provider?.icon}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {t('integration_modal_title', { provider: provider?.label || selectedProvider })}
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
            </div>,
            document.body
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Toast */}
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

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <LinkIcon className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                        {t('integrations_title')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('integrations_description')}
                    </p>
                </div>

                {/* Add Integration Dropdown */}
                {!isLoading && availableProviders.length > 0 && (
                    <div className="relative">
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setShowAddDropdown(!showAddDropdown)}
                        >
                            <Plus className="w-4 h-4" />
                            {t('integration_add_button') || 'Add Integration'}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAddDropdown ? 'rotate-180' : ''}`} />
                        </Button>

                        {showAddDropdown && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowAddDropdown(false)} />
                                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    {availableProviders.map((provider) => (
                                        <button
                                            key={provider.type}
                                            onClick={() => handleAddProvider(provider.type)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                                        >
                                            <div className={`w-9 h-9 rounded-lg ${provider.iconBg} flex items-center justify-center shrink-0`}>
                                                {provider.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{provider.label}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 ${provider.tagColor} rounded-full uppercase tracking-wider`}>
                                                        {provider.tag}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{provider.description}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Configured Integrations List */}
            {isLoading ? (
                <div className="space-y-3 animate-in fade-in duration-300">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl">
                            <div className="flex items-center gap-4 p-4">
                                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse shrink-0" />
                                <div className="flex-1 space-y-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800/50 rounded-md animate-pulse" />
                                        <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800/50 rounded-full animate-pulse" />
                                        <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800/50 rounded-full animate-pulse" />
                                    </div>
                                    <div className="h-3 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-md animate-pulse" />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800/50 rounded-lg animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : configuredProviders.length > 0 ? (
                <div className="space-y-3">
                    {configuredProviders.map((provider) => {
                        const status = providerStatuses[provider.type];
                        return (
                            <div
                                key={provider.type}
                                className="group bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl hover:border-slate-300 dark:hover:border-slate-600/50 transition-all"
                            >
                                <div className="flex items-center gap-4 p-4">
                                    {/* Icon */}
                                    <div className={`w-11 h-11 rounded-xl ${provider.iconBg} flex items-center justify-center shrink-0`}>
                                        {provider.icon}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{provider.label}</h3>
                                            <span className={`text-[9px] font-bold px-2 py-0.5 ${provider.tagColor} rounded-full uppercase tracking-wider`}>
                                                {provider.tag}
                                            </span>
                                            {getStatusIndicator(status)}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{provider.description}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {status.conflictCount > 0 && (
                                            <button
                                                onClick={() => { setSelectedProvider(provider.type); setActiveTab('conflicts'); }}
                                                className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                            >
                                                <AlertTriangle className="w-3 h-3" />
                                                {status.conflictCount}
                                            </button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => { setSelectedProvider(provider.type); setActiveTab('settings'); }}
                                        >
                                            <Settings className="w-4 h-4" />
                                            {t('configure_button')}
                                        </Button>
                                        <button
                                            onClick={() => handleRemoveProvider(provider.type)}
                                            className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title={t('integration_remove') || 'Remove integration'}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Empty State */
                <div className="bg-white dark:bg-[#1a1d23] border border-dashed border-slate-300 dark:border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4">
                        <LinkIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                        {t('integration_empty_title') || 'No integrations configured'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
                        {t('integration_empty_description') || 'Add an integration to connect your management system (IXC, SGP) and sync customer data automatically.'}
                    </p>
                    {availableProviders.length > 0 && (
                        <Button type="button" variant="primary" size="sm" onClick={() => setShowAddDropdown(true)}>
                            <Plus className="w-4 h-4" />
                            {t('integration_add_button') || 'Add Integration'}
                        </Button>
                    )}
                </div>
            )}

            {renderProviderModal()}
        </div>
    );
};
