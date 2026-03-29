import React from 'react';
import { Router, Server, AlignJustify, Scissors, Zap, Magnet, Network, Save, X, Link } from 'lucide-react';
import { Button } from '../common/Button';

interface PopToolbarProps {
    onAddOLT: () => void;
    onAddDIO: () => void;
    onViewModeChange: (mode: 'canvas' | 'logical') => void;
    viewMode: 'canvas' | 'logical';
    onClearAll: () => void;
    onAutoPatch?: () => void;
    onSave: () => void;
    userRole?: string | null;
    t: (key: string) => string;
    stats?: { olts: number; dios: number; connections: number; totalPorts: number; usedPorts: number };
}

export const PopToolbar: React.FC<PopToolbarProps> = ({
    onAddOLT,
    onAddDIO,
    onViewModeChange,
    viewMode,
    onClearAll,
    onAutoPatch,
    onSave,
    userRole,
    t,
    stats
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

                {/* STATS */}
                {stats && (
                    <div className="hidden sm:flex items-center gap-3 px-3 border-r border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>OLT: {stats.olts}</span>
                        <span>DIO: {stats.dios}</span>
                        <span>{t('pop_ports_used') || 'Portas'}: {stats.usedPorts}/{stats.totalPorts}</span>
                    </div>
                )}

                {/* GROUP 2: VIEW / MODE */}
                <div className="flex items-center gap-1 px-2 mx-auto bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50">
                    <Button
                        variant={viewMode === 'canvas' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => onViewModeChange('canvas')}
                        className={`h-7 px-3 text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'canvas' ? 'bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600' : ''}`}
                        title={t('view_canvas') || '2D Canvas'}
                        icon={<Zap className="w-3.5 h-3.5" />}
                    >
                        {t('view_canvas') || '2D Canvas'}
                    </Button>
                    <Button
                        variant={viewMode === 'logical' ? 'emerald' : 'ghost'}
                        size="sm"
                        onClick={() => onViewModeChange('logical')}
                        className={`h-7 px-3 text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'logical' ? 'shadow-sm shadow-emerald-500/20' : ''}`}
                        title={t('view_patching') || 'Patching'}
                        icon={<Network className="w-3.5 h-3.5" />}
                    >
                        {t('view_patching') || 'Patching'}
                    </Button>
                </div>

                <div className="flex items-center ml-auto gap-2">
                    <Button
                        variant={userRole === 'MEMBER' ? 'outline' : 'emerald'}
                        size="sm"
                        onClick={onSave}
                        className="h-8 px-4 font-bold active:scale-95 shadow-sm"
                        icon={userRole === 'MEMBER' ? <X className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    >
                        {userRole === 'MEMBER' ? (t('done') || 'Sair') : (t('save_or_done') || 'Concluir')}
                    </Button>

                    {userRole !== 'MEMBER' && onAutoPatch && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAutoPatch}
                            className="h-8 px-3 font-bold text-xs hover:border-indigo-500/30 active:scale-95"
                            icon={<Link className="w-3.5 h-3.5 text-indigo-500" />}
                            title={t('auto_patch_desc') || 'Auto-patch'}
                        >
                            {t('auto_patch')}
                        </Button>
                    )}
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
