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
import { CompanySettings } from './settings/CompanySettings';
import { IntegrationsPage } from './integrations/IntegrationsPage';


import { Network, Plus, FolderOpen, Trash2, LogOut, Search, Map as MapIcon, Globe, Activity, AlertTriangle, Loader2, MapPin, X, Ruler, Users, Settings, Database, Save, ChevronRight, Moon, Sun, Box, Cable, Zap, GitFork, UtilityPole, ClipboardList, Server, LayoutGrid, List } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import { OLTRegistration } from './registrations/OLTRegistration';
import CustomerRegistration from './registrations/CustomerRegistration';
import { BackupManager } from './BackupManager';
import L from 'leaflet';
import { searchLocation } from '../services/nominatimService';
import { CustomInput } from './common/CustomInput';
import { CustomSelect } from './common/CustomSelect';

interface DashboardPageProps {
  username: string;
  userRole?: string;
  userPlan?: string;
  userPlanType?: string;
  userBackupEnabled?: boolean;
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
  currentView?: DashboardView;
  onViewChange?: (view: DashboardView) => void;
  currentProjectId?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
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

type DashboardView = 'projects' | 'integrations' | 'registrations' | 'users' | 'settings' | 'backup' | 'reg_poste' | 'reg_caixa' | 'reg_cabo' | 'reg_fusao' | 'reg_splitter' | 'reg_olt' | 'reg_clientes';

export const DashboardPage: React.FC<DashboardPageProps> = ({
  username,
  userRole, // Receive role
  userPlan = 'Plano Grátis',
  userPlanType = 'STANDARD',
  userBackupEnabled = false,
  subscriptionExpiresAt,
  cancelAtPeriodEnd = false,
  projects,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  onLogout,
  onUpgradeClick,
  onUpdateProject,
  isLoading = false,
  currentView: externalView,
  onViewChange: onExternalViewChange,
  currentProjectId,
  showToast
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  /* State for active view, verified to persist on refresh */
  const [currentView, setCurrentView] = useState<DashboardView>(externalView || (() => {
    const saved = localStorage.getItem('dashboard_active_view');
    return (saved as DashboardView) || 'projects';
  }));

  const handleViewChange = (view: DashboardView) => {
    setCurrentView(view);
    localStorage.setItem('dashboard_active_view', view);
    if (onExternalViewChange) {
      onExternalViewChange(view);
    }
  };

  useEffect(() => {
    if (externalView) {
      setCurrentView(externalView);
    }
  }, [externalView]);

  // State for expanded menus
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  // Modal States


  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('ftth_project_view_mode') as 'grid' | 'list') || 'grid';
  });

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('ftth_project_view_mode', mode);
  };

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
  const [userFormData, setUserFormData] = useState({ username: '', email: '', password: '', confirmPassword: '', role: 'MEMBER' });
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
    if (userFormData.password !== userFormData.confirmPassword) {
      if (showToast) showToast(t('error_passwords_dont_match') || "As senhas não coincidem", 'error');
      else alert(t('error_passwords_dont_match') || "As senhas não coincidem");
      return;
    }
    try {
      const newUser = await adminService.createUser(userFormData);
      setUsersList(prev => [newUser, ...prev]);
      setIsUserModalOpen(false);
      setUserFormData({ username: '', email: '', password: '', confirmPassword: '', role: 'MEMBER' });
      if (showToast) showToast(t('toast_user_created') || "Usuário criado com sucesso", 'success');
    } catch (error: any) {
      console.error("Failed to create user", error);
      const backendMsg = error.response?.data?.error || "";
      let errorKey = 'error_create_user';

      if (backendMsg.includes('Username already taken') || backendMsg.includes('Email already taken')) errorKey = 'error_username_taken';
      else if (backendMsg.includes('Password must be at least 6 characters')) errorKey = 'error_password_length';
      else if (backendMsg.includes('Email and password are required') || backendMsg.includes('Email is required')) errorKey = 'error_email_required';
      else if (backendMsg) console.warn("Unmapped backend error:", backendMsg);

      if (showToast) showToast(t(errorKey), 'error');
      else alert(t(errorKey));
    }
  };

  const handleEditUserClick = (user: adminService.AdminUser) => {
    setEditingUser(user);
    setUserFormData({ username: user.username, email: user.email, password: '', confirmPassword: '', role: user.role }); // Password empty means no change
    setIsUserModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (userFormData.password && userFormData.password !== userFormData.confirmPassword) {
      if (showToast) showToast(t('error_passwords_dont_match') || "As senhas não coincidem", 'error');
      else alert(t('error_passwords_dont_match') || "As senhas não coincidem");
      return;
    }
    try {
      const updateData: any = { role: userFormData.role };
      if (userFormData.password) updateData.password = userFormData.password;

      const updatedUser = await adminService.updateUser(editingUser.id, updateData);
      setUsersList(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserFormData({ username: '', email: '', password: '', confirmPassword: '', role: 'MEMBER' });
      if (showToast) showToast(t('toast_user_updated') || "Usuário atualizado com sucesso", 'success');
    } catch (error: any) {
      console.error("Failed to update user", error);
      const backendMsg = error.response?.data?.error || "";
      let errorKey = 'error_generic';
      if (backendMsg.includes('Password must be at least 6 characters')) errorKey = 'error_password_length';
      
      if (showToast) showToast(t(errorKey), 'error');
      else alert(t(errorKey));
    }
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      try {
        await adminService.deleteUser(userToDelete.id);
        setUsersList(prev => prev.filter(u => u.id !== userToDelete.id));
        setUserToDelete(null);
        if (showToast) showToast(t('toast_user_deleted') || "Usuário excluído com sucesso", 'success');
      } catch (error: any) {
        console.error("Failed to delete user", error);
        const backendMsg = error.response?.data?.error || "";
        let errorKey = 'error_delete_user';

        if (backendMsg.includes('Cannot delete yourself')) errorKey = 'error_cannot_delete_self';

        if (showToast) showToast(t(errorKey), 'error');
        else alert(t(errorKey));
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
      // Reset map center to default after creation for next time
      setMapCenter({ lat: -23.5505, lng: -46.6333 });
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
        { id: 'reg_fusao', label: t('reg_fusao') || 'Fusão', icon: Zap },
        { id: 'reg_clientes', label: t('reg_clientes') || 'Clientes', icon: Users }
      ]
    },
    { id: 'users', label: t('users') || 'Usuários', icon: Users },
    { id: 'integrations', label: 'Integrações', icon: Server },
    { id: 'settings', label: t('settings') || 'Configurações', icon: Settings },
    { id: 'backup', label: t('backup') || 'Backup', icon: Database },
  ].filter(item => {
    if (item.id === 'backup' && !userBackupEnabled) return false;

    // Only show Users, Backup and Registrations to ADMIN or OWNER or SUPPORT
    if (item.id === 'users' || item.id === 'backup' || item.id === 'registrations') {
      return userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'support';
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
    // Use mapState if available from server
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
      handleViewChange(item.id);
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
    <div className="flex h-screen w-full bg-slate-50 dark:bg-[#151820] font-sans transition-colors duration-300 overflow-hidden">


      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#151820] px-4 pb-4 pt-20 lg:p-8 h-full relative">

        {/* Projects View */}
        {currentView === 'projects' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderOpen className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                  {t('my_projects')}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {t('manage_networks_desc')}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="text"
                    placeholder={t('search_generic')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-100/80 dark:bg-[#22262e]/40 border border-slate-200/50 dark:border-slate-700/30/50 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-300 placeholder:text-slate-400 shadow-sm"
                  />
                </div>

                <div className="flex items-center bg-slate-100/80 dark:bg-[#22262e]/40 border border-slate-200/50 dark:border-slate-700/30/50 rounded-xl p-1 shadow-sm h-[38px]">
                  <button
                    onClick={() => toggleViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    title={t('grid_view') || "Grade"}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    title={t('list_view') || "Lista"}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {(userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'support') && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20 whitespace-nowrap active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> {t('create_new_project_btn')}
                  </button>
                )}
              </div>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl p-5 animate-pulse h-48"></div>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-slate-300 dark:border-slate-700/30 rounded-2xl bg-slate-50/50 dark:bg-[#1a1d23]/50">
                <div className="w-16 h-16 bg-slate-200 dark:bg-[#22262e] rounded-full flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                </div>
                <p className="text-slate-500 font-medium">{t('no_projects')}</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                {filteredProjects.map((project: any) => {
                  const counts = project.counts || { ctos: 0, pops: 0, cables: 0, poles: 0, deployedCtos: 0, deployedCables: 0 };
                  const totalCTOs = project.network?.ctos?.length || counts.ctos || 0;
                  const totalCables = project.network?.cables?.length || counts.cables || 0;
                  const totalPOPs = project.network?.pops?.length || counts.pops || 0;

                  const deployedCTOs = project.network
                    ? project.network.ctos.filter((c: any) => c.status === 'DEPLOYED' || c.status === 'CERTIFIED').length
                    : (counts.deployedCtos || 0);

                  const deployedCables = project.network
                    ? project.network.cables.filter((c: any) => c.status === 'DEPLOYED' || c.status === 'CERTIFIED').length
                    : (counts.deployedCables || 0);

                  const totalItems = totalCTOs + totalCables + totalPOPs;
                  const deployedItems = deployedCTOs + deployedCables + totalPOPs;
                  const progress = totalItems > 0 ? Math.round((deployedItems / totalItems) * 100) : 0;
                  const hasNetworkData = !!project.network;

                  if (viewMode === 'list') {
                    return (
                      <div
                        key={project.id}
                        onClick={() => onOpenProject(project.id)}
                        className="group bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 hover:border-emerald-500/50 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg flex items-center gap-6 relative"
                      >
                        <div className="w-12 h-12 bg-slate-100 dark:bg-[#22262e] group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                          <MapIcon className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                              {project.name}
                            </h3>
                            <span className="text-[10px] bg-slate-100 dark:bg-[#22262e] text-slate-500 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                              {t('last_modified', { date: new Date(project.updatedAt).toLocaleDateString() })}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {totalCTOs} CTOs</span>
                            <span className="flex items-center gap-1"><Cable className="w-3 h-3" /> {totalCables} {t('cables')}</span>
                            <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-emerald-500" /> {progress}%</span>
                          </div>
                        </div>

                        <div className="hidden md:block w-48 shrink-0">
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-[#22262e] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>

                        {(userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'support') && (
                          <div className="flex items-center gap-1 pl-4 border-l border-slate-100 dark:border-slate-700/30">
                            <button
                              onClick={(e) => handleEditClick(e, project)}
                              className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-colors"
                              title={t('edit_project')}
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
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={project.id}
                      onClick={() => onOpenProject(project.id)}
                      className="group bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 hover:border-emerald-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-emerald-900/10 hover:-translate-y-1 relative"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-[#22262e] group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 rounded-lg flex items-center justify-center transition-colors">
                          <MapIcon className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                        </div>
                        {(userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'support') && (
                          <div className="flex items-center gap-1 relative z-20">
                            {/* EDIT BUTTON */}
                            <button
                              onClick={(e) => handleEditClick(e, project)}
                              className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-colors"
                              title={t('edit_project')}
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
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                        {project.name}
                      </h3>

                      <p className="text-xs text-slate-500 mb-4">
                        {t('last_modified', { date: new Date(project.updatedAt).toLocaleDateString() })}
                      </p>

                      <div className="flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#151820]/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/30">
                        <div>
                          <span className="block font-bold text-slate-700 dark:text-slate-200">
                            {hasNetworkData ? project.network.ctos.filter((c: any) => c.type === 'CEO').length : '...'}
                          </span>
                          <span className="text-slate-500 dark:text-slate-600">CEOs</span>
                        </div>
                        <div className="w-[1px] h-6 bg-slate-200 dark:bg-[#22262e]"></div>
                        <div>
                          <span className="block font-bold text-slate-700 dark:text-slate-200">
                            {hasNetworkData ? `${deployedCTOs}/${totalCTOs}` : totalCTOs}
                          </span>
                          <span className="text-slate-500 dark:text-slate-600">CTOs</span>
                        </div>
                        <div className="w-[1px] h-6 bg-slate-200 dark:bg-[#22262e]"></div>
                        <div>
                          <span className="block font-bold text-slate-700 dark:text-slate-200">
                            {hasNetworkData ? `${deployedCables}/${totalCables}` : totalCables}
                          </span>
                          <span className="text-slate-500 dark:text-slate-600">{t('cables')}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/30">
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">
                            <Activity className="w-3 h-3 text-emerald-500" />
                            {t('status_DEPLOYED')}
                          </div>
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-[#22262e] rounded-full overflow-hidden">
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

        {/* --- COMPANY SETTINGS --- */}
        {currentView === 'settings' && (
          <CompanySettings />
        )}

        {/* --- INTEGRATIONS --- */}
        {currentView === 'integrations' && (
          <IntegrationsPage />
        )}

        {/* Placeholders for other views */}
        {currentView !== 'projects' && currentView !== 'integrations' && currentView !== 'users' && currentView !== 'backup' && currentView !== 'settings' && !currentView.startsWith('reg_') && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-slate-100 dark:bg-[#22262e] rounded-full flex items-center justify-center mb-6">
              {currentView === 'registrations' && <ClipboardList className="w-10 h-10 text-slate-400" />}
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
        {currentView === 'backup' && userBackupEnabled && (
          <BackupManager backupEnabled={userBackupEnabled} />
        )}

        {/* --- SPLITTER REGISTRATION --- */}
        {currentView === 'reg_splitter' && (
          <SplitterRegistration showToast={showToast} />
        )}

        {/* --- CABLE REGISTRATION --- */}
        {currentView === 'reg_cabo' && (
          <CableRegistration showToast={showToast} />
        )}

        {/* --- BOX REGISTRATION --- */}
        {currentView === 'reg_caixa' && (
          <BoxRegistration showToast={showToast} />
        )}

        {/* --- POLE REGISTRATION --- */}
        {currentView === 'reg_poste' && (
          <PoleRegistration showToast={showToast} />
        )}

        {/* --- FUSION REGISTRATION --- */}
        {currentView === 'reg_fusao' && (
          <FusionRegistration showToast={showToast} />
        )}

        {/* --- OLT REGISTRATION --- */}
        {currentView === 'reg_olt' && (
          <OLTRegistration showToast={showToast} />
        )}

        {/* --- CUSTOMER REGISTRATION --- */}
        {currentView === 'reg_clientes' && (
          <CustomerRegistration
            projectId={currentProjectId}
            showToast={showToast}
            onLocate={(customer) => {
              // Try to find which project this customer belongs to
              let project = null;
              
              if (customer.projectId) {
                project = projects.find(p => p.id === customer.projectId);
              }

              // Fallback: search by ctoId if projectId didn't match or is missing
              if (!project && customer.ctoId) {
                project = projects.find(p =>
                  p.network?.ctos?.some(c => c.id === customer.ctoId) ||
                  (p as any).counts?.ctoIds?.includes(customer.ctoId)
                );
              }

              if (project) {
                onOpenProject(project.id);
                // Map will need to pan to customer.lat/lng after opening
                localStorage.setItem('map_jump_to_coords', JSON.stringify({ lat: customer.lat, lng: customer.lng }));
              } else if (!customer.ctoId && !customer.projectId) {
                alert(t('customer_not_connected_to_map') || 'Cliente não está conectado a nenhuma CTO no mapa.');
              } else {
                alert(t('project_not_found_for_customer') || 'Projeto não encontrado para este cliente.');
              }
            }}
          />
        )}

        {/* --- REGISTRATION PLACEHOLDERS --- */}
        {currentView.startsWith('reg_') && !['reg_splitter', 'reg_cabo', 'reg_caixa', 'reg_poste', 'reg_fusao', 'reg_olt', 'reg_clientes'].includes(currentView) && (
          <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-slate-100 dark:bg-[#22262e] rounded-full flex items-center justify-center mb-6">
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
                  <Users className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                  {t('users')}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {t('users_manage_desc')}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserFormData({ username: '', email: '', password: '', confirmPassword: '', role: 'MEMBER' });
                  setIsUserModalOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> {t('add_user')}
              </button>
            </div>

            {isLoadingUsers ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
            ) : (
              <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">{t('username')}</th>
                      <th className="px-6 py-4">{t('email')}</th>
                      <th className="px-6 py-4">{t('role')}</th>
                      <th className="px-6 py-4">{t('created_at')}</th>
                      <th className="px-6 py-4 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {usersList.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{user.username}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                             ${user.role === 'OWNER' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                              user.role === 'ADMIN' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                'bg-slate-100 text-slate-800 dark:bg-[#22262e] dark:text-slate-300'}`}>
                            {user.role === 'OWNER' ? t('role_owner') : user.role === 'ADMIN' ? t('role_admin') : t('role_member')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleEditUserClick(user)}
                            className="text-slate-400 hover:text-emerald-500 transition-colors p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg mr-1"
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
          <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col relative">
            <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-[#22262e] shrink-0 rounded-t-xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /> {editingUser ? t('edit_user') : t('add_user')}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4 relative z-10">
              <CustomInput
                label={t('email')}
                type="email"
                value={userFormData.email}
                onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                placeholder={t('user_email_placeholder')}
              />
              <CustomInput
                label={`${t('username')} (${t('optional')})`}
                type="text"
                value={userFormData.username}
                onChange={e => setUserFormData({ ...userFormData, username: e.target.value })}
                disabled={!!editingUser}
              />
              <CustomInput
                label={t('password')}
                type="password"
                value={userFormData.password}
                onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                placeholder={editingUser ? "••••••••" : ""}
              />
              {(userFormData.password || !editingUser) && (
                <CustomInput
                  label={t('confirm_password') || 'Confirmar Senha'}
                  type="password"
                  value={userFormData.confirmPassword}
                  onChange={e => setUserFormData({ ...userFormData, confirmPassword: e.target.value })}
                  placeholder={editingUser ? "••••••••" : ""}
                />
              )}
              <CustomSelect
                label={t('role')}
                value={userFormData.role}
                options={[
                  { value: 'MEMBER', label: t('role_member') },
                  { value: 'ADMIN', label: t('role_admin') },
                  ...(editingUser && editingUser.role === 'OWNER' ? [{ value: 'OWNER', label: t('saas_role_owner') || 'Proprietário' }] : [])
                ]}
                onChange={val => setUserFormData({ ...userFormData, role: val })}
                showSearch={false}
              />
            </div>
            <div className="p-4 bg-slate-50 dark:bg-[#22262e] border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-xl">
              <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition">{t('cancel')}</button>

              <button
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2"
              >
                {!editingUser && <Plus className="w-4 h-4" />}
                {editingUser && <Save className="w-4 h-4" />}
                {editingUser ? t('update') : t('create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- USER DELETE CONFIRMATION --- */}
      {userToDelete && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('confirm_delete')}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t('confirm_delete_user_msg', { username: userToDelete.username, email: userToDelete.email })}
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
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col relative max-h-[90vh]">
              <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-[#22262e] shrink-0 rounded-t-xl">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /> {t('create_project_modal_title')}
                </h3>
                <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 dark:hover:white transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div className="space-y-4">
                  <CustomInput
                    label={t('name')}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder={t('new_project_placeholder')}
                    autoFocus
                  />
                </div>
                <div className="relative z-20">
                  <CustomInput
                    label={t('search_location')}
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder={t('search_location_placeholder')}
                    icon={MapPin}
                    loading={isSearchingLocation}
                  />
                  <div className="absolute top-[3px] right-0">
                    <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold normal-case flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/50">
                      <MapIcon className="w-3 h-3" /> {t('pinned_location')}: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
                    </span>
                  </div>
                  {locationResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-30 max-h-40 overflow-y-auto">
                      {locationResults.map((loc, idx) => (<button key={idx} onClick={() => selectLocationResult(loc)} className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center gap-2 transition-colors"> <MapPin className="w-3 h-3 text-emerald-500" /> <span className="truncate">{loc.name}</span> </button>))}
                    </div>
                  )}
                </div>
                <div className="h-64 w-full rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden relative z-10 bg-slate-100 dark:bg-[#1a1d23]">
                  <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={13} style={{ height: '100%', width: '100%' }} dragging={true} scrollWheelZoom={true}>
                    <MapInvalidator />
                    <LayersControl position="topright">
                      <LayersControl.BaseLayer checked name={t('map_street')}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
                      </LayersControl.BaseLayer>
                      <LayersControl.BaseLayer name={t('map_satellite')}>
                        <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                      </LayersControl.BaseLayer>
                    </LayersControl>
                    <LocationPickerMap center={mapCenter} onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} />
                  </MapContainer>
                  <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-[#1a1d23]/80 px-2 py-1 rounded text-[10px] text-slate-600 dark:text-slate-300 pointer-events-none z-[1000] border border-slate-200 dark:border-slate-700">
                    {t('map_instruction')}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-[#22262e] border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-xl">
                <button onClick={() => setIsCreating(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition">{t('cancel')}</button>
                <button onClick={handleCreateSubmit} disabled={!newProjectName.trim()} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2"> <Plus className="w-4 h-4" /> {t('confirm_create')} </button>
              </div>
            </div>
          </div>
        )
      }

      {/* --- EDIT PROJECT MODAL --- */}
      {
        isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col relative max-h-[90vh]">
              <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-[#22262e] shrink-0 rounded-t-xl">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /> {t('edit_project')}
                </h3>
                <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:white transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div className="space-y-4">
                  <CustomInput
                    label={t('name')}
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    placeholder={t('new_project_placeholder')}
                    autoFocus
                  />
                </div>
                <div className="relative z-20">
                  <CustomInput
                    label={t('search_location')}
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder={t('search_location_placeholder')}
                    icon={MapPin}
                    loading={isSearchingLocation}
                  />
                  <div className="absolute top-[3px] right-0">
                    <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold normal-case flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/50">
                      <MapIcon className="w-3 h-3" /> {t('pinned_location')}: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
                    </span>
                  </div>
                  {locationResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-30 max-h-40 overflow-y-auto">
                      {locationResults.map((loc, idx) => (<button key={idx} onClick={() => selectLocationResult(loc)} className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center gap-2 transition-colors"> <MapPin className="w-3 h-3 text-emerald-500" /> <span className="truncate">{loc.name}</span> </button>))}
                    </div>
                  )}
                </div>
                <div className="h-64 w-full rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden relative z-10 bg-slate-100 dark:bg-[#1a1d23]">
                  <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={13} style={{ height: '100%', width: '100%' }} dragging={true} scrollWheelZoom={true}>
                    <MapInvalidator />
                    <LayersControl position="topright">
                      <LayersControl.BaseLayer checked name={t('map_street')}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
                      </LayersControl.BaseLayer>
                      <LayersControl.BaseLayer name={t('map_satellite')}>
                        <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                      </LayersControl.BaseLayer>
                    </LayersControl>
                    <LocationPickerMap center={mapCenter} onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} />
                  </MapContainer>
                  <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-[#1a1d23]/80 px-2 py-1 rounded text-[10px] text-slate-600 dark:text-slate-300 pointer-events-none z-[1000] border border-slate-200 dark:border-slate-700">
                    {t('map_instruction')}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-[#22262e] border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0 rounded-b-xl">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition">{t('cancel')}</button>
                <button onClick={handleEditSubmit} disabled={!editProjectName.trim()} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2"> <Save className="w-4 h-4" /> {t('save_changes')} </button>
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
              className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
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



    </div >
  );
};
