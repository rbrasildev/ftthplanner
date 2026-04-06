import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { Button } from './components/common/Button';
import { autoSnapNetwork, calculateDistance } from './utils/geometryUtils';
import { CTOEditor } from './components/CTOEditor';
import { POPEditor } from './components/POPEditor';
import { ProjectManager } from './components/ProjectManager';
import { CableEditor } from './components/CableEditor';
import { CTODetailsPanel } from './components/CTODetailsPanel';
import { POPDetailsPanel } from './components/POPDetailsPanel';
import { PoleDetailsPanel } from './components/PoleDetailsPanel';
import { MapToolbar } from './components/MapToolbar';
import { SaasAdminPage } from './components/admin/SaasAdminPage';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { LandingPage } from './components/LandingPage';
import { DashboardPage } from './components/DashboardPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { CompanySettings } from './components/settings/CompanySettings';
import { SearchBox } from './components/SearchBox';
import { Project, Coordinates, EquipmentType, CTOData, POPData, CableData, PoleData, SaaSConfig, NetworkState, CTOStatus, SystemSettings, FusionType, Customer } from './types';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import { useKMZExport } from './hooks/useKMZExport';
import { useNetworkImport } from './hooks/useNetworkImport';
import { useOpticalTrace } from './hooks/useOpticalTrace';
import { useNetworkOperations } from './hooks/useNetworkOperations';

import { Loader2, Plus, FileDown, Waypoints, Box, Activity, CalendarDays, Database, Users, Link as LinkIcon, Building2, Map as MapIcon, LayoutDashboard, Settings, LogOut, ChevronRight, Share2, Crown, Zap, Save, AlertTriangle, Building, ChevronLeft, MapPin, X, FileUp, Check, CheckCircle2, Play, Pause, Square, SkipForward, SkipBack, Search, Maximize2, UtilityPole, Ruler, Scissors, ArrowRightLeft, MousePointer2, AlertCircle, Phone, Info, Eye, Download, EyeOff, LayoutTemplate, Layers, Move } from 'lucide-react';
import JSZip from 'jszip';
import toGeoJSON from '@mapbox/togeojson';
import L from 'leaflet';
import * as projectService from './services/projectService';
import * as saasService from './services/saasService';
import * as authService from './services/authService';
import * as catalogService from './services/catalogService';
import api from './services/api';
import { UpgradePlanModal } from './components/UpgradePlanModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';

const STORAGE_KEY_USER = 'ftth_planner_user_v1';
import { PoleSelectionModal } from './components/modals/PoleSelectionModal';
import { KmlImportModal } from './components/modals/KmlImportModal';
import { AdvancedImportModal } from './components/modals/AdvancedImportModal';
import { ProjectReportModal } from './components/modals/ProjectReportModal';
import { ExportKMZModal, ExportKMZOptions } from './components/modals/ExportKMZModal';
import { FusionModule } from './components/FusionModule';
import { SupportChatBubble } from './components/support/SupportChatBubble';

// Map Overlays
import { MapModeTooltip } from './components/map/MapModeTooltip';
import { RulerToolbar } from './components/map/RulerToolbar';
import { CableEditToolbar } from './components/map/CableEditToolbar';

const parseJwt = (token: string) => {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.warn("JWT parse failed", e);
        return null;
    }
};

// --- DATA MIGRATION HELPER (Fix for Cable Split Persistence) ---
const migrateNodeData = (node: CTOData | POPData, oldCableId: string, newCableId: string): CTOData | POPData => {
    // 1. Update Input IDs
    const nextInputIds = (node.inputCableIds || []).map(id => id === oldCableId ? newCableId : id);

    // 2. Migrate Layout
    let nextLayout = node.layout ? { ...node.layout } : {};
    if (nextLayout[oldCableId]) {
        nextLayout[newCableId] = nextLayout[oldCableId];
        delete nextLayout[oldCableId];
    }

    // 3. Migrate Connections
    let nextConnections = (node.connections || []).map(conn => {
        let nextConn = { ...conn };
        // Replace in Source
        if (conn.sourceId === oldCableId) nextConn.sourceId = newCableId;
        else if (conn.sourceId.includes(`${oldCableId}-fiber-`)) {
            nextConn.sourceId = conn.sourceId.replace(`${oldCableId}-fiber-`, `${newCableId}-fiber-`);
        }

        // Replace in Target
        if (conn.targetId === oldCableId) nextConn.targetId = newCableId;
        else if (conn.targetId.includes(`${oldCableId}-fiber-`)) {
            nextConn.targetId = conn.targetId.replace(`${oldCableId}-fiber-`, `${newCableId}-fiber-`);
        }
        return nextConn;
    });

    return {
        ...node,
        inputCableIds: nextInputIds,
        layout: nextLayout,
        connections: nextConnections
    };
};

import { ConnectionStatus } from './components/ConnectionStatus';

export default function App() {
    const { t, language, setLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();

    const [user, setUser] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_USER));
    const [token, setToken] = useState<string | null>(null); // Token is now in cookies
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userPermissions, setUserPermissions] = useState<string[]>([]);
    const [isSupportMode, setIsSupportMode] = useState<boolean>(() => !!localStorage.getItem('ftth_support_token'));

    useEffect(() => {
        // Evaluate token with interceptor logic priority
        const supportToken = localStorage.getItem('ftth_support_token');
        const activeToken = supportToken || token;

        if (activeToken && activeToken !== 'session') {
            const decoded = parseJwt(activeToken);
            if (decoded?.role) setUserRole(decoded.role);
            if (decoded?.username) setUser(decoded.username);
        } else if (!activeToken) {
            setUserRole(null);
        }
    }, [token, isSupportMode]);

    const [authView, setAuthView] = useState<'landing' | 'login' | 'register' | 'reset-password'>('landing');
    const [selectedRegisterPlan, setSelectedRegisterPlan] = useState<string | undefined>(undefined);

    // Projects List (Summaries)
    const [projects, setProjects] = useState<Project[]>([]);
    // Current Active Project (Full Data)
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);

    // Global System Settings
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({ snapDistance: 30 });

    const [isExportKMZModalOpen, setIsExportKMZModalOpen] = useState(false);
    const { isExporting, exportToKMZ } = useKMZExport();
    const [exportAreaPolygon, setExportAreaPolygon] = useState<{ lat: number; lng: number }[]>([]);

    const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => localStorage.getItem('ftth_current_project_id'));

    useEffect(() => {
        if (currentProjectId) {
            localStorage.setItem('ftth_current_project_id', currentProjectId);
        } else {
            localStorage.removeItem('ftth_current_project_id');
            // FIX: If we clear project and are in support mode, ensure we go to projects dashboard view
            if (isSupportMode) {
                setDashboardView('projects');
                // We should NOT clear user or projects here, 
                // as the support admin still needs to see the client's dashboard.
            }
        }
        // Safety: Reset tool mode and clear backup when switching projects
        setToolMode('view');
        previousNetworkState.current = null;
    }, [currentProjectId, isSupportMode]);
    const prevProjectIdRef = useRef<string>('');

    const [showProjectManager, setShowProjectManager] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);
    const settingsTimeoutRef = useRef<any>(null);
    const syncTimeoutRef = useRef<any>(null); // For debounce sync
    const skipNextAutoSyncRef = useRef<boolean>(false); // NEW: To avoid sync conflict when manual updateCTO is running

    // Backup for Cancel functionality
    const previousNetworkState = useRef<NetworkState | null>(null);

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [renewOnly, setRenewOnly] = useState(false);
    const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
    const [upgradeModalDetails, setUpgradeModalDetails] = useState<string | undefined>(undefined);
    const [upgradeModalTitle, setUpgradeModalTitle] = useState<string | undefined>(undefined);
    const [userPlan, setUserPlan] = useState<string>('Plano Grátis');
    const [userPlanId, setUserPlanId] = useState<string | null>(null);
    const [userPlanPrice, setUserPlanPrice] = useState<number>(0);
    const [userPlanType, setUserPlanType] = useState<string>('STANDARD');
    const [userBackupEnabled, setUserBackupEnabled] = useState<boolean>(false);
    const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
    const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState<string | null>(null);
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [saasConfig, setSaasConfig] = useState<SaaSConfig | null>(null);

    // Initial Route Check for Password Reset
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const isResetPath = window.location.pathname === '/reset-password';
        const hasResetToken = params.has('token');

        if (isResetPath || (hasResetToken && !user)) {
            setAuthView('reset-password');
        }

        // --- DEEP LINK / QR CODE HANDLER ---
        const path = window.location.pathname;

        if (path.startsWith('/cto/')) {
            const ctoId = path.split('/')[2];
            const pId = params.get('projectId');
            if (ctoId) {
                if (pId) setCurrentProjectId(pId);
                setTargetCTOId(ctoId);
                if (params.get('download') === 'true') {
                    setAutoDownloadCTO(true);
                }
            }
        }

        // Load Global SaaS Config
        saasService.getSaaSConfig().then(setSaasConfig).catch(console.error);

        // Load Global Customers (for Search/Linking)
        if (currentProjectId) {
            import('./services/customerService').then(service => {
                service.getCustomers({ projectId: currentProjectId }).then(setGlobalCustomers).catch(console.error);
            });
        } else {
            setGlobalCustomers([]);
        }
    }, [currentProjectId]);

    useEffect(() => {
        const handleSync = () => {
            if (currentProjectId) {
                import('./services/customerService').then(service => {
                    service.getCustomers({ projectId: currentProjectId }).then(setGlobalCustomers).catch(console.error);
                });
            }
        };
        window.addEventListener('customers-synced', handleSync);
        return () => window.removeEventListener('customers-synced', handleSync);
    }, [currentProjectId]);

    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [companyStatus, setCompanyStatus] = useState<string>('ACTIVE');
    const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);

    const [toolMode, setToolMode] = useState<'view' | 'add_cto' | 'add_pop' | 'add_pole' | 'add_customer' | 'draw_cable' | 'connect_cable' | 'move_node' | 'pick_connection_target' | 'otdr' | 'edit_cable' | 'ruler' | 'position_reserve' | 'export_area'>('view');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'info' | 'error' } | null>(null);

    // Pole Modal State
    const [isPoleModalOpen, setIsPoleModalOpen] = useState(false);
    const [isKmlImportOpen, setIsKmlImportOpen] = useState(false);
    const [isAdvancedImportOpen, setIsAdvancedImportOpen] = useState(false);

    const [pendingPoleLocation, setPendingPoleLocation] = useState<Coordinates | null>(null);
    const [pendingConnectionCableId, setPendingConnectionCableId] = useState<string | null>(null);
    const [showLabels, setShowLabels] = useState(() => {
        const saved = localStorage.getItem('ftth_show_labels');
        return saved === 'true'; // Default to false if not present or 'false'
    });

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [targetCTOId, setTargetCTOId] = useState<string | null>(null); // NEW: For deep links
    const [autoDownloadCTO, setAutoDownloadCTO] = useState(false); // NEW: For auto-export
    const [editingCTO, setEditingCTO] = useState<CTOData | null>(null);
    const [editingPOP, setEditingPOP] = useState<POPData | null>(null);
    const [editingCable, setEditingCable] = useState<CableData | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null); // For dropdowns

    // Search State
    // searchTerm handled by SearchBox component to avoid re-renders
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [mapForceUpdateKey, setMapForceUpdateKey] = useState<string>('');

    // State for highlighting cable on map when hovering in editor
    const [multiConnectionIds, setMultiConnectionIds] = useState<Set<string>>(new Set());
    const [highlightedCableId, setHighlightedCableId] = useState<string | null>(null);

    // New Cable Creation State (Multipoint)
    const [drawingPath, setDrawingPath] = useState<Coordinates[]>([]);
    const [drawingFromId, setDrawingFromId] = useState<string | null>(null);

    const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);

    // --- Global VFL State ---
    const [vflSource, setVflSource] = useState<string | null>(null);
    const [showFusionModule, setShowFusionModule] = useState(false); // FUSION MODULE STATE

    // --- OTDR State ---
    const [otdrResult, setOtdrResult] = useState<Coordinates | null>(null);

    // --- Ruler State ---
    const [rulerPoints, setRulerPoints] = useState<Coordinates[]>([]);

    // --- Technical Reserve State ---
    const [pendingReserveCableId, setPendingReserveCableId] = useState<string | null>(null);

    // --- Pinned Location State ---
    const [pinnedLocation, setPinnedLocation] = useState<(Coordinates & { viability?: { active: boolean, distance: number } }) | null>(null);

    // --- KMZ Import Preview State ---
    const [previewImportData, setPreviewImportData] = useState<{
        cables: any[];
        ctos: any[];
        ceos: any[];
        poles: any[];
    } | null>(null);
    const [globalCustomers, setGlobalCustomers] = useState<Customer[]>([]);

    // --- Sidebar & Responsive State ---
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('ftth_sidebar_collapsed') === 'true');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [dashboardView, setDashboardView] = useState<any>(() => {
        // Se começou a sessão de suporte agora, forçamos 'projects'
        if (!!localStorage.getItem('ftth_support_token')) {
            return 'projects';
        }
        const saved = localStorage.getItem('dashboard_active_view');
        return saved || 'projects';
    });

    useEffect(() => {
        localStorage.setItem('ftth_sidebar_collapsed', isSidebarCollapsed.toString());
    }, [isSidebarCollapsed]);

    useEffect(() => {
        // Salva somente se NAO for suporte, ou se a view mudou para nao admin_users.
        if (!isSupportMode || dashboardView !== 'admin_users') {
            localStorage.setItem('dashboard_active_view', dashboardView);
        }
    }, [dashboardView, isSupportMode]);

    useEffect(() => user ? localStorage.setItem(STORAGE_KEY_USER, user) : localStorage.removeItem(STORAGE_KEY_USER), [user]);
    // localStorage token persistence removed - handled by cookies

    // Load Projects and Hydrate Session on Auth/Mount
    useEffect(() => {
        const hydrate = async () => {
            // If we don't have a user hint, but haven't hydrated, we still try getMe 
            // because there might be a cookie.
            if (!isHydrated) {
                setIsLoadingProjects(true);
            }

            try {
                const data = await authService.getMe();
                if (data && data.user) {
                    setUser(data.user.username);
                    setToken("session"); // Compatibility placeholder for cookies
                    
                    if (data.user.role) {
                        setUserRole(data.user.role);
                    }
                    if (data.user.permissions) {
                        setUserPermissions(data.user.permissions);
                    }

                    // Populate other user fields
                    const plan = data.user.company?.plan;
                    if (plan?.name) setUserPlan(plan.name);
                    if (plan?.id) setUserPlanId(plan.id);
                    if (plan?.price !== undefined) setUserPlanPrice(plan.price);
                    if (plan?.type) setUserPlanType(plan.type);
                    if (plan?.backupEnabled !== undefined) {
                        setUserBackupEnabled(!!plan.backupEnabled);
                    } else {
                        setUserBackupEnabled(false);
                    }
                    
                    if (data.user.company?.subscriptionExpiresAt) setSubscriptionExpiresAt(data.user.company.subscriptionExpiresAt);
                    else if (data.user.company?.subscription?.currentPeriodEnd) setSubscriptionExpiresAt(data.user.company.subscription.currentPeriodEnd);
                    
                    setCancelAtPeriodEnd(!!data.user.company?.subscription?.cancelAtPeriodEnd);
                    if (data.user.company?.id) setCompanyId(data.user.company.id);
                    if (data.user.email) setUserEmail(data.user.email);
                    if (data.user.company?.name) setCompanyName(data.user.company.name);
                    setCompanyLogo(data.user.company?.logoUrl || null);
                    setCompanyStatus(data.user.company?.status || 'ACTIVE');
                    setHasActiveSubscription(!!data.user.company?.mercadopagoSubscriptionId);

                    // Now load projects
                    const prjs = await projectService.getProjects();
                    setProjects(prjs);
                } else if (user) {
                    // Fail-safe: if getMe returns no user but we have hit in localStorage, clear it
                    setUser(null);
                    setToken(null);
                    setUserBackupEnabled(false);
                }
            } catch (err: any) {
                // Only log if it's NOT a 401 (which is normal for unauthenticated users)
                if (err?.response?.status !== 401) {
                    console.error("Session hydration failed", err);
                }
                
                setUserBackupEnabled(false);
                if (err.response && err.response.status === 401) {
                    setUser(null);
                    setToken(null);
                    setProjects([]);
                }
            } finally {
                setIsHydrated(true);
                setIsLoadingProjects(false);
            }
        };

        hydrate();
    }, [isHydrated]); // Only trigger on mount (or if explicitly reset)

    // Load Project Details when ID changes
    useEffect(() => {
        if (currentProject) {
            setProjects(prev => prev.map(p => p.id === currentProject.id ? currentProject : p));
        }
    }, [currentProject]);

    useEffect(() => {
        if (currentProjectId && token && (currentProjectId !== prevProjectIdRef.current || !currentProject)) {
            projectService.getProject(currentProjectId).then(p => {
                setCurrentProject(p);
                if (p.settings) setSystemSettings(p.settings);
            }).catch(err => {
                console.error(err);
                if (err.response && err.response.status === 403) {
                    const isExpired = subscriptionExpiresAt && new Date() > new Date(subscriptionExpiresAt);
                    const isTrial = userPlanType === 'TRIAL' || userPlan.toLowerCase().includes('teste') || userPlan.toLowerCase().includes('trial');
                    
                    if (isExpired) {
                        setUpgradeModalTitle(isTrial ? t('trial_expired_error') : t('subscription_expired_error'));
                        setUpgradeModalDetails(isTrial ? t('trial_expired_desc') : t('subscription_expired_desc'));
                        setRenewOnly(!isTrial && userPlanPrice > 0);
                    } else {
                        setUpgradeModalTitle(t('limit_reached'));
                        setUpgradeModalDetails(err.response.data?.error || t('error_permission_denied'));
                        setRenewOnly(false);
                    }

                    setShowUpgradeModal(true);
                    setCurrentProjectId(null); // Return to dashboard
                } else {
                    showToast(t('error_project_load') || 'Failed to load project', 'info');
                }
            });
        }
    }, [currentProjectId, token]);

    // Handle targeting CTO after project loads
    useEffect(() => {
        if (currentProject && targetCTOId) {
            const foundCTO = currentProject.network.ctos.find(c => c.id === targetCTOId);
            if (foundCTO) {
                setEditingCTO(foundCTO);
                setTargetCTOId(null);
            }
        }
    }, [currentProject, targetCTOId]);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Ref to hold latest project for event handlers to avoid dependency cycles
    const projectRef = useRef<Project | null>(null);
    useEffect(() => { projectRef.current = currentProject; }, [currentProject]);

    useEffect(() => {
        localStorage.setItem('ftth_show_labels', showLabels.toString());
    }, [showLabels]);

    // Reset map bounds when project changes
    useEffect(() => {
        if (currentProjectId !== prevProjectIdRef.current) {
            setMapBounds(null);
            prevProjectIdRef.current = currentProjectId || '';
            isInitialLoad.current = true;

            // --- Reset UI State on Project Switch/Entry ---
            setEditingCTO(null);
            setEditingPOP(null);
            setEditingCable(null);
            setSelectedId(null);
            setHighlightedCableId(null);
            setToolMode('view');
            setIsAdvancedImportOpen(false);
            setIsKmlImportOpen(false);
            setIsPoleModalOpen(false);
            setShowSettingsModal(false);
            setOtdrResult(null);
            setRulerPoints([]);
        }
    }, [currentProjectId]);

    const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleEndSupport = async () => {
        try {
            await saasService.endSupportSession();
        } catch (error) {
            console.error('Failed to end support session remotely', error);
        } finally {
            localStorage.removeItem('ftth_support_token');
            localStorage.removeItem('ftth_current_project_id');
            // We keep USER and TOKEN (cookie) to stay logged in as admin
            setCurrentProjectId(null);
            setProjects([]);
            setIsSupportMode(false);
            window.location.href = '/';
        }
    };

    const getCurrentNetwork = useCallback((): NetworkState => {
        const p = projectRef.current;
        return p ? { ctos: p.network.ctos, pops: p.network.pops || [], cables: p.network.cables, poles: p.network.poles || [], fusionTypes: p.network.fusionTypes || [] } : { ctos: [], pops: [], cables: [], poles: [], fusionTypes: [] };
    }, []);

    const totalFusionsCount = useMemo(() => {
        if (!currentProject) return 0;
        const net = currentProject.network;
        const ctoFusions = net.ctos.reduce((acc, c) => acc + (c.fusions?.length || 0), 0);
        const popFusions = (net.pops || []).reduce((acc, p) => acc + (p.fusions?.length || 0), 0);
        return ctoFusions + popFusions;
    }, [currentProject]); // Re-calc when project changes

    const updateCurrentNetwork = useCallback((updater: (prev: NetworkState) => NetworkState) => {
        setCurrentProject(prev => {
            if (!prev) return null;
            const newNetwork = updater(prev.network);
            return { ...prev, network: newNetwork, updatedAt: Date.now() };
        });

        // DEBOUNCE SYNC - Cleared here, triggered by useEffect on currentProject
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    }, []);

    const [isSaving, setIsSaving] = useState(false);

    // Actually, let's use a specific Effect for Syncing changes to backend
    const isInitialLoad = useRef(true);
    const syncErrorCount = useRef(0);
    useEffect(() => {
        if (!currentProject || !token) return;
        if (isInitialLoad.current) { isInitialLoad.current = false; return; }

        if (skipNextAutoSyncRef.current) {
            console.log("[Sync] Skipping auto-sync because a manual fast-update was just performed.");
            skipNextAutoSyncRef.current = false;
            setIsSaving(false);
            return;
        }

        setIsSaving(true);
        syncTimeoutRef.current = setTimeout(() => {
            syncTimeoutRef.current = null;
            projectService.syncProject(currentProject.id, currentProject.network, currentProject.mapState, systemSettings)
                .then(() => {
                    console.log(`[Sync] Project ${currentProject.name} saved.`);
                    setIsSaving(false);
                    syncErrorCount.current = 0; // Reset error count on success
                })
                .catch(e => {
                    console.error("Sync failed", e);
                    setIsSaving(false);
                    syncErrorCount.current++;

                    // Upgrade Modal for Limits (403) - ALWAYS show if blocked
                    if (e.response && e.response.status === 403) {
                        const errorMsg = e.response.data?.error || e.response.data?.details || 'Limite atingido ou acesso negado';
                        console.log('Sync 403:', errorMsg);

                        // If backend says it's a permission issue, show toast and return
                        if (e.response.data?.error === 'Permissão insuficiente') {
                            showToast(t('error_permission_denied'), 'error');
                            return;
                        }

                        const isExpired = subscriptionExpiresAt && new Date() > new Date(subscriptionExpiresAt);
                        const isTrial = userPlanType === 'TRIAL' || userPlan.toLowerCase().includes('teste') || userPlan.toLowerCase().includes('trial');

                        if (isExpired) {
                            setUpgradeModalTitle(isTrial ? t('trial_expired_error') : t('subscription_expired_error'));
                            setUpgradeModalDetails(isTrial ? t('trial_expired_desc') : t('subscription_expired_desc'));
                            setRenewOnly(!isTrial && userPlanPrice > 0);
                        } else {
                            setUpgradeModalTitle(t('limit_reached'));
                            setUpgradeModalDetails(errorMsg);
                            setRenewOnly(false);
                        }

                        setShowUpgradeModal(true);
                        return; // Exit early
                    }

                    // Only show generic toasts on first few errors
                    if (syncErrorCount.current <= 5) {
                        const detail = e.response?.data?.details || e.message;
                        showToast(`Erro ao sincronizar: ${detail}`, 'info');

                        if (!e.response || e.response.status === 500) {
                            console.error('SYNC CRITICAL FAILURE:', e.response?.data);
                        }
                    }
                });
        }, 800); // Reduced delay for faster saving (was 1000)
        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
        };
    }, [currentProject, token]);

    // PROTECT AGAINST DATA LOSS (Refreshes/Closes while Saving)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isSaving) {
                e.preventDefault();
                e.returnValue = ''; // Standard for Chrome/Firefox to show warning
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSaving]);

    // Helper to trigger snap and notify
    const performAutoSnap = (overrideDistance?: number) => {
        if (!currentProjectId) return;
        const distance = overrideDistance ?? systemSettings.snapDistance;
        let count = 0;
        updateCurrentNetwork(prev => {
            const result = autoSnapNetwork(prev, distance);
            count = result.snappedCount;
            return result.state;
        });
        if (count > 0) {
            showToast(t('toast_auto_snap_success', { count, distance }), 'success');
        }
    };

    const handleToggleReserveCable = useCallback((id: string) => {
        updateCurrentNetwork(prev => ({
            ...prev,
            cables: prev.cables.map(c => c.id === id ? { ...c, showReserveLabel: !c.showReserveLabel } : c)
        }));
    }, [updateCurrentNetwork]);

    const handlePositionReserveCable = useCallback((id: string) => {
        const cable = getCurrentNetwork().cables.find(c => c.id === id);
        if (!cable || (cable.technicalReserve || 0) <= 0) {
            showToast(t('technical_reserve') + " <= 0", 'info');
            return;
        }
        setPendingReserveCableId(id);
        setToolMode('position_reserve');
        showToast(t('tooltip_position_reserve'), 'info');
    }, [getCurrentNetwork, t]);

    const handleReservePositionSet = useCallback((lat: number, lng: number) => {
        if (!pendingReserveCableId) return;
        updateCurrentNetwork(prev => ({
            ...prev,
            cables: prev.cables.map(c => c.id === pendingReserveCableId ? { ...c, reserveLocation: { lat, lng }, showReserveLabel: true } : c)
        }));
        setToolMode('view');
        setPendingReserveCableId(null);
        showToast(t('toast_reserve_positioned'), 'success');
    }, [pendingReserveCableId, updateCurrentNetwork, t]);

    const { handleImportPoles, handleAdvancedImport } = useNetworkImport({
        currentProjectId,
        getCurrentNetwork,
        setCurrentProject,
        setIsLoadingProjects,
        showToast,
        syncTimeoutRef,
        setUpgradeModalDetails,
        setShowUpgradeModal
    });

    const { traceOpticalPath } = useOpticalTrace({
        getCurrentNetwork,
        setOtdrResult,
        setMapBounds,
        setEditingCTO,
        setEditingPOP,
        setEditingCable,
        showToast
    });

    const {
        handleAddPoint, handleMoveNode, handleDeleteCTO, handleDeletePOP, handleDeletePole,
        handleSaveCTO, handleSavePOP, handleSelectPole, handleRenameCTO, handleUpdateCTOStatus,
        handleRenamePOP, handleUpdatePOPStatus, finalizeCableCreation, handleConnectCable,
        handleUpdateCableGeometry, handleDisconnectCableFromBox, handleDeleteCable,
        handleSaveCable, handleUpdateCable
    } = useNetworkOperations({
        currentProject, updateCurrentNetwork, getCurrentNetwork, showToast, setIsSaving,
        setCurrentProject, setEditingCTO, setEditingPOP, setEditingCable, setSelectedId,
        setToolMode, setDrawingPath, setDrawingFromId, setIsPoleModalOpen,
        setPendingPoleLocation, pendingPoleLocation, setMultiConnectionIds,
        setHighlightedCableId, syncTimeoutRef, skipNextAutoSyncRef,
        systemSettings, migrateNodeData
    });

    const handleMapMoveEnd = (lat: number, lng: number, zoom: number) => {
        if (currentProjectId) {
            localStorage.setItem(`ftth_last_pos_${currentProjectId}`, JSON.stringify({ center: { lat, lng }, zoom }));
        }
    };

    // Map Persistence State Loading
    const savedMapState = useMemo(() => {
        if (!currentProjectId) return null;
        try {
            return JSON.parse(localStorage.getItem(`ftth_last_pos_${currentProjectId}`) || 'null');
        } catch { return null; }
    }, [currentProjectId]);

    // Search Logic - Optimized
    const searchResults = useMemo(() => {
        const term = debouncedSearchTerm.trim();
        if (term.length < 2) return [];

        const coordMatch = term.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
        const pinResult = coordMatch ? [{
            id: 'pin-location',
            name: `${t('coordinates')}: ${coordMatch[1]}, ${coordMatch[3]}`,
            type: 'PIN' as const,
            coordinates: { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[3]) }
        }] : [];

        const lowerTerm = term.toLowerCase();
        const net = getCurrentNetwork();

        const matchedCtos = net.ctos
            .filter(c => c.name.toLowerCase().includes(lowerTerm))
            .map(c => ({ ...c, type: 'CTO' as const }));

        const matchedPops = (net.pops || [])
            .filter(p => p.name.toLowerCase().includes(lowerTerm))
            .map(p => ({ ...p, type: 'POP' as const }));

        return [...pinResult, ...matchedPops, ...matchedCtos].slice(0, 10);
    }, [debouncedSearchTerm, projects, currentProjectId, t]);

    const handleSearchResultClick = useCallback((item: { id: string, coordinates: Coordinates, type: 'CTO' | 'POP' | 'PIN' }) => {
        setSelectedId(item.id);
        setToolMode('view');
        const offset = 0.0015;
        setMapBounds([
            [item.coordinates.lat - offset, item.coordinates.lng - offset],
            [item.coordinates.lat + offset, item.coordinates.lng + offset]
        ]);
    }, []);

    const litNetwork = useMemo(() => {
        if (!currentProject) return { litPorts: new Set<string>(), litCables: new Set<string>(), litConnections: new Set<string>() };
        const network = currentProject.network;
        const litPorts = new Set<string>();
        const litCables = new Set<string>();
        const litConnections = new Set<string>();

        if (!vflSource) return { litPorts, litCables, litConnections };

        const queue = [vflSource];
        litPorts.add(vflSource);

        if (vflSource.includes('-fiber-')) {
            const cableId = vflSource.split('-fiber-')[0];
            litCables.add(cableId);
        }

        const allNodes = [...network.ctos, ...network.pops];

        while (queue.length > 0) {
            const curr = queue.shift()!;
            for (const node of allNodes) {
                const attachedConns = node.connections.filter(c => c.sourceId === curr || c.targetId === curr);
                attachedConns.forEach(conn => {
                    if (!litConnections.has(conn.id)) {
                        litConnections.add(conn.id);
                        const neighbor = conn.sourceId === curr ? conn.targetId : conn.sourceId;
                        if (!litPorts.has(neighbor)) {
                            litPorts.add(neighbor);
                            queue.push(neighbor);
                            if (neighbor.includes('-fiber-')) {
                                const cid = neighbor.split('-fiber-')[0];
                                litCables.add(cid);
                            }
                        }
                    }
                });

                if ('splitters' in node) {
                    const splitter = (node as CTOData).splitters.find(s => s.inputPortId === curr || s.outputPortIds.includes(curr));
                    if (splitter) {
                        if (curr === splitter.inputPortId) {
                            splitter.outputPortIds.forEach(out => {
                                if (!litPorts.has(out)) { litPorts.add(out); queue.push(out); }
                            });
                        } else {
                            if (!litPorts.has(splitter.inputPortId)) { litPorts.add(splitter.inputPortId); queue.push(splitter.inputPortId); }
                        }
                    }
                }

                const fusion = node.fusions.find(f => f.id + '-a' === curr || f.id + '-b' === curr);
                if (fusion) {
                    const otherSide = curr.endsWith('-a') ? `${fusion.id}-b` : `${fusion.id}-a`;
                    if (!litPorts.has(otherSide)) { litPorts.add(otherSide); queue.push(otherSide); }
                }
            }
        }
        return { litPorts, litCables, litConnections };
    }, [vflSource, currentProject]);

    // OMNI-RE-RENDER PROTECTION: Memoized props for CTOEditor to prevent jitter/tremor
    const editingCTOIncomingCables = useMemo(() => {
        if (!editingCTO || !currentProject) return [];
        const net = currentProject.network;
        const currentCTOState = net.ctos.find(c => c.id === editingCTO.id) || editingCTO;
        return net.cables.filter(c =>
            c.fromNodeId === editingCTO.id ||
            c.toNodeId === editingCTO.id ||
            currentCTOState.inputCableIds?.includes(c.id)
        );
    }, [editingCTO, currentProject]);

    const editingCTONetwork = useMemo(() => currentProject?.network || { ctos: [], pops: [], cables: [], poles: [], fusionTypes: [] }, [currentProject]);

    const handleCTOHoverCable = useCallback((id: string | null) => {
        setHighlightedCableId(id);
    }, []);

    const handleCTOClose = useCallback(() => {
        setEditingCTO(null);
        setHighlightedCableId(null);
    }, []);

    const handleCTOToggleVfl = useCallback((portId: string) => {
        setVflSource(prev => prev === portId ? null : portId);
    }, []);

    const handleCTOShowUpgrade = useCallback(() => {
        setUpgradeModalDetails(t('upgrade_exclusive_msg'));
        setShowUpgradeModal(true);
    }, [t]);

    const editingPOPIncomingCables = useMemo(() => {
        if (!editingPOP || !currentProject) return [];
        const net = currentProject.network;
        return net.cables.filter(c => c.fromNodeId === editingPOP.id || c.toNodeId === editingPOP.id);
    }, [editingPOP, currentProject]);

    const handlePOPHoverCable = useCallback((id: string | null) => {
        setHighlightedCableId(id);
    }, []);

    const handlePOPClose = useCallback(() => {
        setEditingPOP(null);
        setHighlightedCableId(null);
    }, []);

    const handlePOPToggleVfl = useCallback((portId: string) => {
        setVflSource(prev => prev === portId ? null : portId);
    }, []);


    const handleImportKMZ = async (file: File) => {
        try {
            let kmlText = '';
            if (file.name.toLowerCase().endsWith('.kmz')) {
                const zip = new JSZip();
                const loadedZip = await zip.loadAsync(file);
                const kmlFile = Object.values(loadedZip.files).find((f: any) => f.name.toLowerCase().endsWith('.kml'));
                if (kmlFile) {
                    kmlText = await (kmlFile as any).async('string');
                } else {
                    throw new Error("No KML found in KMZ");
                }
            } else {
                kmlText = await file.text();
            }

            const parser = new DOMParser();
            const kml = parser.parseFromString(kmlText, 'text/xml');
            const geoJSON = toGeoJSON.kml(kml);

            const newCTOs: CTOData[] = [];
            const newCables: CableData[] = [];
            let ctoCount = 0;
            let cableCount = 0;

            geoJSON.features.forEach((feature: any) => {
                if (!feature.geometry) return;

                if (feature.geometry.type === 'Point') {
                    if (!Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 2) return;
                    const valLng = Number(feature.geometry.coordinates[0]);
                    const valLat = Number(feature.geometry.coordinates[1]);
                    if (isNaN(valLng) || isNaN(valLat)) return;

                    newCTOs.push({
                        id: `cto-imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: feature.properties.name || `CTO ${ctoCount + 1}`,
                        status: 'PLANNED',
                        coordinates: { lat: valLat, lng: valLng },
                        splitters: [], fusions: [], connections: [], inputCableIds: [], clientCount: 0
                    });
                    ctoCount++;
                } else if (feature.geometry.type === 'LineString') {
                    if (!Array.isArray(feature.geometry.coordinates)) return;

                    const coords = feature.geometry.coordinates
                        .map((c: any) => {
                            if (!Array.isArray(c) || c.length < 2) return null;
                            const lat = Number(c[1]);
                            const lng = Number(c[0]);
                            if (isNaN(lat) || isNaN(lng)) return null;
                            return { lat, lng };
                        })
                        .filter((c: any) => c !== null);

                    if (coords.length < 2) return; // Ignore single-point lines or empty lines

                    newCables.push({
                        id: `cable-imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: feature.properties.name || `Cable ${cableCount + 1}`,
                        status: 'NOT_DEPLOYED',
                        fiberCount: 6,
                        fromNodeId: null,
                        toNodeId: null,
                        coordinates: coords
                    });
                    cableCount++;
                }
            });

            if (ctoCount === 0 && cableCount === 0) {
                showToast(t('import_no_geo'), 'info');
                return;
            }

            // WRAPPED WITH AUTO SNAP AND DUPLICATE PREVENTION
            updateCurrentNetwork(prev => {
                // Prevent Duplicates: Check if items with same name/coordinates already exist
                const validNewCTOs = newCTOs.filter(n =>
                    !prev.ctos.some(e => e.name === n.name && Math.abs(e.coordinates.lat - n.coordinates.lat) < 0.00001 && Math.abs(e.coordinates.lng - n.coordinates.lng) < 0.00001)
                );

                const validNewCables = newCables.filter(n =>
                    !prev.cables.some(e =>
                        // Match by name or geometry (approx)
                        (e.name === n.name) ||
                        (e.coordinates.length === n.coordinates.length &&
                            Math.abs(e.coordinates[0].lat - n.coordinates[0].lat) < 0.00001 &&
                            Math.abs(e.coordinates[0].lng - n.coordinates[0].lng) < 0.00001)
                    )
                );

                if (validNewCTOs.length !== newCTOs.length || validNewCables.length !== newCables.length) {
                    showToast(t('import_duplicates_skipped', { count: (newCTOs.length - validNewCTOs.length) + (newCables.length - validNewCables.length) }), 'info');
                }

                if (validNewCTOs.length === 0 && validNewCables.length === 0) {
                    return prev;
                }

                return autoSnapNetwork({
                    ...prev,
                    ctos: [...prev.ctos, ...validNewCTOs],
                    cables: [...prev.cables, ...validNewCables]
                }, systemSettings.snapDistance).state;
            });

            if (newCTOs.length > 0) {
                const bounds = L.latLngBounds(newCTOs.map(c => [c.coordinates.lat, c.coordinates.lng]));
                setMapBounds(bounds);
            } else if (newCables.length > 0) {
                const allPoints = newCables.flatMap(c => c.coordinates.map(p => [p.lat, p.lng] as [number, number]));
                if (allPoints.length > 0) {
                    setMapBounds(L.latLngBounds(allPoints));
                }
            }

            showToast(t('toast_imported', { ctos: ctoCount, cables: cableCount }));
            setShowProjectManager(false);
        } catch (error) {
            console.error(error);
            showToast(t('import_error'), 'info');
        }
    };



    const handleSelectNextNode = useCallback((cableId: string) => {
        const net = getCurrentNetwork();
        const cable = net.cables.find(c => c.id === cableId);
        if (!cable || !editingCTO) return;

        let targetId: string | undefined;

        if (cable.fromNodeId === editingCTO.id) targetId = cable.toNodeId;
        else if (cable.toNodeId === editingCTO.id) targetId = cable.fromNodeId;

        if (!targetId) {
            showToast(t('error_cable_endpoint_missing'), 'info');
            return;
        }

        const targetCTO = net.ctos.find(c => c.id === targetId);
        const targetPOP = net.pops.find(p => p.id === targetId);

        if (targetCTO) {
            setEditingCTO(targetCTO);
        } else if (targetPOP) {
            setEditingCTO(null);
            setEditingPOP(targetPOP);
        } else {
            showToast(t('error_target_not_found'), 'error');
        }

    }, [getCurrentNetwork, t, editingCTO]);

    const handleNodeClick = useCallback((id: string, type: 'CTO' | 'POP' | 'Pole') => {
        if (toolMode === 'view') {
            // Direct Open Editor - Do NOT select (avoids opening DetailsPanel)
            const net = getCurrentNetwork();
            if (type === 'CTO') {
                const cto = net.ctos.find(c => c.id === id);
                if (cto) {
                    setEditingCTO(cto);
                    setSelectedId(null); // Clear selection so DetailsPanel doesn't show
                }
            } else if (type === 'POP') {
                const pop = net.pops.find(p => p.id === id);
                if (pop) {
                    setEditingPOP(pop);
                    setSelectedId(null);
                }
            }
        } else if (toolMode === 'move_node') {
            setSelectedId(id);
        }
    }, [toolMode, getCurrentNetwork]);

    const handleEditNode = useCallback((id: string, type: 'CTO' | 'POP' | 'Pole') => {
        const net = getCurrentNetwork();
        if (type === 'CTO') {
            const cto = net.ctos.find(c => c.id === id);
            if (cto) {
                setEditingCTO(cto);
                setSelectedId(null);
            }
        } else if (type === 'POP') {
            const pop = net.pops.find(p => p.id === id);
            if (pop) {
                setEditingPOP(pop);
                setSelectedId(null);
            }
        }
    }, [getCurrentNetwork]);

    const handleDeleteNode = useCallback((id: string, type: 'CTO' | 'POP' | 'Pole') => {
        if (type === 'CTO') handleDeleteCTO(id);
        else if (type === 'POP') handleDeletePOP(id);
        else if (type === 'Pole') handleDeletePole(id); // Fixed: Handle Pole deletion
    }, []); // Dependencies like handleDeleteCTO are closures, assuming stable enough or re-created with safe deps

    const handleMoveNodeStart = useCallback((id: string) => {
        setToolMode('move_node');
        setSelectedId(id);
        showToast(t('toast_mode_move_node'), 'info');
    }, [t]);

    const handlePropertiesNode = useCallback((id: string, type: 'CTO' | 'POP' | 'Pole') => {
        if (toolMode === 'view') {
            setSelectedId(id);
            // Ensure full editor is closed so that Details Panel (Properties) shows up
            setEditingCTO(null);
            setEditingPOP(null);
        }
    }, [toolMode]);

    const handleNodeForCable = useCallback((nodeId: string) => {
        const net = getCurrentNetwork(); // stable getter
        const node = net.ctos.find(c => c.id === nodeId) || net.pops.find(p => p.id === nodeId);
        if (!node) return;

        // Use functional state for drawingPath and drawingFromId to avoid dependency?
        // Actually here we need current values.
        // We will rely on getCurrentNetwork() stability (it uses Ref).
        // But `drawingPath` state:
        setDrawingPath(prev => {
            if (prev.length === 0) {
                setDrawingFromId(nodeId);
                return [node.coordinates];
            } else {
                // If checking current drawingFromId, we need to access it.
                // To avoid dependency, we can't fully inline this Logic unless we put drawingFromId in Ref or read it inside Set (not possible to read other state inside set).
                // So we must depend on drawingFromId.
                return prev;
            }
        });

        // This function is tricky to fully memoize without deps because it conditionally calls finalize.
        // Let's defer "Finish" logic to effect? No.
        // Simple approach: Depend on drawingFromId. It changes only during cable draw.
        // When drawingFromId changes, this handlers recreates.
        // But markers only re-render if THIS handler changes.
        // If drawingFromId is null (view mode), handler is stable.
        // If we start drawing, handler updates.
        // Markers re-render? Yes.
        // Can we avoid?
        // Use Ref for drawingFromId.
    }, [getCurrentNetwork]);
    // Wait, I didn't implement Ref for `drawingFromId`.

    // REDOING handleNodeForCable with current state access:
    const drawingFromIdRef = useRef<string | null>(null);
    useEffect(() => { drawingFromIdRef.current = drawingFromId; }, [drawingFromId]);
    const drawingPathRef = useRef<Coordinates[]>([]);
    useEffect(() => { drawingPathRef.current = drawingPath; }, [drawingPath]);

    const handleNodeForCableStable = useCallback((nodeId: string) => {
        const net = getCurrentNetwork();
        const node = net.ctos.find(c => c.id === nodeId) || net.pops.find(p => p.id === nodeId) || (net.poles || []).find(p => p.id === nodeId);
        if (!node) return;

        const currentPath = drawingPathRef.current;
        const currentFromId = drawingFromIdRef.current;

        if (currentPath.length === 0) {
            setDrawingPath([node.coordinates]);
            setDrawingFromId(nodeId);
        } else {
            if (currentFromId !== nodeId) {
                const finalPath = [...currentPath, node.coordinates];
                finalizeCableCreation(finalPath, currentFromId, nodeId);
            }
        }
    }, [getCurrentNetwork, finalizeCableCreation]);

    const handleCableClick = useCallback((id: string) => {
        // Left click in view mode: Just select (or do nothing to avoid annoying popups)
        if (toolMode === 'view' || toolMode === 'edit_cable') {
            setSelectedId(id);
        }
    }, [toolMode]);

    const handleEditCableGeometry = useCallback((id: string) => {
        // Start Edit Mode with Backup
        previousNetworkState.current = JSON.parse(JSON.stringify(getCurrentNetwork()));
        setToolMode('edit_cable');
        setSelectedId(id);
        setHighlightedCableId(id);
    }, [getCurrentNetwork]);

    const handleEditCable = useCallback((id: string) => {
        if (toolMode === 'view') {
            setEditingCable(getCurrentNetwork().cables.find(c => c.id === id) || null);
            // Also clear any previous selection
            setSelectedId(null);
        }
    }, [toolMode, getCurrentNetwork]);

    const handleUndoDrawingPoint = useCallback(() => {
        if (toolMode === 'position_reserve') {
            setToolMode('view');
            setPendingReserveCableId(null);
            showToast(t('connection_cancelled') || "Ação Cancelada", 'info');
            return;
        }
        setDrawingPath(prev => {
            if (prev.length <= 1) {
                setDrawingFromId(null);
                return [];
            }
            return prev.slice(0, -1);
        });
    }, [toolMode, t]);

    const handleInitConnection = useCallback((id: string) => {
        setToolMode('connect_cable');
        // Start with this cable selected for connection
        setMultiConnectionIds(new Set([id]));
        showToast(t('toast_select_next_cable'));
    }, [t]);


    // --- LOGIN LOGIC ---



    const handleLogout = async () => {
        try {
            await authService.logout();
        } catch (e) {
            console.error("Logout error:", e);
        } finally {
            setUser(null);
            setToken(null);
            setCurrentProjectId(null);
            setCurrentProject(null);
            setProjects([]);
            localStorage.removeItem('ftth_support_token');
            localStorage.removeItem('ftth_token');
            // Force return to landing or login
            setAuthView('landing');
        }
    };

    const handleLogin = async (email: string, password?: string) => {
        setIsLoggingIn(true);
        setLoginError(null);
        try {
            const data = await authService.login(email, password);
            if (data.token) {
                localStorage.setItem('ftth_token', data.token);
            }
            setIsLoadingProjects(true); // START LOADING IMMEDIATELY to prevent "No Projects" flash
            setUser(data.user.username);
            setToken("session"); // Compatibility placeholder
            
            // Trigger hydration to fill all fields and load projects
            setIsHydrated(false); 
        } catch (e: any) {
            console.error("Login error:", e);
            if (e.response && e.response.status === 401) {
                setLoginError("Email ou senha incorretos.");
            } else {
                setLoginError("Erro ao conectar ao servidor. Tente novamente.");
            }
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleRegister = async (username: string, email: string, password?: string, companyName?: string, planName?: string, phone?: string, source?: string) => {
        setIsRegistering(true);
        try {
            // Re-using the logic from authService if we had a separate register, 
            // but authService.login already has a silent register.
            // However, we want to be explicit here.
            const res = await api.post('/auth/register', {
                username,
                email,
                password: password || "123456",
                companyName,
                planName,
                phone,
                source: source || 'direct'
            });
            const regData = res.data;
            if (regData.token) {
                localStorage.setItem('ftth_token', regData.token);
            }
            showToast(t('registration_success'), 'success');
            setAuthView('login');
        } catch (e: any) {
            setIsRegistering(false);
            throw e;
        } finally {
            setIsRegistering(false);
        }
    };

    const handleAddFusionType = (name: string, attenuation: number) => {
        const newType: FusionType = { id: `ft-${Date.now()}`, name, attenuation };
        updateCurrentNetwork(prev => ({
            ...prev,
            fusionTypes: [...(prev.fusionTypes || []), newType]
        }));
        showToast(t('toast_fusion_type_added') || 'Tipo de fusão adicionado');
    };

    const handleDeleteFusionType = (id: string) => {
        updateCurrentNetwork(prev => ({
            ...prev,
            fusionTypes: (prev.fusionTypes || []).filter(ft => ft.id !== id)
        }));
        showToast(t('toast_fusion_type_deleted') || 'Tipo de fusão removido');
    };

    const handleCancelMode = useCallback(() => {
        if (toolMode === 'view') return;

        // Cleanup logic for each complex mode
        if (toolMode === 'ruler') {
            setRulerPoints([]);
        } else if (toolMode === 'draw_cable') {
            setDrawingPath([]);
            setDrawingFromId(null);
        } else if (toolMode === 'edit_cable' || toolMode === 'connect_cable') {
            if (previousNetworkState.current) {
                const backup = previousNetworkState.current;
                updateCurrentNetwork(() => backup);
                previousNetworkState.current = null;
                setEditingCTO(null);
                setEditingPOP(null);
            }
            setMultiConnectionIds(new Set());
            setHighlightedCableId(null);
        } else if (toolMode === 'move_node') {
            // Cancel move
            const net = getCurrentNetwork();
            setCurrentProject(prev => prev ? { ...prev, network: net } : null);
        } else if (toolMode === 'position_reserve') {
            setPendingReserveCableId(null);
        } else if (toolMode === 'export_area') {
            setExportAreaPolygon([]);
        }

        setToolMode('view');
        setSelectedId(null);
        showToast(t('action_cancelled') || "Ação Cancelada", 'info');
    }, [toolMode, t]);

    const handleExportKMZ = useCallback((options: ExportKMZOptions) => {
        if (!currentProject) return;

        // Construct object specifically for the worker
        const projectData = {
            projectName: currentProject.name,
            nodes: currentProject.network.ctos,
            cables: currentProject.network.cables,
            pops: currentProject.network.pops,
            poles: currentProject.network.poles,
            customers: globalCustomers,
            polygon: exportAreaPolygon.length >= 3 ? exportAreaPolygon : undefined
        };

        exportToKMZ(projectData, options, showToast);
        setIsExportKMZModalOpen(false);
        setExportAreaPolygon([]);
        if (toolMode === 'export_area') setToolMode('view');
    }, [currentProject, globalCustomers, exportToKMZ, showToast, exportAreaPolygon, toolMode]);

    if (!user) {
        if (authView === 'landing') {
            return <LandingPage
                onLoginClick={() => setAuthView('login')}
                onRegisterClick={(planName) => {
                    setAuthView('register');
                    setSelectedRegisterPlan(planName || null);
                }}
                saasConfig={saasConfig}
            />;
        }
        if (authView === 'register') {
            return (
                <RegisterPage
                    onRegister={handleRegister}
                    onBackToLogin={() => setAuthView('login')}
                    onBackToLanding={() => setAuthView('landing')} // Assuming you'll add this prop
                    initialPlan={selectedRegisterPlan}
                    isLoading={isRegistering}
                />
            );
        }
        if (authView === 'reset-password') {
            return (
                <ResetPasswordPage
                    onBackToLogin={() => {
                        window.history.pushState({}, '', '/');
                        setAuthView('login');
                    }}
                    logoUrl={saasConfig?.appLogoUrl}
                />
            );
        }
        return (
            <LoginPage
                onLogin={handleLogin}
                onRegisterClick={() => setAuthView('register')}
                error={loginError}
                isLoading={isLoggingIn}
                onBackToLanding={() => setAuthView('landing')} // Assuming you'll add this prop
                logoUrl={saasConfig?.appLogoUrl}
            />
        );
    }

    if (userRole === 'SUPER_ADMIN') {
        return <SaasAdminPage onLogout={handleLogout} />;
    }



    const handleConvertPinToNode = (type: 'CTO' | 'Pole' | 'Customer') => {
        if (!pinnedLocation || !currentProject) return;

        const newId = crypto.randomUUID();
        // Use translation for default names if possible, else fallback

        if (type === 'CTO') {
            const newCTO: CTOData = {
                id: newId,
                name: `CTO ${getCurrentNetwork().ctos.length + 1}`,
                status: 'PLANNED',
                type: 'CTO',
                coordinates: pinnedLocation,
                splitters: [], fusions: [], connections: [], inputCableIds: [], clientCount: 0
            };
            updateCurrentNetwork(prev => ({ ...prev, ctos: [...prev.ctos, newCTO] }));
            showToast(t('toast_cto_added') || "CTO Adicionada", 'success');
        } else if (type === 'Pole') {
            const newPole: PoleData = {
                id: newId,
                name: `Poste ${getCurrentNetwork().poles.length + 1}`,
                status: 'PLANNED',
                coordinates: pinnedLocation,
                type: 'Poste Padrão'
            };
            updateCurrentNetwork(prev => ({ ...prev, poles: [...(prev.poles || []), newPole] }));
            showToast(t('toast_pole_added') || "Poste Adicionado", 'success');
        } else if (type === 'Customer') {
            // Don't clear pin - MapView will handle opening CustomerModal at this location
            return;
        }
        setPinnedLocation(null);
    };

    const network = getCurrentNetwork();
    const deployedCTOs = network.ctos.filter(c => c.status === 'DEPLOYED').length;
    const deployedCables = network.cables.filter(c => c.status === 'DEPLOYED').length;
    const totalPOPs = network.pops?.length || 0;

    const totalItems = network.ctos.length + totalPOPs + network.cables.length;
    const deployedItems = deployedCTOs + totalPOPs + deployedCables;

    const deploymentProgress = totalItems > 0 ? Math.round((deployedItems / totalItems) * 100) : 0;

    const handleMainSearch = (term: string) => {
        if (!term || term.trim() === '') {
            setPinnedLocation(null);
            setDebouncedSearchTerm('');
            return;
        }

        // Smart Search: Check for coordinates (Lat, Lng)
        // Supports: "-23.123, -46.123" or "-23.123 -46.123"
        const coordMatch = term.trim().match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);

        if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[3]);

            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                // Determine valid coordinate range
                if (currentProject) {
                    // Update project center state (transient) for consistency
                    setCurrentProject(prev => prev ? {
                        ...prev,
                        mapState: {
                            ...prev.mapState,
                            center: { lat, lng },
                            zoom: 18
                        }
                    } : null);

                    // Move map smoothly using bounds instead of forcing a view reset
                    const offset = 0.002;
                    setMapBounds([
                        [lat - offset, lng - offset],
                        [lat + offset, lng + offset]
                    ]);


                    // Viability Check
                    let minDistance = Infinity;
                    const net = getCurrentNetwork();
                    net.ctos.forEach(cto => {
                        const d = calculateDistance({ lat, lng }, cto.coordinates);
                        if (d < minDistance) minDistance = d;
                    });
                    // Optional: Check POPs too if they count for viability
                    if (net.pops) {
                        net.pops.forEach(pop => {
                            const d = calculateDistance({ lat, lng }, pop.coordinates);
                            if (d < minDistance) minDistance = d;
                        });
                    }

                    const isViable = minDistance <= 200;

                    setPinnedLocation({
                        lat,
                        lng,
                        viability: { active: isViable, distance: minDistance }
                    });
                    showToast(t('searching_location') || "Localizando...", "info");
                    // Allow search term debounce to update so dropdown shows the result
                }
            }
        }

        setDebouncedSearchTerm(term);
    };

    return (

        <div className="flex h-screen w-screen bg-slate-50 dark:bg-[#151820] overflow-hidden text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
            <Helmet>
                <title>{saasConfig?.appName || t('app_title')}</title>
                <link rel="icon" href={saasConfig?.faviconUrl || saasConfig?.appLogoUrl || "/logo.png"} type="image/png" />
            </Helmet>

            <ConnectionStatus />
            
            {toast && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[999999] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
                    toast.type === 'success' ? 'bg-emerald-600 text-white' :
                    toast.type === 'error' ? 'bg-red-600 text-white' :
                    'bg-sky-600 text-white'
                }`}>
                    {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    {toast.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {toast.type === 'info' && <Zap className="w-4 h-4 shrink-0" />}
                    {toast.msg}
                    <button onClick={() => setToast(null)} className="ml-2 p-0.5 rounded hover:bg-white/20 transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {isSupportMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[99999] bg-orange-600 text-white px-5 py-2.5 rounded-full flex items-center justify-center gap-4 shadow-2xl font-bold text-sm border-2 border-orange-400 animate-in fade-in slide-in-from-top-4">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                    <span>MODO DE SUPORTE ATIVO</span>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleEndSupport}
                        className="rounded-full text-xs"
                    >
                        Encerrar Suporte
                    </Button>
                </div>
            )}

            {/* Subscription Expired Banner */}
            {(() => {
                if (!subscriptionExpiresAt || !user) return null;
                const isFree = userPlan === 'Plano Grátis';
                if (isFree) return null;
                const isExpired = new Date() > new Date(subscriptionExpiresAt);
                if (!isExpired && companyStatus !== 'SUSPENDED') return null;
                return (
                    <div className="fixed top-0 left-0 right-0 z-[99998] bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-lg">
                        <div className="flex items-center justify-center gap-4 px-4 py-3">
                            <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
                            <span className="text-sm font-semibold">
                                {userPlanType?.toUpperCase() === 'TRIAL'
                                    ? t('trial_expired_desc')
                                    : t('subscription_expired_desc')}
                            </span>
                            <button
                                onClick={() => {
                                    setRenewOnly(true);
                                    setShowUpgradeModal(true);
                                }}
                                className="shrink-0 px-4 py-1.5 bg-white text-rose-700 font-bold text-sm rounded-lg hover:bg-rose-50 transition-all hover:scale-105 active:scale-95 shadow"
                            >
                                {t('renew_now') || 'Renovar Agora'}
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Mobile TopBar */}
            <header className="lg:hidden absolute top-0 left-0 right-0 h-14 bg-white/80 dark:bg-[#151820]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/30 z-[40] flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <img src={saasConfig?.appLogoUrl || "/logo.png"} alt="Logo" className="w-7 h-7" />
                    <span className="font-bold text-sm tracking-tight">{saasConfig?.appName || t('app_title')}</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileMenuOpen(true)}
                >
                    <MapIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </Button>
            </header>

            <Sidebar
                viewMode={currentProjectId ? 'project' : 'dashboard'}
                user={user}
                userRole={userRole}
                userPermissions={userPermissions}
                userPlan={userPlan}
                userBackupEnabled={userBackupEnabled}
                userPlanType={userPlanType}
                subscriptionExpiresAt={subscriptionExpiresAt}
                cancelAtPeriodEnd={cancelAtPeriodEnd}
                projects={projects}
                currentProjectId={currentProjectId}
                deploymentProgress={deploymentProgress}
                vflSource={vflSource}
                setVflSource={setVflSource}
                searchResults={searchResults}
                onSearch={handleMainSearch}
                onResultClick={handleSearchResultClick}
                onLogout={handleLogout}
                onUpgradeClick={() => setIsAccountSettingsOpen(true)}
                setCurrentProjectId={setCurrentProjectId}
                setShowProjectManager={setShowProjectManager}
                onImportClick={() => setIsAdvancedImportOpen(true)}
                onExportClick={() => setIsExportKMZModalOpen(true)}
                onExportAreaClick={() => setToolMode('export_area')}
                isExporting={isExporting}
                onReportClick={() => setIsReportModalOpen(true)}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                isMobileOpen={isMobileMenuOpen}
                onCloseMobile={() => setIsMobileMenuOpen(false)}
                currentDashboardView={dashboardView}
                onDashboardViewChange={setDashboardView}
                isHydrated={isHydrated}
                companyLogo={companyLogo}
                companyName={companyName}
                saasName={saasConfig?.appName}
                saasLogo={saasConfig?.appLogoUrl}
            />

            {!currentProjectId ? (
                <main className="flex-1 relative overflow-hidden">
                    <DashboardPage
                        username={user!}
                        userRole={userRole || 'MEMBER'}
                        userPermissions={userPermissions}
                        userPlan={userPlan}
                        userPlanType={userPlanType}
                        userBackupEnabled={userBackupEnabled}
                        subscriptionExpiresAt={subscriptionExpiresAt}
                        cancelAtPeriodEnd={cancelAtPeriodEnd}
                        projects={projects}
                        currentView={dashboardView}
                        onViewChange={setDashboardView}
                        showToast={showToast}
                        onJumpToCoords={(lat, lng) => {
                            const offset = 0.001;
                            setMapBounds([[lat - offset, lng - offset], [lat + offset, lng + offset]]);
                        }}
                        onOpenProject={(id) => {
                            const isExpired = subscriptionExpiresAt && new Date() > new Date(subscriptionExpiresAt);
                            if (companyStatus === 'SUSPENDED' || isExpired) {
                                const isTrial = userPlanType === 'TRIAL' || userPlan?.toLowerCase().includes('teste') || userPlan?.toLowerCase().includes('trial');
                                if (isTrial || !userPlanPrice || userPlanPrice === 0) {
                                    setUpgradeModalTitle(t('trial_expired_error'));
                                    setUpgradeModalDetails(t('trial_expired_desc'));
                                    setRenewOnly(false);
                                } else {
                                    setUpgradeModalTitle(t('subscription_expired_error'));
                                    setUpgradeModalDetails(t('subscription_expired_desc'));
                                    setRenewOnly(true);
                                }
                                setShowUpgradeModal(true);
                                return;
                            }
                            setCurrentProjectId(id);
                            setShowProjectManager(false);
                        }}
                        onCreateProject={async (name, center) => {
                            const isExpired = subscriptionExpiresAt && new Date() > new Date(subscriptionExpiresAt);
                            if (companyStatus === 'SUSPENDED' || isExpired) {
                                const isTrial = userPlanType === 'TRIAL' || userPlan?.toLowerCase().includes('teste') || userPlan?.toLowerCase().includes('trial');
                                if (isTrial || !userPlanPrice || userPlanPrice === 0) {
                                    setUpgradeModalTitle(t('trial_expired_error'));
                                    setUpgradeModalDetails(t('trial_expired_desc'));
                                    setRenewOnly(false);
                                } else {
                                    setUpgradeModalTitle(t('subscription_expired_error'));
                                    setUpgradeModalDetails(t('subscription_expired_desc'));
                                    setRenewOnly(true);
                                }
                                setShowUpgradeModal(true);
                                return;
                            }
                            if (!token) return;
                            try {
                                const newProject = await projectService.createProject(name, center || { lat: -23.5505, lng: -46.6333 });
                                setProjects(prev => [newProject, ...prev]);
                                setCurrentProjectId(newProject.id);
                                showToast(t('toast_project_created'), 'success');
                            } catch (e: any) {
                                if (e.response && e.response.status === 403) {
                                    setUpgradeModalDetails(e.response.data?.details || "Você atingiu o limite de projetos do seu plano.");
                                    setShowUpgradeModal(true);
                                } else {
                                    showToast(t('error_project_create'), 'info');
                                }
                            }
                        }}
                        onDeleteProject={async (id) => {
                            try {
                                await projectService.deleteProject(id);
                                setProjects(prev => prev.filter(p => p.id !== id));
                                showToast(t('toast_project_deleted'));
                            } catch (e) {
                                showToast(t('error_project_delete'), 'info');
                            }
                        }}
                        onUpdateProject={async (id, name, center) => {
                            try {
                                const updated = await projectService.updateProject(id, name, center);
                                setProjects(prev => prev.map(p => p.id === id ? { ...p, name: updated.name, mapState: updated.mapState, updatedAt: updated.updatedAt } : p));
                                showToast(t('project_updated'), 'success');
                            } catch (e) {
                                showToast(t('error_project_update'), 'info');
                            }
                        }}
                        isLoading={isLoadingProjects}
                        onLogout={handleLogout}
                        onUpgradeClick={() => setIsAccountSettingsOpen(true)}
                        currentProjectId={currentProjectId || undefined}
                    />
                </main>
            ) : currentProjectId && !currentProject ? (
                <main className="flex-1 relative flex flex-col items-center justify-center bg-slate-100 dark:bg-[#151820] text-slate-900 dark:text-white gap-4 transition-colors">
                    <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                    <div className="text-xl font-bold tracking-tight">{t('processing')}</div>
                </main>
            ) : (
                <main className="flex-1 relative bg-slate-100 dark:bg-[#1a1d23]">
                    {/* Map Toolbar (Floating Center) */}
                    <div className={`absolute ${isSupportMode ? 'top-20 lg:top-20' : 'top-20 lg:top-4'} left-1/2 -translate-x-1/2 z-[1000] pointer-events-none`}>
                        <div className="pointer-events-auto w-fit">
                            <MapToolbar
                                toolMode={toolMode}
                                setToolMode={setToolMode}
                                activeMenuId={activeMenuId}
                                setActiveMenuId={setActiveMenuId}
                                onImportKml={() => setIsKmlImportOpen(true)}
                                onConnectClick={() => {
                                    previousNetworkState.current = JSON.parse(JSON.stringify(getCurrentNetwork()));
                                    setToolMode('connect_cable');
                                    setSelectedId(null);
                                }}
                                userRole={userRole}
                                userPermissions={userPermissions}
                            />
                        </div>
                    </div>

                    {/* Move Mode Floating Controls */}
                    {toolMode === 'move_node' && (
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-white dark:bg-[#22262e] p-2 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-2 flex items-center gap-2">
                                <Move className="w-4 h-4 text-sky-500" />
                                {t('moving_node')}
                            </div>
                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
                            <Button
                                variant="emerald"
                                onClick={() => {
                                    setToolMode('view');
                                    setSelectedId(null);
                                    showToast(t('position_saved'), 'success');
                                }}
                                className="flex items-center gap-2"
                                size="sm"
                            >
                                <Check className="w-4 h-4" />
                                {t('save_position')}
                            </Button>
                        </div>
                    )}

                    <MapView
                        ctos={currentProject?.network.ctos || []}
                        pops={currentProject?.network.pops || []}
                        poles={currentProject?.network.poles || []}
                        cables={currentProject?.network.cables || []}
                        mode={toolMode}
                        userRole={userRole}
                        userPermissions={userPermissions}
                        selectedId={selectedId}
                        mapBounds={mapBounds}
                        showLabels={showLabels}
                        litCableIds={litNetwork.litCables}
                        highlightedCableId={highlightedCableId}
                        drawingPath={drawingPath}
                        snapDistance={systemSettings.snapDistance}
                        viewKey={mapForceUpdateKey ? `force-${mapForceUpdateKey}` : (currentProjectId || undefined)}
                        projectId={currentProjectId || undefined}
                        initialCenter={savedMapState?.center || currentProject?.mapState?.center}
                        initialZoom={savedMapState?.zoom || currentProject?.mapState?.zoom}
                        onMapMoveEnd={handleMapMoveEnd}
                        onToggleLabels={() => setShowLabels(!showLabels)}
                        onAddPoint={(lat, lng) => handleAddPoint(lat, lng, toolMode)}
                        onUndoDrawingPoint={handleUndoDrawingPoint}
                        onNodeClick={handleNodeClick}
                        onMoveNode={handleMoveNode}
                        onEditNode={handleEditNode}
                        onDeleteNode={handleDeleteNode}
                        onMoveNodeStart={handleMoveNodeStart}
                        onPropertiesNode={handlePropertiesNode}
                        onCableStart={handleNodeForCableStable}
                        onCableEnd={handleNodeForCableStable}
                        onConnectCable={handleConnectCable}
                        onUpdateCableGeometry={handleUpdateCableGeometry}
                        multiConnectionIds={multiConnectionIds}
                        previewImportData={previewImportData}
                        onCableClick={handleCableClick}
                        onEditCableGeometry={handleEditCableGeometry}
                        onEditCable={handleEditCable}
                        onDeleteCable={handleDeleteCable}
                        onInitConnection={handleInitConnection}
                        otdrResult={otdrResult}
                        pinnedLocation={pinnedLocation}
                        allCustomers={globalCustomers}
                        onConvertPin={handleConvertPinToNode}
                        onClearPin={() => setPinnedLocation(null)}
                        rulerPoints={rulerPoints}
                        onRulerPointsChange={setRulerPoints}
                        onToggleReserveCable={handleToggleReserveCable}
                        onPositionReserveCable={handlePositionReserveCable}
                        onReservePositionSet={handleReservePositionSet}
                        showToast={showToast}
                        onCustomerSaved={(customer?: Customer) => {
                            setToolMode('view');
                            if (customer) {
                                setGlobalCustomers(prev => {
                                    const exists = prev.some(c => c.id === customer.id);
                                    if (exists) {
                                        return prev.map(c => c.id === customer.id ? customer : c);
                                    } else {
                                        return [customer, ...prev];
                                    }
                                });
                            }
                        }}
                        onCancelMode={handleCancelMode}
                        exportAreaPolygon={exportAreaPolygon}
                        onExportAreaPolygonChange={setExportAreaPolygon}
                        onExportAreaConfirm={() => {
                            if (exportAreaPolygon.length >= 3) {
                                setIsExportKMZModalOpen(true);
                            }
                        }}
                    />

                    {toolMode === 'edit_cable' && (
                        <CableEditToolbar
                            toolMode="edit_cable"
                            onSave={() => {
                                setToolMode('view');
                                setHighlightedCableId(null);
                                setSelectedId(null);
                                previousNetworkState.current = null;
                                showToast(t('changes_saved'), 'success');
                            }}
                            onCancel={() => {
                                if (previousNetworkState.current) {
                                    const backup = previousNetworkState.current;
                                    updateCurrentNetwork(() => backup);
                                    previousNetworkState.current = null;
                                    setEditingCTO(null);
                                    setEditingPOP(null);
                                }
                                setToolMode('view');
                                setMultiConnectionIds(new Set());
                                setSelectedId(null);
                                setHighlightedCableId(null);
                                showToast(t('connection_cancelled') || "Conexão Cancelada", 'info');
                            }}
                        />
                    )}

                    {toolMode === 'connect_cable' && (
                        <CableEditToolbar
                            toolMode="connect_cable"
                            onSave={() => {
                                setToolMode('view');
                                setMultiConnectionIds(new Set());
                                setSelectedId(null);
                                previousNetworkState.current = null;
                                showToast(t('finish'), 'success');
                            }}
                            onCancel={() => {
                                if (previousNetworkState.current) {
                                    const backup = previousNetworkState.current;
                                    updateCurrentNetwork(() => backup);
                                    previousNetworkState.current = null;
                                    setEditingCTO(null);
                                    setEditingPOP(null);
                                }
                                setToolMode('view');
                                setMultiConnectionIds(new Set());
                                setSelectedId(null);
                                setHighlightedCableId(null);
                                showToast(t('connection_cancelled') || "Conexão Cancelada", 'info');
                            }}
                        />
                    )}

                    <MapModeTooltip toolMode={toolMode} drawingPath={drawingPath} />

                    <RulerToolbar
                        rulerPoints={rulerPoints}
                        onClear={() => setRulerPoints([])}
                        onFinish={() => {
                            setToolMode('view');
                            setRulerPoints([]);
                        }}
                    />

                    {toolMode === 'draw_cable' && drawingPath.length > 0 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2000] flex gap-3">
                            <Button
                                variant="emerald"
                                onClick={() => finalizeCableCreation(drawingPath, drawingFromId)}
                                className="rounded-full px-6 py-6 shadow-2xl font-bold flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                {t('finish_cable')}
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => { setDrawingPath([]); setDrawingFromId(null); }}
                                className="bg-white/90 dark:bg-[#22262e]/90 backdrop-blur rounded-full px-6 py-6 shadow-2xl font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700"
                            >
                                <X className="w-5 h-5" />
                                {t('cancel')}
                            </Button>
                        </div>
                    )}
                </main>
            )}

            {/* Editors */}
            {editingPOP && (
                <POPEditor
                    pop={editingPOP}
                    incomingCables={editingPOPIncomingCables}
                    litPorts={litNetwork.litPorts}
                    vflSource={vflSource}
                    onToggleVfl={handlePOPToggleVfl}
                    onClose={handlePOPClose}
                    onSave={handleSavePOP}
                    onHoverCable={handlePOPHoverCable}
                    userRole={userRole}
                    onEditCable={setEditingCable}
                    onOtdrTrace={(portId, dist) => traceOpticalPath(editingPOP.id, portId, dist)}
                />
            )}
            {editingCTO && (
                <CTOEditor
                    key={editingCTO.id}
                    cto={editingCTO}
                    projectName={currentProject?.name || ''}
                    incomingCables={editingCTOIncomingCables}
                    litPorts={litNetwork.litPorts}
                    vflSource={vflSource}
                    onToggleVfl={handleCTOToggleVfl}
                    onClose={handleCTOClose}
                    onSave={handleSaveCTO}
                    onEditCable={setEditingCable}
                    onHoverCable={handleCTOHoverCable}
                    onDisconnectCable={handleDisconnectCableFromBox}
                    onSelectNextNode={handleSelectNextNode}
                    onOtdrTrace={(portId, dist) => traceOpticalPath(editingCTO.id, portId, dist)}
                    userRole={userRole}
                    userPermissions={userPermissions}
                    userPlan={userPlan}
                    subscriptionExpiresAt={subscriptionExpiresAt}
                    onShowUpgrade={handleCTOShowUpgrade}
                    network={editingCTONetwork}
                    projectId={currentProjectId || undefined}
                    companyLogo={companyLogo}
                    saasLogo={saasConfig?.appLogoUrl}
                    autoDownload={autoDownloadCTO}
                    onUpdateCableStreetNames={(updates) => {
                        updateCurrentNetwork(prev => ({
                            ...prev,
                            cables: prev.cables.map(c => {
                                const street = updates.get(c.id);
                                return street ? { ...c, streetName: street } : c;
                            })
                        }));
                    }}
                />
            )}

            {/* Modals */}
            <KmlImportModal
                isOpen={isKmlImportOpen}
                onClose={() => setIsKmlImportOpen(false)}
                onImport={handleImportPoles}
            />

            <AdvancedImportModal
                isOpen={isAdvancedImportOpen}
                onClose={() => {
                    setIsAdvancedImportOpen(false);
                    setPreviewImportData(null);
                }}
                onPreview={(data) => setPreviewImportData(data)}
                onImport={async (data) => {
                    await handleAdvancedImport(data);
                    setIsAdvancedImportOpen(false);
                    setPreviewImportData(null);
                }}
            />

            {/* Details Panels */}
            {selectedId && !editingCTO && toolMode === 'view' && getCurrentNetwork().ctos.find(c => c.id === selectedId) && (
                <CTODetailsPanel
                    cto={getCurrentNetwork().ctos.find(c => c.id === selectedId)!}
                    poles={getCurrentNetwork().poles || []}
                    onRename={handleRenameCTO}
                    onUpdateStatus={handleUpdateCTOStatus}
                    onUpdate={(updates) => {
                        updateCurrentNetwork(prev => ({
                            ...prev,
                            ctos: prev.ctos.map(c => c.id === selectedId ? { ...c, ...updates } : c)
                        }));
                        showToast(t('toast_applied_success'));
                    }}
                    onOpenSplicing={() => { setEditingCTO(getCurrentNetwork().ctos.find(c => c.id === selectedId)!); setSelectedId(null); }}
                    onDelete={handleDeleteCTO}
                    onClose={() => setSelectedId(null)}
                />
            )}

            {selectedId && !editingPOP && toolMode === 'view' && getCurrentNetwork().pops?.find(p => p.id === selectedId) && (
                <POPDetailsPanel
                    pop={getCurrentNetwork().pops?.find(p => p.id === selectedId)!}
                    poles={getCurrentNetwork().poles || []}
                    onRename={handleRenamePOP}
                    onUpdateStatus={handleUpdatePOPStatus}
                    onUpdate={(id, updates) => {
                        updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.map(p => p.id === id ? { ...p, ...updates } : p) }));
                        showToast(t('toast_applied_success'));
                    }}
                    onOpenRack={() => { setEditingPOP(getCurrentNetwork().pops?.find(p => p.id === selectedId)!); setSelectedId(null); }}
                    onDelete={handleDeletePOP}
                    onClose={() => setSelectedId(null)}
                />
            )}

            {selectedId && toolMode === 'view' && getCurrentNetwork().poles?.find(p => p.id === selectedId) && (
                <PoleDetailsPanel
                    pole={getCurrentNetwork().poles?.find(p => p.id === selectedId)!}
                    cables={getCurrentNetwork().cables}
                    onRename={(id, newName) => updateCurrentNetwork(prev => ({ ...prev, poles: prev.poles.map(p => p.id === id ? { ...p, name: newName } : p) }))}
                    onUpdateStatus={(id, status) => updateCurrentNetwork(prev => ({ ...prev, poles: prev.poles.map(p => p.id === id ? { ...p, status } : p) }))}
                    onUpdate={(id, updates) => {
                        updateCurrentNetwork(prev => ({ ...prev, poles: prev.poles.map(p => p.id === id ? { ...p, ...updates } : p) }));
                        showToast(t('toast_applied_success'));
                    }}
                    onDelete={(id) => {
                        updateCurrentNetwork(prev => ({ ...prev, poles: prev.poles.filter(p => p.id !== id) }));
                        setSelectedId(null);
                        showToast('Poste removido', 'success');
                    }}
                    onClose={() => setSelectedId(null)}
                />
            )}

            {editingCable && (
                <CableEditor
                    cable={editingCable}
                    onClose={() => { setEditingCable(null); setHighlightedCableId(null); }}
                    onSave={handleSaveCable}
                    onDelete={handleDeleteCable}
                    userRole={userRole}
                />
            )}

            {showProjectManager && (
                <ProjectManager
                    projects={projects}
                    currentProjectId={currentProjectId!}
                    onSelectProject={(id) => {
                        const isExpired = subscriptionExpiresAt && new Date() > new Date(subscriptionExpiresAt);
                        if (companyStatus === 'SUSPENDED' || isExpired) {
                            const isTrial = userPlanType === 'TRIAL' || userPlan?.toLowerCase().includes('teste') || userPlan?.toLowerCase().includes('trial');
                            if (isTrial || !userPlanPrice || userPlanPrice === 0) {
                                setUpgradeModalTitle(t('trial_expired_error'));
                                setUpgradeModalDetails(t('trial_expired_desc'));
                                setRenewOnly(false);
                            } else {
                                setUpgradeModalTitle(t('subscription_expired_error'));
                                setUpgradeModalDetails(t('subscription_expired_desc'));
                                setRenewOnly(true);
                            }
                            setShowUpgradeModal(true);
                            return;
                        }
                        setCurrentProjectId(id);
                        setShowProjectManager(false);
                    }}
                    onDeleteProject={async (id) => {
                        try {
                            await projectService.deleteProject(id);
                            setProjects(prev => prev.filter(x => x.id !== id));
                            showToast(t('toast_project_deleted'));
                        } catch (e) {
                            showToast(t('error_project_delete') || 'Erro ao deletar projeto', 'info');
                        }
                    }}
                    onImportKMZ={handleImportKMZ}
                    onClose={() => setShowProjectManager(false)}
                />
            )}

            <PoleSelectionModal
                isOpen={isPoleModalOpen}
                onClose={() => setIsPoleModalOpen(false)}
                onSelect={(catalogItem) => {
                    if (pendingPoleLocation) {
                        const newPole: PoleData = {
                            id: `pole-${Date.now()}`,
                            name: catalogItem.name,
                            status: 'PLANNED',
                            coordinates: pendingPoleLocation,
                            catalogId: catalogItem.id,
                            type: catalogItem.type,
                            height: catalogItem.height
                        };
                        updateCurrentNetwork(prev => ({ ...prev, poles: [...(prev.poles || []), newPole] }));
                        showToast(t('toast_pole_added'));
                        setIsPoleModalOpen(false);
                        setPendingPoleLocation(null);
                    }
                }}
            />

            <ExportKMZModal
                isOpen={isExportKMZModalOpen}
                onClose={() => setIsExportKMZModalOpen(false)}
                onExport={handleExportKMZ}
                isExporting={isExporting}
            />

            {showSettingsModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowSettingsModal(false)}>
                    <div
                        className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden transition-colors"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="h-12 bg-slate-50 dark:bg-[#22262e] border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Settings className="w-4 h-4" /> {t('system_settings')}
                            </h3>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setShowSettingsModal(false)}
                            >
                                <X className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-white" />
                            </Button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                                    <Ruler className="w-3 h-3" /> {t('snap_distance_lbl')}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        min="1"
                                        max="200"
                                        value={systemSettings.snapDistance}
                                        onChange={(e) => {
                                            const val = Math.max(1, parseInt(e.target.value) || 1);
                                            setSystemSettings(prev => ({ ...prev, snapDistance: val }));
                                            setSettingsSaved(true);
                                            if (settingsTimeoutRef.current) clearTimeout(settingsTimeoutRef.current);
                                            settingsTimeoutRef.current = setTimeout(() => setSettingsSaved(false), 2000);
                                        }}
                                        className="w-24 bg-slate-100 dark:bg-[#22262e] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                                    />
                                    <span className="text-sm text-slate-500">{t('meters')}</span>
                                    {settingsSaved && (
                                        <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold animate-in fade-in slide-in-from-left-2">
                                            <Check className="w-3 h-3" /> {t('saved')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">{t('snap_distance_help')}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-[#22262e]/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                            <Button
                                variant="emerald"
                                onClick={() => {
                                    performAutoSnap(systemSettings.snapDistance);
                                    setShowSettingsModal(false);
                                }}
                            >
                                {t('done')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <AccountSettingsModal
                isOpen={isAccountSettingsOpen}
                onClose={() => setIsAccountSettingsOpen(false)}
                onManagePlan={() => {
                    setIsAccountSettingsOpen(false);
                    setUpgradeModalDetails(undefined);
                    setShowUpgradeModal(true);
                }}
                userData={{
                    username: user!,
                    email: userEmail || undefined,
                    plan: userPlan,
                    planType: userPlanType,
                    expiresAt: subscriptionExpiresAt,
                    companyId: companyId || 'UNKNOWN'
                }}
            />

            <UpgradePlanModal
                isOpen={showUpgradeModal}
                onClose={() => { setShowUpgradeModal(false); setRenewOnly(false); }}
                limitDetails={upgradeModalDetails}
                limitTitle={upgradeModalTitle}
                companyId={companyId || undefined}
                email={userEmail || undefined}
                currentPlanName={userPlan}
                currentPlanId={userPlanId || undefined}
                currentPlanPrice={userPlanPrice}
                companyStatus={companyStatus}
                renewOnly={renewOnly}
            />

            <ProjectReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                network={currentProject?.network || { ctos: [], pops: [], cables: [], poles: [] }}
                projectName={currentProject?.name || ''}
            />

            {token && <SupportChatBubble />}
        </div>
    );
}
