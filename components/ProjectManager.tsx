
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-[600px] max-h-[85vh] rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0">
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
    </div>
  );
};
