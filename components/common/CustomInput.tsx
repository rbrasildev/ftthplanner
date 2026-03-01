import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CustomInputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label?: string;
    error?: string;
    icon?: LucideIcon;
    isTextarea?: boolean;
}

export const CustomInput: React.FC<CustomInputProps> = ({
    label,
    error,
    icon: Icon,
    isTextarea = false,
    className = "",
    ...props
}) => {
    const baseClasses = `
        w-full px-4 py-2.5 
        bg-white dark:bg-slate-950 
        border rounded-xl transition-all duration-300
        text-sm text-slate-900 dark:text-white
        placeholder:text-slate-400
        focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10
        ${error
            ? 'border-red-500 ring-4 ring-red-500/10'
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'}
        ${Icon ? 'pl-11' : ''}
    `;

    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1.5 uppercase text-[10px] tracking-wider">
                    {label}
                </label>
            )}

            <div className="relative">
                {Icon && (
                    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                )}

                {isTextarea ? (
                    <textarea
                        {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
                        className={`${baseClasses} min-h-[100px] resize-none ${Icon ? 'pt-3' : ''}`}
                    />
                ) : (
                    <input
                        {...props}
                        className={baseClasses}
                    />
                )}
            </div>

            {error && (
                <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>
            )}
        </div>
    );
};
