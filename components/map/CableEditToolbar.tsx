import React from 'react';
import { useLanguage } from '../../LanguageContext';
import { X, Check, Cable, Unplug } from 'lucide-react';

interface CableEditToolbarProps {
    toolMode: 'edit_cable' | 'connect_cable';
    onSave: () => void;
    onCancel: () => void;
}

export const CableEditToolbar: React.FC<CableEditToolbarProps> = ({ toolMode, onSave, onCancel }) => {
    const { t } = useLanguage();

    const isEdit = toolMode === 'edit_cable';
    const title = isEdit ? t('editing_cable') : t('connecting_cable');
    const saveLabel = isEdit ? t('save_changes') : t('finish');
    const Icon = isEdit ? Cable : Unplug;
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-white/95 dark:bg-[#1a1d23]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/40 overflow-hidden">
                <div className="flex items-center gap-0">
                    {/* Icon + Title */}
                    <div className="flex items-center gap-2.5 pl-4 pr-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500">
                            <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{title}</div>
                            <div className="text-[10px] text-slate-400 font-medium">
                                {isEdit
                                    ? (t('cable_edit_hint') || 'Arraste os pontos | Duplo clique para adicionar')
                                    : (t('cable_connect_hint') || 'Clique nos elementos para conectar')}
                            </div>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="w-px h-10 bg-slate-200 dark:bg-slate-700/40" />

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 px-3">
                        <button
                            onClick={onSave}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-lg bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                        >
                            <Check className="w-3.5 h-3.5" />
                            {saveLabel}
                        </button>
                        <button
                            onClick={onCancel}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            title={t('cancel')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
