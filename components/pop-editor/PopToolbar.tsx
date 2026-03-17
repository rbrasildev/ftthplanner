import React from 'react';
import { Router, Server, AlignJustify, Scissors, Zap, Magnet, Network } from 'lucide-react';
import { Button } from '../common/Button';

interface PopToolbarProps {
    onAddOLT: () => void;
    onAddDIO: () => void;
    onViewModeChange: (mode: 'canvas' | 'logical') => void;
    viewMode: 'canvas' | 'logical';
    onClearAll: () => void;
    userRole?: string | null;
    t: (key: string) => string;
}

export const PopToolbar: React.FC<PopToolbarProps> = ({
    onAddOLT,
    onAddDIO,
    onViewModeChange,
    viewMode,
    onClearAll,
    userRole,
    t
}) => {
    return (
        <div className="h-12 bg-white dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 z-40 backdrop-blur-sm">
            <div className="flex gap-2 items-center w-full">
                {/* GROUP 1: CREATION */}
                {userRole !== 'MEMBER' && (
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAddOLT}
                            className="bg-white dark:bg-slate-800 hover:shadow hover:border-indigo-500/30 font-bold active:scale-95"
                            icon={<Zap className="w-3.5 h-3.5 text-indigo-500" />}
                        >
                            {t('add_active_equipment')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAddDIO}
                            className="bg-white dark:bg-slate-800 hover:shadow hover:border-emerald-500/30 font-bold active:scale-95"
                            icon={<Server className="w-3.5 h-3.5 text-emerald-500" />}
                        >
                            {t('add_dio')}
                        </Button>
                    </div>
                )}

                {/* GROUP 2: VIEW / MODE */}
                <div className="flex items-center gap-1 px-2 mx-auto bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50">
                    <Button
                        variant={viewMode === 'canvas' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => onViewModeChange('canvas')}
                        className={`h-7 px-3 text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'canvas' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600' : ''}`}
                        title="Visão Livre 2D"
                        icon={<Zap className="w-3.5 h-3.5" />}
                    >
                        2D Canvas
                    </Button>
                    <Button
                        variant={viewMode === 'logical' ? 'emerald' : 'ghost'}
                        size="sm"
                        onClick={() => onViewModeChange('logical')}
                        className={`h-7 px-3 text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'logical' ? 'shadow-sm shadow-emerald-500/20' : ''}`}
                        title="Matriz de Manobra"
                        icon={<Network className="w-3.5 h-3.5" />}
                    >
                        Patching
                    </Button>
                </div>

                <div className="flex items-center ml-auto">
                    {userRole !== 'MEMBER' && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onClearAll}
                            className="h-8 w-8 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400"
                            title={t('clear_all')}
                        >
                            <Scissors className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
