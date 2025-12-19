
import React, { useState, useMemo } from 'react';
import { CableData, CableStatus } from '../types';
import { X, Save, Trash2, Cable, Palette, Activity, Ruler, AlertTriangle, Layers } from 'lucide-react';
import L from 'leaflet';
import { useLanguage } from '../LanguageContext';

interface CableEditorProps {
  cable: CableData;
  onClose: () => void;
  onSave: (updatedCable: CableData) => void;
  onDelete: (cableId: string) => void;
}

const FIBER_COUNTS = [1, 2, 4, 6, 12, 24, 36, 48, 72, 96, 144, 288];

// Palette for Map Visualization (distinct from fiber colors)
const CABLE_MAP_COLORS = [
  '#0ea5e9', // Default Blue
  '#ef4444', // Red
  '#f59e0b', // Orange
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b', // Slate
  '#000000', // Black
];

export const CableEditor: React.FC<CableEditorProps> = ({ cable, onClose, onSave, onDelete }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<CableData>({
    ...cable,
    status: cable.status || 'DEPLOYED', // Default fallback
    looseTubeCount: cable.looseTubeCount || 1 // Default to 1 loose tube if undefined
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Calculate length in meters based on coordinates using Leaflet's distanceTo
  const calculatedLength = useMemo(() => {
    if (!cable.coordinates || cable.coordinates.length < 2) return 0;
    let totalMeters = 0;
    for (let i = 0; i < cable.coordinates.length - 1; i++) {
      const p1 = L.latLng(cable.coordinates[i].lat, cable.coordinates[i].lng);
      const p2 = L.latLng(cable.coordinates[i + 1].lat, cable.coordinates[i + 1].lng);
      totalMeters += p1.distanceTo(p2);
    }
    return totalMeters;
  }, [cable.coordinates]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(cable.id);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  React.useEffect(() => {
    if (panelRef.current) {
      const initialX = window.innerWidth - 470;
      const initialY = 100;
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
      className="fixed z-[2000] w-[420px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden h-auto max-h-[80vh]"
      style={{ willChange: 'top, left', transition: 'none' }}
    >

      {/* Header - Draggable Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0 cursor-move select-none"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Cable className="w-5 h-5 text-sky-500 dark:text-sky-400" />
          {t('edit_cable')}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('cable_name')}</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
            placeholder="e.g. Backbone Route A"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('fiber_count')}</label>
            <select
              value={formData.fiberCount}
              onChange={(e) => setFormData({ ...formData, fiberCount: Number(e.target.value) })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              {FIBER_COUNTS.map(count => (
                <option key={count} value={count}>{count} FO</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> {t('loose_tubes')}
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={formData.looseTubeCount}
              onChange={(e) => setFormData({ ...formData, looseTubeCount: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3" /> {t('status')}
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as CableStatus })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="NOT_DEPLOYED">{t('status_NOT_DEPLOYED')}</option>
              <option value="DEPLOYED">{t('status_DEPLOYED')}</option>
            </select>
          </div>
        </div>

        {/* Length Display */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
            <Ruler className="w-3 h-3" /> {t('estimated_length')}
          </label>
          <div className="text-slate-900 dark:text-white font-mono text-sm">
            {Math.round(calculatedLength).toLocaleString()} m
            <span className="text-slate-500 ml-2 text-xs">
              ({(calculatedLength / 1000).toFixed(3)} km)
            </span>
          </div>
        </div>

        {/* Color Picker - Only enabled if DEPLOYED */}
        <div className={`transition-opacity ${formData.status === 'NOT_DEPLOYED' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
            <Palette className="w-3 h-3" /> {t('map_color')} {formData.status === 'NOT_DEPLOYED' && `(${t('disabled')})`}
          </label>
          <div className="flex flex-wrap gap-2">
            {CABLE_MAP_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData({ ...formData, color })}
                className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color ? 'border-white dark:border-slate-100 scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="pt-4">
          {showDeleteConfirm ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-medium leading-tight">
                  {t('confirm_delete_cable_msg', { name: cable.name })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  className="flex-1 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-bold transition shadow-lg shadow-red-900/20"
                >
                  {t('confirm_delete')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleDeleteClick}
                className="px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2 transition cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" /> {t('delete')}
              </button>

              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center justify-center gap-2 font-bold transition shadow-lg shadow-sky-900/20 active:scale-95"
              >
                <Save className="w-4 h-4" /> {t('save_changes')}
              </button>
            </div>
          )}
        </div>

      </form>
    </div>
  );
};
