
import React, { useState, useEffect, useMemo } from 'react';
import { CTOData, CTOStatus, CTO_STATUS_COLORS, PoleData, BuildingConfig, Splitter, ElementLayout, Customer } from '../types';
import { Settings2, Trash2, Activity, MapPin, Type, X, AlertTriangle, ChevronDown, ChevronUp, Loader2, Building2, Wand2, Users, Pencil } from 'lucide-react';
import { CTOIcon, CEOIcon } from './icons/TelecomIcons';
import { useLanguage } from '../LanguageContext';
import { getBoxes, BoxCatalogItem } from '../services/catalogService';
import { calculateDistance } from '../utils/geometryUtils';
import { CustomInput } from './common/CustomInput';
import { CustomSelect } from './common/CustomSelect';

interface CTODetailsPanelProps {
  cto: CTOData;
  poles: PoleData[];
  customers?: Customer[];
  onRename: (id: string, newName: string) => void;
  onUpdateStatus: (status: CTOStatus) => void;
  onUpdate: (updates: Partial<CTOData>) => void;
  onOpenSplicing: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onEditCustomer?: (customer: Customer) => void;
}

export const CTODetailsPanel: React.FC<CTODetailsPanelProps> = ({
  cto,
  poles,
  customers = [],
  onRename,
  onUpdateStatus,
  onUpdate,
  onOpenSplicing,
  onDelete,
  onClose,
  onEditCustomer
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
  // Whether this CTO is a vertical condo is now intrinsic to the entity
  // (created via the toolbar's Condomínio button). The properties panel only
  // exposes EDITING of an existing condo's floors/units — never converts a
  // regular CTO into one. To create a condo, use the toolbar.
  const isVerticalCondo = !!cto.building;
  const [buildingFloors, setBuildingFloors] = useState<string>(cto.building?.floors ? String(cto.building.floors) : '');
  const [buildingUnitsPerFloor, setBuildingUnitsPerFloor] = useState<string>(cto.building?.unitsPerFloor ? String(cto.building.unitsPerFloor) : '');
  const [floorSplitterPolish, setFloorSplitterPolish] = useState<'APC' | 'UPC'>('UPC');
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  useEffect(() => {
    setName(cto.name);
    setStatus(cto.status || 'PLANNED');
    setCatalogId(cto.catalogId || '');
    setPoleId(cto.poleId || '');
    setBuildingFloors(cto.building?.floors ? String(cto.building.floors) : '');
    setBuildingUnitsPerFloor(cto.building?.unitsPerFloor ? String(cto.building.unitsPerFloor) : '');
  }, [cto.id, cto.name, cto.status, cto.catalogId, cto.poleId, cto.building]);

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
          // Auto-rename when the user keeps the default "CTO-N" / "CEO-N" pattern.
          // Skipped if they already typed a custom name, so we never clobber edits.
          const effectiveName = updates.name ?? cto.name;
          const autoNameMatch = effectiveName.match(/^(CTO|CEO)-(\d+)$/);
          if (autoNameMatch && autoNameMatch[1] !== box.type) {
            updates.name = `${box.type}-${autoNameMatch[2]}`;
          }
        }
      }
      if (poleId !== cto.poleId) updates.poleId = poleId || undefined;

      // Edit-only: when this is already a condo, persist floors/units changes.
      // Conversion to/from condo is not possible from this panel.
      if (isVerticalCondo) {
        const nextBuilding: BuildingConfig = {
          floors: Math.max(1, parseInt(buildingFloors, 10) || 1),
          ...(buildingUnitsPerFloor ? { unitsPerFloor: Math.max(1, parseInt(buildingUnitsPerFloor, 10)) } : {})
        };
        if (JSON.stringify(nextBuilding) !== JSON.stringify(cto.building ?? null)) {
          updates.building = nextBuilding;
        }
      }

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

  // Round up to nearest commercial splitter size (2/4/8/16/32/64). 0 → 8 default.
  const roundToSplitterSize = (n: number): number => {
    if (!n || n <= 0) return 8;
    const sizes = [2, 4, 8, 16, 32, 64];
    return sizes.find(s => s >= n) ?? 64;
  };

  const handleGenerateFloorSplittersClick = () => {
    if (!parseInt(buildingFloors, 10)) return;
    if (cto.splitters.length > 0) {
      setShowGenerateConfirm(true);
      return;
    }
    void runGenerateFloorSplitters();
  };

  const runGenerateFloorSplitters = async () => {
    if (isSavingLocal) return; // Guard against double-clicks racing the save.
    setIsSavingLocal(true);
    setShowGenerateConfirm(false);
    const floors = Math.max(1, parseInt(buildingFloors, 10) || 0);
    const units = parseInt(buildingUnitsPerFloor, 10) || 8;
    const portCount = roundToSplitterSize(units);

    // Stack splitters vertically in the diagram. GRID_SIZE=6 in CTOEditor, so
    // we use multiples of 6 to align cleanly.
    const SPACING_Y = 96;
    const baseX = 240;
    const baseY = 60;

    const newSplitters: Splitter[] = [];
    const newLayout: Record<string, ElementLayout> = { ...(cto.layout || {}) };
    // Random suffix in addition to timestamp guards against ID collision if the
    // user somehow runs the generator twice within the same millisecond, or if
    // splitters from a previous run share the same ts.
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);

    for (let f = 1; f <= floors; f++) {
      const id = `spl-floor-${ts}-${rand}-${f}`;
      const outputIds: string[] = [];
      for (let i = 0; i < portCount; i++) outputIds.push(`${id}-out-${i}`);

      newSplitters.push({
        id,
        name: `${t('floor') || 'Andar'} ${f}`,
        type: `1x${portCount}`,
        inputPortId: `${id}-in`,
        outputPortIds: outputIds,
        connectorType: 'Connectorized',
        polishType: floorSplitterPolish,
        allowCustomConnections: true
      });

      newLayout[id] = { x: baseX, y: baseY + (f - 1) * SPACING_Y, rotation: 270 };
    }

    setIsSavingLocal(true);
    try {
      const updates: Partial<CTOData> = {
        splitters: [...cto.splitters, ...newSplitters],
        layout: newLayout
      };
      // If building config changed locally but wasn't applied yet, persist it together.
      const nextBuilding: BuildingConfig | null = {
        floors,
        ...(buildingUnitsPerFloor ? { unitsPerFloor: Math.max(1, parseInt(buildingUnitsPerFloor, 10)) } : {})
      };
      if (JSON.stringify(nextBuilding) !== JSON.stringify(cto.building ?? null)) {
        updates.building = nextBuilding;
      }
      await onUpdate(updates);
      onClose();
    } catch (error) {
      console.error('Failed to generate floor splitters', error);
    } finally {
      setIsSavingLocal(false);
    }
  };

  // Tenants: customers connected to this CTO. Only meaningful when the CTO is
  // a vertical condo — for regular CTOs the customer markers on the map already
  // expose this info. Sorted by floor then unit so the list reads bottom-up.
  const tenants = useMemo(() => {
    if (!cto.building) return [];
    const list = customers.filter(c => c.ctoId === cto.id);
    return list.sort((a, b) => {
      const af = a.floor ?? Number.POSITIVE_INFINITY;
      const bf = b.floor ?? Number.POSITIVE_INFINITY;
      if (af !== bf) return af - bf;
      return (a.unit || '').localeCompare(b.unit || '', undefined, { numeric: true });
    });
  }, [cto.building, cto.id, customers]);

  const occupancyTotal = cto.building
    ? cto.building.floors * (cto.building.unitsPerFloor || 1)
    : 0;

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
      const width = 520;
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
      className="fixed z-[2000] w-[calc(100vw-1rem)] sm:w-[520px] max-w-[520px] bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden h-auto max-h-[85vh] sm:max-h-[90vh]"
      style={{ willChange: 'top, left', transition: 'none' }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-slate-50 dark:bg-[#22262e] shrink-0 cursor-move select-none"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          {isVerticalCondo
            ? <Building2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            : cto.type === 'CEO'
              ? <CEOIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              : <CTOIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />}
          {isVerticalCondo ? (t('vertical_condo') || 'Condomínio Vertical') : t('edit_cto')}
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

            {!isVerticalCondo && (
              <div>
                {isLoading ? (
                  <div className="w-full bg-[#f9fafb] dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-xl px-4 py-2.5 flex items-center gap-2 text-slate-500 dark:text-slate-400 h-[46px]">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span className="text-sm">{t('loading') || 'Carregando...'}</span>
                  </div>
                ) : (
                  <CustomSelect
                    label={t('box_model') || 'Modelo de Caixa'}
                    value={catalogId}
                    onChange={(selectedId) => {
                      setCatalogId(selectedId);
                      // Live-update the auto-generated "CTO-N" / "CEO-N" name so the
                      // user sees the consistent label before saving.
                      const box = availableBoxes.find(b => b.id === selectedId);
                      if (box) {
                        const m = name.match(/^(CTO|CEO)-(\d+)$/);
                        if (m && m[1] !== box.type) setName(`${box.type}-${m[2]}`);
                      }
                    }}
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
            )}

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

            {!isVerticalCondo && (
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
                  className="mt-2 w-full py-2 bg-[#f9fafb] dark:bg-[#151820] hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl border border-slate-200 dark:border-slate-700/30 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <Activity className="w-4 h-4" />
                  {t('link_to_nearest_pole') || 'Vincular ao poste próximo'}
                </button>
              </div>
            )}

            {isVerticalCondo && (
              <div className="bg-slate-50 dark:bg-[#22262e]/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t('vertical_condo') || 'Condomínio Vertical'}
                  </span>
                </div>
                <>
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <CustomInput
                      label={t('floors') || 'Andares'}
                      type="number"
                      min={1}
                      value={buildingFloors}
                      onChange={(e) => setBuildingFloors(e.target.value)}
                      placeholder="Ex: 10"
                    />
                    <CustomInput
                      label={t('units_per_floor') || 'Unidades/Andar'}
                      type="number"
                      min={1}
                      value={buildingUnitsPerFloor}
                      onChange={(e) => setBuildingUnitsPerFloor(e.target.value)}
                      placeholder="Ex: 4"
                    />
                  </div>
                  <div className="ml-6 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('connector') || 'Conector'}:
                    </span>
                    <div className="flex bg-slate-100 dark:bg-[#22262e] p-0.5 rounded-md gap-0.5">
                      {(['UPC', 'APC'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFloorSplitterPolish(p)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1.5 ${
                            floorSplitterPolish === p
                              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                          title={p === 'APC' ? 'Conector verde (APC - angulado)' : 'Conector azul (UPC - reto)'}
                        >
                          <span className={`w-2 h-2 rounded-full border ${p === 'APC' ? 'bg-green-500 border-green-600' : 'bg-blue-500 border-blue-600'}`} />
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateFloorSplittersClick}
                    disabled={isSavingLocal || !parseInt(buildingFloors, 10)}
                    className="ml-6 mt-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm"
                    title={t('generate_floor_splitters_desc') || 'Cria 1 splitter por andar dentro da CTO, nomeados "Andar 1"..."Andar N"'}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {t('generate_floor_splitters') || 'Gerar splitters por andar'}
                    {buildingFloors && buildingUnitsPerFloor && (
                      <span className="font-mono text-[10px] opacity-80">
                        ({parseInt(buildingFloors, 10)} × 1×{roundToSplitterSize(parseInt(buildingUnitsPerFloor, 10))} {floorSplitterPolish})
                      </span>
                    )}
                  </button>
                </>
              </div>
            )}

            {cto.building && (
              <div className="bg-white dark:bg-[#1a1d23] p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {t('tenants') || 'Moradores'}
                  </h4>
                  <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                    {tenants.length}/{occupancyTotal} {t('occupied_short') || 'ocupados'}
                  </span>
                </div>
                {tenants.length === 0 ? (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 italic py-2">
                    {t('no_tenants_yet') || 'Nenhum morador conectado ainda. Conecte clientes a esta CTO para vê-los aqui.'}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto -mx-1 px-1 space-y-1">
                    {tenants.map(c => {
                      const dotColor =
                        c.connectionStatus === 'online' ? 'bg-emerald-500' :
                        c.connectionStatus === 'offline' ? 'bg-red-500' :
                        c.status === 'ACTIVE' ? 'bg-emerald-400' :
                        c.status === 'SUSPENDED' ? 'bg-amber-400' :
                        c.status === 'INACTIVE' ? 'bg-[#BFAA0F]' :
                        c.status === 'CANCELLED' ? 'bg-slate-500' : 'bg-slate-400';
                      return (
                        <div
                          key={c.id}
                          className="group flex items-center gap-2 text-[11px] px-2 py-1.5 rounded bg-slate-50 dark:bg-[#22262e]/50 border border-slate-100 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                          title={`${c.name}${c.document ? ` · ${c.document}` : ''}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0 w-20">
                            {c.floor != null ? `${t('floors_short') || 'and.'} ${c.floor}` : '—'}
                            {c.unit ? ` · ${c.unit}` : ''}
                          </span>
                          <span className="truncate text-slate-600 dark:text-slate-400 flex-1">
                            {c.name}
                          </span>
                          {onEditCustomer && (
                            <button
                              type="button"
                              onClick={() => onEditCustomer(c)}
                              className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                              title={t('edit') || 'Editar'}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-50 dark:bg-[#22262e]/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 space-y-2">
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

          <div className="p-4 bg-white/95 dark:bg-[#1a1d23]/95 backdrop-blur border-t border-slate-200 dark:border-slate-700/30 shrink-0 flex gap-3">
            <button
              onClick={onOpenSplicing}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-[#22262e] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
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

      {showGenerateConfirm && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowGenerateConfirm(false)}
        >
          <div
            className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center shrink-0 border border-amber-300 dark:border-amber-500/30">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  {t('generate_floor_splitters') || 'Gerar splitters por andar'}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t('confirm_replace_splitters') ||
                    `Esta CTO já possui ${cto.splitters.length} splitter(s). Os splitters de andar gerados serão ADICIONADOS (não substituem). Continuar?`}
                </p>
              </div>
            </div>
            <div className="flex flex-row gap-3 mt-6">
              <button
                onClick={runGenerateFloorSplitters}
                disabled={isSavingLocal}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg"
              >
                {isSavingLocal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {t('continue') || 'Continuar'}
              </button>
              <button
                onClick={() => setShowGenerateConfirm(false)}
                className="px-4 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
