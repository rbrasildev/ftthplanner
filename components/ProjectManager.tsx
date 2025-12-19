
import React, { useState } from 'react';
import { Project } from '../types';
import { FileUp, FolderOpen, Trash2, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface ProjectManagerProps {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onImportKMZ: (file: File) => void;
  onClose: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onDeleteProject,
  onImportKMZ,
  onClose
}) => {
  const { t } = useLanguage();
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsImporting(true);
      await onImportKMZ(e.target.files[0]);
      setIsImporting(false);
    }
  };

  // Draggable Logic - Optimized with Refs for smoothness
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0
  });

  React.useEffect(() => {
    if (panelRef.current) {
      const initialX = (window.innerWidth - 600) / 2;
      const initialY = 80;
      panelRef.current.style.left = `${initialX}px`;
      panelRef.current.style.top = `${initialY}px`;
    }
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.isDragging || !panelRef.current) return;

      e.preventDefault();

      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      panelRef.current.style.left = `${dragRef.current.initialLeft + dx}px`;
      panelRef.current.style.top = `${dragRef.current.initialTop + dy}px`;
    };

    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    dragRef.current.isDragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;

    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current.initialLeft = rect.left;
    dragRef.current.initialTop = rect.top;

    document.body.style.userSelect = 'none';
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-full max-w-[600px] max-h-[85vh] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
      style={{ willChange: 'top, left', transition: 'none' }}
    >

      {/* Header - Draggable Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0 cursor-move select-none"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-sky-500 dark:text-sky-400" />
          {t('project_manager')}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">

        {/* Import KMZ Area */}
        <div className="mb-8 p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/30 text-center">
          <label className="cursor-pointer block">
            <div className="flex flex-col items-center gap-2 text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors">
              <FileUp className="w-8 h-8" />
              <span className="text-sm font-medium">
                {isImporting ? t('processing') : t('import_kmz_title')}
              </span>
              <span className="text-xs text-slate-500">{t('import_kmz_desc')}</span>
            </div>
            <input
              type="file"
              accept=".kmz,.kml"
              className="hidden"
              onChange={handleFileChange}
              disabled={isImporting}
            />
          </label>
        </div>

        {/* Project List */}
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{t('your_projects')}</h3>
        <div className="space-y-2">
          {projects.map(project => (
            <div
              key={project.id}
              className={`
                  flex items-center justify-between p-3 rounded-lg border transition-all
                  ${project.id === currentProjectId
                  ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-500 dark:border-sky-600 shadow-md'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}
                `}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-2 h-2 rounded-full shrink-0 ${project.id === currentProjectId ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <div className="overflow-hidden">
                  <h4 className={`text-sm font-bold truncate ${project.id === currentProjectId ? 'text-sky-700 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {project.name}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {t('items_count', { ctos: project.network.ctos.length, cables: project.network.cables.length })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {project.id !== currentProjectId && (
                  <button
                    onClick={() => onSelectProject(project.id)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-sky-600 dark:hover:bg-sky-600 text-xs font-bold text-slate-700 dark:text-white hover:text-white rounded transition"
                  >
                    {t('load_project')}
                  </button>
                )}
                <button
                  onClick={() => onDeleteProject(project.id)}
                  className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                  title={t('delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
