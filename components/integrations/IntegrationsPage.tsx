import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';
import { Link as LinkIcon, AlertTriangle, CheckCircle2, Zap, Server, Settings, Search, RefreshCw, X } from 'lucide-react';
import { Button } from '../common/Button';
import { CustomInput } from '../common/CustomInput';
import api from '../../services/api';
import { SgpSettingsModal } from './SgpSettingsModal';
import { SgpConflictsTab } from './SgpConflictsTab';

type ProviderType = 'IXC' | 'GENERIC';

export const IntegrationsPage: React.FC = () => {
    const { t } = useLanguage();
    const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
    const [activeTab, setActiveTab] = useState<'settings' | 'logs' | 'conflicts'>('settings');

    const renderProviderModal = () => {
        if (!selectedProvider) return null;

        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <LinkIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    {t('integration_modal_title', { provider: selectedProvider })}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {t('integration_modal_subtitle')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedProvider(null)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex px-6 border-b border-slate-200 dark:border-slate-800">
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {t('integration_tab_settings')}
                        </button>
                        <button
                            onClick={() => setActiveTab('conflicts')}
                            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'conflicts' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {t('integration_tab_conflicts')}
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
                        {activeTab === 'settings' && <SgpSettingsModal providerType={selectedProvider} />}
                        {activeTab === 'conflicts' && <SgpConflictsTab providerType={selectedProvider} />}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
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

                {/* IXC Card */}
                {/* <div
                    onClick={() => { setSelectedProvider('IXC'); setActiveTab('settings'); }}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                            <Server className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full uppercase tracking-wider">
                            Webhook
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('ixc_provider_title')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                        {t('ixc_provider_description')}
                    </p>
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-auto">
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Settings className="w-4 h-4" /> {t('configure_button')}
                        </span>
                    </div>
                </div> */}


                {/* Generic SGP Card */}
                <div
                    onClick={() => { setSelectedProvider('GENERIC'); setActiveTab('settings'); }}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                            <RefreshCw className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full uppercase tracking-wider">
                            API Polling
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">SGP</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                        {t('sgp_provider_description')}
                    </p>
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-auto">
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Settings className="w-4 h-4" /> {t('configure_button')}
                        </span>
                    </div>
                </div>

            </div>

            {renderProviderModal()}
        </div>
    );
};
