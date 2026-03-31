
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'emerald';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading,
    icon,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
        primary: "bg-slate-900 text-slate-50 shadow hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90",
        secondary: "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-100/80 dark:bg-[#22262e] dark:text-slate-50 dark:hover:bg-slate-800/80",
        outline: "border border-slate-200 bg-transparent shadow-sm hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700/30 dark:hover:bg-slate-800 dark:hover:text-slate-50",
        ghost: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50",
        destructive: "bg-rose-500 text-slate-50 shadow-sm hover:bg-rose-500/90 dark:bg-rose-900 dark:text-slate-50 dark:hover:bg-rose-900/90",
        emerald: "bg-emerald-600 text-white shadow hover:bg-emerald-600/90 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-500/90"
    };

    const sizes = {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 py-2",
        lg: "h-10 px-8",
        icon: "h-9 w-9"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : icon ? (
                <span className={children ? "mr-2" : ""}>{icon}</span>
            ) : null}
            {children}
        </button>
    );
};
