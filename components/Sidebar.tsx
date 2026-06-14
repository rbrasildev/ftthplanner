import React, { useState, useEffect, useRef } from 'react';
import {
    FolderOpen, Upload, Activity, Flashlight, Globe, Moon, Sun,
    LogOut, FileUp, FileDown, ScanSearch, ChevronLeft, ChevronRight,
    Search, Database, LayoutDashboard, X, ChevronDown, ClipboardList, UtilityPole,
    Cable, GitFork, Server, Zap, Users, Settings, FileText, Crown, CreditCard, Plug, Ruler, Fingerprint, FileSpreadsheet, HelpCircle, Building, Briefcase, Puzzle
} from 'lucide-react';
import { CTOIcon } from './icons/TelecomIcons';
import { Button } from './common/Button';
import { Tooltip } from './common/Tooltip';
import { SearchBox } from './SearchBox';
import { hasPermission } from '../shared/permissions';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import { Project, Coordinates } from '../types';

export type DashboardView = 'projects' | 'dashboard' | 'integrations' | 'registrations' | 'users' | 'settings' | 'backup' | 'reg_poste' | 'reg_caixa' | 'reg_cabo' | 'reg_fusao' | 'reg_conector' | 'reg_splitter' | 'reg_olt' | 'reg_gbic' | 'reg_clientes';

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
    userPermissions?: string[];
    userPlan?: string;
    userPlanType?: string;
    subscriptionExpiresAt?: string | null;
    cancelAtPeriodEnd?: boolean;
    projects: Project[];
    currentProjectId: string | null;
    deploymentProgress: number;
    vflSource: string | null;
    setVflSource: (source: string | null) => void;
    otdrResult?: Coordinates | null;
    setOtdrResult?: (result: Coordinates | null) => void;
    searchResults: any[];
    onSearch: (term: string) => void;
    onResultClick: (item: any) => void;
    onLogout: () => void;
    onUpgradeClick?: () => void;
    setCurrentProjectId: (id: string | null) => void;
    setShowProjectManager: (show: boolean) => void;
    onImportClick: () => void;
    onExportClick?: () => void;
    onExportAreaClick?: () => void;
    onReportAreaClick?: () => void;
    isExporting?: boolean;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    isMobileOpen: boolean;
    onCloseMobile: () => void;
    onReportClick?: () => void;
    onPoleTableClick?: () => void;
    isHydrated?: boolean;
    currentDashboardView?: DashboardView;
    onDashboardViewChange?: (view: DashboardView) => void;
    companyLogo?: string | null;
    companyName?: string | null;
    saasName?: string | null;
    saasLogo?: string | null;
    userBackupEnabled?: boolean;
    menuBadges?: Partial<Record<DashboardView, number | string>>;
    onProjectSettingsClick?: () => void;
    onHelpClick?: () => void;
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

// Resolve uma label legível pra fonte do VFL combinando o ID da porta com o
// nome do equipamento dono (OLT, DIO, splitter, cabo). Sem o network o fallback
// volta às labels genéricas (Fibra N, Porta N, …) — o que aparecia antes.
function formatVflSourceLabel(source: string, network?: { ctos?: any[]; pops?: any[]; cables?: any[] } | null): string {
    // OLT GPON port: `olt-<id>-s<slot>-p<port>`
    const oltGponMatch = source.match(/^(olt-[^-]+)-s(\d+)-p(\d+)$/i);
    if (oltGponMatch) {
        const [, oltId, slot, port] = oltGponMatch;
        const olt = network?.pops?.flatMap((p: any) => p.olts || []).find((o: any) => o.id === oltId);
        const name = olt?.name || 'OLT';
        return `${name} · Slot ${slot} · Porta ${port}`;
    }
    // OLT uplink: `olt-<id>-uplink-<n>`
    const oltUplinkMatch = source.match(/^(olt-[^-]+)-uplink-(\d+)$/i);
    if (oltUplinkMatch) {
        const [, oltId, idx] = oltUplinkMatch;
        const olt = network?.pops?.flatMap((p: any) => p.olts || []).find((o: any) => o.id === oltId);
        return `${olt?.name || 'OLT'} · Uplink ${idx}`;
    }
    // DIO port (POP): `dio-<id>-p-<idx>` (zero-based)
    const dioPopMatch = source.match(/^(dio-[^-]+)-p-(\d+)$/i);
    if (dioPopMatch) {
        const [, dioId, idx] = dioPopMatch;
        const dio = network?.pops?.flatMap((p: any) => p.dios || []).find((d: any) => d.id === dioId);
        return `${dio?.name || 'DIO'} · Porta ${parseInt(idx, 10) + 1}`;
    }
    // DIO inline (CTO): `dio-<ts>-port-<idx>-<in|out>`
    const dioInlineMatch = source.match(/^(dio-\d+)-port-(\d+)-(in|out)$/i);
    if (dioInlineMatch) {
        const [, dioId, idx, side] = dioInlineMatch;
        const dio = network?.ctos?.flatMap((c: any) => c.dios || []).find((d: any) => d.id === dioId);
        return `${dio?.name || 'DIO'} · P${parseInt(idx, 10) + 1} (${side.toUpperCase()})`;
    }
    // Splitter port: `splitter-<id>-...-(in|out)-<idx>`
    const splitterMatch = source.match(/^(splitter-[^-]+).*-(in|out)-(\d+)$/i);
    if (splitterMatch) {
        const [, splitterId, side, idx] = splitterMatch;
        const allSplitters = [
            ...(network?.ctos?.flatMap((c: any) => c.splitters || []) || []),
            ...(network?.pops?.flatMap((p: any) => p.splitters || []) || []),
        ];
        const sp = allSplitters.find((s: any) => s.id === splitterId);
        const portLabel = side.toLowerCase() === 'in' ? 'IN' : `OUT ${parseInt(idx, 10) + 1}`;
        return `${sp?.name || 'Splitter'} · ${portLabel}`;
    }
    // Fibra de cabo: `<cableId>-fiber-<N>`
    const fiberMatch = source.match(/^(.+)-fiber-(\d+)$/);
    if (fiberMatch) {
        const [, cableId, idx] = fiberMatch;
        const cable = network?.cables?.find((c: any) => c.id === cableId);
        const fiberN = parseInt(idx, 10) + 1;
        return cable?.name ? `${cable.name} · Fibra ${fiberN}` : `Fibra ${fiberN}`;
    }
    // Genérico `-port-<idx>`
    const portMatch = source.match(/-port-(\d+)$/i);
    if (portMatch) return `Porta ${parseInt(portMatch[1], 10) + 1}`;
    return source.length > 24 ? source.slice(0, 24) + '…' : source;
}

// --- Main Component ---

export const Sidebar: React.FC<SidebarProps> = ({
    viewMode,
    user,
    userRole,
    userPermissions = [],
    userPlan,
    userPlanType,
    subscriptionExpiresAt,
    cancelAtPeriodEnd,
    projects,
    currentProjectId,
    deploymentProgress,
    vflSource,
    setVflSource,
    otdrResult,
    setOtdrResult,
    searchResults,
    onSearch,
    onResultClick,
    onLogout,
    onUpgradeClick,
    setCurrentProjectId,
    setShowProjectManager,
    onImportClick,
    onExportClick,
    onExportAreaClick,
    onReportAreaClick,
    isExporting,
    isCollapsed,
    onToggleCollapse,
    isMobileOpen,
    onCloseMobile,
    onReportClick,
    onPoleTableClick,
    isHydrated,
    currentDashboardView = 'projects',
    onDashboardViewChange,
    companyLogo,
    companyName,
    saasName,
    saasLogo,
    userBackupEnabled,
    menuBadges,
    onProjectSettingsClick,
    onHelpClick
}) => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
    const [showUserPopover, setShowUserPopover] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const projectSwitcherRef = useRef<HTMLDivElement>(null);
    const [showProjectSwitcher, setShowProjectSwitcher] = useState(false);

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
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: menuBadges?.dashboard },
            {
                id: 'registrations',
                label: t('registrations') || 'Cadastros',
                icon: ClipboardList,
                badge: menuBadges?.registrations,
                subItems: [
                    { id: 'reg_poste', label: t('reg_poste') || 'Poste', icon: UtilityPole, badge: menuBadges?.reg_poste },
                    { id: 'reg_caixa', label: t('reg_caixa') || 'Caixa', icon: CTOIcon, badge: menuBadges?.reg_caixa },
                    { id: 'reg_cabo', label: t('reg_cabo') || 'Cabo', icon: Cable, badge: menuBadges?.reg_cabo },
                    { id: 'reg_splitter', label: t('reg_splitter') || 'Splitter', icon: GitFork, badge: menuBadges?.reg_splitter },
                    { id: 'reg_olt', label: t('reg_olt') || 'OLT', icon: Server, badge: menuBadges?.reg_olt },
                    { id: 'reg_gbic', label: t('reg_gbic') || 'GBIC / SFP', icon: Fingerprint, badge: menuBadges?.reg_gbic },
                    { id: 'reg_fusao', label: t('reg_fusao') || 'Fusão', icon: Zap, badge: menuBadges?.reg_fusao },
                    { id: 'reg_conector', label: t('reg_conector') || 'Conector', icon: Plug, badge: menuBadges?.reg_conector },
                    { id: 'reg_clientes', label: t('reg_clientes') || 'Clientes', icon: Users, badge: menuBadges?.reg_clientes }
                ]
            },
            { id: 'users', label: t('users') || 'Usuários', icon: Users, badge: menuBadges?.users },
            { id: 'integrations', label: 'Integrações', icon: Puzzle, badge: menuBadges?.integrations },
            { id: 'settings', label: t('sidebar_organization') || 'Organização', icon: Briefcase },
            { id: 'backup', label: t('backup') || 'Backup', icon: Database },
            { id: 'help', label: t('help') || 'Ajuda', icon: HelpCircle },
        ].filter(item => {
            if (item.id === 'backup') return userBackupEnabled && (hasPermission(userPermissions, 'backup:manage') || userRole === 'OWNER' || userRole === 'support');
            if (item.id === 'users') return hasPermission(userPermissions, 'users:manage') || userRole === 'OWNER' || userRole === 'support';
            if (item.id === 'registrations') return hasPermission(userPermissions, 'catalogs:manage') || userRole === 'OWNER' || userRole === 'support';
            if (item.id === 'integrations') return hasPermission(userPermissions, 'integrations:manage') || userRole === 'OWNER' || userRole === 'support';
            if (item.id === 'settings') return hasPermission(userPermissions, 'settings:company') || userRole === 'OWNER' || userRole === 'support';
            return true;
        }) as MenuItem[];

        // Group into sections
        const general = allItems.filter(i => i.id === 'projects' || i.id === 'dashboard');
        const management = allItems.filter(i => ['registrations', 'users', 'integrations', 'settings'].includes(i.id));
        const system = allItems.filter(i => ['backup', 'help'].includes(i.id));

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

    useEffect(() => {
        if (!showProjectSwitcher) return;
        const handler = (e: MouseEvent) => {
            if (projectSwitcherRef.current && !projectSwitcherRef.current.contains(e.target as Node)) {
                setShowProjectSwitcher(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showProjectSwitcher]);

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
                    <div className={`p-4 border-b border-slate-100 dark:border-slate-700/30 flex-shrink-0 space-y-2 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                        {(hasPermission(userPermissions, 'projects:import') || userRole === 'OWNER') && <Tooltip content={t('import_kmz_label')} enabled={isCollapsed}>
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
                        </Tooltip>}

                        {/* Project switcher inline — click pra trocar de projeto
                            sem voltar pro dashboard. */}
                        <div className="relative" ref={projectSwitcherRef}>
                            <button
                                onClick={() => !isCollapsed && setShowProjectSwitcher(o => !o)}
                                className={`group relative w-full flex items-center transition-colors ${isCollapsed
                                    ? 'w-10 h-10 justify-center mx-auto rounded-xl bg-slate-50 dark:bg-[#22262e] text-slate-400 hover:text-emerald-500'
                                    : 'gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#22262e] hover:bg-slate-100 dark:hover:bg-[#262a32] border border-slate-200/60 dark:border-slate-700/40'}`}
                                title={isCollapsed ? currentProjectName : undefined}
                            >
                                <FolderOpen className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                {!isCollapsed && (
                                    <>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{currentProjectName}</p>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{deploymentProgress}% implantado</p>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProjectSwitcher ? 'rotate-180' : ''}`} />
                                    </>
                                )}
                                {/* Progress bar embutida no fundo do card */}
                                {!isCollapsed && (
                                    <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500" style={{ width: `${deploymentProgress}%` }} />
                                )}
                            </button>

                            {/* Dropdown de projetos */}
                            {showProjectSwitcher && !isCollapsed && projects.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700/40 rounded-xl shadow-xl z-30 max-h-72 overflow-y-auto py-1">
                                    {projects.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setCurrentProjectId(p.id);
                                                setShowProjectSwitcher(false);
                                                onCloseMobile();
                                            }}
                                            className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors ${p.id === currentProjectId ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300 font-medium'}`}
                                        >
                                            <FolderOpen className={`w-3.5 h-3.5 ${p.id === currentProjectId ? 'text-emerald-500' : 'text-slate-400'}`} />
                                            <span className="truncate flex-1">{p.name}</span>
                                            {p.id === currentProjectId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Navigation / Tools */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 custom-scrollbar">

                    {viewMode === 'project' ? (
                        <>
                            {/* Search Section */}
                            {!isCollapsed ? (
                                <div className="space-y-2 animate-in slide-in-from-left-2 duration-300">
                                    <span className="px-2 text-[11px] font-semibold text-slate-400/80 dark:text-slate-500/80">{t('search_generic')}</span>
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
                            <div className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                                {/* Navigation */}
                                <NavButton
                                    icon={<LayoutDashboard className="w-5 h-5" />}
                                    label={t('home')}
                                    onClick={() => { setCurrentProjectId(null); setShowProjectManager(false); onCloseMobile(); }}
                                    isCollapsed={isCollapsed}
                                    variant="slate"
                                />

                                {/* Análise — sem header, agrupado por divider */}
                                <NavButton
                                    icon={<FileText className="w-5 h-5" />}
                                    label={t('report_analyze')}
                                    onClick={() => { onReportClick?.(); onCloseMobile(); }}
                                    isCollapsed={isCollapsed}
                                    variant="slate"
                                />

                                <NavButton
                                    icon={<UtilityPole className="w-5 h-5" />}
                                    label={t('pole_table')}
                                    onClick={() => { onPoleTableClick?.(); onCloseMobile(); }}
                                    isCollapsed={isCollapsed}
                                    variant="slate"
                                />

                                {/* Export — separado por divider fino em vez de label */}
                                {((hasPermission(userPermissions, 'projects:export') || userRole === 'OWNER') && (onExportClick || onExportAreaClick)) && (
                                    <>
                                        {!isCollapsed && <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-1" />}
                                        {onExportClick && (
                                            <NavButton
                                                icon={<FileDown className={`w-5 h-5 ${isExporting ? 'animate-bounce text-emerald-500' : ''}`} />}
                                                label={t('export_kmz_button')}
                                                onClick={() => { if (!isExporting) { onExportClick(); onCloseMobile(); } }}
                                                isCollapsed={isCollapsed}
                                                variant="slate"
                                            />
                                        )}
                                        {onExportAreaClick && (
                                            <NavButton
                                                icon={<ScanSearch className="w-5 h-5" />}
                                                label={t('export_area')}
                                                onClick={() => { onExportAreaClick(); onCloseMobile(); }}
                                                isCollapsed={isCollapsed}
                                                variant="slate"
                                            />
                                        )}
                                        {onReportAreaClick && (
                                            <NavButton
                                                icon={<FileSpreadsheet className="w-5 h-5" />}
                                                label={t('report_area')}
                                                onClick={() => { onReportAreaClick(); onCloseMobile(); }}
                                                isCollapsed={isCollapsed}
                                                variant="slate"
                                            />
                                        )}
                                    </>
                                )}

                                {/* Settings — divider, sem label redundante */}
                                {!isCollapsed && <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-1" />}
                                <NavButton
                                    icon={<Settings className="w-5 h-5" />}
                                    label={t('system_settings')}
                                    onClick={() => { onProjectSettingsClick?.(); onCloseMobile(); }}
                                    isCollapsed={isCollapsed}
                                    variant="slate"
                                />
                            </div>

                            {/* VFL pill — compact status bar style (VS Code-like) */}
                            {vflSource && (
                                <button
                                    onClick={() => setVflSource(null)}
                                    title={`${t('turn_off')} VFL`}
                                    className={`group flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors ${isCollapsed ? 'w-10 h-8 justify-center mx-auto' : 'w-full px-2.5 py-1.5'}`}
                                >
                                    <span className="flex items-center gap-1.5 shrink-0">
                                        <Flashlight className="w-3.5 h-3.5 text-rose-500" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    </span>
                                    {!isCollapsed && (
                                        <>
                                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">VFL</span>
                                            <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 truncate flex-1 text-left">
                                                {formatVflSourceLabel(vflSource, projects.find(p => p.id === currentProjectId)?.network)}
                                            </span>
                                            <X className="w-3.5 h-3.5 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                        </>
                                    )}
                                </button>
                            )}

                            {/* OTDR pill — mesma estrutura compacta */}
                            {otdrResult && setOtdrResult && (
                                <button
                                    onClick={() => setOtdrResult(null)}
                                    title={`${t('turn_off')} OTDR`}
                                    className={`group flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors ${isCollapsed ? 'w-10 h-8 justify-center mx-auto' : 'w-full px-2.5 py-1.5'}`}
                                >
                                    <span className="flex items-center gap-1.5 shrink-0">
                                        <Ruler className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    </span>
                                    {!isCollapsed && (
                                        <>
                                            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">OTDR</span>
                                            <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 font-mono truncate flex-1 text-left">
                                                {otdrResult.lat.toFixed(4)}, {otdrResult.lng.toFixed(4)}
                                            </span>
                                            <X className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                        </>
                                    )}
                                </button>
                            )}
                        </>
                    ) : (
                        /* Dashboard Menu with Sections */
                        <div className="space-y-4">
                            {dashboardSections.map(section => (
                                <div key={section.label} className={`space-y-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                                    {!isCollapsed && (
                                        <span className="px-2 pb-1 block text-[11px] font-semibold text-slate-400/80 dark:text-slate-500/80">
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
                                                                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-xs transition-colors border-l-2
                                                                        ${subActive
                                                                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 font-bold rounded-l-none'
                                                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 border-transparent font-semibold'}`}
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

                                    {isHydrated && userRole !== 'support' && (hasPermission(userPermissions, 'subscription:manage') || userRole === 'OWNER') && (
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

                                    <div className="grid grid-cols-4 gap-1.5">
                                        <FooterButton icon={<Globe className="w-3.5 h-3.5" />} title={language.toUpperCase()} onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')} />
                                        <FooterButton icon={theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />} title={theme === 'dark' ? 'Dark' : 'Light'} onClick={toggleTheme} />
                                        {onHelpClick && (
                                            <FooterButton icon={<HelpCircle className="w-3.5 h-3.5" />} title={t('help') || 'Ajuda'} onClick={() => { onHelpClick(); setShowUserPopover(false); }} />
                                        )}
                                        <FooterButton icon={<LogOut className="w-3.5 h-3.5" />} title={t('logout')} onClick={onLogout} danger />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Expanded: Upgrade button */}
                    {!isCollapsed && isHydrated && userRole !== 'support' && (hasPermission(userPermissions, 'subscription:manage') || userRole === 'OWNER') && (
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
                        <div className={`grid ${onHelpClick ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
                            <FooterButton icon={<Globe className="w-4 h-4" />} title={language.toUpperCase()} onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')} />
                            <FooterButton icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} title={theme === 'dark' ? 'Dark' : 'Light'} onClick={toggleTheme} />
                            {onHelpClick && (
                                <FooterButton icon={<HelpCircle className="w-4 h-4" />} title={t('help') || 'Ajuda'} onClick={onHelpClick} />
                            )}
                            <FooterButton icon={<LogOut className="w-4 h-4" />} title={t('logout')} onClick={onLogout} danger />
                        </div>
                    )}

                    {/* Collapsed: Only theme + help + logout (rest is in popover) */}
                    {isCollapsed && (
                        <div className="flex flex-col gap-2 items-center">
                            <Tooltip content={theme === 'dark' ? 'Dark' : 'Light'}>
                                <FooterButton
                                    icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                    onClick={toggleTheme}
                                    className="w-10 h-10 px-0 flex-none"
                                />
                            </Tooltip>
                            {onHelpClick && (
                                <Tooltip content={t('help') || 'Ajuda'}>
                                    <FooterButton
                                        icon={<HelpCircle className="w-4 h-4" />}
                                        onClick={onHelpClick}
                                        className="w-10 h-10 px-0 flex-none"
                                    />
                                </Tooltip>
                            )}
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
    // Active state pattern: left rail accent + text color shift + bg muito sutil.
    // Diferencia "current page" de "hover" (que usa só bg-slate-100 leve).
    // Padrão Linear/Notion/GitHub. variant="emerald" antigo (bg fill) ainda
    // funciona pra contextos não-nav (ex.: project context card highlight).
    const useAccentStyle = isActive && variant !== 'emerald';
    const isEmerald = variant === 'emerald';

    const baseClasses = isCollapsed ? 'w-10 h-10 p-0 justify-center mx-auto' : 'w-full px-3 py-2 gap-3 justify-start';
    const stateClasses = useAccentStyle
        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 border-l-2 border-emerald-500 rounded-l-none'
        : isEmerald
            ? '' // Button já estiliza com variant
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 border-l-2 border-transparent';

    const button = (
        <Button
            variant={isEmerald ? 'emerald' : 'ghost'}
            onClick={onClick}
            className={`flex items-center group relative transition-colors duration-150 overflow-hidden ${baseClasses} ${stateClasses}`}
        >
            <div className={`relative flex-shrink-0 transition-colors duration-150 ${useAccentStyle ? 'text-emerald-600 dark:text-emerald-400' : isEmerald ? 'text-white' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`}>
                {icon}
                {isCollapsed && badge !== undefined && badge !== 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-[#1a1d23]" />
                )}
            </div>

            {!isCollapsed && (
                <span className={`text-xs truncate flex-1 text-left ${useAccentStyle ? 'font-bold' : 'font-semibold'}`}>{label}</span>
            )}

            {!isCollapsed && badge !== undefined && badge !== 0 && (
                <Badge value={badge} />
            )}

            {hasArrow && (
                <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${useAccentStyle ? 'text-emerald-500' : isEmerald ? 'text-white' : 'text-slate-400'}`} />
            )}

            {progress !== undefined && !isCollapsed && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
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
        className={`flex-1 h-9 ${className} ${danger ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500 dark:hover:text-white border-rose-200 dark:border-rose-500/30' : 'dark:border-slate-600/30 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-[#22262e]'}`}
    >
        {icon}
    </Button>
);
