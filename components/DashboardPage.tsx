
import React, { useState, useEffect, useRef } from 'react';
import { Project, Coordinates } from '../types';
import { useLanguage } from '../LanguageContext';
import { Network, Plus, FolderOpen, Trash2, LogOut, Search, Map as MapIcon, Globe, Activity, AlertTriangle, Loader2, MapPin, X, Ruler } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { searchLocation } from '../services/nominatimService';

interface DashboardPageProps {
  username: string;
  projects: Project[];
  onOpenProject: (id: string) => void;
  onCreateProject: (name: string, center?: Coordinates, snapDistance?: number) => void;
  onDeleteProject: (id: string) => void;
  onLogout: () => void;
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
        map.flyTo([center.lat, center.lng], 14, { duration: 1.5 });
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

export const DashboardPage: React.FC<DashboardPageProps> = ({
  username,
  projects,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  onLogout
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // New Project State
  const [newProjectName, setNewProjectName] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<{name: string, coords: Coordinates}[]>([]);
  
  // Ref to prevent search trigger when selecting an item from the list
  const skipSearchRef = useRef(false);

  // Default Center (e.g., São Paulo or user loc)
  const [mapCenter, setMapCenter] = useState<Coordinates>({ lat: -23.5505, lng: -46.6333 });

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

  const selectLocationResult = (result: {name: string, coords: Coordinates}) => {
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300">
      
      {/* Navbar */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur sticky top-0 z-50 transition-colors">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-sky-600 rounded flex items-center justify-center">
                <Network className="text-white w-5 h-5" />
              </div>
             <h1 className="font-bold text-lg text-slate-900 dark:text-white">{t('app_title')}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              {t('welcome', { name: username })}
            </span>
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <button 
               onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
               className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
               title="Change Language"
            >
               <span className="text-xs font-bold border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5">{language.toUpperCase()}</span>
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition ml-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-sky-500 dark:text-sky-400" />
            {t('my_projects')}
          </h2>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {/* Create Button */}
            <button 
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-900/20 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> {t('create_new_project_btn')}
            </button>
          </div>
        </div>

        {/* --- CREATE PROJECT MODAL --- */}
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
                 
                 {/* Modal Header */}
                 <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0">
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                         <Plus className="w-5 h-5 text-sky-500 dark:text-sky-400" /> {t('create_project_modal_title')}
                     </h3>
                     <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-6 h-6"/></button>
                 </div>

                 {/* Modal Content */}
                 <div className="p-6 overflow-y-auto flex-1 space-y-5">
                     
                     {/* Name Input */}
                     <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('name')}</label>
                         <input 
                            type="text" 
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder={t('new_project_placeholder')}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                            autoFocus
                         />
                     </div>

                     {/* Location Search + Map Preview */}
                     <div className="space-y-2">
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex justify-between">
                             {t('search_location')}
                             <span className="text-sky-600 dark:text-sky-400 font-normal normal-case flex items-center gap-1"><MapIcon className="w-3 h-3"/> {t('pinned_location')}: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}</span>
                         </label>
                         
                         {/* Search Box */}
                         <div className="relative z-20">
                             <div className="relative w-full">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                <input 
                                    type="text" 
                                    value={locationQuery}
                                    onChange={(e) => setLocationQuery(e.target.value)}
                                    placeholder={t('search_location_placeholder')}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-10 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                                />
                                {isSearchingLocation && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                                    </div>
                                )}
                             </div>

                             {/* Search Results */}
                             {locationResults.length > 0 && (
                                 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-30 max-h-40 overflow-y-auto">
                                     {locationResults.map((loc, idx) => (
                                         <button 
                                            key={idx}
                                            onClick={() => selectLocationResult(loc)}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center gap-2"
                                         >
                                             <MapPin className="w-3 h-3 text-sky-500" />
                                             <span className="truncate">{loc.name}</span>
                                         </button>
                                     ))}
                                 </div>
                             )}
                         </div>

                         {/* Mini Map */}
                         <div className="h-64 w-full rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden relative z-10 bg-slate-100 dark:bg-slate-900">
                             <MapContainer 
                                center={[mapCenter.lat, mapCenter.lng]} 
                                zoom={13} 
                                style={{ height: '100%', width: '100%' }}
                                dragging={true}
                                scrollWheelZoom={true}
                             >
                                 <MapInvalidator />
                                 <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                                 <LocationPickerMap 
                                    center={mapCenter} 
                                    onCenterChange={(lat, lng) => setMapCenter({ lat, lng })} 
                                 />
                             </MapContainer>
                             <div className="absolute bottom-2 left-2 bg-white/90 dark:bg-slate-900/80 px-2 py-1 rounded text-[10px] text-slate-600 dark:text-slate-300 pointer-events-none z-[1000] border border-slate-200 dark:border-slate-700">
                                 {t('map_instruction')}
                             </div>
                         </div>
                     </div>

                 </div>

                 {/* Modal Footer */}
                 <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 shrink-0">
                     <button 
                        onClick={() => setIsCreating(false)} 
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition"
                     >
                         {t('cancel')}
                     </button>
                     <button 
                        onClick={handleCreateSubmit}
                        disabled={!newProjectName.trim()}
                        className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2"
                     >
                         <Plus className="w-4 h-4" /> {t('confirm_create')}
                     </button>
                 </div>
             </div>
          </div>
        )}

        {/* Project Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
             <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
               <FolderOpen className="w-8 h-8 text-slate-400 dark:text-slate-600" />
             </div>
             <p className="text-slate-500 font-medium">{t('no_projects')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => {
              // Calculate Metrics
              const totalCTOs = project.network.ctos.length;
              const deployedCTOs = project.network.ctos.filter(c => 
                c.status === 'DEPLOYED' || c.status === 'CERTIFIED'
              ).length;
              const progress = totalCTOs > 0 ? Math.round((deployedCTOs / totalCTOs) * 100) : 0;

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
                     <button 
                       onClick={(e) => handleDeleteClick(e, project)}
                       className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors relative z-20"
                       title={t('delete')}
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                    {project.name}
                  </h3>
                  
                  <p className="text-xs text-slate-500 mb-4">
                    {t('last_modified', { date: new Date(project.updatedAt).toLocaleDateString() })}
                  </p>

                  <div className="flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                     <div>
                        <span className="block font-bold text-slate-700 dark:text-slate-200">{project.network.ctos.length}</span>
                        <span className="text-slate-500 dark:text-slate-600">CTOs</span>
                     </div>
                     <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800"></div>
                     <div>
                        <span className="block font-bold text-slate-700 dark:text-slate-200">{project.network.cables.length}</span>
                        <span className="text-slate-500 dark:text-slate-600">Cables</span>
                     </div>
                  </div>

                  {/* Deployment Metric */}
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
                     <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-1 text-right font-mono">
                       {deployedCTOs} / {totalCTOs}
                     </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
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
      )}

    </div>
  );
};
