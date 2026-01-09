import React from 'react';
import { Network, Settings2, FolderOpen, Upload, Activity, Flashlight, Globe, Moon, Sun, LogOut } from 'lucide-react';
import { SearchBox } from './SearchBox';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import { Project } from '../types';

// interface SidebarProps {
//     user: string | null;
//     projects: Project[];
//     currentProjectId: string | null;
//     deploymentProgress: number;
//     vflSource: string | null;
//     setVflSource: (source: string | null) => void;
//     searchResults: any[];
//     onSearch: (term: string) => void;
//     onResultClick: (item: any) => void;
//     onLogout: () => void;
//     setCurrentProjectId: (id: string | null) => void;
//     setShowProjectManager: (show: boolean) => void;
// }

// Keeping it clean:

interface SidebarProps {
    user: string | null;
    projects: Project[];
    currentProjectId: string | null;
    deploymentProgress: number;
    vflSource: string | null;
    setVflSource: (source: string | null) => void;
    searchResults: any[];
    onSearch: (term: string) => void;
    onResultClick: (item: any) => void;
    onLogout: () => void;
    setCurrentProjectId: (id: string | null) => void;
    setShowProjectManager: (show: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    user,
    projects,
    currentProjectId,
    deploymentProgress,
    vflSource,
    setVflSource,
    searchResults,
    onSearch,
    onResultClick,
    onLogout,
    setCurrentProjectId,
    setShowProjectManager
}) => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();

    return (
        <aside className="w-[280px] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-2xl relative transition-colors duration-300 font-sans">
            {/* 1. Header & Project Info (Compact) */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-sky-600 rounded-lg shadow-lg shadow-sky-600/20 flex items-center justify-center">
                            <Network className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none">FTTH Master</h1>
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Planner Pro</span>
                        </div>
                    </div>
                    <button onClick={() => { setCurrentProjectId(null); setShowProjectManager(false); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors" title={t('exit_project')}>
                        <Settings2 className="w-4 h-4 text-slate-300 group-hover:text-sky-500 transition-colors" />
                    </button>
                </div>

                {/* Project Selector (Elevated look) */}
                <button
                    onClick={() => setShowProjectManager(true)}
                    className="group w-full flex items-center justify-between bg-white dark:bg-slate-900 hover:border-sky-500 dark:hover:border-sky-500 border border-slate-200 dark:border-slate-800 p-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center group-hover:bg-sky-100 dark:group-hover:bg-sky-900/40 transition-colors">
                            <FolderOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div className="flex flex-col items-start overflow-hidden">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projeto Atual</span>
                            <span className="truncate max-w-[140px] font-semibold text-xs text-slate-700 dark:text-slate-200">{projects.find(p => p.id === currentProjectId)?.name}</span>
                        </div>
                    </div>
                    <Upload className="w-4 h-4 text-slate-300 group-hover:text-sky-500 transition-colors" />
                </button>
            </div>

            {/* 2. Deployment Stats (Tech Look) */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Progresso</span>
                    <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">{deploymentProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${deploymentProgress}%` }}></div>
                </div>
            </div>

            {/* 3. Search (Fixed, outside scroll) - Optimized Component */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-950 z-30">
                <SearchBox
                    onSearch={onSearch}
                    results={searchResults}
                    onResultClick={onResultClick}
                />
            </div>

            {/* 4. Main Tools Scroll Attributes */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 custom-scrollbar relative z-10">

                {/* Fusion Module Button Removed */}

                {/* VFL Alert */}
                {vflSource && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl relative overflow-hidden group animate-in fade-in zoom-in-95 duration-300">
                        <div className="absolute top-0 right-0 p-2 opacity-50"><Flashlight className="w-12 h-12 text-red-200 dark:text-red-900/20 rotate-12" /></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold uppercase mb-1">
                                <span className="flex w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                                {t('vfl_active_status')}
                            </div>
                            <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2 line-clamp-1">{vflSource}</div>
                            <button onClick={() => setVflSource(null)} className="w-full py-1.5 bg-white dark:bg-red-950/50 hover:bg-red-50 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 text-[10px] font-bold uppercase tracking-wide rounded-lg border border-red-100 dark:border-red-900/30 shadow-sm transition-colors">
                                {t('turn_off')}
                            </button>
                        </div>
                    </div>
                )}

            </div>
            {/* 4. Footer System Bar */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 grid grid-cols-3 gap-2">
                <button
                    onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
                    className="h-9 flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs transition-colors"
                    title={language === 'en' ? 'Mudar para Português' : 'Switch to English'}
                >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{language.toUpperCase()}</span>
                </button>
                <button
                    onClick={toggleTheme}
                    className="h-9 flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs transition-colors"
                    title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                <button
                    onClick={onLogout}
                    className="h-9 flex items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold text-xs transition-colors"
                    title={t('logout')}
                >
                    <LogOut className="w-3.5 h-3.5" />
                </button>
            </div>
        </aside>
    );
};
