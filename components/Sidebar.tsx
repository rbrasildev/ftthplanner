import React, { useState, useEffect } from 'react';
import {
    Network, Settings2, FolderOpen, Upload, Activity, Flashlight, Globe, Moon, Sun,
    LogOut, FileUp, ChevronLeft, ChevronRight, Menu, Map as MapIcon, Boxes,
    Layers, Search, Database, LayoutDashboard, X, ClipboardList, UtilityPole,
    Box, Cable, GitFork, Server, Zap, Users, Settings, FileText
} from 'lucide-react';
import { SearchBox } from './SearchBox';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import { Project } from '../types';

export type DashboardView = 'projects' | 'registrations' | 'users' | 'settings' | 'backup' | 'reg_poste' | 'reg_caixa' | 'reg_cabo' | 'reg_fusao' | 'reg_splitter' | 'reg_olt';

interface MenuItem {
    id: DashboardView;
    label: string;
    icon: React.FC<any>;
    subItems?: MenuItem[];
}

interface SidebarProps {
    viewMode: 'project' | 'dashboard';
    user: string | null;
    userRole?: string | null;
    userPlan?: string;
    userPlanType?: string;
    subscriptionExpiresAt?: string | null;
    cancelAtPeriodEnd?: boolean;
    projects: Project[];
    currentProjectId: string | null;
    deploymentProgress: number;
    vflSource: string | null;
    setVflSource: (source: string | null) => void;
    searchResults: any[];
    onSearch: (term: string) => void;
    onResultClick: (item: any) => void;
    onLogout: () => void;
    onUpgradeClick?: () => void;
    setCurrentProjectId: (id: string | null) => void;
    setShowProjectManager: (show: boolean) => void;
    onImportClick: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    isMobileOpen: boolean;
    onCloseMobile: () => void;
    onReportClick?: () => void;
    isHydrated?: boolean;
    currentDashboardView?: DashboardView;
    onDashboardViewChange?: (view: DashboardView) => void;
    companyLogo?: string | null;
    companyName?: string | null;
    saasName?: string | null;
    saasLogo?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
    viewMode,
    user,
    userRole,
    userPlan,
    userPlanType,
    subscriptionExpiresAt,
    cancelAtPeriodEnd,
    projects,
    currentProjectId,
    deploymentProgress,
    vflSource,
    setVflSource,
    searchResults,
    onSearch,
    onResultClick,
    onLogout,
    onUpgradeClick,
    setCurrentProjectId,
    setShowProjectManager,
    onImportClick,
    isCollapsed,
    onToggleCollapse,
    isMobileOpen,
    onCloseMobile,
    onReportClick,
    isHydrated,
    currentDashboardView = 'projects',
    onDashboardViewChange,
    companyLogo,
    companyName,
    saasName,
    saasLogo
}) => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

    const currentProjectName = projects.find(p => p.id === currentProjectId)?.name || t('home');

    const sidebarClasses = `
        fixed lg:relative z-[2000] h-screen transition-all duration-300 ease-in-out border-r border-slate-200/60 dark:border-slate-800 glass-sidebar flex flex-col
        ${isCollapsed ? 'w-20' : 'w-[280px]'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `;

    const menuItems: MenuItem[] = [
        { id: 'projects', label: t('my_projects') || 'Projetos', icon: FolderOpen },
        {
            id: 'registrations',
            label: t('registrations') || 'Cadastros',
            icon: ClipboardList,
            subItems: [
                { id: 'reg_poste', label: t('reg_poste') || 'Poste', icon: UtilityPole },
                { id: 'reg_caixa', label: t('reg_caixa') || 'Caixa', icon: Box },
                { id: 'reg_cabo', label: t('reg_cabo') || 'Cabo', icon: Cable },
                { id: 'reg_splitter', label: t('reg_splitter') || 'Splitter', icon: GitFork },
                { id: 'reg_olt', label: t('reg_olt') || 'OLT', icon: Server },
                { id: 'reg_fusao', label: t('reg_fusao') || 'Fusão', icon: Zap }
            ]
        },
        { id: 'users', label: t('users') || 'Usuários', icon: Users },
        { id: 'settings', label: t('company_settings_title') || 'Configurações', icon: Settings },
        { id: 'backup', label: t('backup') || 'Backup', icon: Database },
    ].filter(item => {
        if (item.id === 'users' || item.id === 'backup' || item.id === 'registrations') {
            return userRole === 'ADMIN' || userRole === 'OWNER';
        }
        return true;
    }) as MenuItem[];

    // Auto-expand menu if current view is a child
    useEffect(() => {
        if (viewMode === 'dashboard') {
            menuItems.forEach(item => {
                if (item.subItems && item.subItems.some(sub => sub.id === currentDashboardView)) {
                    setExpandedMenu(item.id);
                }
            });
        }
    }, [currentDashboardView, viewMode]);

    const isMenuActive = (item: MenuItem) => {
        if (currentDashboardView === item.id) return true;
        if (item.subItems) {
            return item.subItems.some(sub => sub.id === currentDashboardView);
        }
        return false;
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onCloseMobile}
                />
            )}

            <aside className={sidebarClasses}>
                {/* 1. Header & Collapse Toggle */}
                <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-slate-200/50 dark:border-slate-800/50 h-16 flex-shrink-0`}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-2.5 overflow-hidden animate-in fade-in duration-300">
                            <div className="w-8 h-8 flex-shrink-0">
                                <img src={saasLogo || "/logo.png"} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="font-extrabold text-sm tracking-tighter text-zinc-900 dark:text-zinc-50 leading-none uppercase">
                                    {saasName || "FTTH PLANNER"}
                                </h1>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mt-1">{t('professional') || 'PRO'}</span>
                            </div>
                        </div>
                    )}
                    {isCollapsed && (
                        <img src={saasLogo || "/logo.png"} alt="Logo" className="w-8 h-8 object-contain animate-in fade-in duration-300" />
                    )}

                    <button
                        onClick={onToggleCollapse}
                        className="hidden lg:flex p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-500 transition-all duration-200"
                        title={isCollapsed ? t('sidebar_expand') : t('sidebar_collapse')}
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>

                    {/* Mobile Close */}
                    <button onClick={onCloseMobile} className="lg:hidden p-2 text-zinc-400 hover:text-red-500">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                </div>

                {/* 2. Project Context (Only in map/project mode) */}
                {viewMode === 'project' && (
                    <div className={`p-4 border-b border-slate-200/50 dark:border-slate-800/50 ${isCollapsed ? 'flex flex-col items-center justify-center' : ''} flex-shrink-0 space-y-2`}>
                        <button
                            onClick={onImportClick}
                            className={`group relative flex items-center transition-all duration-200 
                                ${isCollapsed
                                    ? 'w-10 h-10 justify-center mx-auto rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-emerald-500'
                                    : 'w-full gap-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl border-dashed hover:border-emerald-500 group-hover:bg-emerald-50/50'}`}
                            title={isCollapsed ? t('import_kmz_label') : ''}
                        >
                            <FileUp className={`flex-shrink-0 transition-colors ${isCollapsed ? 'w-5 h-5' : 'w-4 h-4 text-zinc-400 group-hover:text-emerald-500'}`} />
                            {!isCollapsed && (
                                <div className="flex flex-col items-start overflow-hidden text-left">
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider leading-none mb-1">{t('import_kmz_label')}</span>
                                    <span className="truncate text-[10px] font-medium text-zinc-500 dark:text-zinc-400 leading-tight">{t('import_kmz_desc')}</span>
                                </div>
                            )}
                            {!isCollapsed && <Upload className="w-3.5 h-3.5 text-zinc-300 ml-auto group-hover:text-emerald-500" />}
                        </button>

                        <NavButton
                            icon={<FolderOpen className="w-5 h-5" />}
                            label={currentProjectName}
                            onClick={() => setShowProjectManager(true)}
                            isCollapsed={isCollapsed}
                            variant="zinc"
                        />

                        <NavButton
                            icon={<Activity className="w-5 h-5" />}
                            label={`${t('deployment_progress')}: ${deploymentProgress}%`}
                            onClick={() => { }}
                            isCollapsed={isCollapsed}
                            variant="emerald"
                            progress={deploymentProgress}
                        />
                    </div>
                )}

                {/* 3. Navigation / Tools */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 custom-scrollbar">

                    {viewMode === 'project' ? (
                        <>
                            {/* Search Section */}
                            {!isCollapsed ? (
                                <div className="space-y-2 animate-in slide-in-from-left-2 duration-300">
                                    <span className="px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">{t('search_generic')}</span>
                                    <SearchBox
                                        onSearch={onSearch}
                                        results={searchResults}
                                        onResultClick={item => { onResultClick(item); onCloseMobile(); }}
                                    />
                                </div>
                            ) : (
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => { onToggleCollapse(); setTimeout(() => document.querySelector('input')?.focus(), 100); }}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                                        title={t('search_generic')}
                                    >
                                        <Search className="w-5 h-5" />
                                    </button>
                                </div>
                            )}

                            {/* Operation Section */}
                            <div className="space-y-1">
                                {!isCollapsed && (
                                    <span className="px-2 pb-2 block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">{t('sidebar_operation')}</span>
                                )}

                                <NavButton
                                    icon={<LayoutDashboard className="w-5 h-5" />}
                                    label={t('home')}
                                    onClick={() => { setCurrentProjectId(null); setShowProjectManager(false); onCloseMobile(); }}
                                    isCollapsed={isCollapsed}
                                    variant="zinc"
                                />

                                <NavButton
                                    icon={<FileText className="w-5 h-5" />}
                                    label={t('report_analyze')}
                                    onClick={() => { onReportClick?.(); onCloseMobile(); }}
                                    isCollapsed={isCollapsed}
                                    variant="zinc"
                                />
                            </div>

                            {/* VFL Indicator */}
                            {vflSource && (
                                <div className={`p-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl relative overflow-hidden group ${isCollapsed ? 'flex justify-center' : ''}`}>
                                    <div className="absolute top-0 right-0 p-1 opacity-10">
                                        <Flashlight className="w-10 h-10 text-rose-500 -rotate-12" />
                                    </div>
                                    <div className={`relative z-10 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="flex w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                            {!isCollapsed && <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tighter">VFL ON</span>}
                                        </div>
                                        {!isCollapsed && <div className="text-[10px] font-medium text-rose-500 dark:text-rose-400 mb-2 truncate max-w-[180px]">{vflSource}</div>}
                                        <button
                                            onClick={() => setVflSource(null)}
                                            className={`bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors font-bold uppercase tracking-wider
                                                ${isCollapsed ? 'p-1' : 'w-full py-1 text-[9px]'}`}
                                            title={t('turn_off')}
                                        >
                                            {isCollapsed ? <X className="w-3.5 h-3.5" /> : t('turn_off')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-1">
                            {menuItems.map(item => {
                                const active = isMenuActive(item);
                                const isExpanded = expandedMenu === item.id;
                                const hasSubItems = !!item.subItems;

                                return (
                                    <div key={item.id} className="space-y-1">
                                        <NavButton
                                            icon={<item.icon className="w-5 h-5" />}
                                            label={item.label}
                                            onClick={() => {
                                                if (hasSubItems) {
                                                    setExpandedMenu(prev => prev === item.id ? null : item.id);
                                                } else if (onDashboardViewChange) {
                                                    onDashboardViewChange(item.id);
                                                    onCloseMobile();
                                                }
                                            }}
                                            isCollapsed={isCollapsed}
                                            variant={active ? "emerald" : "zinc"}
                                            isActive={active}
                                            hasArrow={hasSubItems && !isCollapsed}
                                            isExpanded={isExpanded}
                                        />

                                        {hasSubItems && isExpanded && !isCollapsed && (
                                            <div className="pl-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                                {item.subItems!.map(sub => {
                                                    const subActive = currentDashboardView === sub.id;
                                                    return (
                                                        <button
                                                            key={sub.id}
                                                            onClick={() => {
                                                                if (onDashboardViewChange) {
                                                                    onDashboardViewChange(sub.id);
                                                                    onCloseMobile();
                                                                }
                                                            }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all
                                                                ${subActive
                                                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                                                                    : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                                        >
                                                            <sub.icon className={`w-3.5 h-3.5 ${subActive ? 'text-emerald-500' : ''}`} />
                                                            <span>{sub.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 4. Footer Icons */}
                <div className={`p-4 border-t border-slate-200/50 dark:border-slate-800/50 ${isCollapsed ? 'items-center' : ''} flex flex-col gap-3 flex-shrink-0`}>
                    {!isCollapsed && user && (
                        <div className="flex items-center gap-3 px-2 mb-2">
                            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 overflow-hidden shrink-0">
                                {companyLogo ? (
                                    <img src={companyLogo} alt="Company" className="w-full h-full object-contain" />
                                ) : (
                                    user.substring(0, 2).toUpperCase()
                                )}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{companyName || user}</span>
                                <span className="text-[9px] text-zinc-400 truncate">{user}</span>
                                {isHydrated ? (
                                    <>
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{userPlan || 'Plano Grátis'}</span>
                                        {(() => {
                                            const isTrialPlan = userPlanType?.toUpperCase() === 'TRIAL' || userPlan?.toLowerCase().includes('trial') || userPlan?.toLowerCase().includes('teste');
                                            const isFree = userPlan === 'Plano Grátis';
                                            const shouldShowExp = subscriptionExpiresAt && !isFree && (isTrialPlan || cancelAtPeriodEnd);
                                            if (!shouldShowExp) return null;

                                            const days = Math.max(0, Math.ceil((new Date(subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                                            const isExpiringSoon = days <= 3;

                                            return (
                                                <p className={`text-[9px] font-extrabold uppercase tracking-wide leading-tight mt-0.5 ${isExpiringSoon || cancelAtPeriodEnd ? 'text-rose-500' : 'text-amber-500'}`}>
                                                    {isTrialPlan ? (t('trial') || 'Teste') : (t('expires') || 'Expira')}: {days} {t('days') || 'dias'}
                                                </p>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                )}
                            </div>
                        </div>
                    )}

                    {!isCollapsed && isHydrated && (
                        <div className="px-2 mb-1">
                            <button
                                onClick={onUpgradeClick}
                                className={`flex items-center justify-center gap-2 text-[10px] px-3 py-2 rounded-xl font-bold w-full shadow-sm border border-transparent transition-all transform hover:scale-[1.02] active:scale-[0.98]
                                ${(userPlan === 'Plano Grátis' || userPlanType?.toUpperCase() === 'TRIAL')
                                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-emerald-500 hover:text-emerald-500 hover:shadow-md'}`}
                            >
                                {(userPlan === 'Plano Grátis' || userPlanType?.toUpperCase() === 'TRIAL')
                                    ? <><Zap className="w-3.5 h-3.5" /> {t('upgrade_now') || 'Fazer Upgrade'}</>
                                    : <><Settings className="w-3.5 h-3.5" /> {t('manage_subscription') || 'Gerenciar Assinatura'}</>
                                }
                            </button>
                        </div>
                    )}

                    {!isCollapsed && (
                        <div className="grid grid-cols-3 gap-2">
                            <FooterButton icon={<Globe className="w-4 h-4" />} title={language.toUpperCase()} onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')} />
                            <FooterButton icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} title={theme === 'dark' ? 'Dark' : 'Light'} onClick={toggleTheme} />
                            <FooterButton icon={<LogOut className="w-4 h-4" />} title={t('logout')} onClick={onLogout} danger />
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="flex flex-col gap-4 items-center">
                            <FooterButton
                                icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                onClick={toggleTheme}
                                className="w-10 h-10 px-0 flex-none"
                            />
                            <FooterButton
                                icon={<LogOut className="w-4 h-4" />}
                                onClick={onLogout}
                                danger
                                className="w-10 h-10 px-0 flex-none"
                            />
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};

interface NavButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    isCollapsed: boolean;
    variant?: 'zinc' | 'emerald';
    progress?: number;
    isActive?: boolean;
    hasArrow?: boolean;
    isExpanded?: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, onClick, isCollapsed, variant = 'zinc', progress, isActive, hasArrow, isExpanded }) => {
    const isEmerald = variant === 'emerald' || isActive;

    const activeClass = isEmerald
        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100';

    return (
        <button
            onClick={onClick}
            className={`flex items-center group relative transition-all duration-300 rounded-xl border border-transparent overflow-hidden
                ${isCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'w-full px-3 py-2.5 gap-3'} ${activeClass}
                ${!isActive && 'hover:shadow-sm hover:border-slate-200/50 dark:hover:border-zinc-800'}`}
            title={isCollapsed ? label : ''}
        >
            <div className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isEmerald ? 'text-emerald-500' : 'text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'}`}>
                {icon}
            </div>

            {!isCollapsed && (
                <span className="text-xs font-bold truncate tracking-tight flex-1 text-left">{label}</span>
            )}

            {hasArrow && (
                <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} text-zinc-400`} />
            )}

            {progress !== undefined && !isCollapsed && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${progress}%` }} />
            )}
        </button>
    );
};

const FooterButton: React.FC<{ icon: React.ReactNode; title?: string; onClick: () => void; danger?: boolean; className?: string }> = ({ icon, title, onClick, danger, className = "" }) => (
    <button
        onClick={onClick}
        title={title}
        className={`h-9 flex items-center justify-center rounded-xl border transition-all duration-200 flex-1 px-2 ${className}
            ${danger
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30 text-rose-500 hover:bg-rose-500 hover:text-white'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-emerald-500 hover:text-emerald-500 shadow-sm'}`}
    >
        {icon}
    </button>
);
