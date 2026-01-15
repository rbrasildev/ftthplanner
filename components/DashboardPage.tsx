import React, { useState, useEffect, useRef } from 'react';
import { Project, Coordinates } from '../types';
import * as adminService from '../services/adminService';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';
import { PoleRegistration } from './registrations/PoleRegistration';
import { FusionRegistration } from './registrations/FusionRegistration';
import { SplitterRegistration } from './registrations/SplitterRegistration';
import CableRegistration from './registrations/CableRegistration';
import BoxRegistration from './registrations/BoxRegistration';

import { AccountSettingsModal } from './AccountSettingsModal';
import { Network, Plus, FolderOpen, Trash2, LogOut, Search, Map as MapIcon, Globe, Activity, AlertTriangle, Loader2, MapPin, X, Ruler, Users, Settings, Database, Save, ChevronRight, Moon, Sun, Box, Cable, Zap, GitFork, UtilityPole, ClipboardList, Server } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import { OLTRegistration } from './registrations/OLTRegistration';
import { BackupManager } from './BackupManager';
import L from 'leaflet';
import { searchLocation } from '../services/nominatimService';

interface DashboardPageProps {
  username: string;
  userRole?: string;
  userPlan?: string;
  userPlanType?: string;
  subscriptionExpiresAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  projects: Project[];
  onOpenProject: (id: string) => void;
  onCreateProject: (name: string, center?: Coordinates, snapDistance?: number) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProject?: (id: string, name: string, center: Coordinates) => void;
  onLogout: () => void;
  onUpgradeClick?: () => void;
  isLoading?: boolean;
}

// Helper to fix Leaflet size inside Modals
const MapInvalidator = () => {
  const map = useMap();
  useEffect(() => {
    // Wait for modal animation to likely finish
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// Internal Component: Map Controller for Modal
const LocationPickerMap = ({
  center,
  onCenterChange
}: {
  center: Coordinates,
  onCenterChange: (lat: number, lng: number) => void
}) => {
  const map = useMap();

  useEffect(() => {
    const currentCenter = map.getCenter();
    const dist = map.distance(currentCenter, [center.lat, center.lng]);
    // Only fly if distance > 100 meters (e.g. search result or initial load)
    // improving UX by not resetting if just minor drag adjustments or re-renders
    if (dist > 100) {
      map.flyTo([center.lat, center.lng], map.getZoom() || 14, { duration: 1.5 });
    }
  }, [center, map]);

  useMapEvents({
    click(e) {
      onCenterChange(e.latlng.lat, e.latlng.lng);
    },
    dragend(e) {
      const c = e.target.getCenter();
      onCenterChange(c.lat, c.lng);
    }
  });

  return (
    <Marker position={[center.lat, center.lng]} />
  );
};

type DashboardView = 'projects' | 'registrations' | 'users' | 'settings' | 'backup' | 'reg_poste' | 'reg_caixa' | 'reg_cabo' | 'reg_fusao' | 'reg_splitter' | 'reg_olt';

export const DashboardPage: React.FC<DashboardPageProps> = ({
  username,
  userRole, // Receive role
  userPlan = 'Plano Grátis',
  userPlanType = 'STANDARD',
  subscriptionExpiresAt,
  cancelAtPeriodEnd = false,
  projects,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  onLogout,
  onUpgradeClick,
  onUpdateProject,
  isLoading = false
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  /* State for active view, verified to persist on refresh */
  const [currentView, setCurrentView] = useState<DashboardView>(() => {
    const saved = localStorage.getItem('dashboard_active_view');
    return (saved as DashboardView) || 'projects';
  });

  useEffect(() => {
    localStorage.setItem('dashboard_active_view', currentView);
  }, [currentView]);

  // State for expanded menus
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  // Modal States
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // New Project State
  const [newProjectName, setNewProjectName] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<{ name: string, coords: Coordinates }[]>([]);

  // Ref to prevent search trigger when selecting an item from the list
  const skipSearchRef = useRef(false);

  // Default Center (e.g., São Paulo or user loc)
  const [mapCenter, setMapCenter] = useState<Coordinates>({ lat: -23.5505, lng: -46.6333 });

  // --- USER MANAGEMENT STATE ---
  const [usersList, setUsersList] = useState<adminService.AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<adminService.AdminUser | null>(null); // New state for editing
  const [userFormData, setUserFormData] = useState({ username: '', password: '', role: 'MEMBER' });
  const [userToDelete, setUserToDelete] = useState<adminService.AdminUser | null>(null);

  // Fetch users when view changes to 'users'
  useEffect(() => {
    if (currentView === 'users') {
      setIsLoadingUsers(true);
      adminService.getUsers()
        .then(data => setUsersList(data))
        .catch(err => console.error("Failed to fetch users", err))
        .finally(() => setIsLoadingUsers(false));
    }
  }, [currentView]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newUser = await adminService.createUser(userFormData);
      setUsersList(prev => [newUser, ...prev]);
      setIsUserModalOpen(false);
      setUserFormData({ username: '', password: '', role: 'MEMBER' });
    } catch (error: any) {
      console.error("Failed to create user", error);
      const backendMsg = error.response?.data?.error || "";
      let errorKey = 'error_create_user';

      if (backendMsg.includes('Username already taken')) errorKey = 'error_username_taken';
      else if (backendMsg.includes('Password must be at least 6 characters')) errorKey = 'error_password_length';
      else if (backendMsg) console.warn("Unmapped backend error:", backendMsg);

      alert(t(errorKey));
    }
  };

  const handleEditUserClick = (user: adminService.AdminUser) => {
    setEditingUser(user);
    setUserFormData({ username: user.username, password: '', role: user.role }); // Password empty means no change
    setIsUserModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const updateData: any = { role: userFormData.role };
      if (userFormData.password) updateData.password = userFormData.password;

      const updatedUser = await adminService.updateUser(editingUser.id, updateData);
      setUsersList(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserFormData({ username: '', password: '', role: 'MEMBER' });
    } catch (error: any) {
      console.error("Failed to update user", error);
      const backendMsg = error.response?.data?.error || "";
      let errorKey = 'error_generic';
      if (backendMsg.includes('Password must be at least 6 characters')) errorKey = 'error_password_length';
      alert(t(errorKey));
    }
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      try {
        await adminService.deleteUser(userToDelete.id);
        setUsersList(prev => prev.filter(u => u.id !== userToDelete.id));
        setUserToDelete(null);
      } catch (error: any) {
        console.error("Failed to delete user", error);
        const backendMsg = error.response?.data?.error || "";
        let errorKey = 'error_delete_user';

        if (backendMsg.includes('Cannot delete yourself')) errorKey = 'error_cannot_delete_self';

        alert(t(errorKey));
      }
    }
  };

  // Get user location on mount if possible
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, []);

  // Debounced Search Effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Only search if query is long enough AND we shouldn't skip (e.g. just selected)
      if (locationQuery.length >= 3 && !skipSearchRef.current) {
        setIsSearchingLocation(true);
        try {
          const results = await searchLocation(locationQuery);
          setLocationResults(results);
        } catch (error) {
          console.error("Search error", error);
        } finally {
          setIsSearchingLocation(false);
        }
      } else if (locationQuery.length < 3) {
        setLocationResults([]);
      }
      // Reset skip ref after check
      skipSearchRef.current = false;
    }, 1000); // 1 second delay to avoid spamming API while typing

    return () => clearTimeout(timer);
  }, [locationQuery]);

  const filteredProjects = projects
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName, mapCenter);
      setNewProjectName('');
      setLocationQuery('');
      setIsCreating(false);
    }
  };

  const selectLocationResult = (result: { name: string, coords: Coordinates }) => {
    skipSearchRef.current = true; // Prevent the useEffect from searching again immediately
    setMapCenter(result.coords);
    setLocationQuery(result.name);
    setLocationResults([]); // Clear results after selection
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToDelete(project);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  interface MenuItem {
    id: DashboardView;
    label: string;
    icon: React.FC<any>;
    subItems?: MenuItem[];
  }

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
    { id: 'settings', label: t('settings') || 'Configurações', icon: Settings },
    { id: 'backup', label: t('backup') || 'Backup', icon: Database },
  ].filter(item => {
    // Only show Users and Backup to ADMIN or OWNER
    if (item.id === 'users' || item.id === 'backup') {
      return userRole === 'ADMIN' || userRole === 'OWNER';
    }
    return true;
  }) as MenuItem[];

  // Need to import GitFork or use a fallback. Let's use Component inside map to solve icon imports if needed.
  // Actually, I need to check imports. Activity, Box, Unplug, Zap are imported. GitFork is NOT imported.
  // Let's use 'Share2' or 'Network' for Splitter if GitFork is not available, or add it to imports.
  // Viewing imports... Component has `Network` ... `Share2` isn't there. `Split` isn't there. 
  // Let's replace GitFork with `Network` or `Share` if available. `Network` is imported. `Zap` is imported.

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToEdit(project);
    setEditProjectName(project.name);
    setMapCenter(project.mapState?.center || { lat: -23.5505, lng: -46.6333 });
    setLocationQuery(''); // Reset search
    setLocationResults([]);
    setIsEditing(true);
  };

  const handleEditSubmit = async () => {
    if (projectToEdit && editProjectName.trim()) {
      try {
        if (onUpdateProject) {
          await onUpdateProject(projectToEdit.id, editProjectName, mapCenter);
        } else {
          const updatedProject = await import('../services/projectService').then(m => m.updateProject(projectToEdit.id, editProjectName, mapCenter));
          window.location.reload();
        }
        setIsEditing(false);
        setProjectToEdit(null);
      } catch (e) {
        console.error("Failed to update project", e);
      }
    }
  };

  // Helper to check if a menu is active (including children)
  const isMenuActive = (item: MenuItem) => {
    if (currentView === item.id) return true;
    if (item.subItems) {
      return item.subItems.some(sub => sub.id === currentView);
    }
    return false;
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.subItems) {
      // Toggle expansion
      setExpandedMenu(prev => prev === item.id ? null : item.id);
    } else {
      setCurrentView(item.id);
    }
  };

  // Auto-expand menu if current view is a child
  useEffect(() => {
    menuItems.forEach(item => {
      if (item.subItems && item.subItems.some(sub => sub.id === currentView)) {
        setExpandedMenu(item.id);
      }
    });
  }, [currentView]);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300 overflow-hidden">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-20">
        {/* ... (Sidebar content same as before) ... */}
        {/* Brand Area */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 bg-sky-600 rounded flex items-center justify-center shrink-0 shadow-lg shadow-sky-900/20">
            <Network className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg text-slate-900 dark:text-white truncate" title={t('app_title')}>{t('app_title')}</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map(item => {
            const isActive = isMenuActive(item);
            const isExpanded = expandedMenu === item.id;
            const hasSubItems = !!item.subItems;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => handleMenuClick(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group ${isActive && !hasSubItems
                    ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 shadow-sm ring-1 ring-sky-200 dark:ring-sky-800'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                  <item.icon className={`w-5 h-5 transition-colors ${isActive && !hasSubItems ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {hasSubItems && (
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                  )}
                </button>

                {/* Submenu */}
                {hasSubItems && isExpanded && (
                  <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {item.subItems!.map(sub => {
                      const isSubActive = currentView === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setCurrentView(sub.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all group ${isSubActive
                            ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400'
                            : 'text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                          <sub.icon className={`w-4 h-4 ${isSubActive ? 'text-sky-500' : 'text-slate-400'}`} />
                          {/* <span className={`w-1.5 h-1.5 rounded-full ${isSubActive ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400'}`}></span> */}
                          <span className="">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User / Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-start gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
              {username.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate mb-0.5">{username}</p>

              {isLoading ? (
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-1.5" />
              ) : (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${userPlan === 'Plano Ilimitado' ? 'bg-purple-500' : userPlan === 'Plano Intermediário' ? 'bg-sky-500' : 'bg-emerald-500'}`}></span>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate font-medium" title={userPlan}>{userPlan}</p>
                </div>
              )}


            </div>

          </div>
          <div className="flex flex-col gap-1 mb-2">
            {subscriptionExpiresAt && (userPlanType === 'TRIAL' || cancelAtPeriodEnd) && (
              <p className={`text-[9px] font-bold uppercase tracking-wide leading-tight ${userPlanType === 'TRIAL' ? 'text-amber-500' : 'text-red-500'}`}>
                {userPlanType === 'TRIAL' ? 'Teste' : 'Expira'}: {Math.max(0, Math.ceil((new Date(subscriptionExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} dias
              </p>
            )}

            {isLoading ? (
              <div className="h-8 w-full bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            ) : (
              onUpgradeClick && (
                <button
                  onClick={() => {
                    if (userPlan === 'Plano Grátis' || userPlanType === 'TRIAL') {
                      onUpgradeClick && onUpgradeClick();
                    } else {
                      setIsAccountSettingsOpen(true);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg font-bold w-full shadow-sm border border-transparent 
                        ${(userPlan === 'Plano Grátis' || userPlanType === 'TRIAL')
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 hover:shadow-md'}`}
                >
                  {(userPlan === 'Plano Grátis' || userPlanType === 'TRIAL')
                    ? <><Zap className="w-3 h-3" /> Fazer Upgrade</>
                    : <><Settings className="w-3 h-3" /> Gerenciar Assinatura</>
                  }
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
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
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 h-full relative">

        {/* Projects View */}
        {currentView === 'projects' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderOpen className="w-7 h-7 text-sky-500 dark:text-sky-400" />
                  {t('my_projects')}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {t('manage_networks_desc')}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder={t('search_generic')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors shadow-sm"
                  />
                </div>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-900/20 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> {t('create_new_project_btn')}
                </button>
              </div>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 animate-pulse h-48"></div>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 font-medium">{t('no_projects')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols3 xl:grid-cols-3 gap-6">
                {filteredProjects.map((project: any) => {
                  const totalCTOs = project.network.ctos.length;
                  const deployedCTOs = project.network.ctos.filter((c: any) => c.status === 'DEPLOYED' || c.status === 'CERTIFIED').length;

                  const totalCables = project.network.cables.length;
                  const deployedCables = project.network.cables.filter((c: any) => c.status === 'DEPLOYED' || c.status === 'CERTIFIED').length;

                  const totalItems = totalCTOs + totalCables;
                  const deployedItems = deployedCTOs + deployedCables;
                  const progress = totalItems > 0 ? Math.round((deployedItems / totalItems) * 100) : 0;

                  return (
                    <div
                      key={project.id}
                      onClick={() => onOpenProject(project.id)}
                      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-sky-900/10 hover:-translate-y-1 relative"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/30 rounded-lg flex items-center justify-center transition-colors">
                          <MapIcon className="w-5 h-5 text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400" />
                        </div>
                        <div className="flex items-center gap-1 relative z-20">
                          {/* EDIT BUTTON */}
                          <button
                            onClick={(e) => handleEditClick(e, project)}
                            className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/10 rounded-lg transition-colors"
                            title={t('edit') || 'Edit'}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(e, project)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                        {project.name}
                      </h3>

                      <p className="text-xs text-slate-500 mb-4">
                        {t('last_modified', { date: new Date(project.updatedAt).toLocaleDateString() })}
                      </p>

                      <div className="flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="block font-bold text-slate-700 dark:text-slate-200">{deployedCTOs}/{totalCTOs}</span>
                          <span className="text-slate-500 dark:text-slate-600">CTOs</span>
                        </div>
                        <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800"></div>
                        <div>
                          <span className="block font-bold text-slate-700 dark:text-slate-200">{deployedCables}/{totalCables}</span>
                          <span className="text-slate-500 dark:text-slate-600">{t('cables')}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">
                            <Activity className="w-3 h-3 text-emerald-500" />
                            {t('status_DEPLOYED')}
                          </div>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Placeholders for other views */}
        {currentView !== 'projects' && currentView !== 'users' && currentView !== 'backup' && !currentView.startsWith('reg_') && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              {currentView === 'registrations' && <ClipboardList className="w-10 h-10 text-slate-400" />}
              {currentView === 'settings' && <Settings className="w-10 h-10 text-slate-400" />}

            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 capitalize">
              {menuItems.find(m => m.id === currentView)?.label}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {t('module_under_development')}
            </p>
          </div>
        )}

        {/* --- BACKUP MANAGER --- */}
        {currentView === 'backup' && (
          <BackupManager />
        )}

        {/* --- SPLITTER REGISTRATION --- */}
        {currentView === 'reg_splitter' && (
          <SplitterRegistration />
        )}

        {/* --- CABLE REGISTRATION --- */}
        {currentView === 'reg_cabo' && (
          <CableRegistration />
        )}

        {/* --- BOX REGISTRATION --- */}
        {currentView === 'reg_caixa' && (
          <BoxRegistration />
        )}

        {/* --- POLE REGISTRATION --- */}
        {currentView === 'reg_poste' && (
          <PoleRegistration />
        )}

        {/* --- FUSION REGISTRATION --- */}
        {currentView === 'reg_fusao' && (
          <FusionRegistration />
        )}

        {/* --- OLT REGISTRATION --- */}
        {currentView === 'reg_olt' && (
          <OLTRegistration />
        )}

        {/* --- REGISTRATION PLACEHOLDERS --- */}
        {currentView.startsWith('reg_') && !['reg_splitter', 'reg_cabo', 'reg_caixa', 'reg_poste', 'reg_fusao', 'reg_olt'].includes(currentView) && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              {currentView === 'reg_poste' && <UtilityPole className="w-10 h-10 text-slate-400" />}
              {currentView === 'reg_caixa' && <Box className="w-10 h-10 text-slate-400" />}
              {currentView === 'reg_cabo' && <Cable className="w-10 h-10 text-slate-400" />}

              {currentView === 'reg_fusao' && <Zap className="w-10 h-10 text-slate-400" />}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {t('registration_title', { name: t(currentView as any) || currentView.replace('reg_', '') })}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {t('registration_placeholder_desc', { name: t(currentView as any) || currentView.replace('reg_', '') })}
            </p>
          </div>
        )}

        {/* --- USERS VIEW --- */}
        {currentView === 'users' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-7 h-7 text-sky-500 dark:text-sky-400" />
                  {t('users')}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {t('users_manage_desc')}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserFormData({ username: '', password: '', role: 'MEMBER' });
                  setIsUserModalOpen(true);
                }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-900/20 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> {t('add_user')}
              </button>
            </div>

            {isLoadingUsers ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-sky-500" /></div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">{t('username')}</th>
                      <th className="px-6 py-4">{t('role')}</th>
                      <th className="px-6 py-4">{t('created_at')}</th>
                      <th className="px-6 py-4 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {usersList.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{user.username}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                             ${user.role === 'OWNER' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                              user.role === 'ADMIN' ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' :
                                'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {user.role === 'OWNER' ? t('role_owner') : user.role === 'ADMIN' ? t('role_admin') : t('role_member')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleEditUserClick(user)}
                            className="text-slate-400 hover:text-sky-500 transition-colors p-2 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg mr-1"
                            title={t('edit_user')}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {usersList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          {t('no_users_found')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- ADD USER MODAL --- */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-500 dark:text-sky-400" /> {editingUser ? t('edit_user') : t('add_user')}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('username')}</label>
                <input
                  type="text"
                  value={userFormData.username}
                  onChange={e => setUserFormData({ ...userFormData, username: e.target.value })}
                  disabled={!!editingUser} // Username cannot be changed
                  className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors ${editingUser ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('password')}</label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('role')}</label>
                <select
                  value={userFormData.role}
                  onChange={e => setUserFormData({ ...userFormData, role: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                >
                  <option value="MEMBER">{t('role_member')}</option>
                  <option value="ADMIN">{t('role_admin')}</option>
                </select>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition">{t('cancel')}</button>

              <button
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2"
              >
                <Plus className={`w-4 h-4 ${editingUser ? 'hidden' : ''}`} />
                <Save className={`w-4 h-4 ${editingUser ? '' : 'hidden'}`} />
                {editingUser ? t('update') : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- USER DELETE CONFIRMATION --- */}
      {userToDelete && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('confirm_delete')}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t('confirm_delete_user_msg', { username: userToDelete.username })}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setUserToDelete(null)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors">{t('cancel')}</button>
              <button onClick={handleDeleteUser} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-900/20 transition-all active:scale-95">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}


      {/* --- CREATE PROJECT MODAL --- */}
      {
        isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
              <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-sky-500 dark:text-sky-400" /> {t('create_project_modal_title')}
                </h3>
                <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('name')}</label>
                  <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder={t('new_project_placeholder')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors" autoFocus />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex justify-between">
                    {t('search_location')}
                    <span className="text-sky-600 dark:text-sky-400 font-normal normal-case flex items-center gap-1"><MapIcon className="w-3 h-3" /> {t('pinned_location')}: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}</span>
                  </label>
                  <div className="relative z-20">
                    <div className="relative w-full">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <input type="text" value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder={t('search_location_placeholder')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500" />
                      {isSearchingLocation && (<div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="w-4 h-4 animate-spin text-sky-500" /></div>)}
                    </div>
                    {locationResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-30 max-h-40 overflow-y-auto">
                        {locationResults.map((loc, idx) => (<button key={idx} onClick={() => selectLocationResult(loc)} className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center gap-2"> <MapPin className="w-3 h-3 text-sky-500" /> <span className="truncate">{loc.name}</span> </button>))}
                      </div>
                    )}
                  </div>
                  <div className="h-64 w-full rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden relative z-10 bg-slate-100 dark:bg-slate-900">
                    <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={13} style={{ height: '100%', width: '100%' }} dragging={true} scrollWheelZoom={true}>
                      <MapInvalidator />
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                      <LocationPickerMap center={mapCenter} onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} />
                    </MapContainer>
                    <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-slate-900/80 px-2 py-1 rounded text-[10px] text-slate-600 dark:text-slate-300 pointer-events-none z-[1000] border border-slate-200 dark:border-slate-700">
                      {t('map_instruction')}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsCreating(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition">{t('cancel')}</button>
                <button onClick={handleCreateSubmit} disabled={!newProjectName.trim()} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2"> <Plus className="w-4 h-4" /> {t('confirm_create')} </button>
              </div>
            </div>
          </div>
        )
      }

      {/* --- EDIT PROJECT MODAL --- */}
      {
        isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
              <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-sky-500 dark:text-sky-400" /> {t('edit_project') || 'Edit Project'}
                </h3>
                <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('name')}</label>
                  <input type="text" value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} placeholder={t('new_project_placeholder')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors" autoFocus />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex justify-between">
                    {t('search_location')}
                    <span className="text-sky-600 dark:text-sky-400 font-normal normal-case flex items-center gap-1"><MapIcon className="w-3 h-3" /> {t('pinned_location')}: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}</span>
                  </label>
                  <div className="relative z-20">
                    <div className="relative w-full">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <input type="text" value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} placeholder={t('search_location_placeholder')} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500" />
                      {isSearchingLocation && (<div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="w-4 h-4 animate-spin text-sky-500" /></div>)}
                    </div>
                    {locationResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-30 max-h-40 overflow-y-auto">
                        {locationResults.map((loc, idx) => (<button key={idx} onClick={() => selectLocationResult(loc)} className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center gap-2"> <MapPin className="w-3 h-3 text-sky-500" /> <span className="truncate">{loc.name}</span> </button>))}
                      </div>
                    )}
                  </div>
                  <div className="h-64 w-full rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden relative z-10 bg-slate-100 dark:bg-slate-900">
                    <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={13} style={{ height: '100%', width: '100%' }} dragging={true} scrollWheelZoom={true}>
                      <MapInvalidator />
                      <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name={t('map_street') || "Map rua"}>
                          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name={t('map_satellite') || "Satélite"}>
                          <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                        </LayersControl.BaseLayer>
                      </LayersControl>
                      <LocationPickerMap center={mapCenter} onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} />
                    </MapContainer>
                    <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-slate-900/80 px-2 py-1 rounded text-[10px] text-slate-600 dark:text-slate-300 pointer-events-none z-[1000] border border-slate-200 dark:border-slate-700">
                      {t('map_instruction')}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition">{t('cancel')}</button>
                <button onClick={handleEditSubmit} disabled={!editProjectName.trim()} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2"> <Save className="w-4 h-4" /> {t('save_changes') || 'Salvar'} </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Delete Confirmation Modal */}
      {
        projectToDelete && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setProjectToDelete(null)}>
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('confirm_delete')}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t('delete_project_confirm', { name: projectToDelete.name })}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setProjectToDelete(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-900/20 transition-all active:scale-95"
                >
                  {t('delete')}
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
          if (onUpgradeClick) onUpgradeClick();
        }}
        userData={{
          username,
          plan: userPlan,
          planType: userPlanType,
          expiresAt: subscriptionExpiresAt || null,
          companyId: (projects[0] as any)?.companyId || 'UNKNOWN'
        }}
      />

    </div >
  );
};
