import React, { useState, useEffect } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface ResetPasswordPageProps {
    onBackToLogin: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onBackToLogin }) => {
    const { t } = useLanguage();
    const [token, setToken] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenParam = urlParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setError(t('reset_password_error'));
        }
    }, [t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError(t('reset_password_error_mismatch'));
            return;
        }
        if (password.length < 6) {
            setError(t('reset_password_error_length'));
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const data = await response.json();
            if (response.ok) {
                setSuccess(true);
            } else {
                setError(data.error || t('reset_password_error'));
            }
        } catch (err) {
            setError(t('reset_password_error_connection'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 lg:p-0 relative overflow-hidden bg-slate-950 dark">

            {/* Background */}
            <div className="absolute inset-0 z-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md"></div>

            <div className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-8 sm:p-12">
                    <div className="text-center space-y-2 mb-8">
                        <div className="flex justify-center mb-6">
                            <img src="/logo.png" alt="Logo" className="h-20 w-auto object-contain" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                            {success ? t('reset_password_success') : t('reset_password_title')}
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                            {success ? t('reset_password_success_redirect') : t('reset_password_subtitle')}
                        </p>
                    </div>

                    {success ? (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex justify-center">
                                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-10 h-10" />
                                </div>
                            </div>
                            <button
                                onClick={onBackToLogin}
                                className="w-full text-white bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-sm px-5 py-4 text-center transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                            >
                                {t('back_to_login')}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-300 text-sm font-medium flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent block w-full p-4 placeholder-zinc-400 outline-none font-medium transition-all"
                                        placeholder={t('register_password_placeholder')}
                                        required
                                        disabled={isLoading || !token}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent block w-full p-4 placeholder-zinc-400 outline-none font-medium transition-all"
                                        placeholder={t('register_confirm_password_placeholder')}
                                        required
                                        disabled={isLoading || !token}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !token}
                                className="w-full text-white bg-emerald-600 hover:bg-emerald-500 focus:ring-4 focus:outline-none focus:ring-emerald-300 font-bold rounded-xl text-sm px-5 py-4 text-center transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                            >
                                {isLoading ? t('loading') : t('reset_password_button')}
                            </button>

                            <button
                                type="button"
                                onClick={onBackToLogin}
                                className="w-full text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {t('back_to_login')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
