import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
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
import { SearchBox } from './components/SearchBox';
import { CTOData, POPData, CableData, NetworkState, Project, Coordinates, CTOStatus, SystemSettings } from './types';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import {
    Map as MapIcon, Zap, MousePointer2, Unplug, CheckCircle2, Eye, EyeOff, Server, Box, Move, Ruler, X, Settings, Check, Loader2, Building2,
    UtilityPole, FileUp, ChevronRight, Plus
} from 'lucide-react';
import JSZip from 'jszip';
import toGeoJSON from '@mapbox/togeojson';
import L from 'leaflet';
import * as projectService from './services/projectService';
import * as authService from './services/authService';
import * as catalogService from './services/catalogService';
import api from './services/api';
import { UpgradePlanModal } from './components/UpgradePlanModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';

const STORAGE_KEY_TOKEN = 'ftth_planner_token_v1';
const STORAGE_KEY_USER = 'ftth_planner_user_v1';
import { PoleSelectionModal } from './components/modals/PoleSelectionModal';
import { KmlImportModal } from './components/modals/KmlImportModal';
import { AdvancedImportModal } from './components/modals/AdvancedImportModal';
import { ProjectReportModal } from './components/modals/ProjectReportModal';
import { FusionModule } from './components/FusionModule';

import { PoleData, FusionType } from './types';




// --- GEOMETRY HELPERS MOVED TO utils/geometryUtils.ts ---

const parseJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};

export default function App() {
    const { t, language, setLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();

    const [user, setUser] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_USER));
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_TOKEN));
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            const decoded = parseJwt(token);
            if (decoded?.role) setUserRole(decoded.role);
        } else {
            setUserRole(null);
        }
    }, [token]);

    const [authView, setAuthView] = useState<'landing' | 'login' | 'register' | 'reset-password'>('landing');
    const [selectedRegisterPlan, setSelectedRegisterPlan] = useState<string | undefined>(undefined);

    // Projects List (Summaries)
    const [projects, setProjects] = useState<Project[]>([]);
    // Current Active Project (Full Data)
    const [currentProject, setCurrentProject] = useState<Project | null>(null);


    const [isLoadingProjects, setIsLoadingProjects] = useState(() => !!localStorage.getItem(STORAGE_KEY_TOKEN));

    // Global System Settings
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({ snapDistance: 30 });

    const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => localStorage.getItem('ftth_current_project_id'));

    useEffect(() => {
        if (currentProjectId) {
            localStorage.setItem('ftth_current_project_id', currentProjectId);
        } else {
            localStorage.removeItem('ftth_current_project_id');
        }
        // Safety: Reset tool mode and clear backup when switching projects
        setToolMode('view');
        previousNetworkState.current = null;
    }, [currentProjectId]);
    const prevProjectIdRef = useRef<string>('');

    const [showProjectManager, setShowProjectManager] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);
    const settingsTimeoutRef = useRef<any>(null);
    const syncTimeoutRef = useRef<any>(null); // For debounce sync

    // Backup for Cancel functionality
    const previousNetworkState = useRef<NetworkState | null>(null);

    // Upgrade Modal State

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
    const [upgradeModalDetails, setUpgradeModalDetails] = useState<string | undefined>(undefined);
    const [userPlan, setUserPlan] = useState<string>('Plano Grátis');
    const [userPlanId, setUserPlanId] = useState<string | null>(null); // NEW: Track Plan ID for accurate comparison
    const [userPlanType, setUserPlanType] = useState<string>('STANDARD');
    const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
    const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    // Initial Route Check for Password Reset
    useEffect(() => {
        if (window.location.pathname === '/reset-password') {
            setAuthView('reset-password');
        }
    }, []);

    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [companyStatus, setCompanyStatus] = useState<string>('ACTIVE');
    const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);

    const [toolMode, setToolMode] = useState<'view' | 'add_cto' | 'add_pop' | 'add_pole' | 'draw_cable' | 'connect_cable' | 'move_node' | 'pick_connection_target' | 'otdr' | 'edit_cable' | 'ruler' | 'position_reserve'>('view');
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

    // --- Sidebar & Responsive State ---
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('ftth_sidebar_collapsed') === 'true');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [dashboardView, setDashboardView] = useState<any>(() => {
        const saved = localStorage.getItem('dashboard_active_view');
        return saved || 'projects';
    });

    useEffect(() => {
        localStorage.setItem('ftth_sidebar_collapsed', isSidebarCollapsed.toString());
    }, [isSidebarCollapsed]);

    useEffect(() => {
        localStorage.setItem('dashboard_active_view', dashboardView);
    }, [dashboardView]);

    useEffect(() => user ? localStorage.setItem(STORAGE_KEY_USER, user) : localStorage.removeItem(STORAGE_KEY_USER), [user]);
    useEffect(() => token ? localStorage.setItem(STORAGE_KEY_TOKEN, token) : localStorage.removeItem(STORAGE_KEY_TOKEN), [token]);

    // Load Projects on Auth
    useEffect(() => {
        if (token && user) {
            setIsLoadingProjects(true);
            projectService.getProjects()
                .then(setProjects)
                .catch(console.error)
                .finally(() => setIsLoadingProjects(false));

            // Hydrate User Session (Plan & Subscription)
            authService.getMe().then((data: any) => {
                if (data.user) {
                    // Check if user matches (sanity check)
                    if (data.user.username !== user) {
                        // Token belongs to different user? Update user state.
                        setUser(data.user.username);
                    }

                    if (data.user.company?.plan?.name) {
                        setUserPlan(data.user.company.plan.name);
                    }
                    if (data.user.company?.plan?.id) {
                        setUserPlanId(data.user.company.plan.id);
                    }
                    if (data.user.company?.plan?.type) {
                        setUserPlanType(data.user.company.plan.type);
                    }
                    if (data.user.company?.subscriptionExpiresAt) {
                        setSubscriptionExpiresAt(data.user.company.subscriptionExpiresAt);
                    } else if (data.user.company?.subscription?.currentPeriodEnd) {
                        setSubscriptionExpiresAt(data.user.company.subscription.currentPeriodEnd);
                    } else {
                        setSubscriptionExpiresAt(null);
                    }
                    if (data.user.company?.subscription?.cancelAtPeriodEnd) {
                        setCancelAtPeriodEnd(true);
                    } else {
                        setCancelAtPeriodEnd(false);
                    }
                    if (data.user.company?.id) {
                        setCompanyId(data.user.company.id);
                    }
                    if (data.user.email) {
                        setUserEmail(data.user.email);
                    }
                    if (data.user.company?.status) {
                        setCompanyStatus(data.user.company.status);
                    }
                    if (data.user.company?.mercadopagoSubscriptionId) {
                        setHasActiveSubscription(true);
                    } else {
                        setHasActiveSubscription(false);
                    }
                }
            }).catch(err => {
                console.error("Failed to hydrate session", err);
                if (err.response && err.response.status === 401) {
                    // Token invalid/expired - Logout
                    setToken(null);
                    setUser(null);
                }
            }).finally(() => {
                setIsHydrated(true);
            });
        }
    }, [token, user]);

    // Load Project Details when ID changes
    useEffect(() => {
        if (currentProject) {
            setProjects(prev => prev.map(p => p.id === currentProject.id ? currentProject : p));
        }
    }, [currentProject]);

    useEffect(() => {
        if (currentProjectId && token && currentProjectId !== prevProjectIdRef.current) {
            projectService.getProject(currentProjectId).then(p => {
                setCurrentProject(p);
                if (p.settings) setSystemSettings(p.settings);
            }).catch(err => {
                console.error(err);
                setToast({ msg: 'Failed to load project', type: 'info' });
            });
        } else {
            // Only nullify if we actually switched to a null ID (logout/exit), not on init
            if (!currentProjectId && prevProjectIdRef.current) setCurrentProject(null);
        }
    }, [currentProjectId, token]);

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
        setTimeout(() => setToast(null), 3000);
    };

    // const currentProject = projects.find(p => p.id === currentProjectId); // REMOVED (using state)
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

        // DEBOUNCE SYNC
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
            // Sync happens via Effect watching currentProject
        }, 1000);
    }, []);

    const [isSaving, setIsSaving] = useState(false);

    // Actually, let's use a specific Effect for Syncing changes to backend
    const isInitialLoad = useRef(true);
    const syncErrorCount = useRef(0);
    useEffect(() => {
        if (!currentProject || !token) return;
        if (isInitialLoad.current) { isInitialLoad.current = false; return; }

        setIsSaving(true);
        const timer = setTimeout(() => {
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

                        // If user is MEMBER, it's strictly a permission issue, NOT a plan limit
                        if (userRole === 'MEMBER') {
                            showToast(t('error_permission_denied'), 'error');
                            return;
                        }

                        setUpgradeModalDetails(errorMsg);
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
        }, 1000); // Reduced delay for better safety (was 3000)
        return () => clearTimeout(timer);
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

    // --- TRIGGER AUTO SNAP WHEN SETTINGS CHANGE AUTOMATICALLY ---
    // Using a timeout to debounce slightly if the user is typing fast, but ensuring it runs.
    useEffect(() => {
        /* AUTO-SNAP EFFECT DISABLED
        if (currentProjectId) {
            const timer = setTimeout(() => {
                performAutoSnap(systemSettings.snapDistance);
            }, 1500); // Increased from 500ms to 1500ms for better performance
            return () => clearTimeout(timer);
        }
        */
    }, [systemSettings.snapDistance, currentProjectId]);


    const handleImportPoles = async (points: Array<{ lat: number, lng: number }>, poleTypeId: string) => {
        if (!currentProjectId) return;
        setIsLoadingProjects(true);

        try {
            // Clear auto-sync
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

            const newPoles: PoleData[] = points.map((pt, idx) => ({
                id: crypto.randomUUID(),
                name: `Poste ${idx + 1}`,
                status: 'PLANNED',
                coordinates: pt,
                catalogId: poleTypeId,
            }));

            const updated = { ...getCurrentNetwork() };
            updated.poles = [...(updated.poles || []), ...newPoles];

            await projectService.syncProject(currentProjectId, updated);

            // Update Local
            setCurrentProject(prev => prev ? { ...prev, network: updated, updatedAt: Date.now() } : null);
            showToast(t('toast_poles_imported', { count: newPoles.length }), 'success');
            setIsKmlImportOpen(false); // Close legacy modal

        } catch (err) {
            console.error(err);
            showToast(t('toast_poles_import_error'), 'error');
        } finally {
            setIsLoadingProjects(false);
        }
    };

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

    // ... (litNetwork logic unchanged) ...
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
        return net.cables.filter(c =>
            c.fromNodeId === editingCTO.id ||
            c.toNodeId === editingCTO.id ||
            editingCTO.inputCableIds?.includes(c.id)
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

    // ... (handleImportKMZ logic unchanged) ...
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

    // ... (finalizeCableCreation, map interactions, move node logic unchanged) ...
    const finalizeCableCreation = useCallback((path: Coordinates[], fromId: string | null = null, toId: string | null = null) => {
        if (path.length < 2) return;

        // Use functional update to get latest network inside
        updateCurrentNetwork(prev => {
            const newCable: CableData = {
                id: `cable-${Date.now()}`,
                name: `CBL-${prev.cables.length + 1}`,
                status: 'DEPLOYED',
                fiberCount: 12,
                fromNodeId: fromId,
                toNodeId: toId,
                coordinates: path
            };

            const updatedCTOs = prev.ctos.map(cto => {
                if (cto.id === toId) return { ...cto, inputCableIds: [...(cto.inputCableIds || []), newCable.id] };
                if (cto.id === fromId) return { ...cto, inputCableIds: [...(cto.inputCableIds || []), newCable.id] };
                return cto;
            });
            const updatedPOPs = prev.pops.map(pop => {
                if (pop.id === toId) return { ...pop, inputCableIds: [...(pop.inputCableIds || []), newCable.id] };
                if (pop.id === fromId) return { ...pop, inputCableIds: [...(pop.inputCableIds || []), newCable.id] };
                return pop;
            });

            return {
                ...prev,
                cables: [...prev.cables, newCable],
                ctos: updatedCTOs,
                pops: updatedPOPs,
                poles: prev.poles // Ensure poles are preserved
            };
        });

        showToast(t('toast_cable_created'));
        setDrawingPath([]);
        setDrawingFromId(null);
        setToolMode('view');
    }, [t, updateCurrentNetwork]);

    const handleAddPoint = useCallback((lat: number, lng: number) => {
        if (toolMode === 'add_cto') {
            updateCurrentNetwork(prev => {
                const newCTO: CTOData = {
                    id: `cto-${Date.now()}`,
                    name: `CTO-${prev.ctos.length + 1}`,
                    status: 'PLANNED',
                    coordinates: { lat, lng },
                    splitters: [], fusions: [], connections: [], inputCableIds: [], clientCount: 0
                };
                return { ...prev, ctos: [...prev.ctos, newCTO] };
            });
            showToast(t('toast_cto_added'));
            setToolMode('view');
        } else if (toolMode === 'add_pop') {
            updateCurrentNetwork(prev => {
                const newPOP: POPData = {
                    id: `pop-${Date.now()}`,
                    name: `POP-${(prev.pops?.length || 0) + 1}`,
                    status: 'PLANNED',
                    coordinates: { lat, lng },
                    olts: [], dios: [], fusions: [], connections: [], inputCableIds: []
                };
                return { ...prev, pops: [...(prev.pops || []), newPOP] };
            });
            showToast(t('toast_pop_added'));
            setToolMode('view');

        } else if (toolMode === 'add_pole') {
            setPendingPoleLocation({ lat, lng });
            setIsPoleModalOpen(true);
        } else if (toolMode === 'draw_cable') {
            setDrawingPath(prev => [...prev, { lat, lng }]);
        }
    }, [toolMode, updateCurrentNetwork, t]);

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

    const handleMoveNode = useCallback((id: string, lat: number, lng: number) => {
        updateCurrentNetwork(prev => {
            const oldNode = prev.ctos.find(c => c.id === id) || prev.pops.find(p => p.id === id) || (prev.poles || []).find(p => p.id === id);
            if (!oldNode) return prev;

            const oldLat = oldNode.coordinates.lat;
            const oldLng = oldNode.coordinates.lng;

            let updatedCTOs = prev.ctos;
            let updatedPOPs = prev.pops;
            let updatedPoles = prev.poles || [];

            if (prev.ctos.some(c => c.id === id)) {
                updatedCTOs = prev.ctos.map(c => c.id === id ? { ...c, coordinates: { lat, lng } } : c);
            }
            else if (prev.pops.some(p => p.id === id)) {
                updatedPOPs = prev.pops.map(p => p.id === id ? { ...p, coordinates: { lat, lng } } : p);
            }
            else if (updatedPoles.some(p => p.id === id)) {
                updatedPoles = updatedPoles.map(p => p.id === id ? { ...p, coordinates: { lat, lng } } : p);
                // Also move any CTO/POP linked to this pole
                updatedCTOs = updatedCTOs.map(c => c.poleId === id ? { ...c, coordinates: { lat, lng } } : c);
                updatedPOPs = updatedPOPs.map(p => p.poleId === id ? { ...p, coordinates: { lat, lng } } : p);
            }

            const updatedCables = prev.cables.map(cable => {
                let changed = false;
                const newCoords = cable.coordinates.map(coord => {
                    // Match by location (epsilon check) for intermediate anchors
                    const d = Math.sqrt(Math.pow(coord.lat - oldLat, 2) + Math.pow(coord.lng - oldLng, 2));
                    if (d < 0.00000001) {
                        changed = true;
                        return { lat, lng };
                    }
                    return coord;
                });

                if (cable.fromNodeId === id) {
                    newCoords[0] = { lat, lng };
                    changed = true;
                }
                if (cable.toNodeId === id) {
                    newCoords[newCoords.length - 1] = { lat, lng };
                    changed = true;
                }
                return changed ? { ...cable, coordinates: newCoords } : cable;
            });

            return { ...prev, ctos: updatedCTOs, pops: updatedPOPs, cables: updatedCables, poles: updatedPoles };
        });
    }, [updateCurrentNetwork]);

    const handleSavePOP = async (updatedPOP: POPData) => {
        if (!currentProject) return;

        // 1. Clear any pending automatic sync
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
        }

        // 2. Derive new network
        const newNetwork: NetworkState = {
            ...currentProject.network,
            pops: (currentProject.network.pops || []).map(p => p.id === updatedPOP.id ? updatedPOP : p)
        };

        // 3. Update React State
        setCurrentProject(prev => prev ? { ...prev, network: newNetwork, updatedAt: Date.now() } : null);
        setEditingPOP(null);
        setHighlightedCableId(null);

        // 4. BLOCKING SYNC
        setIsSaving(true);
        try {
            await projectService.syncProject(currentProject.id, newNetwork, currentProject.mapState, systemSettings);
            console.log("[Manual Sync] POP save success");
            showToast(t('toast_pop_saved'));
        } catch (e) {
            console.error("[Manual Sync] POP save failed", e);
            showToast(t('error_saving_changes'), 'error');
            throw e;
        } finally {
            setIsSaving(false);
        }
    };
    const handleRenamePOP = (id: string, name: string) => updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.map(p => p.id === id ? { ...p, name } : p) }));
    const handleUpdatePOPStatus = (status: CTOStatus) => selectedId && updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.map(p => p.id === selectedId ? { ...p, status } : p) }));
    const handleDeletePOP = (id: string) => {
        setSelectedId(null);
        updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.filter(p => p.id !== id) }));
        showToast(t('toast_pop_deleted'));
    };

    const handleConnectCable = useCallback((cableId: string, nodeId: string, pointIndex: number) => {
        // We use updateCurrentNetwork to access latest state via prev
        updateCurrentNetwork(prev => {
            const cable = prev.cables.find(c => c.id === cableId);
            const node = prev.ctos.find(c => c.id === nodeId) || prev.pops.find(p => p.id === nodeId) || (prev.poles || []).find(p => p.id === nodeId);
            if (!cable || !node) return prev;

            // --- CLEANUP: REMOVE CABLE FROM OLD NODE INPUT LISTS ---
            const oldNodeId = pointIndex === 0 ? cable.fromNodeId : cable.toNodeId;
            let updatedCTOs = prev.ctos;
            let updatedPOPs = prev.pops;

            if (oldNodeId && oldNodeId !== nodeId) {
                updatedCTOs = updatedCTOs.map(c => c.id === oldNodeId ? { ...c, inputCableIds: (c.inputCableIds || []).filter(id => id !== cableId) } : c);
                updatedPOPs = updatedPOPs.map(p => p.id === oldNodeId ? { ...p, inputCableIds: (p.inputCableIds || []).filter(id => id !== cableId) } : p);
            }

            // --- VALIDATION: PREVENT DUPLICATE CONNECTION OF SAME CABLE ---
            const isCTO = prev.ctos.some(c => c.id === nodeId);
            if (node && 'inputCableIds' in node && (node.inputCableIds || []).includes(cableId)) {
                showToast(t('error_cto_duplicate_cable'), 'info');
                return prev;
            }

            if (pointIndex === 0 || pointIndex === cable.coordinates.length - 1) {
                const isPole = (prev.poles || []).some(p => p.id === nodeId);
                const newCoords = [...cable.coordinates];
                newCoords[pointIndex] = node.coordinates;
                showToast(t(pointIndex === 0 ? 'toast_cable_connected_start' : 'toast_cable_connected_end', { name: node.name }));

                if (isPole) {
                    return {
                        ...prev,
                        cables: prev.cables.map(c => c.id === cableId ? {
                            ...c,
                            coordinates: newCoords
                            // NOT setting fromNodeId/toNodeId for poles to allow logical link without interrupting continuity
                        } : c),
                        poles: (prev.poles || []).map(p => p.id === nodeId ? {
                            ...p,
                            linkedCableIds: Array.from(new Set([...(p.linkedCableIds || []), cableId]))
                        } : p)
                    };
                }

                return {
                    ...prev,
                    cables: prev.cables.map(c => c.id === cableId ? {
                        ...c,
                        coordinates: newCoords,
                        [pointIndex === 0 ? 'fromNodeId' : 'toNodeId']: node.id
                    } : c),
                    ctos: updatedCTOs.map(c => c.id === nodeId ? { ...c, inputCableIds: (c.inputCableIds || []).includes(cable.id) ? c.inputCableIds : [...(c.inputCableIds || []), cable.id] } : c),
                    pops: updatedPOPs.map(p => p.id === nodeId ? { ...p, inputCableIds: (p.inputCableIds || []).includes(cable.id) ? p.inputCableIds : [...(p.inputCableIds || []), cable.id] } : p)
                };
            }

            // --- POLE ANCHORAGE WITHOUT SPLIT ---
            const isPole = (prev.poles || []).some(p => p.id === nodeId);
            if (isPole) {
                const newCoords = [...cable.coordinates];
                newCoords[pointIndex] = node.coordinates;
                showToast(t('toast_cable_anchored_pole', { name: node.name }));
                return {
                    ...prev,
                    cables: prev.cables.map(c => c.id === cableId ? { ...c, coordinates: newCoords } : c),
                    poles: (prev.poles || []).map(p => p.id === nodeId ? {
                        ...p,
                        linkedCableIds: Array.from(new Set([...(p.linkedCableIds || []), cableId]))
                    } : p)
                };
            }

            const coordSegment1 = cable.coordinates.slice(0, pointIndex + 1);
            const coordSegment2 = cable.coordinates.slice(pointIndex);
            coordSegment1[coordSegment1.length - 1] = node.coordinates;
            coordSegment2[0] = node.coordinates;
            const newCableId = `cable-${Date.now()}-split`;

            const cable1 = { ...cable, coordinates: coordSegment1, toNodeId: node.id, name: `${cable.name} (A)`, looseTubeCount: cable.looseTubeCount };
            const cable2 = { ...cable, id: newCableId, name: `${cable.name.replace(' (A)', '')} (B)`, fromNodeId: node.id, toNodeId: cable.toNodeId, coordinates: coordSegment2, looseTubeCount: cable.looseTubeCount };

            showToast(t('toast_cable_split', { name: node.name }));

            // Multi-connection: Add both parts to the active set to keep them editable
            setMultiConnectionIds(prev => {
                const newSet = new Set(prev);
                newSet.add(cableId); // Original (modified)
                newSet.add(newCableId); // New part
                return newSet;
            });

            return {
                ...prev,
                cables: [...prev.cables.map(c => c.id === cableId ? cable1 : c), cable2],
                ctos: updatedCTOs.map(c => c.id === nodeId ? { ...c, inputCableIds: (c.inputCableIds || []).includes(cableId) ? c.inputCableIds : [...(c.inputCableIds || []), cableId] } : c),
                pops: updatedPOPs.map(p => p.id === nodeId ? { ...p, inputCableIds: (p.inputCableIds || []).includes(cableId) ? p.inputCableIds : [...(p.inputCableIds || []), cableId] } : p)
            };
        });
    }, [updateCurrentNetwork, t]);

    const handleSaveCTO = async (updatedCTO: CTOData) => {
        if (!currentProject) return;

        // 1. Clear any pending automatic sync to avoid conflicts
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
        }

        // 2. Derive the NEW network using the most up-to-date state (currentProject.network)
        // instead of projectRef which might be stale during this async cycle.
        const newNetwork: NetworkState = {
            ...currentProject.network,
            ctos: currentProject.network.ctos.map(c => c.id === updatedCTO.id ? updatedCTO : c)
        };

        // 3. Update React State (UI)
        setCurrentProject(prev => prev ? { ...prev, network: newNetwork, updatedAt: Date.now() } : null);
        setEditingCTO(updatedCTO);

        // 4. BLOCKING SYNC (Wait for confirmation to ensure data integrity)
        setIsSaving(true);
        try {
            // We await here to ensure this critical change is saved before anything else can happen
            await projectService.syncProject(currentProject.id, newNetwork, currentProject.mapState, systemSettings);
            console.log("[Manual Sync] CTO save success");
            showToast(t('toast_cto_splicing_saved'));
        } catch (e) {
            console.error("[Manual Sync] CTO save failed", e);
            showToast(t('error_saving_changes'), 'error');
            throw e; // Rethrow so CTOEditor can potentially keep the modal open or show an alert
        } finally {
            setIsSaving(false);
        }
    };
    const handleRenameCTO = (id: string, name: string) => updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.map(c => c.id === id ? { ...c, name } : c) }));
    const handleUpdateCTOStatus = (status: CTOStatus) => selectedId && updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.map(c => c.id === selectedId ? { ...c, status } : c) }));
    const handleDeleteCTO = (id: string) => {
        setSelectedId(null);
        updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.filter(c => c.id !== id) }));
        showToast(t('toast_cto_deleted'));
    };
    const handleDeletePole = (id: string) => {
        setSelectedId(null);
        updateCurrentNetwork(prev => {
            const updatedPoles = (prev.poles || []).filter(p => p.id !== id);
            const updatedCables = prev.cables.map(cable => {
                if (cable.fromNodeId === id) return { ...cable, fromNodeId: undefined };
                if (cable.toNodeId === id) return { ...cable, toNodeId: undefined };
                return cable;
            });
            const updatedCTOs = prev.ctos.map(c => c.poleId === id ? { ...c, poleId: undefined } : c);
            const updatedPOPs = prev.pops.map(p => p.poleId === id ? { ...p, poleId: undefined } : p);
            return { ...prev, poles: updatedPoles, cables: updatedCables, ctos: updatedCTOs, pops: updatedPOPs };
        });
        showToast(t('toast_pole_deleted'));
    };
    const handleSaveCable = (c: CableData) => { updateCurrentNetwork(prev => ({ ...prev, cables: prev.cables.map(cb => cb.id === c.id ? c : cb) })); setEditingCable(null); setHighlightedCableId(null); };
    const handleUpdateCable = (c: CableData) => updateCurrentNetwork(prev => ({ ...prev, cables: prev.cables.map(cb => cb.id === c.id ? c : cb) }));
    const handleDeleteCable = (id: string) => { setEditingCable(null); updateCurrentNetwork(prev => ({ ...prev, cables: prev.cables.filter(c => c.id !== id) })); showToast(t('toast_cable_deleted')); };

    const handleUpdateCableGeometry = (id: string, coords: Coordinates[]) => {
        updateCurrentNetwork(prev => {
            let cable = prev.cables.find(c => c.id === id);
            if (!cable) return prev;

            let updatedCable = { ...cable, coordinates: coords };
            let updatedCTOs = prev.ctos;
            let updatedPOPs = prev.pops;

            const DISCONNECT_THRESHOLD = 0.000001; // Approx 10cm

            // Check Start Disconnection
            if (updatedCable.fromNodeId) {
                const node = prev.ctos.find(c => c.id === updatedCable.fromNodeId) || prev.pops.find(p => p.id === updatedCable.fromNodeId);
                if (node) {
                    const start = coords[0];
                    const dist = Math.sqrt(Math.pow(start.lat - node.coordinates.lat, 2) + Math.pow(start.lng - node.coordinates.lng, 2));
                    if (dist > DISCONNECT_THRESHOLD) {
                        updatedCable.fromNodeId = undefined;
                        // Remove from Input IDs
                        if (prev.ctos.some(c => c.id === node.id)) {
                            updatedCTOs = updatedCTOs.map(c => c.id === node.id ? { ...c, inputCableIds: c.inputCableIds?.filter(cid => cid !== id) } : c);
                        } else {
                            updatedPOPs = updatedPOPs.map(p => p.id === node.id ? { ...p, inputCableIds: p.inputCableIds?.filter(cid => cid !== id) } : p);
                        }
                        showToast(t('toast_cable_disconnected'));
                    }
                }
            }

            // Check End Disconnection
            if (updatedCable.toNodeId) {
                const node = prev.ctos.find(c => c.id === updatedCable.toNodeId) || prev.pops.find(p => p.id === updatedCable.toNodeId);
                if (node) {
                    const end = coords[coords.length - 1];
                    const dist = Math.sqrt(Math.pow(end.lat - node.coordinates.lat, 2) + Math.pow(end.lng - node.coordinates.lng, 2));
                    if (dist > DISCONNECT_THRESHOLD) {
                        updatedCable.toNodeId = undefined;
                        // Remove from Input IDs
                        if (prev.ctos.some(c => c.id === node.id)) {
                            updatedCTOs = updatedCTOs.map(c => c.id === node.id ? { ...c, inputCableIds: c.inputCableIds?.filter(cid => cid !== id) } : c);
                        } else {
                            updatedPOPs = updatedPOPs.map(p => p.id === node.id ? { ...p, inputCableIds: p.inputCableIds?.filter(cid => cid !== id) } : p);
                        }
                        showToast(t('toast_cable_disconnected'));
                    }
                }
            }

            // --- REMOVE DUPLICATE CONSECUTIVE POINTS ---
            const filteredCoords = updatedCable.coordinates.filter((c, i, arr) => {
                if (i === 0) return true;
                const prevPt = arr[i - 1];
                const d = Math.sqrt(Math.pow(c.lat - prevPt.lat, 2) + Math.pow(c.lng - prevPt.lng, 2));
                return d > 0.0000001; // Filter points closer than ~1cm
            });
            updatedCable.coordinates = filteredCoords;

            // Apply AutoSnap (disabled but kept for consistency) and return
            const tempState = { ...prev, cables: prev.cables.map(c => c.id === id ? updatedCable : c), ctos: updatedCTOs, pops: updatedPOPs };
            return autoSnapNetwork(tempState, systemSettings.snapDistance).state;
        });
    };

    const handleDisconnectCableFromBox = (cableId: string) => {
        if (!editingCTO) return;
        const nodeId = editingCTO.id;
        updateCurrentNetwork(prev => {
            const cable = prev.cables.find(c => c.id === cableId);
            if (!cable) return prev;

            // Disconnect cable from this node specifically
            const newFrom = cable.fromNodeId === nodeId ? undefined : cable.fromNodeId;
            const newTo = cable.toNodeId === nodeId ? undefined : cable.toNodeId;

            // Update CTO input list
            const updatedCTOs = prev.ctos.map(c => c.id === nodeId ? {
                ...c,
                inputCableIds: c.inputCableIds?.filter(cid => cid !== cableId)
            } : c);

            // Update POP input list (just in case, though editingCTO implies CTO)
            const updatedPOPs = prev.pops.map(p => p.id === nodeId ? {
                ...p,
                inputCableIds: p.inputCableIds?.filter(cid => cid !== cableId)
            } : p);

            showToast(t('toast_cable_disconnected') || "Cabo desconectado");

            const newState = {
                ...prev,
                cables: prev.cables.map(c => c.id === cableId ? { ...c, fromNodeId: newFrom, toNodeId: newTo } : c),
                ctos: updatedCTOs,
                pops: updatedPOPs
            };

            // Sync local editing state to reflect removal immediately
            const updatedEditingCTO = updatedCTOs.find(c => c.id === nodeId);
            if (updatedEditingCTO) {
                setEditingCTO(updatedEditingCTO);
            }

            return newState;
        });
    };

    // ... (OTDR Trace Logic Unchanged) ...
    const traceOpticalPath = (startNodeId: string, startPortId: string, targetDistance: number) => {
        // ... (Implementation unchanged from previous version) ...
        // For brevity, using the existing OTDR logic here.
        // Assuming it's the exact same block as before.
        const net = getCurrentNetwork();
        let remainingDist = targetDistance;
        let currentNodeId = startNodeId;
        let currentPortId = startPortId; // Typically "cable-id-fiber-index"

        let loops = 0;

        while (remainingDist > 0 && loops < 50) {
            loops++;

            if (!currentPortId.includes('-fiber-')) {
                showToast(t('otdr_trace_start_error'), "info");
                return;
            }

            const cableId = currentPortId.split('-fiber-')[0];
            const cable = net.cables.find(c => c.id === cableId);

            if (!cable) {
                showToast(t('otdr_cable_not_found'), "info");
                return;
            }

            let path: Coordinates[] = [];
            let nextNodeId: string | null = null;

            if (cable.fromNodeId === currentNodeId) {
                path = [...cable.coordinates];
                nextNodeId = cable.toNodeId || null;
            } else if (cable.toNodeId === currentNodeId) {
                path = [...cable.coordinates].reverse();
                nextNodeId = cable.fromNodeId || null;
            } else {
                showToast(t('otdr_conn_mismatch'), "info");
                return;
            }

            // --- CABLE TECHNICAL RESERVE ---
            if (cable.technicalReserve && cable.technicalReserve > 0) {
                if (remainingDist <= cable.technicalReserve) {
                    // Event is within the reserve of this cable at the entry point
                    const entryPoint = path[0];
                    setOtdrResult(entryPoint);
                    setMapBounds([[entryPoint.lat, entryPoint.lng], [entryPoint.lat, entryPoint.lng]]);
                    showToast(`${t('otdr_result')}: ${t('technical_reserve')} (${cable.name})`);
                    return;
                }
                remainingDist -= cable.technicalReserve;
            }

            let eventPoint: Coordinates | null = null;

            for (let i = 0; i < path.length - 1; i++) {
                const p1 = L.latLng(path[i].lat, path[i].lng);
                const p2 = L.latLng(path[i + 1].lat, path[i + 1].lng);
                const segmentDist = p1.distanceTo(p2);

                if (remainingDist <= segmentDist) {
                    const ratio = remainingDist / segmentDist;
                    const lat = path[i].lat + (path[i + 1].lat - path[i].lat) * ratio;
                    const lng = path[i].lng + (path[i + 1].lng - path[i].lng) * ratio;
                    eventPoint = { lat, lng };
                    break;
                }

                remainingDist -= segmentDist;
            }

            if (eventPoint) {
                setOtdrResult(eventPoint);
                setMapBounds([[eventPoint.lat, eventPoint.lng], [eventPoint.lat, eventPoint.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                setEditingCable(null);
                showToast(`${t('otdr_result')}: ${t('otdr_success_cable', { name: cable.name })} `);
                return;
            }

            if (!nextNodeId) {
                showToast(t('otdr_end_open'), "info");
                const end = path[path.length - 1];
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }

            const nextNode = net.ctos.find(c => c.id === nextNodeId) || net.pops.find(p => p.id === nextNodeId) || (net.poles || []).find(p => p.id === nextNodeId);
            if (!nextNode) {
                showToast(t('otdr_next_node_error'), "info");
                return;
            }

            // --- POLE Auto-Pass-Through ---
            // Poles don't have explicit internal connections. We assume anchoring = continuity.
            // If it's a pole, find the next cable connected to it and continue on the same fiber index.
            const isPole = (net.poles || []).some(p => p.id === nextNodeId);
            if (isPole) {
                const fiberIndex = currentPortId.split('-fiber-')[1];
                // Find another cable connected to this pole (excluding the current one)
                const nextCable = net.cables.find(c =>
                    c.id !== cableId &&
                    (c.fromNodeId === nextNode.id || c.toNodeId === nextNode.id)
                );

                if (nextCable) {
                    showToast(t('otdr_traversing_pole', { name: nextNode.name }), 'info');
                    currentPortId = `${nextCable.id}-fiber-${fiberIndex}`;
                    currentNodeId = nextNode.id;
                    continue; // Jump to next iteration for the new cable
                } else {
                    showToast(t('otdr_end_open'), "info");
                    const end = nextNode.coordinates;
                    setOtdrResult(end);
                    setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                    return;
                }
            }

            // --- CTO Slack Logic ---
            // If traversing a CTO (not POP), consider 13m slack.
            // We subtract this from the remaining distance before continuing.
            // If slack consumes remaining distance, the event is INSIDE this CTO.
            if ('splitters' in nextNode) { // Check if it's a CTO (POPs don't have splitters property in this type, or use type check)
                // Or safer: check if it is NOT a POP (Assuming IDs or type props)
                // Based on usage: CTOData has splitters, POPData doesn't (or defined differently).
                // net.ctos contains CTOData.
                const isCTO = net.ctos.some(c => c.id === nextNode.id);

                if (isCTO) {
                    const slack = 13;
                    if (remainingDist <= slack) {
                        // Event is within the slack of this CTO
                        showToast(`${t('otdr_result')}: ${t('otdr_inside_cto', { name: nextNode.name })} (${remainingDist.toFixed(1)}m into slack)`, 'info');
                        const end = nextNode.coordinates;
                        setOtdrResult(end);
                        setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                        setEditingCTO(null);
                        setEditingPOP(null);
                        return;
                    }
                    remainingDist -= slack;
                }
            }

            if (!('connections' in nextNode)) {
                showToast(t('otdr_fiber_end_node', { node: nextNode.name }), "info");
                const end = nextNode.coordinates;
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }

            const connection = (nextNode as any).connections.find((c: any) => c.sourceId === currentPortId || c.targetId === currentPortId);

            if (!connection) {
                showToast(t('otdr_fiber_end_node', { node: nextNode.name }), "info");
                const end = nextNode.coordinates;
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }

            const nextPortId = connection.sourceId === currentPortId ? connection.targetId : connection.sourceId;

            if (nextPortId.includes('-fiber-')) {
                currentPortId = nextPortId;
                currentNodeId = nextNodeId;
            } else {
                showToast(t('otdr_event_equipment', { node: nextNode.name }), "info");
                const end = nextNode.coordinates;
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }
        }
        showToast(t('otdr_max_depth'), "info");
    };


    // --- LOGIN LOGIC ---

    // --- UPGRADE MODAL STATE REMOVED (Duplicate) ---

    const handleLogin = async (email: string, password?: string) => {
        setIsLoggingIn(true);
        setLoginError(null);
        try {
            const data = await authService.login(email, password);
            setIsLoadingProjects(true); // START LOADING IMMEDIATELY to prevent "No Projects" flash
            setUser(data.user.username);
            setToken(data.token);
            // Fetch Plan Name
            if (data.user.company?.plan?.name) {
                setUserPlan(data.user.company.plan.name);
                setUserPlanType(data.user.company.plan.type || 'STANDARD');
                setUserPlanId(data.user.company.plan.id);
            }
            if (data.user.company?.subscriptionExpiresAt) {
                setSubscriptionExpiresAt(data.user.company.subscriptionExpiresAt);
            } else {
                setSubscriptionExpiresAt(null);
            }
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
            await api.post('/auth/register', {
                username,
                email,
                password: password || "123456",
                companyName,
                planName,
                phone,
                source: source || 'direct'
            });
            showToast(t('registration_success'), 'success');
            setAuthView('login');
        } catch (e) {
            showToast(t('registration_failed'), 'info');
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


    if (!user) {
        if (authView === 'landing') {
            return <LandingPage onLoginClick={() => setAuthView('login')} onRegisterClick={(planName) => { setSelectedRegisterPlan(planName); setAuthView('register'); }} />;
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
            />
        );
    }

    if (userRole === 'SUPER_ADMIN') {
        return <SaasAdminPage onLogout={() => { setUser(null); setToken(null); }} />;
    }



    const handleConvertPinToNode = (type: 'CTO' | 'Pole') => {
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
        } else {
            const newPole: PoleData = {
                id: newId,
                name: `Poste ${getCurrentNetwork().poles.length + 1}`,
                status: 'PLANNED',
                coordinates: pinnedLocation,
                type: 'Poste Padrão'
            };
            updateCurrentNetwork(prev => ({ ...prev, poles: [...(prev.poles || []), newPole] }));
            showToast(t('toast_pole_added') || "Poste Adicionado", 'success');
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
        <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
            {toast && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-5">
                    <div className={`px-4 py-2 rounded-lg shadow-lg border flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/90 border-emerald-500 text-emerald-800 dark:text-white' : toast.type === 'error' ? 'bg-red-100 dark:bg-red-900/90 border-red-500 text-red-800 dark:text-white' : 'bg-sky-100 dark:bg-sky-900/90 border-sky-500 text-sky-800 dark:text-white'} `}>
                        <CheckCircle2 className="w-4 h-4" /> <span className="text-sm font-medium">{toast.msg}</span>
                    </div>
                </div>
            )}

            {/* Mobile TopBar */}
            <header className="lg:hidden absolute top-0 left-0 right-0 h-14 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-[40] flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Logo" className="w-7 h-7" />
                    <span className="font-bold text-sm tracking-tight">{t('app_title')}</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <MapIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </button>
            </header>

            <Sidebar
                viewMode={currentProjectId ? 'project' : 'dashboard'}
                user={user}
                userRole={userRole}
                userPlan={userPlan}
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
                onLogout={() => {
                    setUser(null);
                    setToken(null);
                    setCurrentProjectId(null);
                }}
                onUpgradeClick={() => setIsAccountSettingsOpen(true)}
                setCurrentProjectId={setCurrentProjectId}
                setShowProjectManager={setShowProjectManager}
                onImportClick={() => setIsAdvancedImportOpen(true)}
                onReportClick={() => setIsReportModalOpen(true)}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                isMobileOpen={isMobileMenuOpen}
                onCloseMobile={() => setIsMobileMenuOpen(false)}
                currentDashboardView={dashboardView}
                onDashboardViewChange={setDashboardView}
                isHydrated={isHydrated}
            />

            {!currentProjectId ? (
                <main className="flex-1 relative overflow-hidden">
                    <DashboardPage
                        username={user!}
                        userRole={userRole || 'MEMBER'}
                        userPlan={userPlan}
                        userPlanType={userPlanType}
                        subscriptionExpiresAt={subscriptionExpiresAt}
                        cancelAtPeriodEnd={cancelAtPeriodEnd}
                        projects={projects}
                        currentView={dashboardView}
                        onViewChange={setDashboardView}
                        onOpenProject={(id) => {
                            if (companyStatus === 'SUSPENDED') {
                                setUpgradeModalDetails("Sua conta está suspensa. Renove sua assinatura para acessar os projetos.");
                                setShowUpgradeModal(true);
                                return;
                            }
                            setCurrentProjectId(id);
                            setShowProjectManager(false);
                        }}
                        onCreateProject={async (name, center) => {
                            if (companyStatus === 'SUSPENDED') {
                                setUpgradeModalDetails("Sua conta está suspensa. Renove sua assinatura para criar novos projetos.");
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
                                    showToast('Failed to create project', 'info');
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
                        onLogout={() => { setUser(null); setToken(null); setProjects([]); setCurrentProjectId(null); setCurrentProject(null); }}
                        onUpgradeClick={() => setIsAccountSettingsOpen(true)}
                    />
                </main>
            ) : currentProjectId && !currentProject ? (
                <main className="flex-1 relative flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white gap-4 transition-colors">
                    <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                    <div className="text-xl font-bold tracking-tight">{t('processing')}</div>
                </main>
            ) : (
                <main className="flex-1 relative bg-slate-100 dark:bg-slate-900">
                    {/* Map Toolbar (Floating) */}
                    <div className="absolute top-20 lg:top-4 left-0 right-0 z-[1000] pointer-events-none">
                        {/* Pointer events none on container so clicks pass through, but auto on toolbar itself */}
                        <div className="pointer-events-auto w-fit mx-auto">
                            <MapToolbar
                                toolMode={toolMode}
                                setToolMode={setToolMode}
                                activeMenuId={activeMenuId}
                                setActiveMenuId={setActiveMenuId}
                                onImportKml={() => setIsKmlImportOpen(true)}
                                userRole={userRole}
                                onConnectClick={() => {
                                    previousNetworkState.current = JSON.parse(JSON.stringify(getCurrentNetwork()));
                                    setToolMode('connect_cable');
                                    setSelectedId(null);
                                }}
                            />
                        </div>
                    </div>

                    {/* Move Mode Floating Controls */}
                    {toolMode === 'move_node' && (
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-white dark:bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 ml-2 flex items-center gap-2">
                                <Move className="w-4 h-4 text-sky-500" />
                                {t('moving_node')}
                            </div>
                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
                            <button
                                onClick={() => {
                                    setToolMode('view');
                                    setSelectedId(null);
                                    showToast(t('position_saved'), 'success');
                                }}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                {t('save_position')}
                            </button>
                        </div>
                    )}

                    <MapView
                        ctos={getCurrentNetwork().ctos}
                        pops={getCurrentNetwork().pops || []}
                        poles={getCurrentNetwork().poles || []}
                        cables={getCurrentNetwork().cables}
                        mode={toolMode}
                        userRole={userRole}
                        selectedId={selectedId}
                        mapBounds={mapBounds}
                        showLabels={showLabels}
                        litCableIds={litNetwork.litCables}
                        highlightedCableId={highlightedCableId}
                        drawingPath={drawingPath}
                        snapDistance={systemSettings.snapDistance}

                        viewKey={mapForceUpdateKey ? `force-${mapForceUpdateKey}` : (currentProjectId || undefined)}
                        initialCenter={savedMapState?.center || currentProject?.mapState?.center}
                        initialZoom={savedMapState?.zoom || currentProject?.mapState?.zoom}
                        onMapMoveEnd={handleMapMoveEnd}
                        onToggleLabels={() => setShowLabels(!showLabels)}

                        onAddPoint={handleAddPoint}
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
                        // Pass OTDR Result Point to MapView to render marker
                        otdrResult={otdrResult}
                        pinnedLocation={pinnedLocation}
                        onConvertPin={handleConvertPinToNode}
                        onClearPin={() => setPinnedLocation(null)}
                        rulerPoints={rulerPoints}
                        onRulerPointsChange={setRulerPoints}

                        onToggleReserveCable={handleToggleReserveCable}
                        onPositionReserveCable={handlePositionReserveCable}
                        onReservePositionSet={handleReservePositionSet}
                    />




                    {/* Save/Cancel Toolbar for Cable Edit */}
                    {
                        toolMode === 'edit_cable' && (
                            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 z-[1000] animate-in slide-in-from-top-4 fade-in duration-300">
                                <div className="flex items-center gap-3 px-3">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {t('editing_cable')}
                                    </span>
                                    <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600"></div>
                                    <button
                                        onClick={() => {
                                            setToolMode('view');
                                            setHighlightedCableId(null);
                                            setSelectedId(null);
                                            previousNetworkState.current = null;
                                            showToast(t('changes_saved'), 'success');
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg shadow-emerald-900/20"
                                    >
                                        {t('save_changes')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            // CANCEL (Revert changes)
                                            if (previousNetworkState.current) {
                                                const backup = previousNetworkState.current; // Capture ref value
                                                updateCurrentNetwork(() => backup); // Return backup as new state
                                                previousNetworkState.current = null;

                                                // FORCE MODAL CLOSE / REFRESH to prevent stale state in modals
                                                setEditingCTO(null);
                                                setEditingPOP(null);
                                            }
                                            setToolMode('view');
                                            setMultiConnectionIds(new Set());
                                            setSelectedId(null);
                                            setHighlightedCableId(null); // Fix: Clear highlight on cancel
                                            showToast(t('connection_cancelled') || "Conexão Cancelada", 'info');
                                        }}
                                        className="text-slate-500 hover:text-red-500 transition-colors p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    {/* Save/Cancel Toolbar for Connect Cable */}
                    {
                        toolMode === 'connect_cable' && (
                            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 z-[1000] animate-in slide-in-from-top-4 fade-in duration-300">
                                <div className="flex items-center gap-3 px-3">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {t('connecting_cable')}
                                    </span>
                                    <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600"></div>
                                    <button
                                        onClick={() => {
                                            setToolMode('view');
                                            setMultiConnectionIds(new Set());
                                            setSelectedId(null);
                                            previousNetworkState.current = null;
                                            showToast(t('finish'), 'success');
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg shadow-emerald-900/20"
                                    >
                                        {t('finish')}
                                    </button>
                                    <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
                                    <button
                                        onClick={() => {
                                            // CANCEL (Revert changes)
                                            if (previousNetworkState.current) {
                                                const backup = previousNetworkState.current; // Capture ref value
                                                updateCurrentNetwork(() => backup); // Return backup as new state
                                                previousNetworkState.current = null;

                                                // FORCE MODAL CLOSE / REFRESH to prevent stale state in modals
                                                setEditingCTO(null);
                                                setEditingPOP(null);
                                            }
                                            setToolMode('view');
                                            setMultiConnectionIds(new Set());
                                            setSelectedId(null);
                                            setHighlightedCableId(null); // Fix: Clear highlight on cancel
                                            showToast(t('connection_cancelled') || "Conexão Cancelada", 'info');
                                        }}
                                        className="text-slate-500 hover:text-red-500 transition-colors p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur text-slate-700 dark:text-white px-4 py-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 text-xs font-medium z-[500] pointer-events-none">
                        {toolMode === 'view' && t('tooltip_view')}
                        {toolMode === 'move_node' && t('tooltip_move')}
                        {toolMode === 'add_cto' && t('tooltip_add_cto')}
                        {toolMode === 'add_pop' && t('tooltip_add_pop')}
                        {toolMode === 'add_pole' && t('tooltip_add_pole')}
                        {toolMode === 'ruler' && t('tooltip_ruler')}
                        {toolMode === 'draw_cable' && (drawingPath.length === 0 ? t('tooltip_draw_cable_start') : t('tooltip_draw_cable'))}
                        {toolMode === 'pick_connection_target' && t('toast_select_next_box')}
                        {toolMode === 'position_reserve' && t('tooltip_position_reserve')}
                    </div>

                    {/* Ruler Toolbar */}
                    {toolMode === 'ruler' && rulerPoints.length > 0 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2000] flex gap-3">
                            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-3 border border-slate-200 dark:border-slate-700">
                                <Ruler className="w-5 h-5 text-pink-500" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 uppercase leading-none">{t('ruler_total')}</span>
                                    <span className="text-sm text-pink-600 dark:text-pink-400">
                                        {rulerPoints.reduce((acc, curr, idx) => {
                                            if (idx === 0) return 0;
                                            return acc + L.latLng(rulerPoints[idx - 1]).distanceTo(L.latLng(curr));
                                        }, 0).toFixed(1)}m
                                    </span>
                                </div>
                                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                <button
                                    onClick={() => setRulerPoints([])}
                                    className="text-slate-500 hover:text-red-500 transition-colors text-xs flex items-center gap-1"
                                >
                                    <X className="w-4 h-4" />
                                    {t('ruler_clear')}
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    setToolMode('view');
                                    setRulerPoints([]);
                                }}
                                className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transition-all hover:bg-slate-800 dark:hover:bg-slate-600"
                            >
                                <Check className="w-4 h-4" />
                                {t('finish')}
                            </button>
                        </div>
                    )}

                    {
                        toolMode === 'draw_cable' && drawingPath.length > 0 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2000] flex gap-3">
                                <button
                                    onClick={() => finalizeCableCreation(drawingPath, drawingFromId)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                    {t('finish_cable')}
                                </button>
                                <button
                                    onClick={() => { setDrawingPath([]); setDrawingFromId(null); }}
                                    className="bg-white/90 dark:bg-slate-800/90 backdrop-blur text-slate-700 dark:text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
                                >
                                    <X className="w-5 h-5" />
                                    {t('cancel')}
                                </button>
                            </div>
                        )
                    }

                </main >
            )}

            {/* Editors */}
            {
                editingPOP && (
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
                )
            }
            {
                editingCTO && (
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

                        // Auth / Protection Props
                        userRole={userRole}
                        userPlan={userPlan}
                        subscriptionExpiresAt={subscriptionExpiresAt}
                        onShowUpgrade={handleCTOShowUpgrade}
                        network={editingCTONetwork}
                    />
                )
            }

            {/* ... */}

            {/* Legacy KML Import Modal (Poles Only - via Toolbar) */}
            <KmlImportModal
                isOpen={isKmlImportOpen}
                onClose={() => setIsKmlImportOpen(false)}
                onImport={async (coordinates, poleTypeId) => {
                    handleImportPoles(coordinates, poleTypeId); // Ensure this legacy handler exists or is recreated
                }}
            />

            {/* Advanced Import Modal (Sidebar) */}
            <AdvancedImportModal
                isOpen={isAdvancedImportOpen}
                onClose={() => {
                    setIsAdvancedImportOpen(false);
                    setPreviewImportData(null);
                }}
                onPreview={(data) => setPreviewImportData(data)}
                onImport={async (data) => {
                    if (!currentProjectId) return;
                    if (!data) return;

                    setIsLoadingProjects(true);

                    try {
                        const updated = { ...getCurrentNetwork() };

                        // 1. Process Cables
                        if (data.cables && data.cables.length > 0) {
                            const newCables: CableData[] = data.cables.map((c: any, idx: number) => ({
                                id: crypto.randomUUID(),
                                name: c.originalName || `Cabo ${idx + 1}`,
                                status: c.status || 'DEPLOYED', // Use imported status or default
                                fiberCount: c.type?.fiberCount || 1, // Fallback
                                looseTubeCount: c.type?.looseTubeCount || 1,
                                color: c.type?.deployedSpec?.color || c.type?.plannedSpec?.color || '#0ea5e9', // Use catalog color
                                colorStandard: 'ABNT',
                                // Transform [[lng, lat]] -> [{lat, lng}]
                                // VALIDATION: Ensure we only map valid points
                                coordinates: (Array.isArray(c.coordinates) ? c.coordinates : [])
                                    .filter((pt: any) => Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]))
                                    .map((pt: any) => ({ lat: pt[1], lng: pt[0] })),
                                fromNodeId: null,
                                toNodeId: null,
                                catalogId: c.type?.id
                            }));
                            // DOUBLE CHECK: Remove cables with too few points
                            updated.cables = [...(updated.cables || []), ...newCables.filter(c => c.coordinates.length >= 2)];
                        }

                        // 2. Process CTOs
                        if (data.ctos && data.ctos.length > 0) {
                            const newCTOs: CTOData[] = data.ctos.map((c: any, idx: number) => ({
                                id: crypto.randomUUID(),
                                name: c.originalName || `CTO ${idx + 1}`,
                                status: c.status || 'DEPLOYED', // Use imported status
                                type: 'CTO',
                                coordinates: { lat: c.coordinates[1], lng: c.coordinates[0] },
                                catalogId: c.type?.id,
                                splitters: [],
                                fusions: [],
                                connections: [],
                                inputCableIds: [],
                                clientCount: 0
                            }));
                            updated.ctos = [...(updated.ctos || []), ...newCTOs];
                        }

                        // 3. Process CEOs (Boxes)
                        if (data.ceos && data.ceos.length > 0) {
                            const newCEOs: CTOData[] = data.ceos.map((c: any, idx: number) => ({
                                id: crypto.randomUUID(),
                                name: c.originalName || `CEO ${idx + 1}`,
                                status: c.status || 'DEPLOYED',
                                type: 'CEO',
                                coordinates: { lat: c.coordinates[1], lng: c.coordinates[0] },
                                catalogId: c.type?.id,
                                splitters: [],
                                fusions: [],
                                connections: [],
                                inputCableIds: [],
                                clientCount: 0
                            }));
                            updated.ctos = [...(updated.ctos || []), ...newCEOs];
                        }

                        // 4. Process Poles
                        if (data.poles && data.poles.length > 0) {
                            const newPoles: PoleData[] = data.poles.map((p: any, idx: number) => ({
                                id: crypto.randomUUID(),
                                name: p.originalName || `Poste ${idx + 1}`,
                                status: p.status || 'PLANNED', // Poles default to PLANNED usually
                                coordinates: { lat: p.coordinates[1], lng: p.coordinates[0] },
                                catalogId: p.type?.id,
                                type: p.type?.name,
                                height: p.type?.height
                            }));
                            updated.poles = [...(updated.poles || []), ...newPoles];
                        }

                        // SAVE TO BACKEND
                        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
                        await projectService.syncProject(currentProjectId, updated);
                        setCurrentProject(prev => prev ? { ...prev, network: updated, updatedAt: Date.now() } : null);
                        showToast('Importação realizada com sucesso!', 'success');
                        setIsAdvancedImportOpen(false);
                        setPreviewImportData(null);
                    } catch (error: any) {
                        console.error("Import failed", error);

                        // Limit Check Handler
                        if (error.response && error.response.status === 403) {
                            const errorMsg = error.response.data?.error || error.response.data?.details || 'Acesso negado';
                            setUpgradeModalDetails(errorMsg);
                            setShowUpgradeModal(true);
                            // Do not show generic error toast if it's a limit issue
                        } else {
                            showToast('Erro ao importar.', 'error');
                        }
                    } finally {
                        setIsLoadingProjects(false);
                    }
                }}
            />


            {/* Detail Panels (Mini-Editors/Actions) */}
            {
                selectedId && !editingCTO && toolMode === 'view' && getCurrentNetwork().ctos.find(c => c.id === selectedId) && (
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
                        }}
                        onOpenSplicing={() => { setEditingCTO(getCurrentNetwork().ctos.find(c => c.id === selectedId)!); setSelectedId(null); }}
                        onDelete={handleDeleteCTO}
                        onClose={() => setSelectedId(null)}
                    />
                )
            }

            {
                selectedId && !editingPOP && toolMode === 'view' && getCurrentNetwork().pops?.find(p => p.id === selectedId) && (
                    <POPDetailsPanel
                        pop={getCurrentNetwork().pops?.find(p => p.id === selectedId)!}
                        poles={getCurrentNetwork().poles || []}
                        onRename={handleRenamePOP}
                        onUpdateStatus={handleUpdatePOPStatus}
                        onUpdate={(id, updates) => updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.map(p => p.id === id ? { ...p, ...updates } : p) }))}
                        onOpenRack={() => { setEditingPOP(getCurrentNetwork().pops?.find(p => p.id === selectedId)!); setSelectedId(null); }}
                        onDelete={handleDeletePOP}
                        onClose={() => setSelectedId(null)}
                    />
                )
            }

            {
                selectedId && toolMode === 'view' && getCurrentNetwork().poles?.find(p => p.id === selectedId) && (
                    <PoleDetailsPanel
                        pole={getCurrentNetwork().poles?.find(p => p.id === selectedId)!}
                        cables={getCurrentNetwork().cables}
                        onRename={(id, newName) => updateCurrentNetwork(prev => ({ ...prev, poles: prev.poles.map(p => p.id === id ? { ...p, name: newName } : p) }))}
                        onUpdateStatus={(id, status) => updateCurrentNetwork(prev => ({ ...prev, poles: prev.poles.map(p => p.id === id ? { ...p, status } : p) }))}
                        onUpdate={(id, updates) => updateCurrentNetwork(prev => ({ ...prev, poles: prev.poles.map(p => p.id === id ? { ...p, ...updates } : p) }))}
                        onDelete={(id) => {
                            updateCurrentNetwork(prev => ({ ...prev, poles: prev.poles.filter(p => p.id !== id) }));
                            setSelectedId(null);
                            showToast('Poste removido', 'success');
                        }}
                        onClose={() => setSelectedId(null)}
                    />
                )
            }

            {
                editingCable && (
                    <CableEditor
                        cable={editingCable}
                        onClose={() => { setEditingCable(null); setHighlightedCableId(null); }} // Fix: Clear highlight on close
                        onSave={handleSaveCable}
                        onDelete={handleDeleteCable}
                        userRole={userRole}
                    />
                )
            }
            {
                showProjectManager && (
                    <ProjectManager
                        projects={projects}
                        currentProjectId={currentProjectId!}
                        onSelectProject={(id) => { setCurrentProjectId(id); setShowProjectManager(false); }}
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
                )
            }

            {/* --- UPGRADE MODAL --- */}
            <AccountSettingsModal
                isOpen={isAccountSettingsOpen}
                onClose={() => setIsAccountSettingsOpen(false)}
                onManagePlan={() => { setIsAccountSettingsOpen(false); setShowUpgradeModal(true); }}
                userData={{
                    username: user || 'Usuário',
                    email: userEmail || undefined,
                    plan: userPlan,
                    planType: userPlanType,
                    expiresAt: subscriptionExpiresAt,
                    companyId: companyId || 'N/A'
                }}
                hasActiveSubscription={hasActiveSubscription}
            />

            <UpgradePlanModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                currentPlanName={userPlan}
                limitDetails={upgradeModalDetails}
                companyId={companyId || undefined}
                email={userEmail || undefined}
            />

            <PoleSelectionModal
                isOpen={isPoleModalOpen}
                onClose={() => setIsPoleModalOpen(false)}
                onSelect={(catalogItem) => {
                    if (pendingPoleLocation) {
                        const newPole: PoleData = {
                            id: `pole-${Date.now()}`,
                            name: catalogItem.name,
                            status: 'PLANNED', // Default
                            coordinates: pendingPoleLocation,
                            catalogId: catalogItem.id,
                            type: catalogItem.type,
                            height: catalogItem.height
                        };
                        updateCurrentNetwork(prev => ({ ...prev, poles: [...(prev.poles || []), newPole] }));
                        showToast(t('toast_pole_added'));
                        setIsPoleModalOpen(false);
                        setPendingPoleLocation(null);
                        setToolMode('view');
                    }
                }}
            />

            {/* --- SYSTEM SETTINGS MODAL --- */}
            {
                showSettingsModal && (
                    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowSettingsModal(false)}>
                        <div
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden transition-colors"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="h-12 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Settings className="w-4 h-4" /> {t('system_settings')}
                                </h3>
                                <button onClick={() => setShowSettingsModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-white" /></button>
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
                                            className="w-24 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                                        />
                                        <span className="text-sm text-slate-500">{t('meters')}</span>
                                        {settingsSaved && (
                                            <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold animate-in fade-in slide-in-from-left-2">
                                                <Check className="w-3 h-3" /> {t('saved')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        {t('snap_distance_help')}
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                                <button
                                    onClick={() => {
                                        performAutoSnap(systemSettings.snapDistance);
                                        setShowSettingsModal(false);
                                    }}
                                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-bold transition"
                                >
                                    {t('done')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Account Settings Modal */}
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

            {/* Upgrade Modal (Moved to bottom to ensure z-index over other modals) */}
            <UpgradePlanModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                limitDetails={upgradeModalDetails}
                companyId={companyId || undefined}
                email={userEmail || undefined}
                currentPlanName={userPlan}
                currentPlanId={userPlanId || undefined}
            />

            <ProjectReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                network={currentProject?.network || { ctos: [], pops: [], cables: [], poles: [] }}
                projectName={currentProject?.name || ''}
            />

        </div >
    );
}