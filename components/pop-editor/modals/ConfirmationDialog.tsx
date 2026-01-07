import React from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    secondaryActionLabel?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    onSecondaryAction?: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    title,
    message,
    subMessage,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    secondaryActionLabel,
    type = 'info',
    onConfirm,
    onCancel,
    onSecondaryAction
}) => {
    if (!isOpen) return null;

    const colors = {
        danger: { bg: 'bg-red-900/30', border: 'border-red-500/30', icon: 'text-red-500', btn: 'bg-red-600 hover:bg-red-500', shadow: 'shadow-red-900/20' },
        warning: { bg: 'bg-amber-900/30', border: 'border-amber-500/30', icon: 'text-amber-500', btn: 'bg-amber-600 hover:bg-amber-500', shadow: 'shadow-amber-900/20' },
        info: { bg: 'bg-sky-900/30', border: 'border-sky-500/30', icon: 'text-sky-500', btn: 'bg-sky-600 hover:bg-sky-500', shadow: 'shadow-sky-900/20' }
    };

    const style = colors[type];
    const Icon = type === 'danger' ? AlertTriangle : type === 'warning' ? AlertTriangle : Info;

    return (
        <div className="absolute inset-0 z-[2500] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
            <div className={`bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200`}>
                <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 ${style.bg} rounded-full flex items-center justify-center shrink-0 border ${style.border}`}>
                        <Icon className={`w-6 h-6 ${style.icon}`} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            {message}
                            {subMessage && (
                                <>
                                    <br /><br />
                                    <span className={`${type === 'danger' ? 'text-red-400' : 'text-amber-400'} font-bold`}>{subMessage}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 justify-end mt-6">
                    {onSecondaryAction && secondaryActionLabel && (
                        <button
                            onClick={onSecondaryAction}
                            className="px-4 py-2 text-red-400 hover:bg-red-900/20 font-medium text-sm rounded-lg transition-colors mr-auto"
                        >
                            {secondaryActionLabel}
                        </button>
                    )}

                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-lg transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 ${style.btn} text-white rounded-lg font-bold text-sm shadow-lg ${style.shadow} transition-all active:scale-95`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
