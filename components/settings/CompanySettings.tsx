
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { Building2, Save, Upload, Globe, Mail, Phone, MapPin, Hash, Loader2, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import * as companyService from '../../services/companyService';
import { CustomInput } from '../common/CustomInput';

const SkeletonBlock = ({ className = '' }: { className?: string }) => (
    <div className={`bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse ${className}`} />
);

const SettingsSkeleton = () => (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Header skeleton */}
        <div className="space-y-2">
            <SkeletonBlock className="h-7 w-52" />
            <SkeletonBlock className="h-4 w-80" />
        </div>

        {/* Identity card skeleton */}
        <div className="bg-white dark:bg-[#1a1d23] rounded-xl p-6 border border-slate-200 dark:border-slate-700/30">
            <SkeletonBlock className="h-3 w-32 mb-6" />
            <div className="flex gap-8 items-start">
                <SkeletonBlock className="w-28 h-28 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-4">
                    <SkeletonBlock className="h-10 w-full rounded-lg" />
                    <SkeletonBlock className="h-3 w-48" />
                </div>
            </div>
        </div>

        {/* Grid cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map(i => (
                <div key={i} className="bg-white dark:bg-[#1a1d23] rounded-xl p-6 border border-slate-200 dark:border-slate-700/30 space-y-4">
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="h-10 w-full rounded-lg" />
                    <SkeletonBlock className="h-10 w-full rounded-lg" />
                </div>
            ))}
        </div>

        {/* Location skeleton */}
        <div className="bg-white dark:bg-[#1a1d23] rounded-xl p-6 border border-slate-200 dark:border-slate-700/30">
            <SkeletonBlock className="h-3 w-24 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2"><SkeletonBlock className="h-10 w-full rounded-lg" /></div>
                <SkeletonBlock className="h-10 w-full rounded-lg" />
                <div className="grid grid-cols-2 gap-2">
                    <SkeletonBlock className="h-10 rounded-lg" />
                    <SkeletonBlock className="h-10 rounded-lg" />
                </div>
            </div>
        </div>
    </div>
);

export const CompanySettings: React.FC = () => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        cnpj: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        businessEmail: '',
        website: '',
        logoUrl: ''
    });

    useEffect(() => {
        loadCompanyProfile();
    }, []);

    useEffect(() => {
        if (status) {
            const timer = setTimeout(() => setStatus(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const loadCompanyProfile = async () => {
        setLoading(true);
        try {
            const data = await companyService.getCompanyProfile();
            setFormData({
                name: data.name || '',
                phone: data.phone || '',
                cnpj: data.cnpj || '',
                address: data.address || '',
                city: data.city || '',
                state: data.state || '',
                zipCode: data.zipCode || '',
                businessEmail: data.businessEmail || '',
                website: data.website || '',
                logoUrl: data.logoUrl || ''
            });
        } catch (error) {
            console.error('Error loading profile', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setStatus(null);
        try {
            await companyService.updateCompanyProfile(formData);
            setStatus({ type: 'success', message: t('company_save_success') });
        } catch (error) {
            setStatus({ type: 'error', message: t('company_save_error') });
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            setUploading(true);
            try {
                const res = await companyService.uploadCompanyLogo(reader.result as string);
                setFormData(prev => ({ ...prev, logoUrl: res.logoUrl }));
                setStatus({ type: 'success', message: 'Logo atualizada com sucesso!' });
            } catch (error) {
                setStatus({ type: 'error', message: 'Erro ao enviar logo' });
            } finally {
                setUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const update = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

    if (loading) return <SettingsSkeleton />;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Building2 className="w-6 h-6 text-emerald-500" />
                        {t('company_settings_title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('company_settings_subtitle')}</p>
                </div>

                {/* Save button in header */}
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.97] disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? t('company_uploading') : t('company_save_button')}
                </button>
            </div>

            {/* Status toast */}
            {status && (
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
                    status.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/30'
                }`}>
                    {status.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {status.message}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                {/* Visual Identity */}
                <div className="bg-white dark:bg-[#1a1d23] rounded-xl p-6 border border-slate-200 dark:border-slate-700/30">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">
                        {t('company_identity_section') || 'Identidade Visual'}
                    </h2>

                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                        {/* Logo */}
                        <label className="relative group cursor-pointer shrink-0">
                            <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-[#151820] border-2 border-dashed border-slate-200 dark:border-slate-700/30 flex items-center justify-center overflow-hidden transition-all group-hover:border-emerald-400 dark:group-hover:border-emerald-600">
                                {formData.logoUrl ? (
                                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-2xl">
                                        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md transition-all group-hover:scale-110">
                                <Camera className="w-3.5 h-3.5" />
                            </div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                        </label>

                        <div className="flex-1 space-y-3 w-full">
                            <CustomInput
                                label={t('company_name_label')}
                                type="text"
                                value={formData.name}
                                onChange={e => update('name', e.target.value)}
                                required
                            />
                            <p className="text-[11px] text-slate-400">{t('company_logo_hint')}</p>
                        </div>
                    </div>
                </div>

                {/* Contact & Legal — 2-column grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Legal */}
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl p-6 border border-slate-200 dark:border-slate-700/30 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5" />
                            {t('company_legal_section') || 'Informações Legais'}
                        </h3>
                        <CustomInput
                            label={t('company_cnpj_label')}
                            type="text"
                            value={formData.cnpj}
                            onChange={e => update('cnpj', e.target.value)}
                            placeholder="00.000.000/0000-00"
                            icon={Hash}
                        />
                        <CustomInput
                            label={t('company_phone_label')}
                            type="text"
                            value={formData.phone}
                            onChange={e => update('phone', e.target.value)}
                            icon={Phone}
                        />
                    </div>

                    {/* Digital */}
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl p-6 border border-slate-200 dark:border-slate-700/30 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5" />
                            {t('company_digital_section') || 'Canais Digitais'}
                        </h3>
                        <CustomInput
                            label={t('company_email_label')}
                            type="email"
                            value={formData.businessEmail}
                            onChange={e => update('businessEmail', e.target.value)}
                            icon={Mail}
                        />
                        <CustomInput
                            label={t('company_website_label')}
                            type="text"
                            value={formData.website}
                            onChange={e => update('website', e.target.value)}
                            placeholder="https://"
                            icon={Globe}
                        />
                    </div>
                </div>

                {/* Location */}
                <div className="bg-white dark:bg-[#1a1d23] rounded-xl p-6 border border-slate-200 dark:border-slate-700/30">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" />
                        {t('company_location_section') || 'Localização'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            <CustomInput
                                label={t('company_address_label')}
                                type="text"
                                value={formData.address}
                                onChange={e => update('address', e.target.value)}
                                icon={MapPin}
                            />
                        </div>
                        <CustomInput
                            label={t('company_city_label')}
                            type="text"
                            value={formData.city}
                            onChange={e => update('city', e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <CustomInput
                                label={t('company_state_label')}
                                type="text"
                                value={formData.state}
                                onChange={e => update('state', e.target.value)}
                                maxLength={2}
                            />
                            <CustomInput
                                label={t('company_zip_label')}
                                type="text"
                                value={formData.zipCode}
                                onChange={e => update('zipCode', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};
