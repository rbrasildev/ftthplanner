import React, { useState } from 'react';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface RegisterPageProps {
    onRegister: (username: string, email: string, password?: string, companyName?: string, planName?: string) => void;
    onBackToLogin: () => void;
    onBackToLanding: () => void;
    initialPlan?: string;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegister, onBackToLogin, onBackToLanding, initialPlan }) => {
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const generatedUsername = email.split('@')[0] || email;

        if (!email.trim() || !password.trim() || !companyName.trim()) {
            setError(t('register_error_empty'));
            return;
        }
        if (password !== confirmPassword) {
            setError(t('register_error_match'));
            return;
        }
        setError(null);
        onRegister(generatedUsername, email, password, companyName, initialPlan);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 lg:p-0 relative overflow-hidden bg-zinc-950 dark">

            {/* 1. Page Background (Blurred Map) - HIDDEN ON MOBILE */}
            <div
                className="hidden lg:block absolute inset-0 z-0 bg-cover bg-center"
                style={{ backgroundImage: 'url("/login-bg.png")' }}
            >
                <div className="absolute inset-0 bg-zinc-900/60 dark:bg-black/70 backdrop-blur-md"></div>
            </div>

            {/* Back Button */}
            <button
                onClick={onBackToLanding}
                className="absolute top-8 left-8 z-20 flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-white transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">{t('back_to_home')}</span>
            </button>

            {/* 2. Main Container */}
            <div className="relative z-10 w-full max-w-[1200px] h-auto lg:h-[800px] lg:bg-white lg:dark:bg-zinc-900 lg:border lg:border-zinc-200 lg:dark:border-zinc-800 lg:rounded-3xl overflow-hidden lg:shadow-2xl flex flex-col lg:flex-row bg-transparent dark:bg-transparent shadow-none border-none justify-center">

                {/* Left Side - Form */}
                <div className="w-full lg:w-5/12 p-0 sm:p-12 xl:p-16 flex flex-col justify-center bg-transparent dark:bg-transparent lg:bg-white lg:dark:bg-zinc-900">

                    <div className="max-w-sm mx-auto w-full space-y-8">
                        <div className="text-center space-y-2 relative">
                            {/* Back Button for Mobile within flow or desktop */}
                            <button
                                onClick={onBackToLogin}
                                className="absolute left-0 top-1/2 -translate-y-1/2 lg:-left-12 lg:top-1 p-2 text-zinc-400 hover:text-emerald-500 transition-colors"
                                title={t('back_to_login')}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>

                            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{t('register_page_title')}</h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                                {t('register_subtitle')}
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-300 text-sm text-center animate-in fade-in slide-in-from-top-2 font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-5">
                            <div className="space-y-5 lg:space-y-4">

                                <div className="space-y-1">
                                    <label className="sr-only">{t('register_company_placeholder')}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-base lg:text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent block w-full p-4 placeholder-zinc-400 transition-all outline-none font-medium shadow-sm lg:shadow-none"
                                            placeholder={t('register_company_placeholder')}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="sr-only">{t('login_email_placeholder')}</label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-base lg:text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent block w-full p-4 placeholder-zinc-400 transition-all outline-none font-medium shadow-sm lg:shadow-none"
                                            placeholder={t('login_email_placeholder')}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="sr-only">{t('login_password_placeholder')}</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-base lg:text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent block w-full p-4 placeholder-zinc-400 transition-all outline-none font-medium shadow-sm lg:shadow-none"
                                            placeholder={t('register_password_placeholder')}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="sr-only">{t('register_confirm_password_placeholder')}</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-base lg:text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent block w-full p-4 placeholder-zinc-400 transition-all outline-none font-medium shadow-sm lg:shadow-none"
                                            placeholder={t('register_confirm_password_placeholder')}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full text-white bg-emerald-600 hover:bg-emerald-500 focus:ring-4 focus:outline-none focus:ring-emerald-300 font-bold rounded-xl text-base lg:text-sm px-5 py-4 text-center transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                            >
                                {t('register_button')}
                            </button>

                            <div className="text-center pt-2">
                                <button type="button" onClick={onBackToLogin} className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm font-semibold transition-colors">
                                    {t('register_already_have_account')}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>

                {/* Right Side - Feature Image Display (Hidden on Mobile) */}
                <div className="hidden lg:flex w-7/12 bg-zinc-50 dark:bg-zinc-950 relative items-center justify-center p-12 overflow-hidden">

                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-zinc-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

                    {/* Feature Image Card */}
                    <div className="relative w-full max-w-2xl z-10">
                        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 p-3 rounded-2xl shadow-2xl transform hover:scale-[1.01] transition-transform duration-500">
                            <img
                                src="/login-feature.png"
                                alt="Feature Preview"
                                className="w-full h-auto rounded-xl shadow-inner border border-zinc-200/50 dark:border-zinc-800/50"
                            />
                        </div>

                        {/* Floating Feature Label */}
                        <div className="absolute -bottom-8 -right-8 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-700 flex items-center gap-4 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-200">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-zinc-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <KeyRound className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{t('login_feature_label')}</div>
                                <div className="text-sm font-bold text-zinc-800 dark:text-white">{t('login_feature_title')}</div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};
