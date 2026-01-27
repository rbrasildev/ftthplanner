
import React from 'react';
import { Project } from '../types';
import { FolderOpen, X, Trash2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface ProjectManagerProps {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onImportKMZ: (file: File) => void; // Keep for interface compatibility but won't use
  onClose: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onDeleteProject,
  onClose
}) => {
  const { t } = useLanguage();

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
      className="fixed z-50 w-full max-w-[500px] max-h-[85vh] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
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
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">{t('your_projects')}</h3>

        <div className="space-y-3">
          {projects.map(project => {
            const isActive = project.id === currentProjectId;
            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer
                  ${isActive
                    ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-500 dark:border-sky-600 shadow-md ring-1 ring-sky-500/20'
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-sm'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-sky-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <div className="overflow-hidden">
                    <h4 className={`text-sm font-bold truncate ${isActive ? 'text-sky-700 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                      {project.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {t('items_count', { ctos: project.network?.ctos?.length || 0, cables: project.network?.cables?.length || 0 })}
                    </p>
                  </div>
                </div>

                {!isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t('confirm_delete_project') || 'Deletar projeto?')) {
                        onDeleteProject(project.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {isActive && (
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">{t('active') || 'Ativo'}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
