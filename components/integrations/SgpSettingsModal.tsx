import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { AlertTriangle, Copy, Save, Loader2, KeyRound, Globe, Webhook } from 'lucide-react';
import { CustomInput } from '../common/CustomInput';
import { Button } from '../common/Button';
import api from '../../services/api';

interface SgpSettingsModalProps {
    providerType: 'IXC' | 'GENERIC';
}

interface IntegrationSettings {
    apiUrl: string;
    apiApp?: string; // New field for generic SGP App
    apiToken: string;
    customWebhookUrl?: string; // Automatically generated on backend or frontend
    active: boolean;
}

export const SgpSettingsModal: React.FC<SgpSettingsModalProps> = ({ providerType }) => {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<IntegrationSettings>({ apiUrl: '', apiToken: '', active: false });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        fetchSettings();
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
        } catch (error) {
            console.error("Failed to fetch settings", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await api.post(`/integrations/sgp/settings/${providerType}`, settings);
            alert(t('sgp_save_success'));
        } catch (error) {
            alert(t('sgp_save_error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSyncStatuses = async () => {
        setIsSyncing(true);
        try {
            const res = await api.post(`/integrations/sgp/sync-all/${providerType}`);
            alert(t('sgp_sync_success', { updated: res.data.updated, total: res.data.total }));
            window.dispatchEvent(new CustomEvent('customers-synced'));
        } catch (error: any) {
            alert(t('sgp_sync_error') + (error.response?.data?.error || error.message));
        } finally {
            setIsSyncing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert(t('sgp_copy_success'));
    };

    if (isLoading) {
        return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
    }

    return (
        <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-300">
            {/* Warning Alert */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-semibold mb-1">{t('sgp_credentials_warning_title')}</p>
                    <p>{t('sgp_credentials_warning_text')}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl">
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">{t('sgp_activate_label')}</h4>
                        <p className="text-sm text-slate-500">{t('sgp_activate_help')}</p>
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

                <CustomInput
                    label={providerType === 'IXC' ? t('ixc_token_label') : t('sgp_token_label')}
                    type="password"
                    icon={KeyRound}
                    placeholder={providerType === 'IXC' ? t('ixc_token_placeholder') : t('sgp_token_placeholder')}
                    value={settings.apiToken}
                    onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
                    required
                />

                {providerType === 'IXC' && settings.customWebhookUrl && (
                    <div className="mt-6">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t('sgp_webhook_url_label')}</label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-600 dark:text-slate-300 font-mono overflow-x-auto whitespace-nowrap">
                                {settings.customWebhookUrl}
                            </div>
                            <Button type="button" variant="secondary" onClick={() => copyToClipboard(settings.customWebhookUrl || '')}>
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <Webhook className="w-3 h-3" />
                            {t('sgp_webhook_url_help')}
                        </p>
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleSyncStatuses} 
                    isLoading={isSyncing} 
                    disabled={isSyncing || !settings.apiUrl || !settings.apiToken}
                    className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                    <Globe className="w-4 h-4" />
                    {t('sgp_sync_button')}
                </Button>

                <Button type="submit" isLoading={isSaving} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                    <Save className="w-4 h-4" />
                    {t('sgp_save_button')}
                </Button>
            </div>
        </form>
    );
};
