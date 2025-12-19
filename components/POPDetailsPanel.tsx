
import React, { useState, useEffect } from 'react';
import { POPData, CTOStatus, CTO_STATUS_COLORS } from '../types';
import { Settings2, Trash2, Activity, MapPin, Server, Type, X, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface POPDetailsPanelProps {
  pop: POPData;
  onRename: (id: string, newName: string) => void;
  onUpdateStatus: (status: CTOStatus) => void;
  onOpenRack: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const POPDetailsPanel: React.FC<POPDetailsPanelProps> = ({
  pop,
  onRename,
  onUpdateStatus,
  onOpenRack,
  onDelete,
  onClose
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState(pop.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(pop.name);
  }, [pop.id, pop.name]);

  const handleNameBlur = () => {
    if (name !== pop.name) {
      onRename(pop.id, name);
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
    onDelete(pop.id);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowDeleteConfirm(false);
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

  // Set initial position
  useEffect(() => {
    if (panelRef.current) {
      const initialX = window.innerWidth - 450;
      const initialY = 100;
      panelRef.current.style.left = `${initialX}px`;
      panelRef.current.style.top = `${initialY}px`;
    }
  }, []);

  useEffect(() => {
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
      className="fixed z-[2000] w-[400px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden h-auto max-h-[80vh]"
      style={{ willChange: 'top, left', transition: 'none' }}
    >

      {/* Header - Draggable Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0 cursor-move select-none"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          {t('edit_pop')}
        </h2>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full shadow-sm"
            style={{ backgroundColor: CTO_STATUS_COLORS[pop.status || 'PLANNED'] }}
            title={t(`status_${pop.status}`)}
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
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="POP Name"
            autoFocus
          />
        </div>

        {/* Status Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3" /> {t('status')}
          </label>
          <select
            value={pop.status || 'PLANNED'}
            onChange={(e) => onUpdateStatus(e.target.value as CTOStatus)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
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
            <span className="text-slate-500">{t('backbone_cables')}</span>
            <span className="text-slate-700 dark:text-slate-300 font-mono">{(pop.inputCableIds || []).length}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">OLTs</span>
            <span className="text-slate-700 dark:text-slate-300 font-mono">{(pop.olts || []).length} Unit(s)</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">DIOs</span>
            <span className="text-slate-700 dark:text-slate-300 font-mono">{(pop.dios || []).length} Unit(s)</span>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-start gap-2">
            <MapPin className="w-3 h-3 text-slate-400 mt-0.5" />
            <span className="text-[10px] text-slate-500 font-mono leading-tight">
              {pop.coordinates.lat.toFixed(5)}, <br /> {pop.coordinates.lng.toFixed(5)}
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <button
            onClick={onOpenRack}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-900/10 dark:shadow-indigo-900/20"
          >
            <Settings2 className="w-4 h-4" />
            {t('manage_pop')}
          </button>

          {showDeleteConfirm ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-medium leading-tight">
                  {t('confirm_delete_pop_msg', { name: pop.name })}
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
              {t('delete_pop_btn')}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
