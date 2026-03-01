
import React, { useState, useEffect, useMemo } from 'react';
import { CTOData, CTOStatus, CTO_STATUS_COLORS, PoleData } from '../types';
import { Settings2, Trash2, Activity, MapPin, Box, Type, X, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getBoxes, BoxCatalogItem } from '../services/catalogService';
import { calculateDistance } from '../utils/geometryUtils';
import { CustomInput } from './common/CustomInput';
import { CustomSelect } from './common/CustomSelect';

interface CTODetailsPanelProps {
  cto: CTOData;
  poles: PoleData[];
  onRename: (id: string, newName: string) => void;
  onUpdateStatus: (status: CTOStatus) => void;
  onUpdate: (updates: Partial<CTOData>) => void;
  onOpenSplicing: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const CTODetailsPanel: React.FC<CTODetailsPanelProps> = ({
  cto,
  poles,
  onRename,
  onUpdateStatus,
  onUpdate,
  onOpenSplicing,
  onDelete,
  onClose
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState(cto.name);
  const [status, setStatus] = useState<CTOStatus>(cto.status || 'PLANNED');
  const [catalogId, setCatalogId] = useState(cto.catalogId || '');
  const [poleId, setPoleId] = useState(cto.poleId || '');
  const [availableBoxes, setAvailableBoxes] = useState<BoxCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setName(cto.name);
    setStatus(cto.status || 'PLANNED');
    setCatalogId(cto.catalogId || '');
    setPoleId(cto.poleId || '');
  }, [cto.id, cto.name, cto.status, cto.catalogId, cto.poleId]);

  useEffect(() => {
    setIsLoading(true);
    getBoxes()
      .then(setAvailableBoxes)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    setIsSavingLocal(true);
    try {
      const updates: Partial<CTOData> = {};
      if (name !== cto.name) updates.name = name;
      if (status !== cto.status) updates.status = status;
      if (catalogId !== cto.catalogId) {
        updates.catalogId = catalogId || undefined;
        const box = availableBoxes.find(b => b.id === catalogId);
        if (box) {
          updates.type = box.type as any;
          updates.color = box.color;
          updates.reserveLoopLength = box.reserveLoopLength;
        }
      }
      if (poleId !== cto.poleId) updates.poleId = poleId || undefined;

      if (Object.keys(updates).length > 0) {
        await onUpdate(updates);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save CTO properties', error);
    } finally {
      setIsSavingLocal(false);
    }
  };

  // Calculate accurate fusion count
  const fusionCount = useMemo(() => {
    const explicitFusions = cto.fusions.length;
    const splitterInputIds = new Set(cto.splitters.map(s => s.inputPortId));
    const implicitSplitterSplices = cto.connections.filter(c => {
      const isSourceSplitterIn = splitterInputIds.has(c.sourceId);
      const isTargetSplitterIn = splitterInputIds.has(c.targetId);
      if (!isSourceSplitterIn && !isTargetSplitterIn) return false;
      const otherId = isSourceSplitterIn ? c.targetId : c.sourceId;
      if (otherId.includes('fus-')) return false;
      return true;
    }).length;
    return explicitFusions + implicitSplitterSplices;
  }, [cto]);

  // Draggable Logic
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
      const height = panelRef.current.offsetHeight || 500;
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
      className="fixed z-[2000] w-[400px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden h-auto max-h-[90vh]"
      style={{ willChange: 'top, left', transition: 'none' }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-slate-800 shrink-0 cursor-move select-none"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Box className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          {t('edit_cto')}
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
        <>
          <div className="p-6 space-y-5 flex-1 overflow-y-auto min-h-0">
            <CustomInput
              label={t('name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={Type}
              placeholder="CTO Name"
              autoFocus
            />

            <div>
              {isLoading ? (
                <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-2 text-slate-500 dark:text-slate-400 h-[46px]">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span className="text-sm">{t('loading') || 'Carregando...'}</span>
                </div>
              ) : (
                <CustomSelect
                  label={t('box_model') || 'Modelo de Caixa'}
                  value={catalogId}
                  onChange={(selectedId) => setCatalogId(selectedId)}
                  options={[
                    { value: '', label: t('select_box_model') || 'Selecione Modelo...' },
                    ...availableBoxes.map(box => ({
                      value: box.id,
                      label: box.name,
                      sublabel: box.type
                    }))
                  ]}
                  placeholder={t('select_box_model') || 'Selecione Modelo...'}
                />
              )}
            </div>

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
                    const d = calculateDistance(cto.coordinates, p.coordinates);
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
                {t('link_to_nearest_pole') || 'Vincular ao poste próximo'}
              </button>
            </div>

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
                  {cto.coordinates.lat.toFixed(5)}, <br /> {cto.coordinates.lng.toFixed(5)}
                </span>
              </div>
            </div>

          </div>

          <div className="p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 shrink-0 flex gap-3">
            <button
              onClick={onOpenSplicing}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              <Settings2 className="w-4 h-4" />
              {t('manage_splicing')}
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
        </>
      )}
    </div>
  );
};
