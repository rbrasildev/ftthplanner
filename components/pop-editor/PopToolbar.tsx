import React from 'react';
import { Router, Server, AlignJustify, Scissors, Zap, Magnet } from 'lucide-react';

interface PopToolbarProps {
    onAddOLT: () => void;
    onAddDIO: () => void;
    onToggleRackMode: () => void;
    isRackMode: boolean;
    onClearAll: () => void;
    userRole?: string | null;
    t: (key: string) => string;
}

export const PopToolbar: React.FC<PopToolbarProps> = ({
    onAddOLT,
    onAddDIO,
    onToggleRackMode,
    isRackMode,
    onClearAll,
    userRole,
    t
}) => {
    return (
        <div className="h-12 bg-white dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 z-40 backdrop-blur-sm">
            <div className="flex gap-2 items-center">
                {/* GROUP 1: CREATION */}
                {userRole !== 'MEMBER' && (
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700">
                        <button
                            onClick={onAddOLT}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow hover:border-indigo-500/30 active:scale-95"
                        >
                            <Zap className="w-3.5 h-3.5 text-indigo-500" /> {t('add_active_equipment')}
                        </button>
                        <button
                            onClick={onAddDIO}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow hover:border-emerald-500/30 active:scale-95"
                        >
                            <Server className="w-3.5 h-3.5 text-emerald-500" /> {t('add_dio')}
                        </button>
                    </div>
                )}

                {/* GROUP 2: VIEW / MODE */}
                <div className="flex items-center gap-2 px-2">
                    <button
                        onClick={onToggleRackMode}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all active:scale-95 ${isRackMode
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                    >
                        <AlignJustify className="w-3.5 h-3.5" /> {t('rack_view')}
                    </button>

                    {userRole !== 'MEMBER' && (
                        <button
                            onClick={onClearAll}
                            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            title={t('clear_all') || "Clear All"}
                        >
                            <Scissors className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
