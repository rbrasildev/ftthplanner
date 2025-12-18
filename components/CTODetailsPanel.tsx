
import React, { useState, useEffect, useMemo } from 'react';
import { CTOData, CTOStatus, CTO_STATUS_COLORS } from '../types';
import { Settings2, Trash2, Activity, MapPin, Box, Type, X, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface CTODetailsPanelProps {
  cto: CTOData;
  onRename: (id: string, newName: string) => void;
  onUpdateStatus: (status: CTOStatus) => void;
  onOpenSplicing: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const CTODetailsPanel: React.FC<CTODetailsPanelProps> = ({
  cto,
  onRename,
  onUpdateStatus,
  onOpenSplicing,
  onDelete,
  onClose
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState(cto.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(cto.name);
  }, [cto.id, cto.name]);

  const handleNameBlur = () => {
    if (name !== cto.name) {
      onRename(cto.id, name);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete(cto.id);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowDeleteConfirm(false);
  };

  // Calculate accurate fusion count (Real Fusions vs Pass-throughs)
  const fusionCount = useMemo(() => {
      // 1. Count explicit fusion protector elements
      const explicitFusions = cto.fusions.length;
      
      // 2. Count direct connections to Splitter Inputs (Implicit Splices)
      // We exclude those coming from a Fusion Node to avoid double counting.
      const splitterInputIds = new Set(cto.splitters.map(s => s.inputPortId));
      
      const implicitSplitterSplices = cto.connections.filter(c => {
          const isSourceSplitterIn = splitterInputIds.has(c.sourceId);
          const isTargetSplitterIn = splitterInputIds.has(c.targetId);
          
          if (!isSourceSplitterIn && !isTargetSplitterIn) return false;
          
          // Check if connected to a fusion point (which is already counted as explicit)
          const otherId = isSourceSplitterIn ? c.targetId : c.sourceId;
          if (otherId.includes('fus-')) return false;
          
          return true;
      }).length;

      return explicitFusions + implicitSplitterSplices;
  }, [cto]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-[400px] rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            {t('edit_cto')}
          </h2>
          <div className="flex items-center gap-3">
             <div 
               className="w-3 h-3 rounded-full shadow-sm"
               style={{ backgroundColor: CTO_STATUS_COLORS[cto.status || 'PLANNED'] }} 
               title={t(`status_${cto.status}`)}
             />
             <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
                <X className="w-6 h-6" />
             </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          
          {/* Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
               <Type className="w-3 h-3" /> {t('name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
              placeholder="CTO Name"
              autoFocus
            />
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3" /> {t('status')}
            </label>
            <select
              value={cto.status || 'PLANNED'}
              onChange={(e) => onUpdateStatus(e.target.value as CTOStatus)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors cursor-pointer"
            >
              <option value="PLANNED">{t('status_PLANNED')}</option>
              <option value="NOT_DEPLOYED">{t('status_NOT_DEPLOYED')}</option>
              <option value="DEPLOYED">{t('status_DEPLOYED')}</option>
              <option value="CERTIFIED">{t('status_CERTIFIED')}</option>
            </select>
          </div>

          {/* Info Grid */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('inputs')}</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">{(cto.inputCableIds || []).length} Cable(s)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('connections')}</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">{fusionCount} {t('spliced')}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('splitters')}</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">{(cto.splitters || []).length} Unit(s)</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-start gap-2">
                  <MapPin className="w-3 h-3 text-slate-400 mt-0.5" />
                  <span className="text-[10px] text-slate-500 font-mono leading-tight">
                      {cto.coordinates.lat.toFixed(5)}, <br/> {cto.coordinates.lng.toFixed(5)}
                  </span>
              </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button 
              onClick={onOpenSplicing}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/10 dark:shadow-emerald-900/20"
            >
              <Settings2 className="w-4 h-4" />
              {t('manage_splicing')}
            </button>

            {showDeleteConfirm ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <p className="text-xs font-medium leading-tight">
                          {t('confirm_delete_cto_msg', { name: cto.name })}
                      </p>
                  </div>
                  <div className="flex gap-2">
                      <button 
                          onClick={handleCancelDelete}
                          className="flex-1 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium transition"
                      >
                          {t('cancel')}
                      </button>
                      <button 
                          onClick={handleConfirmDelete}
                          className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-bold transition shadow-lg shadow-red-900/20"
                      >
                          {t('confirm_delete')}
                      </button>
                  </div>
              </div>
            ) : (
              <button 
                type="button"
                onClick={handleDeleteClick}
                className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center justify-center gap-2 transition text-sm font-medium cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {t('delete_cto_btn')}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
