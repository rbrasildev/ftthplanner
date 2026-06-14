import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Eye, EyeOff, Save, Check, Loader2, AlertTriangle } from 'lucide-react';
import { changePassword } from '../../services/authService';
import { PASSWORD_RULES } from '../../utils/passwordRules';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Rule {
    label: string;
    test: (pwd: string, confirm: string) => boolean;
}

// Espelha PASSWORD_RULES + adiciona regra de "confirmação confere" que é
// específica desse modal (não cabe na shared lib que só vê uma senha por vez).
const RULES: Rule[] = [
    ...PASSWORD_RULES.map(r => ({ label: r.label, test: (p: string) => r.test(p) })),
    { label: 'A confirmação confere', test: (p, c) => p.length > 0 && p === c },
];

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const checks = useMemo(() => RULES.map(r => ({ ...r, pass: r.test(newPassword, confirmPassword) })), [newPassword, confirmPassword]);
    const allChecksPass = checks.every(c => c.pass);
    const canSubmit = currentPassword.length > 0 && allChecksPass && !loading && !success;

    if (!isOpen) return null;

    const reset = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrent(false);
        setShowNew(false);
        setError(null);
        setSuccess(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setError(null);
        setSuccess(false);

        try {
            setLoading(true);
            await changePassword(currentPassword, newPassword);
            setSuccess(true);
            setTimeout(() => {
                onClose();
                reset();
            }, 1600);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Falha ao alterar a senha. Verifique a senha atual e tente de novo.');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Lock className="w-5 h-5 text-emerald-500" />
                        Alterar senha
                    </h3>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg flex gap-2.5 items-start">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 dark:text-red-300 leading-snug">{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg flex gap-2.5 items-center">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Senha alterada com sucesso!</p>
                        </div>
                    )}

                    <PasswordField
                        label="Senha atual"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        show={showCurrent}
                        onToggleShow={() => setShowCurrent(!showCurrent)}
                        autoFocus
                        disabled={loading || success}
                    />

                    <PasswordField
                        label="Nova senha"
                        value={newPassword}
                        onChange={setNewPassword}
                        show={showNew}
                        onToggleShow={() => setShowNew(!showNew)}
                        disabled={loading || success}
                    />

                    <PasswordField
                        label="Confirme a nova senha"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        show={showNew}
                        onToggleShow={() => setShowNew(!showNew)}
                        disabled={loading || success}
                    />

                    {/* Requirements checklist — feedback ao vivo enquanto digita */}
                    {(newPassword.length > 0 || confirmPassword.length > 0) && (
                        <ul className="space-y-1 px-1">
                            {checks.map(c => (
                                <li key={c.label} className="flex items-center gap-2 text-xs">
                                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${c.pass ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                        {c.pass ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <span className="w-1 h-1 rounded-full bg-current" />}
                                    </span>
                                    <span className={c.pass ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-500'}>
                                        {c.label}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/30">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]"
                        >
                            {loading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                            ) : (
                                <><Save className="w-4 h-4" /> Salvar nova senha</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

interface PasswordFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggleShow: () => void;
    autoFocus?: boolean;
    disabled?: boolean;
}

const PasswordField: React.FC<PasswordFieldProps> = ({ label, value, onChange, show, onToggleShow, autoFocus, disabled }) => (
    <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            {label}
        </label>
        <div className="relative">
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                autoFocus={autoFocus}
                disabled={disabled}
                autoComplete={label.toLowerCase().includes('atual') ? 'current-password' : 'new-password'}
                className="w-full px-3 py-2.5 bg-[#f9fafb] dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700/40 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 pr-10 transition-colors disabled:opacity-50"
            />
            <button
                type="button"
                onClick={onToggleShow}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
            >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    </div>
);
