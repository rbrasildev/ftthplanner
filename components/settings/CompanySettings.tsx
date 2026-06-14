import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../../LanguageContext';
import { Building2, Save, Globe, Mail, Phone, MapPin, Hash, Loader2, CheckCircle2, AlertCircle, Camera, X, Undo2 } from 'lucide-react';
import * as companyService from '../../services/companyService';
import { CustomInput } from '../common/CustomInput';
import { CustomSelect } from '../common/CustomSelect';

// --- Masks & validators (BR locale) ---
const onlyDigits = (s: string) => s.replace(/\D/g, '');

const maskCNPJ = (raw: string): string => {
    const d = onlyDigits(raw).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const maskPhone = (raw: string): string => {
    const d = onlyDigits(raw).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCEP = (raw: string): string => {
    const d = onlyDigits(raw).slice(0, 8);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
};

// CNPJ check digit validator — algoritmo oficial.
const isValidCNPJ = (raw: string): boolean => {
    const c = onlyDigits(raw);
    if (c.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(c)) return false; // bloqueia 00000000000000, 11111... etc
    const calc = (slice: string, weights: number[]) => {
        const sum = slice.split('').reduce((acc, n, i) => acc + parseInt(n, 10) * weights[i], 0);
        const mod = sum % 11;
        return mod < 2 ? 0 : 11 - mod;
    };
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calc(c.slice(0, 12), w1);
    const d2 = calc(c.slice(0, 12) + d1, w2);
    return c[12] === String(d1) && c[13] === String(d2);
};

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const isValidPhone = (s: string) => onlyDigits(s).length >= 10;
const isValidCEP = (s: string) => onlyDigits(s).length === 8;
const isValidURL = (s: string) => {
    if (!s.trim()) return true; // optional
    try {
        const u = s.startsWith('http') ? s : `https://${s}`;
        new URL(u);
        return true;
    } catch { return false; }
};

// 27 UFs do Brasil — ordem alfabética.
const BR_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
].map(uf => ({ value: uf, label: uf }));

// --- Skeleton ---
const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse ${className}`} />
);

const SettingsSkeleton = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="space-y-2">
            <SkeletonBlock className="h-7 w-52" />
            <SkeletonBlock className="h-4 w-80" />
        </div>
        {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700/30 p-6 space-y-4">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="h-3 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {[1, 2, 3].map(j => <SkeletonBlock key={j} className="h-10 rounded-lg" />)}
                </div>
            </div>
        ))}
    </div>
);

// --- SaveSectionButton: aparece apenas quando a seção tem alteração pendente. ---
const SaveSectionButton: React.FC<{
    visible: boolean;
    saving: boolean;
    disabled?: boolean;
    onClick: () => void;
}> = ({ visible, saving, disabled, onClick }) => {
    if (!visible) return null;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={saving || disabled}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-sm"
            title={disabled ? 'Corrija os erros antes de salvar' : 'Salvar esta seção'}
        >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Salvando…' : 'Salvar'}
        </button>
    );
};

// --- Seção plana (sem card): header + conteúdo + save inline. ---
const SettingsSection: React.FC<{
    title: string;
    description?: string;
    dirty: boolean;
    saving: boolean;
    hasErrors: boolean;
    onSave: () => void;
    children: React.ReactNode;
}> = ({ title, description, dirty, saving, hasErrors, onSave, children }) => (
    <section className="bg-white dark:bg-[#1a1d23] border border-slate-200/80 dark:border-slate-700/30 rounded-2xl">
        <header className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4">
            <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
                {description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
                )}
            </div>
            <SaveSectionButton visible={dirty} saving={saving} disabled={hasErrors} onClick={onSave} />
        </header>
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-1">{children}</div>
    </section>
);

type FormState = {
    name: string;
    phone: string;
    cnpj: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    businessEmail: string;
    website: string;
    logoUrl: string;
};

const EMPTY_FORM: FormState = {
    name: '', phone: '', cnpj: '', address: '', city: '', state: '',
    zipCode: '', businessEmail: '', website: '', logoUrl: '',
};

export const CompanySettings: React.FC = () => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
    // Snapshot inicial pra detectar dirty state + permitir reset.
    const [initialData, setInitialData] = useState<FormState>(EMPTY_FORM);
    // touched: campos que perderam foco — só validamos depois pra não
    // pintar tudo vermelho na carga inicial.
    const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});

    useEffect(() => {
        loadCompanyProfile();
    }, []);

    // Auto-dismiss SÓ pra success (3s). Errors persistem até user fechar.
    useEffect(() => {
        if (status?.type === 'success') {
            const timer = setTimeout(() => setStatus(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const loadCompanyProfile = async () => {
        setLoading(true);
        try {
            const data = await companyService.getCompanyProfile();
            const next: FormState = {
                name: data.name || '',
                phone: maskPhone(data.phone || ''),
                cnpj: maskCNPJ(data.cnpj || ''),
                address: data.address || '',
                city: data.city || '',
                state: (data.state || '').toUpperCase(),
                zipCode: maskCEP(data.zipCode || ''),
                businessEmail: data.businessEmail || '',
                website: data.website || '',
                logoUrl: data.logoUrl || '',
            };
            setFormData(next);
            setInitialData(next);
            setTouched({});
        } catch (error) {
            console.error('Error loading profile', error);
            setStatus({ type: 'error', message: 'Falha ao carregar perfil da empresa.' });
        } finally {
            setLoading(false);
        }
    };

    const update = useCallback((field: keyof FormState, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const onBlur = useCallback((field: keyof FormState) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    }, []);

    // Erros por campo — calculados a cada render baseado em formData + touched.
    const errors = useMemo(() => {
        const e: Partial<Record<keyof FormState, string>> = {};
        if (!formData.name.trim()) e.name = 'Obrigatório';
        if (formData.cnpj && !isValidCNPJ(formData.cnpj)) e.cnpj = 'CNPJ inválido';
        if (formData.phone && !isValidPhone(formData.phone)) e.phone = 'Telefone incompleto';
        if (formData.businessEmail && !isValidEmail(formData.businessEmail)) e.businessEmail = 'Email inválido';
        if (formData.zipCode && !isValidCEP(formData.zipCode)) e.zipCode = 'CEP deve ter 8 dígitos';
        if (formData.website && !isValidURL(formData.website)) e.website = 'URL inválida';
        return e;
    }, [formData]);

    const visibleErrors = useMemo(() => {
        const out: Partial<Record<keyof FormState, string>> = {};
        for (const k of Object.keys(errors) as (keyof FormState)[]) {
            if (touched[k]) out[k] = errors[k];
        }
        return out;
    }, [errors, touched]);

    const hasErrors = Object.keys(errors).length > 0;

    // Dirty: comparação rasa entre form atual e snapshot.
    const dirty = useMemo(() => {
        return (Object.keys(formData) as (keyof FormState)[]).some(k => formData[k] !== initialData[k]);
    }, [formData, initialData]);

    const handleReset = () => {
        setFormData(initialData);
        setTouched({});
        setStatus(null);
    };

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault();
        // Marca todos os campos como touched pra mostrar erros pendentes.
        if (hasErrors) {
            setTouched({ name: true, cnpj: true, phone: true, businessEmail: true, zipCode: true, website: true });
            setStatus({ type: 'error', message: 'Corrija os campos destacados antes de salvar.' });
            return;
        }
        setSaving(true);
        setStatus(null);
        try {
            await companyService.updateCompanyProfile(formData);
            setStatus({ type: 'success', message: t('company_save_success') || 'Alterações salvas.' });
            setInitialData(formData);
        } catch {
            setStatus({ type: 'error', message: t('company_save_error') || 'Erro ao salvar. Tenta novamente.' });
        } finally {
            setSaving(false);
        }
    };

    // Ctrl/Cmd+S pra salvar rapidamente.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (dirty && !saving) handleSave();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [dirty, saving, handleSave]);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            setUploading(true);
            try {
                const res = await companyService.uploadCompanyLogo(reader.result as string);
                setFormData(prev => ({ ...prev, logoUrl: res.logoUrl }));
                setInitialData(prev => ({ ...prev, logoUrl: res.logoUrl }));
                setStatus({ type: 'success', message: t('company_logo_success') || 'Logo atualizado.' });
            } catch {
                setStatus({ type: 'error', message: t('company_logo_error') || 'Erro ao enviar logo.' });
            } finally {
                setUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    // Dirty por seção — habilita só o botão da seção que tem mudança pendente.
    const fieldsChanged = (fields: (keyof FormState)[]) =>
        fields.some(f => formData[f] !== initialData[f]);
    const identityDirty = fieldsChanged(['name', 'logoUrl']);
    const contactDirty = fieldsChanged(['cnpj', 'phone', 'businessEmail', 'website']);
    const addressDirty = fieldsChanged(['zipCode', 'address', 'city', 'state']);

    if (loading) return <SettingsSkeleton />;

    return (
        <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-300 pb-24">
            {/* Status toast — success efêmero, error persistente */}
            {status && (
                <div
                    role={status.type === 'error' ? 'alert' : 'status'}
                    className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${status.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30'}`}
                >
                    {status.type === 'success'
                        ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span className="flex-1">{status.message}</span>
                    {status.type === 'error' && (
                        <button
                            type="button"
                            onClick={() => setStatus(null)}
                            className="shrink-0 p-1 -m-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/40"
                            aria-label="Fechar"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}

            {/* === HERO IDENTIDADE === */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-[#1a1d23] dark:to-[#22262e] border border-slate-200/80 dark:border-slate-700/30 rounded-2xl p-6 sm:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_50%)] pointer-events-none" />
                <div className="relative flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                    {/* Logo grande */}
                    <label className="relative group cursor-pointer shrink-0">
                        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center justify-center overflow-hidden transition-all group-hover:shadow-md group-hover:border-emerald-300 dark:group-hover:border-emerald-700">
                            {formData.logoUrl ? (
                                <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                            ) : (
                                <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                            )}
                            {uploading && (
                                <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-2xl">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                                <span className="text-white text-xs font-bold flex items-center gap-1.5">
                                    <Camera className="w-3.5 h-3.5" /> Alterar
                                </span>
                            </div>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                    </label>

                    {/* Identidade — nome editável inline */}
                    <div className="flex-1 w-full min-w-0">
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Nome da organização</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => update('name', e.target.value)}
                            onBlur={() => onBlur('name')}
                            placeholder="Minha Empresa"
                            className={`w-full text-2xl sm:text-3xl font-extrabold bg-transparent border-0 border-b-2 border-transparent focus:border-emerald-500 focus:outline-none text-slate-900 dark:text-white tracking-tight pb-1 transition-colors ${visibleErrors.name ? 'border-rose-400' : ''}`}
                            required
                        />
                        {visibleErrors.name && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{visibleErrors.name}</p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {t('company_logo_hint') || 'Logo PNG ou SVG, fundo transparente. Aparece em faturas e na barra lateral.'}
                        </p>
                    </div>

                    {/* Save da seção */}
                    <div className="shrink-0 self-start sm:self-center">
                        <SaveSectionButton
                            visible={identityDirty}
                            saving={saving}
                            disabled={hasErrors}
                            onClick={() => handleSave()}
                        />
                    </div>
                </div>
            </section>

            {/* === CONTATO === */}
            <SettingsSection
                title="Contato"
                description="Informações fiscais e canais oficiais."
                dirty={contactDirty}
                saving={saving}
                hasErrors={hasErrors}
                onSave={() => handleSave()}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <CustomInput
                        label={t('company_cnpj_label')}
                        type="text"
                        inputMode="numeric"
                        value={formData.cnpj}
                        onChange={e => update('cnpj', maskCNPJ(e.target.value))}
                        onBlur={() => onBlur('cnpj')}
                        error={visibleErrors.cnpj}
                        placeholder="00.000.000/0000-00"
                        icon={Hash}
                    />
                    <CustomInput
                        label={t('company_phone_label')}
                        type="tel"
                        inputMode="tel"
                        value={formData.phone}
                        onChange={e => update('phone', maskPhone(e.target.value))}
                        onBlur={() => onBlur('phone')}
                        error={visibleErrors.phone}
                        placeholder="(00) 00000-0000"
                        icon={Phone}
                    />
                    <CustomInput
                        label={t('company_email_label')}
                        type="email"
                        value={formData.businessEmail}
                        onChange={e => update('businessEmail', e.target.value)}
                        onBlur={() => onBlur('businessEmail')}
                        error={visibleErrors.businessEmail}
                        icon={Mail}
                    />
                    <div className="lg:col-span-3">
                        <CustomInput
                            label={t('company_website_label')}
                            type="text"
                            value={formData.website}
                            onChange={e => update('website', e.target.value)}
                            onBlur={() => onBlur('website')}
                            error={visibleErrors.website}
                            placeholder="https://"
                            icon={Globe}
                        />
                    </div>
                </div>
            </SettingsSection>

            {/* === ENDEREÇO === */}
            <SettingsSection
                title="Endereço"
                description="Localização da sede."
                dirty={addressDirty}
                saving={saving}
                hasErrors={hasErrors}
                onSave={() => handleSave()}
            >
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-2">
                        <CustomInput
                            label={t('company_zip_label')}
                            type="text"
                            inputMode="numeric"
                            value={formData.zipCode}
                            onChange={e => update('zipCode', maskCEP(e.target.value))}
                            onBlur={() => onBlur('zipCode')}
                            error={visibleErrors.zipCode}
                            placeholder="00000-000"
                            maxLength={9}
                        />
                    </div>
                    <div className="md:col-span-4">
                        <CustomInput
                            label={t('company_address_label')}
                            type="text"
                            value={formData.address}
                            onChange={e => update('address', e.target.value)}
                            icon={MapPin}
                        />
                    </div>
                    <div className="md:col-span-4">
                        <CustomInput
                            label={t('company_city_label')}
                            type="text"
                            value={formData.city}
                            onChange={e => update('city', e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <CustomSelect
                            label={t('company_state_label')}
                            options={BR_STATES}
                            value={formData.state}
                            onChange={v => update('state', v)}
                            placeholder="UF"
                            searchPlaceholder="Buscar UF..."
                        />
                    </div>
                </div>
            </SettingsSection>

            {/* Reset global — discreto, só aparece se tem qualquer dirty */}
            {dirty && (
                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={saving}
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition flex items-center gap-1.5"
                    >
                        <Undo2 className="w-3.5 h-3.5" />
                        Descartar todas as alterações
                    </button>
                </div>
            )}
        </form>
    );
};
