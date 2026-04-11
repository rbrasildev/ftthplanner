
import React, { useState, useMemo, useEffect } from 'react';
import { CableData, CableStatus, CableReserve } from '../types';
import { X, Save, Trash2, Cable, Palette, Activity, Ruler, AlertTriangle, Layers, BookOpen, Loader2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import L from 'leaflet';
import { useLanguage } from '../LanguageContext';
import { getCables, CableCatalogItem } from '../services/catalogService';
import { CustomInput } from './common/CustomInput';
import { CustomSelect } from './common/CustomSelect';

interface CableEditorProps {
  cable: CableData;
  onClose: () => void;
  onSave: (updatedCable: CableData) => void;
  onDelete: (cableId: string) => void;
  userRole?: string | null;
}

const FIBER_COUNTS = [1, 2, 4, 6, 12, 24, 36, 48, 72, 96, 144, 288];

// Palette for Map Visualization (based on Standard Fiber Colors 1-12)
const CABLE_MAP_COLORS = [
  '#0ea5e9', // 1. Blue
  '#f97316', // 2. Orange
  '#10b981', // 3. Green
  '#a97142', // 4. Brown (approx)
  '#64748b', // 5. Slate (Grey)
  '#ffffff', // 6. White
  '#ef4444', // 7. Red
  '#000000', // 8. Black
  '#eab308', // 9. Yellow
  '#8b5cf6', // 10. Violet
  '#ec4899', // 11. Pink
  '#06b6d4', // 12. Aqua
];

export const CableEditor: React.FC<CableEditorProps> = ({ cable, onClose, onSave, onDelete, userRole }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<CableData>({
    ...cable,
    status: cable.status || 'DEPLOYED', // Default fallback
    looseTubeCount: cable.looseTubeCount || 1, // Default to 1 loose tube if undefined
    technicalReserve: cable.technicalReserve || 0
  });

  const [catalogCables, setCatalogCables] = useState<CableCatalogItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(cable.catalogId || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  useEffect(() => {
    // Load catalog cables
    setIsLoadingCatalog(true);
    getCables()
      .then(data => setCatalogCables(data))
      .catch(err => console.error(err))
      .finally(() => setIsLoadingCatalog(false));
  }, []);

  const handleCatalogSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catalogId = e.target.value;
    setSelectedCatalogId(catalogId);

    const selected = catalogCables.find(c => c.id === catalogId);
    if (selected) {
      // Map catalog properties to cable data
      setFormData(prev => ({
        ...prev,
        catalogId: catalogId,
        name: selected.name,
        fiberCount: selected.fiberCount,
        looseTubeCount: selected.looseTubeCount,
        color: selected.deployedSpec?.color || prev.color,
        colorStandard: (selected.fiberProfile === 'EIA' ? 'EIA598' : 'ABNT') as any,
        width: (prev.status === 'DEPLOYED' ? selected.deployedSpec?.width : selected.plannedSpec?.width) || 3,
      }));
    } else {
      // If cleared/reset (though option value="" usually handles this if we add logic)
      setFormData(prev => ({ ...prev, catalogId: undefined }));
    }
  };

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
      const width = 520; // Matches w-[520px]
      const height = panelRef.current.offsetHeight || 600;
      const initialX = (window.innerWidth - width) / 2;
      const initialY = Math.max(50, (window.innerHeight - height) / 2);
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
      className={`fixed z-[2000] w-[520px] bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden ${isCollapsed ? 'h-auto' : 'h-auto max-h-[90vh]'}`}
      style={{ willChange: 'top, left', transition: 'none' }}
    >

      {/* Header - Draggable Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-[#22262e] shrink-0 cursor-move select-none"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Cable className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          {t('edit_cable')}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? t('expand') : t('collapse')}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
          >
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* Catalog Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> {t('use_catalog_model')}
              </label>

              {isLoadingCatalog ? (
                <div className="w-full flex items-center justify-center gap-2 py-2 text-slate-600 dark:text-slate-400 text-xs font-medium bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg opacity-70 cursor-wait">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('loading_catalog')}</span>
                </div>
              ) : (
                <CustomSelect
                  value={selectedCatalogId}
                  onChange={(val) => {
                    const syntheticEvent = { target: { value: val } } as React.ChangeEvent<HTMLSelectElement>;
                    handleCatalogSelect(syntheticEvent);
                  }}
                  disabled={userRole === 'MEMBER'}
                  options={[
                    { value: '', label: t('select_model') },
                    ...catalogCables.map(c => ({ value: c.id, label: `${c.name} (${c.fiberCount}FO)` }))
                  ]}
                  showSearch
                />
              )}
            </div>

            <CustomInput
              label={t('cable_name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={userRole === 'MEMBER'}
            />

            {/* Technical Specs Grid */}
            <div className="grid grid-cols-2 gap-3">
              <CustomInput
                label={t('fiber_count')}
                value={selectedCatalogId ? `${formData.fiberCount} FO` : '-'}
                onChange={() => { }}
                disabled
              />

              <CustomInput
                label={t('loose_tubes')}
                value={selectedCatalogId ? String(formData.looseTubeCount) : '-'}
                onChange={() => { }}
                disabled
              />

              <CustomInput
                label={t('fibers_per_tube')}
                value={selectedCatalogId && formData.fiberCount && formData.looseTubeCount
                  ? String(Math.ceil(formData.fiberCount / (formData.looseTubeCount || 1)))
                  : '-'}
                onChange={() => { }}
                disabled
              />

              <CustomInput
                label={t('cable_thickness')}
                value={(() => {
                  const cat = catalogCables.find(c => c.id === selectedCatalogId);
                  if (!cat) return '-';
                  const w = formData.status === 'DEPLOYED' ? cat.deployedSpec?.width : cat.plannedSpec?.width;
                  return w ? String(w) : '-';
                })()}
                onChange={() => { }}
                disabled
              />
            </div>

            <CustomSelect
              label={t('status')}
              value={formData.status}
              onChange={(val) => setFormData({ ...formData, status: val as CableStatus })}
              disabled={userRole === 'MEMBER'}
              options={[
                { value: 'NOT_DEPLOYED', label: t('status_NOT_DEPLOYED') },
                { value: 'DEPLOYED', label: t('status_DEPLOYED') },
              ]}
              showSearch={false}
            />

            {/* Multiple Technical Reserves */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center justify-between">
                <span>{t('technical_reserve')}</span>
                {userRole !== 'MEMBER' && (
                  <button
                    type="button"
                    onClick={() => {
                      const newReserve: CableReserve = {
                        id: `res-${Date.now()}`,
                        length: 0,
                        showLabel: true,
                      };
                      setFormData({
                        ...formData,
                        reserves: [...(formData.reserves || []), newReserve],
                        technicalReserve: ((formData.technicalReserve || 0) + 0),
                      });
                    }}
                    className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-semibold"
                  >
                    <Plus className="w-3 h-3" /> {t('button_add') || 'Adicionar'}
                  </button>
                )}
              </label>
              {(formData.reserves || []).length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">{t('no_reserves') || 'Nenhuma reserva técnica'}</p>
              )}
              <div className="space-y-2">
                {(formData.reserves || []).map((reserve, idx) => (
                  <div key={reserve.id} className="flex items-center gap-2 bg-slate-50 dark:bg-[#22262e] rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <span className="text-xs font-bold text-slate-400 w-5">#{idx + 1}</span>
                    <input
                      type="number"
                      value={reserve.length}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const updated = (formData.reserves || []).map(r =>
                          r.id === reserve.id ? { ...r, length: val } : r
                        );
                        const totalReserve = updated.reduce((sum, r) => sum + r.length, 0);
                        setFormData({ ...formData, reserves: updated, technicalReserve: totalReserve });
                      }}
                      disabled={userRole === 'MEMBER'}
                      className="flex-1 w-0 px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1d23] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                      placeholder="metros"
                    />
                    <span className="text-xs text-slate-400">m</span>
                    {userRole !== 'MEMBER' && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (formData.reserves || []).filter(r => r.id !== reserve.id);
                          const totalReserve = updated.reduce((sum, r) => sum + r.length, 0);
                          setFormData({ ...formData, reserves: updated, technicalReserve: totalReserve });
                        }}
                        className="p-1 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Color Standard Selection - Display Only */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
                {t('fiber_color_standard')}
              </label>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#22262e] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span>{formData.colorStandard === 'EIA598' ? t('standard_eia') : t('standard_abnt')}</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">{t('catalog_defined')}</span>
              </div>

              {/* Small Preview of first 12 fibers */}
              <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                {(formData.colorStandard === 'EIA598' ?
                  ['#3b82f6', '#f97316', '#22c55e', '#78350f', '#9ca3af', '#ffffff', '#ef4444', '#000000', '#eab308', '#a855f7', '#ec4899', '#22d3ee']
                  :
                  ['#22c55e', '#eab308', '#ffffff', '#3b82f6', '#ef4444', '#a855f7', '#78350f', '#ec4899', '#000000', '#9ca3af', '#f97316', '#22d3ee']
                ).map((c, i) => (
                  <div key={i} title={t('unit_fiber_label', { n: i + 1 })} className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-700 shrink-0" style={{ backgroundColor: c }} />
                ))}
                <span className="text-[9px] text-slate-400 ml-1">...</span>
              </div>
            </div>

            {/* Length Display */}
            <div className="bg-slate-50 dark:bg-[#22262e]/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Ruler className="w-3 h-3" /> {t('estimated_length')} (Total)
              </label>
              <div className="text-slate-900 dark:text-white font-mono text-sm space-y-1">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700/50 pb-1">
                  <span className="text-[10px] text-slate-400">{t('geometric_length')}:</span>
                  <span>{Math.round(calculatedLength).toLocaleString()} m</span>
                </div>
                {(formData.reserves || []).map((r: any, i: number) => (
                  <div key={r.id} className="flex justify-between border-b border-slate-200 dark:border-slate-700/50 pb-1">
                    <span className="text-[10px] text-slate-400">{t('technical_reserve')} #{i + 1}:</span>
                    <span>{r.length?.toLocaleString()} m</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="text-[10px] uppercase">Total:</span>
                  <span>{(Math.round(calculatedLength) + (formData.reserves || []).reduce((s: number, r: any) => s + (r.length || 0), 0)).toLocaleString()} m</span>
                </div>
                <div className="text-right text-[10px] text-slate-500 mt-1">
                  ({((Math.round(calculatedLength) + (formData.technicalReserve || 0)) / 1000).toFixed(3)} km)
                </div>
              </div>
            </div>

            {/* Color Picker — overrides the catalog-defined color for this cable on the map. */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                <Palette className="w-3 h-3" /> {t('map_color')}
              </label>
              <div className="bg-slate-50 dark:bg-[#22262e] p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-6 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 shrink-0"
                    style={{ backgroundColor: formData.color }}
                  />
                  <input
                    type="color"
                    value={(formData.color || '#0ea5e9').substring(0, 7)}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-300 dark:border-slate-600"
                    title={t('pick_custom_color') || 'Escolher cor'}
                  />
                  <CustomInput
                    value={(formData.color || '').toUpperCase()}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      // Accept partial input; only commit when it looks like a valid hex.
                      if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                        setFormData(prev => ({ ...prev, color: v.startsWith('#') ? v : `#${v}` }));
                      }
                    }}
                    placeholder="#0EA5E9"
                    className="flex-1 font-mono text-xs uppercase"
                  />
                  {/* Inline thickness editor — affects the polyline weight on the map. */}
                  <div className="flex items-center gap-1 shrink-0" title={t('cable_thickness')}>
                    <Ruler className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      value={formData.width ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setFormData(prev => ({ ...prev, width: undefined as any }));
                          return;
                        }
                        const n = parseInt(raw, 10);
                        if (!isNaN(n)) setFormData(prev => ({ ...prev, width: Math.max(1, Math.min(20, n)) }));
                      }}
                      className="w-14 h-8 px-2 text-xs text-center font-mono bg-white dark:bg-[#151820] border border-slate-300 dark:border-slate-600 rounded focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CABLE_MAP_COLORS.map(c => {
                    const isActive = (formData.color || '').toLowerCase() === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color: c }))}
                        title={c}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          isActive
                            ? 'border-emerald-500 scale-110 shadow-md'
                            : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          <div className="p-4 bg-white/95 dark:bg-[#1a1d23]/95 backdrop-blur border-t border-slate-200 dark:border-slate-700/30 shrink-0">
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
                    className="flex-1 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium transition"
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
                {userRole !== 'MEMBER' && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2 transition cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" /> {t('delete')}
                  </button>
                )}

                <button
                  type={userRole === 'MEMBER' ? 'button' : 'submit'}
                  onClick={userRole === 'MEMBER' ? onClose : undefined}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center justify-center gap-2 font-bold transition shadow-lg shadow-emerald-900/20 active:scale-95"
                >
                  {userRole === 'MEMBER' ? (
                    <>
                      <X className="w-4 h-4" /> {t('done') || 'Sair'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> {t('save_changes')}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

        </form>
      )}
    </div>
  );
};
