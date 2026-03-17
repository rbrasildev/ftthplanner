import React from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { Button } from '../../common/Button';

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    secondaryActionLabel?: string;
    type?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
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
    isLoading = false,
    onConfirm,
    onCancel,
    onSecondaryAction
}) => {
    if (!isOpen) return null;

    const colors = {
        danger: { 
            bg: 'bg-red-50 dark:bg-red-900/30', 
            border: 'border-red-100 dark:border-red-500/30', 
            icon: 'text-red-600 dark:text-red-500', 
            btn: 'bg-red-600 hover:bg-red-500', 
            shadow: 'shadow-red-900/20' 
        },
        warning: { 
            bg: 'bg-amber-50 dark:bg-amber-900/30', 
            border: 'border-amber-100 dark:border-amber-500/30', 
            icon: 'text-amber-600 dark:text-amber-500', 
            btn: 'bg-amber-600 hover:bg-amber-500', 
            shadow: 'shadow-amber-900/20' 
        },
        info: { 
            bg: 'bg-emerald-50 dark:bg-emerald-900/30', 
            border: 'border-emerald-100 dark:border-emerald-500/30', 
            icon: 'text-emerald-600 dark:text-emerald-500', 
            btn: 'bg-emerald-600 hover:bg-emerald-500', 
            shadow: 'shadow-emerald-900/20' 
        }
    };

    const style = colors[type];
    const Icon = type === 'danger' ? AlertTriangle : type === 'warning' ? AlertTriangle : Info;

    return (
        <div className="absolute inset-0 z-[2500] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm pointer-events-auto">
            <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200`}>
                <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 ${style.bg} rounded-full flex items-center justify-center shrink-0 border ${style.border}`}>
                        <Icon className={`w-6 h-6 ${style.icon}`} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            {message}
                            {subMessage && (
                                <>
                                    <br /><br />
                                    <span className={`${type === 'danger' ? 'text-red-500' : 'text-amber-500'} font-bold`}>{subMessage}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 justify-end mt-6">
                    {onSecondaryAction && secondaryActionLabel && (
                        <Button
                            variant="ghost"
                            onClick={onSecondaryAction}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium text-sm mr-auto"
                        >
                            {secondaryActionLabel}
                        </Button>
                    )}

                    <Button
                        variant="secondary"
                        onClick={onCancel}
                        className="px-4 py-2 font-medium text-sm"
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        isLoading={isLoading}
                        className={`px-4 py-2 text-white font-bold text-sm shadow-lg ${style.btn} ${style.shadow} transition-all active:scale-95 border-none`}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};
