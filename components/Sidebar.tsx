import React, { useState, useEffect, useRef } from 'react';
import {
    FolderOpen, Upload, Activity, Flashlight, Globe, Moon, Sun,
    LogOut, FileUp, ChevronLeft, ChevronRight,
    Search, Database, LayoutDashboard, X, ClipboardList, UtilityPole,
    Box, Cable, GitFork, Server, Zap, Users, Settings, FileText, Crown, CreditCard
} from 'lucide-react';
import { Button } from './common/Button';
import { Tooltip } from './common/Tooltip';
import { SearchBox } from './SearchBox';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import { Project } from '../types';

export type DashboardView = 'projects' | 'integrations' | 'registrations' | 'users' | 'settings' | 'backup' | 'reg_poste' | 'reg_caixa' | 'reg_cabo' | 'reg_fusao' | 'reg_splitter' | 'reg_olt' | 'reg_clientes';

export interface MenuItem {
    id: DashboardView;
    label: string;
    icon: React.FC<any>;
    badge?: number | string;
    subItems?: MenuItem[];
}

export interface SidebarProps {
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
    userBackupEnabled?: boolean;
    menuBadges?: Partial<Record<DashboardView, number | string>>;
}

// --- Helpers ---

function getExpirationInfo(subscriptionExpiresAt: string | null | undefined, cancelAtPeriodEnd: boolean | undefined, userPlan: string | undefined, userPlanType: string | undefined) {
    if (!subscriptionExpiresAt) return null;
    const isFree = userPlan === 'Plano Grátis';
    if (isFree) return null;

    const isTrialPlan = userPlanType?.toUpperCase() === 'TRIAL' || userPlan?.toLowerCase().includes('trial') || userPlan?.toLowerCase().includes('teste');
    const days = Math.max(0, Math.ceil((new Date(subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const isExpired = days === 0;

    // For paid plans (not trial): only show info if expired. Hide the countdown.
    if (!isTrialPlan && !isExpired) return null;

    const isExpiringSoon = days <= 7;
    return { days, isExpired, isExpiringSoon, isTrialPlan, cancelAtPeriodEnd };
}

// --- Main Component ---

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
    saasLogo,
    userBackupEnabled,
    menuBadges
}) => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
    const [showUserPopover, setShowUserPopover] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const currentProjectName = projects.find(p => p.id === currentProjectId)?.name || t('home');
    const expInfo = getExpirationInfo(subscriptionExpiresAt, cancelAtPeriodEnd, userPlan, userPlanType);
    const isFreeOrTrial = userPlan === 'Plano Grátis' || userPlanType?.toUpperCase() === 'TRIAL';

    const sidebarClasses = `
        fixed lg:relative z-[2000] h-screen transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-slate-700/30 bg-white dark:bg-[#1a1d23] flex flex-col
        ${isCollapsed ? 'w-20' : 'w-[280px]'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `;

    const dashboardSections: { label: string; items: MenuItem[] }[] = (() => {
        const allItems: MenuItem[] = [
            { id: 'projects', label: t('my_projects') || 'Projetos', icon: FolderOpen, badge: menuBadges?.projects },
            {
                id: 'registrations',
                label: t('registrations') || 'Cadastros',
                icon: ClipboardList,
                badge: menuBadges?.registrations,
                subItems: [
                    { id: 'reg_poste', label: t('reg_poste') || 'Poste', icon: UtilityPole, badge: menuBadges?.reg_poste },
                    { id: 'reg_caixa', label: t('reg_caixa') || 'Caixa', icon: Box, badge: menuBadges?.reg_caixa },
                    { id: 'reg_cabo', label: t('reg_cabo') || 'Cabo', icon: Cable, badge: menuBadges?.reg_cabo },
                    { id: 'reg_splitter', label: t('reg_splitter') || 'Splitter', icon: GitFork, badge: menuBadges?.reg_splitter },
                    { id: 'reg_olt', label: t('reg_olt') || 'OLT', icon: Server, badge: menuBadges?.reg_olt },
                    { id: 'reg_fusao', label: t('reg_fusao') || 'Fusão', icon: Zap, badge: menuBadges?.reg_fusao },
                    { id: 'reg_clientes', label: t('reg_clientes') || 'Clientes', icon: Users, badge: menuBadges?.reg_clientes }
                ]
            },
            { id: 'users', label: t('users') || 'Usuários', icon: Users, badge: menuBadges?.users },
            { id: 'integrations', label: 'Integrações', icon: Server, badge: menuBadges?.integrations },
            { id: 'settings', label: t('company_settings_title') || 'Configurações', icon: Settings },
            { id: 'backup', label: t('backup') || 'Backup', icon: Database },
        ].filter(item => {
            if (item.id === 'backup') {
                return userBackupEnabled && (userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'support');
            }
            if (item.id === 'users' || item.id === 'registrations' || item.id === 'integrations') {
                return userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'support';
            }
            return true;
        }) as MenuItem[];

        // Group into sections
        const general = allItems.filter(i => i.id === 'projects');
        const management = allItems.filter(i => ['registrations', 'users', 'integrations'].includes(i.id));
        const system = allItems.filter(i => ['settings', 'backup'].includes(i.id));

        const sections: { label: string; items: MenuItem[] }[] = [];
        if (general.length) sections.push({ label: t('sidebar_general') || 'Geral', items: general });
        if (management.length) sections.push({ label: t('sidebar_management') || 'Gerenciamento', items: management });
        if (system.length) sections.push({ label: t('sidebar_system') || 'Sistema', items: system });
        return sections;
    })();

    const allMenuItems = dashboardSections.flatMap(s => s.items);

    // Auto-expand menu if current view is a child
    useEffect(() => {
        if (viewMode === 'dashboard') {
            allMenuItems.forEach(item => {
                if (item.subItems && item.subItems.some(sub => sub.id === currentDashboardView)) {
                    setExpandedMenu(item.id);
                }
            });
        }
    }, [currentDashboardView, viewMode]);

    // Close popover on outside click
    useEffect(() => {
        if (!showUserPopover) return;
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setShowUserPopover(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showUserPopover]);

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
                <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-slate-100 dark:border-slate-700/30 h-16 flex-shrink-0`}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-2.5 overflow-hidden animate-in fade-in duration-300">
                            <div className="w-8 h-8 flex-shrink-0">
                                <img src={saasLogo || "/logo.png"} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="font-extrabold text-sm tracking-tighter text-slate-900 dark:text-slate-50 leading-none uppercase">
                                    {saasName || "FTTH PLANNER"}
                                </h1>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mt-1">{t('professional') || 'PRO'}</span>
                            </div>
                        </div>
                    )}
                    {isCollapsed && (
                        <img src={saasLogo || "/logo.png"} alt="Logo" className="w-8 h-8 object-contain animate-in fade-in duration-300" />
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleCollapse}
                        className="hidden lg:flex"
                        title={isCollapsed ? t('sidebar_expand') : t('sidebar_collapse')}
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>

                    {/* Mobile Close */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onCloseMobile}
                        className="lg:hidden text-slate-400 hover:text-red-500"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </div>

                {/* 2. Project Context (Only in map/project mode) */}
                {viewMode === 'project' && (
                    <div className={`p-4 border-b border-slate-100 dark:border-slate-700/30 ${isCollapsed ? 'flex flex-col items-center justify-center' : ''} flex-shrink-0 space-y-2`}>
                        <Tooltip content={t('import_kmz_label')} enabled={isCollapsed}>
                            <button
                                onClick={onImportClick}
                                className={`group relative flex items-center transition-all duration-200
                                    ${isCollapsed
                                        ? 'w-10 h-10 justify-center mx-auto rounded-xl bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-600/30 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/30'
                                        : 'w-full gap-3 bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-600/30 px-3 py-2 rounded-xl border-dashed hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/20'}`}
                            >
                                <FileUp className={`flex-shrink-0 transition-colors ${isCollapsed ? 'w-5 h-5' : 'w-4 h-4 text-slate-400 group-hover:text-emerald-500'}`} />
                                {!isCollapsed && (
                                    <div className="flex flex-col items-start overflow-hidden text-left">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{t('import_kmz_label')}</span>
                                        <span className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">{t('import_kmz_desc')}</span>
                                    </div>
                                )}
                                {!isCollapsed && <Upload className="w-3.5 h-3.5 text-slate-300 ml-auto group-hover:text-emerald-500" />}
                            </button>
                        </Tooltip>

                        <NavButton
                            icon={<FolderOpen className="w-5 h-5" />}
                            label={currentProjectName}
                            onClick={() => setShowProjectManager(true)}
                            isCollapsed={isCollapsed}
                            variant="slate"
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
                                    <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{t('search_generic')}</span>
                                    <SearchBox
                                        onSearch={onSearch}
                                        results={searchResults}
                                        onResultClick={item => { onResultClick(item); onCloseMobile(); }}
                                    />
                                </div>
                            ) : (
                                <div className="flex justify-center">
                                    <Tooltip content={t('search_generic')}>
                                        <button
                                            onClick={() => { onToggleCollapse(); setTimeout(() => document.querySelector('input')?.focus(), 100); }}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                                        >
                                            <Search className="w-5 h-5" />
                                        </button>
                                    </Tooltip>
                                </div>
                            )}

                            {/* Operation Section */}
                            <div className="space-y-1">
                                {!isCollapsed && (
                                    <span className="px-2 pb-2 block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{t('sidebar_operation')}</span>
                                )}

                                <NavButton
                                    icon={<LayoutDashboard className="w-5 h-5" />}
                                    label={t('home')}
                                    onClick={() => { setCurrentProjectId(null); setShowProjectManager(false); onCloseMobile(); }}
                                    isCollapsed={isCollapsed}
                                    variant="slate"
                                />

                                <NavButton
                                    icon={<FileText className="w-5 h-5" />}
                                    label={t('report_analyze')}
                                    onClick={() => { onReportClick?.(); onCloseMobile(); }}
                                    isCollapsed={isCollapsed}
                                    variant="slate"
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
                                        <Button
                                            variant="destructive"
                                            size={isCollapsed ? "icon" : "sm"}
                                            onClick={() => setVflSource(null)}
                                            className={`font-bold uppercase tracking-wider ${!isCollapsed ? 'w-full py-1 text-[9px] h-7' : 'w-7 h-7'}`}
                                            title={t('turn_off')}
                                        >
                                            {isCollapsed ? <X className="w-3.5 h-3.5" /> : t('turn_off')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Dashboard Menu with Sections */
                        <div className="space-y-4">
                            {dashboardSections.map(section => (
                                <div key={section.label} className="space-y-1">
                                    {!isCollapsed && (
                                        <span className="px-2 pb-1 block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                            {section.label}
                                        </span>
                                    )}
                                    {isCollapsed && (
                                        <div className="mx-auto w-6 border-t border-slate-200 dark:border-slate-700/40 my-2" />
                                    )}
                                    {section.items.map(item => {
                                        const active = isMenuActive(item);
                                        const isExpanded = expandedMenu === item.id;
                                        const hasSubItems = !!item.subItems;

                                        return (
                                            <div key={item.id} className="space-y-1">
                                                <NavButton
                                                    icon={<item.icon className="w-5 h-5" />}
                                                    label={item.label}
                                                    badge={item.badge}
                                                    onClick={() => {
                                                        if (hasSubItems) {
                                                            setExpandedMenu(prev => prev === item.id ? null : item.id);
                                                        } else if (onDashboardViewChange) {
                                                            onDashboardViewChange(item.id);
                                                            onCloseMobile();
                                                        }
                                                    }}
                                                    isCollapsed={isCollapsed}
                                                    variant={active ? "emerald" : "slate"}
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
                                                                            : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#22262e]'}`}
                                                                >
                                                                    <sub.icon className={`w-3.5 h-3.5 ${subActive ? 'text-emerald-500' : ''}`} />
                                                                    <span className="flex-1 text-left">{sub.label}</span>
                                                                    {sub.badge !== undefined && sub.badge !== 0 && (
                                                                        <Badge value={sub.badge} small />
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. Footer */}
                <div className={`p-4 border-t border-slate-100 dark:border-slate-700/30 ${isCollapsed ? 'items-center' : ''} flex flex-col gap-3 flex-shrink-0`}>

                    {/* Expanded: Full user card */}
                    {!isCollapsed && user && (
                        <div className="flex items-center gap-3 px-2 mb-2">
                            <UserAvatar user={user} companyLogo={companyLogo} size="md" />
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{companyName || user}</span>
                                <span className="text-[9px] text-slate-400 truncate">{user}</span>
                                {isHydrated ? (
                                    <>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{userPlan || 'Plano Grátis'}</span>
                                        <ExpirationLabel expInfo={expInfo} t={t} />
                                    </>
                                ) : (
                                    <div className="h-3 w-16 bg-slate-200 dark:bg-[#22262e] rounded animate-pulse" />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Collapsed: Avatar with popover */}
                    {isCollapsed && user && (
                        <div className="relative flex justify-center" ref={popoverRef}>
                            <button
                                onClick={() => setShowUserPopover(prev => !prev)}
                                className="relative group"
                            >
                                <UserAvatar user={user} companyLogo={companyLogo} size="md" />
                                {/* Dot indicator for expiring plans */}
                                {expInfo && (expInfo.isExpired || expInfo.isExpiringSoon) && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white dark:border-[#1a1d23] animate-pulse" />
                                )}
                            </button>

                            {/* User Popover */}
                            {showUserPopover && (
                                <div className="absolute bottom-full left-full ml-2 mb-0 w-56 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-600/40 rounded-xl shadow-xl p-3 z-[9999] animate-in fade-in slide-in-from-left-2 duration-200">
                                    <div className="flex items-center gap-3 mb-3">
                                        <UserAvatar user={user} companyLogo={companyLogo} size="lg" />
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{companyName || user}</span>
                                            <span className="text-[9px] text-slate-400 truncate">{user}</span>
                                        </div>
                                    </div>

                                    {isHydrated && (
                                        <div className="mb-3 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-[#1a1d23]">
                                            <div className="flex items-center gap-1.5">
                                                <Crown className="w-3 h-3 text-amber-500" />
                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">{userPlan || 'Plano Grátis'}</span>
                                            </div>
                                            <ExpirationLabel expInfo={expInfo} t={t} />
                                        </div>
                                    )}

                                    {isHydrated && userRole !== 'support' && (
                                        <Button
                                            variant={isFreeOrTrial ? 'primary' : 'outline'}
                                            onClick={() => { onUpgradeClick?.(); setShowUserPopover(false); }}
                                            className="w-full text-[10px] font-bold h-8 mb-2"
                                        >
                                            {isFreeOrTrial
                                                ? <><Zap className="w-3 h-3 mr-1.5" /> {t('upgrade_now') || 'Fazer Upgrade'}</>
                                                : <><CreditCard className="w-3 h-3 mr-1.5" /> {t('manage_subscription') || 'Gerenciar'}</>
                                            }
                                        </Button>
                                    )}

                                    <div className="grid grid-cols-3 gap-1.5">
                                        <FooterButton icon={<Globe className="w-3.5 h-3.5" />} title={language.toUpperCase()} onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')} />
                                        <FooterButton icon={theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />} title={theme === 'dark' ? 'Dark' : 'Light'} onClick={toggleTheme} />
                                        <FooterButton icon={<LogOut className="w-3.5 h-3.5" />} title={t('logout')} onClick={onLogout} danger />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Expanded: Upgrade button */}
                    {!isCollapsed && isHydrated && userRole !== 'support' && (
                        <div className="px-2 mb-1">
                            <Button
                                variant={isFreeOrTrial ? 'primary' : 'outline'}
                                onClick={onUpgradeClick}
                                className={`w-full text-[10px] font-bold h-9 ${!isFreeOrTrial ? 'dark:border-slate-600/40 dark:text-slate-300 dark:hover:bg-[#22262e] dark:hover:text-white' : ''}`}
                            >
                                {isFreeOrTrial
                                    ? <><Zap className="w-3.5 h-3.5 mr-2" /> {t('upgrade_now') || 'Fazer Upgrade'}</>
                                    : <><Settings className="w-3.5 h-3.5 mr-2" /> {t('manage_subscription') || 'Gerenciar Assinatura'}</>
                                }
                            </Button>
                        </div>
                    )}

                    {/* Expanded: Footer actions */}
                    {!isCollapsed && (
                        <div className="grid grid-cols-3 gap-2">
                            <FooterButton icon={<Globe className="w-4 h-4" />} title={language.toUpperCase()} onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')} />
                            <FooterButton icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} title={theme === 'dark' ? 'Dark' : 'Light'} onClick={toggleTheme} />
                            <FooterButton icon={<LogOut className="w-4 h-4" />} title={t('logout')} onClick={onLogout} danger />
                        </div>
                    )}

                    {/* Collapsed: Only theme + logout (rest is in popover) */}
                    {isCollapsed && (
                        <div className="flex flex-col gap-2 items-center">
                            <Tooltip content={theme === 'dark' ? 'Dark' : 'Light'}>
                                <FooterButton
                                    icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                    onClick={toggleTheme}
                                    className="w-10 h-10 px-0 flex-none"
                                />
                            </Tooltip>
                            <Tooltip content={t('logout')}>
                                <FooterButton
                                    icon={<LogOut className="w-4 h-4" />}
                                    onClick={onLogout}
                                    danger
                                    className="w-10 h-10 px-0 flex-none"
                                />
                            </Tooltip>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};

// --- Sub-Components ---

const Badge: React.FC<{ value: number | string; small?: boolean }> = ({ value, small }) => (
    <span className={`inline-flex items-center justify-center rounded-full font-extrabold leading-none bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400
        ${small ? 'min-w-[16px] h-4 px-1 text-[9px]' : 'min-w-[18px] h-[18px] px-1.5 text-[10px]'}`}>
        {typeof value === 'number' && value > 99 ? '99+' : value}
    </span>
);

const UserAvatar: React.FC<{ user: string; companyLogo?: string | null; size?: 'md' | 'lg' }> = ({ user, companyLogo, size = 'md' }) => {
    const dim = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
    return (
        <div className={`${dim} rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-700/30 overflow-hidden shrink-0`}>
            {companyLogo ? (
                <img src={companyLogo} alt="Company" className="w-full h-full object-contain" />
            ) : (
                user.substring(0, 2).toUpperCase()
            )}
        </div>
    );
};

const ExpirationLabel: React.FC<{ expInfo: ReturnType<typeof getExpirationInfo>; t: (key: string) => string }> = ({ expInfo, t }) => {
    if (!expInfo) return null;

    if (expInfo.isExpired) {
        return (
            <p className="text-[9px] font-extrabold uppercase tracking-wide leading-tight mt-0.5 text-rose-500">
                {t('expired') || 'Expirado'}
            </p>
        );
    }

    return (
        <p className={`text-[9px] font-extrabold uppercase tracking-wide leading-tight mt-0.5 ${expInfo.isExpiringSoon || expInfo.cancelAtPeriodEnd ? 'text-rose-500' : 'text-amber-500'}`}>
            {expInfo.isTrialPlan ? (t('trial') || 'Teste') : (t('expires') || 'Expira')}: {expInfo.days} {t('days') || 'dias'}
        </p>
    );
};

interface NavButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    isCollapsed: boolean;
    variant?: 'slate' | 'emerald';
    progress?: number;
    isActive?: boolean;
    hasArrow?: boolean;
    isExpanded?: boolean;
    badge?: number | string;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, onClick, isCollapsed, variant = 'slate', progress, isActive, hasArrow, isExpanded, badge }) => {
    const isEmerald = variant === 'emerald' || isActive;

    const button = (
        <Button
            variant={isEmerald ? 'emerald' : 'ghost'}
            onClick={onClick}
            className={`flex items-center group relative transition-all duration-300 border border-transparent overflow-hidden
                ${isCollapsed ? 'w-10 h-10 p-0 justify-center mx-auto' : 'w-full px-3 py-2.5 gap-3 justify-start'}
                ${isActive ? '' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}
        >
            <div className={`relative flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isEmerald ? 'text-white' : 'text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100'}`}>
                {icon}
                {/* Badge dot on collapsed icon */}
                {isCollapsed && badge !== undefined && badge !== 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-[#1a1d23]" />
                )}
            </div>

            {!isCollapsed && (
                <span className="text-xs font-bold truncate tracking-tight flex-1 text-left">{label}</span>
            )}

            {!isCollapsed && badge !== undefined && badge !== 0 && (
                <Badge value={badge} />
            )}

            {hasArrow && (
                <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isEmerald ? 'text-white' : 'text-slate-400'}`} />
            )}

            {progress !== undefined && !isCollapsed && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${progress}%` }} />
            )}
        </Button>
    );

    if (isCollapsed) {
        return <Tooltip content={label}>{button}</Tooltip>;
    }
    return button;
};

const FooterButton: React.FC<{ icon: React.ReactNode; title?: string; onClick: () => void; danger?: boolean; className?: string }> = ({ icon, title, onClick, danger, className = "" }) => (
    <Button
        variant={danger ? "destructive" : "outline"}
        size="icon"
        onClick={onClick}
        title={title}
        className={`flex-1 h-9 ${className} ${danger ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-500 hover:text-white border-rose-100 dark:border-rose-900/30' : 'dark:border-slate-600/30 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-[#22262e]'}`}
    >
        {icon}
    </Button>
);
