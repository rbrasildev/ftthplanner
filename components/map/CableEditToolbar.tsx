import React from 'react';
import { useLanguage } from '../../LanguageContext';
import { X } from 'lucide-react';

interface CableEditToolbarProps {
    toolMode: 'edit_cable' | 'connect_cable';
    onSave: () => void;
    onCancel: () => void;
}

export const CableEditToolbar: React.FC<CableEditToolbarProps> = ({ toolMode, onSave, onCancel }) => {
    const { t } = useLanguage();

    const title = toolMode === 'edit_cable' ? t('editing_cable') : t('connecting_cable');
    const saveLabel = toolMode === 'edit_cable' ? t('save_changes') : t('finish');

    return (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 z-[1000] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex items-center gap-3 px-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {title}
                </span>
                <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600"></div>
                <button
                    onClick={onSave}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg shadow-emerald-900/20"
                >
                    {saveLabel}
                </button>
                <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
                <button
                    onClick={onCancel}
                    className="text-slate-500 hover:text-red-500 transition-colors p-1"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
