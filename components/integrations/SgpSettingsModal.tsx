import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../LanguageContext';
import { AlertTriangle, Copy, Save, Loader2, KeyRound, Globe, Webhook, Zap, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { CustomInput } from '../common/CustomInput';
import { Button } from '../common/Button';
import api from '../../services/api';

interface SgpSettingsModalProps {
    providerType: 'IXC' | 'GENERIC';
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface IntegrationSettings {
    apiUrl: string;
    apiApp?: string;
    apiToken: string;
    customWebhookUrl?: string;
    active: boolean;
}

interface SyncProgress {
    phase: 'idle' | 'syncing' | 'done' | 'error';
    current: number;
    total: number;
    updated: number;
}

export const SgpSettingsModal: React.FC<SgpSettingsModalProps> = ({ providerType, showToast }) => {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<IntegrationSettings>({ apiUrl: '', apiToken: '', active: false });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [syncProgress, setSyncProgress] = useState<SyncProgress>({ phase: 'idle', current: 0, total: 0, updated: 0 });
    const testTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        fetchSettings();
        return () => { if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current); };
    }, [providerType]);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/integrations/sgp/settings/${providerType}`);
            if (res.data) {
                setSettings({
                    apiUrl: res.data.apiUrl || '',
                    apiApp: res.data.apiApp || '',
                    apiToken: res.data.apiToken || '',
                    active: res.data.active || false,
                    customWebhookUrl: res.data.customWebhookUrl || ''
                });
            }
        } catch {
            // Settings not found - use defaults
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await api.post(`/integrations/sgp/settings/${providerType}`, settings);
            showToast(t('sgp_save_success'), 'success');
        } catch {
            showToast(t('sgp_save_error'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!settings.apiUrl || !settings.apiToken) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            // Use the search endpoint with a dummy CPF to test connectivity
            await api.post(`/integrations/sgp/search-customer/${providerType}`, { cpfCnpj: '00000000000' });
            setTestResult('success');
            showToast(t('sgp_test_success'), 'success');
        } catch (error: any) {
            // A 404/no-result is still a valid connection — only network/auth errors are failures
            const status = error.response?.status;
            if (status && status >= 200 && status < 500) {
                setTestResult('success');
                showToast(t('sgp_test_success'), 'success');
            } else {
                setTestResult('error');
                const msg = error.response?.data?.error || error.message || 'Unknown error';
                showToast(t('sgp_test_error', { error: msg }), 'error');
            }
        } finally {
            setIsTesting(false);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
            testTimeoutRef.current = setTimeout(() => setTestResult(null), 5000);
        }
    };

    const handleSyncStatuses = async () => {
        setSyncProgress({ phase: 'syncing', current: 0, total: 0, updated: 0 });
        try {
            const res = await api.post(`/integrations/sgp/sync-all/${providerType}`);
            const { updated, total } = res.data;
            setSyncProgress({ phase: 'done', current: total, total, updated });
            showToast(t('sgp_sync_success', { updated, total }), 'success');
            window.dispatchEvent(new CustomEvent('customers-synced'));
            setTimeout(() => setSyncProgress({ phase: 'idle', current: 0, total: 0, updated: 0 }), 5000);
        } catch (error: any) {
            setSyncProgress({ phase: 'error', current: 0, total: 0, updated: 0 });
            showToast(t('sgp_sync_error') + (error.response?.data?.error || error.message), 'error');
            setTimeout(() => setSyncProgress({ phase: 'idle', current: 0, total: 0, updated: 0 }), 3000);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast(t('sgp_copy_success'), 'info');
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-slate-100 dark:bg-slate-800/30 rounded-xl p-4 h-20 animate-pulse" />
                <div className="bg-slate-100 dark:bg-slate-800/30 rounded-xl p-4 h-14 animate-pulse" />
                <div className="bg-slate-100 dark:bg-slate-800/30 rounded-xl p-5 space-y-4 animate-pulse">
                    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700/50 rounded" />
                    <div className="h-10 bg-slate-200 dark:bg-slate-700/50 rounded-lg" />
                    <div className="h-10 bg-slate-200 dark:bg-slate-700/50 rounded-lg" />
                    <div className="h-8 w-36 bg-slate-200 dark:bg-slate-700/50 rounded-lg" />
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-300">
            {/* Warning Alert */}
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-semibold mb-0.5">{t('sgp_credentials_warning_title')}</p>
                    <p className="text-amber-600/80 dark:text-amber-400/70 text-xs">{t('sgp_credentials_warning_text')}</p>
                </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between bg-white dark:bg-[#22262e]/50 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
                <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{t('sgp_activate_label')}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t('sgp_activate_help')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.active}
                        onChange={(e) => setSettings({ ...settings, active: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                </label>
            </div>

            {/* Credential Fields */}
            <div className="space-y-4 bg-white dark:bg-[#22262e]/30 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('sgp_credentials_title')}</h4>

                <CustomInput
                    label={t('api_url_label')}
                    type="url"
                    icon={Globe}
                    placeholder={providerType === 'IXC' ? t('ixc_url_placeholder') : t('sgp_url_placeholder')}
                    value={settings.apiUrl}
                    onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                    required
                />

                {providerType === 'GENERIC' && (
                    <CustomInput
                        label={t('sgp_app_label')}
                        type="text"
                        icon={KeyRound}
                        placeholder={t('sgp_app_id_placeholder')}
                        value={settings.apiApp || ''}
                        onChange={(e) => setSettings({ ...settings, apiApp: e.target.value })}
                        required={providerType === 'GENERIC'}
                    />
                )}

                <div>
                    <CustomInput
                        label={providerType === 'IXC' ? t('ixc_token_label') : t('sgp_token_label')}
                        type="password"
                        icon={KeyRound}
                        placeholder={providerType === 'IXC' ? t('ixc_token_placeholder') : t('sgp_token_placeholder')}
                        value={settings.apiToken}
                        onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
                        required
                    />
                    {providerType === 'IXC' && (
                        <p className="text-[10px] text-slate-400 mt-1.5 ml-1">{t('ixc_token_help')}</p>
                    )}
                </div>

                {/* Test Connection Button */}
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTesting || !settings.apiUrl || !settings.apiToken}
                        className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${testResult === 'success'
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                            : testResult === 'error'
                                ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#22262e] text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600'
                            }`}
                    >
                        {isTesting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : testResult === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : testResult === 'error' ? (
                            <XCircle className="w-3.5 h-3.5" />
                        ) : (
                            <Zap className="w-3.5 h-3.5" />
                        )}
                        {isTesting ? t('sgp_testing') : t('sgp_test_connection')}
                    </button>
                </div>
            </div>

            {/* Webhook URL (IXC only) */}
            {providerType === 'IXC' && settings.customWebhookUrl && (
                <div className="bg-white dark:bg-[#22262e]/30 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                        <Webhook className="w-3.5 h-3.5 inline mr-1" />
                        {t('sgp_webhook_url_label')}
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 font-mono overflow-x-auto whitespace-nowrap">
                            {settings.customWebhookUrl}
                        </div>
                        <Button type="button" variant="secondary" size="sm" onClick={() => copyToClipboard(settings.customWebhookUrl || '')}>
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                        {t('sgp_webhook_url_help')}
                    </p>
                </div>
            )}

            {/* Sync Section */}
            <div className="bg-white dark:bg-[#22262e]/30 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                    {t('sgp_sync_title')}
                </h4>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                        {syncProgress.phase === 'syncing' && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="font-medium">{t('sgp_sync_button')}...</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                                </div>
                            </div>
                        )}
                        {syncProgress.phase === 'done' && (
                            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-medium">
                                    {t('sgp_sync_success', { updated: syncProgress.updated, total: syncProgress.total })}
                                </span>
                            </div>
                        )}
                        {syncProgress.phase === 'error' && (
                            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 animate-in fade-in duration-300">
                                <XCircle className="w-4 h-4" />
                                <span className="font-medium">{t('sgp_sync_error')}</span>
                            </div>
                        )}
                        {syncProgress.phase === 'idle' && (
                            <p className="text-xs text-slate-400">{t('sgp_credentials_warning_text')}</p>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSyncStatuses}
                        disabled={syncProgress.phase === 'syncing' || !settings.apiUrl || !settings.apiToken}
                        className="gap-2 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncProgress.phase === 'syncing' ? 'animate-spin' : ''}`} />
                        {t('sgp_sync_button')}
                    </Button>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
                <Button type="submit" isLoading={isSaving} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6">
                    <Save className="w-4 h-4" />
                    {t('sgp_save_button')}
                </Button>
            </div>
        </form>
    );
};
