import React from 'react';
import { Box, X } from 'lucide-react';

interface PopHeaderProps {
    title: string;
    onClose: () => void;
}

export const PopHeader: React.FC<PopHeaderProps> = ({ title, onClose }) => {
    return (
        <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-50">
            <div className="flex items-center gap-4 min-w-0 flex-1">
                <h2 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-3 whitespace-nowrap truncate min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                        <Box className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    </div>
                    <span className="truncate">{title}</span>
                </h2>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};
