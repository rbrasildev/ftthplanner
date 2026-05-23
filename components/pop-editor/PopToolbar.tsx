import React from 'react';
import { Server, Scissors, Zap, Network, Save, X, Link, ExternalLink, Layers, Flashlight } from 'lucide-react';
import { Button } from '../common/Button';

interface PopToolbarProps {
    onAddOLT: () => void;
    onAddDIO: () => void;
    onAddSwitch?: () => void;
    onViewModeChange: (mode: 'canvas' | 'logical') => void;
    viewMode: 'canvas' | 'logical';
    onClearAll: () => void;
    onAutoPatch?: () => void;
    onSave: () => void;
    userRole?: string | null;
    t: (key: string) => string;
    stats?: { olts: number; dios: number; switches?: number; connections: number; totalPorts: number; usedPorts: number };
    readOnly?: boolean;
    onGoToParentProject?: () => void;
    /** Toggle VFL: quando ativo, clique em porta injeta luz. */
    isVflToolActive?: boolean;
    onToggleVflTool?: () => void;
    vflDirection?: 'both' | 'upstream' | 'downstream';
    onChangeVflDirection?: (d: 'both' | 'upstream' | 'downstream') => void;
}

export const PopToolbar: React.FC<PopToolbarProps> = ({
    onAddOLT,
    onAddDIO,
    onAddSwitch,
    onViewModeChange,
    viewMode,
    onClearAll,
    onAutoPatch,
    onSave,
    userRole,
    t,
    stats,
    readOnly,
    onGoToParentProject,
    isVflToolActive,
    onToggleVflTool,
    vflDirection,
    onChangeVflDirection,
}) => {
    const canEdit = !readOnly && userRole !== 'MEMBER';
    return (
        <div className="h-12 bg-slate-50 dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-600/40 flex items-center justify-between px-4 shrink-0 z-40 backdrop-blur-sm">
            <div className="flex gap-2 items-center w-full">
                {/* GROUP 1: CREATION */}
                {userRole !== 'MEMBER' && (
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-600/40">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAddOLT}
                            className="bg-white dark:bg-[#2a2e38] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600/40 hover:border-indigo-500/50 hover:shadow font-bold active:scale-95"
                            icon={<Server className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />}
                            title="Adicionar OLT"
                        >
                            OLT
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAddDIO}
                            className="bg-white dark:bg-[#2a2e38] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600/40 hover:border-emerald-500/50 hover:shadow font-bold active:scale-95"
                            icon={<Layers className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
                            title="Adicionar DIO"
                        >
                            DIO
                        </Button>
                        {onAddSwitch && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onAddSwitch}
                                className="bg-white dark:bg-[#2a2e38] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600/40 hover:border-emerald-500/50 hover:shadow font-bold active:scale-95"
                                icon={<Network className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />}
                                title="Adicionar Switch, Roteador, Servidor ou outro ativo Ethernet"
                            >
                                Ativo
                            </Button>
                        )}
                    </div>
                )}

                {/* STATS */}
                {stats && (
                    <div className="hidden sm:flex items-center gap-3 px-3 border-r border-slate-200 dark:border-slate-600/40 text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                        <span>OLT: {stats.olts}</span>
                        <span>DIO: {stats.dios}</span>
                        {(stats.switches ?? 0) > 0 && <span>SW: {stats.switches}</span>}
                        <span>{t('pop_ports_used') || 'Portas'}: {stats.usedPorts}/{stats.totalPorts}</span>
                    </div>
                )}

                {/* GROUP 2: VIEW / MODE */}
                <div className="flex items-center gap-1 px-2 mx-auto bg-white dark:bg-[#1a1d23] p-1 rounded-lg border border-slate-200 dark:border-slate-600/40">
                    <Button
                        variant={viewMode === 'canvas' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => onViewModeChange('canvas')}
                        className={`h-7 px-3 text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'canvas' ? 'bg-slate-100 dark:bg-[#2a2e38] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                        title={t('view_canvas') || '2D Canvas'}
                        icon={<Zap className="w-3.5 h-3.5" />}
                    >
                        {t('view_canvas') || '2D Canvas'}
                    </Button>
                    <Button
                        variant={viewMode === 'logical' ? 'emerald' : 'ghost'}
                        size="sm"
                        onClick={() => onViewModeChange('logical')}
                        className={`h-7 px-3 text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'logical' ? 'shadow-sm shadow-emerald-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                        title={t('view_patching') || 'Patching'}
                        icon={<Network className="w-3.5 h-3.5" />}
                    >
                        {t('view_patching') || 'Patching'}
                    </Button>
                </div>

                <div className="flex items-center ml-auto gap-2">
                    {/* VFL só no modo 2D — em "Manobra" (logical) o controle
                        é redundante e o trace não opera sobre essa view. */}
                    {onToggleVflTool && viewMode === 'canvas' && (
                        <>
                            <Button
                                variant={isVflToolActive ? 'destructive' : 'outline'}
                                size="sm"
                                onClick={onToggleVflTool}
                                className={`h-8 px-3 font-bold text-xs active:scale-95 ${isVflToolActive ? 'bg-red-600 border-red-500 hover:bg-red-500' : 'text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-red-500/60 hover:text-red-600 dark:hover:text-red-400'}`}
                                icon={<Flashlight className={`w-3.5 h-3.5 ${isVflToolActive ? 'animate-pulse' : 'text-red-500'}`} />}
                                title={t('tooltip_vfl') || t('vfl_trace') || 'VFL'}
                            >
                                {t('vfl_trace') || 'VFL'}
                            </Button>
                            {isVflToolActive && vflDirection && onChangeVflDirection && (
                                <div className="flex items-center gap-0.5 bg-red-600/10 dark:bg-red-900/20 border border-red-300 dark:border-red-700/50 rounded-lg p-0.5">
                                    {([
                                        { state: 'both', icon: '↕', hint: t('vfl_dir_both_hint') },
                                        { state: 'downstream', icon: '↑', hint: t('vfl_dir_downstream_hint') },
                                        { state: 'upstream', icon: '↓', hint: t('vfl_dir_upstream_hint') },
                                    ] as const).map(opt => (
                                        <button
                                            key={opt.state}
                                            type="button"
                                            onClick={() => onChangeVflDirection(opt.state)}
                                            className={`min-w-[26px] h-6 px-1.5 rounded text-xs font-bold leading-none flex items-center justify-center transition-colors ${vflDirection === opt.state ? 'bg-red-600 text-white' : 'text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'}`}
                                            title={opt.hint}
                                            aria-label={opt.hint}
                                        >
                                            {opt.icon}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {readOnly && onGoToParentProject && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => { onSave(); onGoToParentProject(); }}
                            className="h-8 px-4 font-bold active:scale-95 shadow-sm"
                            icon={<ExternalLink className="w-3.5 h-3.5" />}
                        >
                            {t('base_project_edit_in_base')}
                        </Button>
                    )}
                    <Button
                        variant={canEdit ? 'emerald' : 'outline'}
                        size="sm"
                        onClick={onSave}
                        className={`h-8 px-4 font-bold active:scale-95 shadow-sm ${!canEdit ? 'text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600/40' : ''}`}
                        icon={canEdit ? <Save className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    >
                        {canEdit ? (t('save_or_done') || 'Concluir') : (t('close') || 'Fechar')}
                    </Button>

                    {userRole !== 'MEMBER' && onAutoPatch && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAutoPatch}
                            className="h-8 px-3 font-bold text-xs text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600/40 hover:border-indigo-500/50 active:scale-95"
                            icon={<Link className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />}
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
                            className="h-8 w-8 text-slate-500 border-slate-200 dark:border-slate-600/40 hover:text-rose-500 dark:hover:text-rose-400"
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
