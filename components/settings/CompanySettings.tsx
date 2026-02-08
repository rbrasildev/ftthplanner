
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { Building2, Save, Upload, Globe, Mail, Phone, MapPin, Hash, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import * as companyService from '../../services/companyService';

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

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-7 h-7 text-sky-500" />
                    {t('company_settings_title')}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('company_settings_subtitle')}</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Visual Identity Section */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                        Identidade Visual
                    </h2>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                                {formData.logoUrl ? (
                                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <Building2 className="w-12 h-12 text-slate-300" />
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase">{t('company_uploading')}</span>
                                    </div>
                                )}
                            </div>
                            <label className="absolute -bottom-2 -right-2 p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-lg cursor-pointer transition-all active:scale-95">
                                <Upload className="w-4 h-4" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                            </label>
                        </div>

                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    {t('company_name_label')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                                    required
                                />
                            </div>
                            <p className="text-xs text-slate-500 italic">{t('company_logo_hint')}</p>
                        </div>
                    </div>
                </div>

                {/* Contact and Legal Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Hash className="w-4 h-4" /> Informações Legais
                        </h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('company_cnpj_label')}</label>
                            <input
                                type="text"
                                value={formData.cnpj}
                                onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                                placeholder="00.000.000/0000-00"
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('company_phone_label')}</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Canais Digitais
                        </h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('company_email_label')}</label>
                            <input
                                type="email"
                                value={formData.businessEmail}
                                onChange={e => setFormData({ ...formData, businessEmail: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('company_website_label')}</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={formData.website}
                                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Location Section */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Localização
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('company_address_label')}</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('company_city_label')}</label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">{t('company_state_label')}</label>
                                <input
                                    type="text"
                                    value={formData.state}
                                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                                    maxLength={2}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">{t('company_zip_label')}</label>
                                <input
                                    type="text"
                                    value={formData.zipCode}
                                    onChange={e => setFormData({ ...formData, zipCode: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status and Action */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4">
                    {status ? (
                        <div className={`flex items-center gap-2 text-sm font-bold ${status.type === 'success' ? 'text-emerald-500' : 'text-red-500'} animate-in slide-in-from-left-2`}>
                            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            {status.message}
                        </div>
                    ) : <div></div>}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                {t('company_save_button')}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
