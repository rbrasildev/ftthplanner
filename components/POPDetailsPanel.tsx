import React, { useState, useEffect } from 'react';
import { POPData, CTOStatus, CTO_STATUS_COLORS, PoleData, CTOData } from '../types';
import { Settings2, Trash2, Activity, MapPin, Building2, Type, X, AlertTriangle, Palette, Scaling, Loader2, Edit2, Check, Settings, Info, Share2, Plus, Unlink, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { calculateDistance } from '../utils/geometryUtils';
import { CustomInput } from './common/CustomInput';
import { CustomSelect } from './common/CustomSelect';

interface POPDetailsPanelProps {
  pop: POPData;
  poles: PoleData[];
  onRename: (id: string, newName: string) => void;
  onUpdateStatus: (status: CTOStatus) => void;
  onUpdate: (id: string, updates: Partial<POPData>) => void;
  onOpenRack: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const POPDetailsPanel: React.FC<POPDetailsPanelProps> = ({
  pop,
  poles,
  onRename,
  onUpdateStatus,
  onUpdate,
  onOpenRack,
  onDelete,
  onClose
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState(pop.name);
  const [status, setStatus] = useState<CTOStatus>(pop.status || 'PLANNED');
  const [poleId, setPoleId] = useState(pop.poleId || '');
  const [color, setColor] = useState(pop.color || '#6366f1');
  const [size, setSize] = useState(pop.size || 24);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setName(pop.name);
    setStatus(pop.status || 'PLANNED');
    setPoleId(pop.poleId || '');
    setColor(pop.color || '#6366f1');
    setSize(pop.size || 24);
  }, [pop.id, pop.name, pop.status, pop.poleId, pop.color, pop.size]);

  const handleSave = async () => {
    setIsSavingLocal(true);
    try {
      const updates: Partial<POPData> = {};
      if (name !== pop.name) updates.name = name;
      if (status !== pop.status) updates.status = status;
      if (poleId !== pop.poleId) updates.poleId = poleId || undefined;
      if (color !== pop.color) updates.color = color;
      if (size !== pop.size) updates.size = size;

      if (Object.keys(updates).length > 0) {
        await onUpdate(pop.id, updates);
        if (name !== pop.name) onRename(pop.id, name);
        if (status !== pop.status) onUpdateStatus(status);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save POP properties', error);
    } finally {
      setIsSavingLocal(false);
    }
  };

  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0
  });

  useEffect(() => {
    if (panelRef.current) {
      const width = 400;
      const height = panelRef.current.offsetHeight || 600;
      const initialX = (window.innerWidth - width) / 2;
      const initialY = Math.max(50, (window.innerHeight - height) / 2);
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
      <div
        onMouseDown={handleMouseDown}
        className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0 cursor-move select-none"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          {t('edit_pop')}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
            title={isCollapsed ? t('expand') : t('collapse')}
          >
            {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          <CustomInput
            label={t('name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={Type}
            placeholder="POP Name"
            autoFocus
          />

          <CustomSelect
            label={t('status')}
            value={status}
            onChange={(val) => setStatus(val as CTOStatus)}
            options={[
              { value: 'PLANNED', label: t('status_PLANNED') },
              { value: 'NOT_DEPLOYED', label: t('status_NOT_DEPLOYED') },
              { value: 'DEPLOYED', label: t('status_DEPLOYED') },
              { value: 'CERTIFIED', label: t('status_CERTIFIED') },
            ]}
            showSearch={false}
          />

          <div>
            <CustomSelect
              label={t('linked_pole') || 'Poste Vinculado'}
              value={poleId}
              onChange={(val) => setPoleId(val)}
              options={[
                { value: '', label: t('unlinked') || 'Sem vínculo' },
                ...poles.map(p => ({ value: p.id, label: p.name }))
              ]}
            />
            <button
              onClick={() => {
                let nearest = null;
                let minDist = Infinity;
                poles.forEach(p => {
                  const d = calculateDistance(pop.coordinates, p.coordinates);
                  if (d < minDist) {
                    minDist = d;
                    nearest = p;
                  }
                });
                if (nearest && minDist < 20) {
                  setPoleId((nearest as any).id);
                }
              }}
              title={t('link_to_nearest_pole') || 'Vincular ao poste próximo'}
              className="mt-2 w-full py-2 bg-slate-50 dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-center gap-2 text-xs font-bold"
            >
              <Activity className="w-4 h-4" />
              {t('link_to_nearest_pole')}
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
              <Palette className="w-3 h-3" /> Visualização
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Cor do Ícone</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                    title="Escolher Cor"
                  />
                  <span className="text-xs font-mono text-slate-500">{color}</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block flex items-center gap-1"><Scaling className="w-3 h-3" /> Tamanho ({size}px)</label>
                <input
                  type="range"
                  min="16"
                  max="64"
                  step="4"
                  value={size}
                  onChange={(e) => setSize(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

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

          <div className="p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 shrink-0 flex gap-3">
            <button
              onClick={onOpenRack}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              <Settings2 className="w-4 h-4" />
              {t('manage_pop')}
            </button>

            <button
              onClick={handleSave}
              disabled={isSavingLocal}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/10 dark:shadow-emerald-900/20"
            >
              {isSavingLocal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              {t('apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
