
import React, { useState, useMemo, useEffect } from 'react';
import { CableData, CableStatus, CableReserve } from '../types';
import { X, Save, Trash2, Cable, Palette, Activity, Ruler, AlertTriangle, Layers, BookOpen, Loader2, ChevronDown, ChevronUp, Plus, RotateCcw } from 'lucide-react';
import L from 'leaflet';
import { useLanguage } from '../LanguageContext';
import { getCables, CableCatalogItem } from '../services/catalogService';
import { CustomInput } from './common/CustomInput';
import { CustomSelect } from './common/CustomSelect';

interface CableEditorProps {
  cable: CableData;
  // Opcional pra não quebrar callers antigos. Quando passado, o editor calcula
  // os segmentos irmãos (que vieram do mesmo cabo original via splits) e mostra
  // o comprimento total agregado no bloco de Especificações.
  allCables?: CableData[];
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

export const CableEditor: React.FC<CableEditorProps> = ({ cable, allCables, onClose, onSave, onDelete, userRole }) => {
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
  // Picker COR NO MAPA: colapsado por default quando o cabo segue o catálogo
  // (sem override). Se já tem override ou cabo sem catalog, abre direto.
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

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
      // Map catalog properties to cable data. We persist `defaultLevel` raw
      // into `cable.type` — the layer filter normalizes PT/EN aliases on read
      // (see utils/cableTypeUtils.ts), so any string the catalog uses works.
      setFormData(prev => ({
        ...prev,
        catalogId: catalogId,
        name: selected.name,
        fiberCount: selected.fiberCount,
        looseTubeCount: selected.looseTubeCount,
        // Seleção de catálogo limpa qualquer override por instância — usuário
        // que quer customizar usa o picker abaixo, que escreve em customColor.
        color: selected.deployedSpec?.color || prev.color,
        customColor: null,
        customWidth: null,
        colorStandard: (selected.fiberProfile === 'EIA' ? 'EIA598' : 'ABNT') as any,
        width: (prev.status === 'DEPLOYED' ? selected.deployedSpec?.width : selected.plannedSpec?.width) || 3,
        type: (selected.defaultLevel as any) || prev.type,
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

  // Detecta segmentos irmãos do mesmo cabo original.
  // Heurística em 2 passos pra evitar falsos positivos quando vários cabos
  // diferentes compartilham o nome do catálogo (ex: 10 cabos "Cabo 12FO"
  // desconexos pelo mapa, todos sem sufixo de split — não são irmãos).
  //
  // Passo 1: candidatos por nome base.
  //   - strip recursivo de " (A)" / " (B)" (sufixos do split em
  //     useNetworkOperations.ts handleConnectCableToNode)
  //   - "Cabo 48FO (B) (B) (A)" → base "Cabo 48FO"
  //   - catalogId entra como soft check: se ambos têm e diferem, exclui;
  //     se algum lado não tem, aceita (dados antigos podem ter perdido).
  //
  // Passo 2: BFS por conectividade. Splits sempre deixam segmento1.last e
  //   segmento2.first na MESMA coordenada (= node.coordinates) — esse é o
  //   sinal mais robusto. Expande via:
  //     a) endpoint coord bucket (5 casas decimais ≈ 1m) — pega tudo,
  //        inclusive ancoragem em poste (poles não setam node id no cabo)
  //     b) fromNodeId/toNodeId compartilhado — redundante mas defensivo
  //
  // Fallback aceito: se usuário renomeou segmento OU separou geograficamente
  // (>1m entre endpoints), perde o link nesse ponto. v1 sem schema.
  const siblingCables = useMemo(() => {
    if (!allCables || allCables.length === 0) return [cable];
    const stripSplitSuffixes = (name: string) =>
      (name || '').replace(/(\s+\([AB]\))+\s*$/, '').trim();
    const baseName = stripSplitSuffixes(cable.name);
    if (!baseName) return [cable];
    const myCatalog = cable.catalogId || null;

    const candidates = allCables.filter(c => {
      if (stripSplitSuffixes(c.name) !== baseName) return false;
      const cCat = c.catalogId || null;
      // Soft catalog check: só corta se AMBOS têm catalogId e são diferentes.
      // Dados de produção podem ter segmentos sem catalogId.
      if (myCatalog && cCat && myCatalog !== cCat) return false;
      return true;
    });
    if (candidates.length <= 1) return [cable];

    // Índices pra BFS O(N+E)
    const coordKey = (lat: number, lng: number) =>
      `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const coordToIds = new Map<string, string[]>();
    const nodeToIds = new Map<string, string[]>();
    const addTo = (m: Map<string, string[]>, key: string, id: string) => {
      const arr = m.get(key);
      if (arr) arr.push(id);
      else m.set(key, [id]);
    };
    for (const c of candidates) {
      if (c.fromNodeId) addTo(nodeToIds, c.fromNodeId, c.id);
      if (c.toNodeId) addTo(nodeToIds, c.toNodeId, c.id);
      if (c.coordinates && c.coordinates.length > 0) {
        const first = c.coordinates[0];
        const last = c.coordinates[c.coordinates.length - 1];
        addTo(coordToIds, coordKey(first.lat, first.lng), c.id);
        if (c.coordinates.length > 1) {
          addTo(coordToIds, coordKey(last.lat, last.lng), c.id);
        }
      }
    }
    const byId = new Map<string, CableData>(candidates.map(c => [c.id, c]));

    const group: typeof candidates = [];
    const visited = new Set<string>();
    const queue: string[] = [cable.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const c = byId.get(id);
      if (!c) continue;
      group.push(c);
      // Expand via node id
      for (const n of [c.fromNodeId, c.toNodeId]) {
        if (!n) continue;
        const neighbors = nodeToIds.get(n);
        if (!neighbors) continue;
        for (const nid of neighbors) if (!visited.has(nid)) queue.push(nid);
      }
      // Expand via endpoint coord
      if (c.coordinates && c.coordinates.length > 0) {
        const first = c.coordinates[0];
        const last = c.coordinates[c.coordinates.length - 1];
        const keys = c.coordinates.length > 1
          ? [coordKey(first.lat, first.lng), coordKey(last.lat, last.lng)]
          : [coordKey(first.lat, first.lng)];
        for (const k of keys) {
          const neighbors = coordToIds.get(k);
          if (!neighbors) continue;
          for (const nid of neighbors) if (!visited.has(nid)) queue.push(nid);
        }
      }
    }
    if (group.length === 0) return [cable];
    return group;
  }, [cable, allCables]);

  const siblingsAggregate = useMemo(() => {
    if (siblingCables.length <= 1) return null;
    let geometric = 0;
    let reserves = 0;
    for (const c of siblingCables) {
      if (c.coordinates && c.coordinates.length >= 2) {
        for (let i = 0; i < c.coordinates.length - 1; i++) {
          const p1 = L.latLng(c.coordinates[i].lat, c.coordinates[i].lng);
          const p2 = L.latLng(c.coordinates[i + 1].lat, c.coordinates[i + 1].lng);
          geometric += p1.distanceTo(p2);
        }
      }
      reserves += (c.reserves || []).reduce((s, r) => s + (r.length || 0), 0);
    }
    return {
      count: siblingCables.length,
      total: Math.round(geometric) + reserves,
    };
  }, [siblingCables]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    // Bypass o debounce de 300ms — clique explícito no botão Salvar não
    // deveria deixar janela racey pro user dar reload e ver "alterações
    // não salvas". App.tsx escuta esse evento e dispara o sync imediato.
    setTimeout(() => window.dispatchEvent(new CustomEvent('app:sync-now')), 0);
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
      const width = Math.min(520, window.innerWidth - 16); // Matches w-[520px], clamped on mobile
      const height = panelRef.current.offsetHeight || 600;
      const initialX = Math.max(8, (window.innerWidth - width) / 2);
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
      className={`fixed z-[2000] w-[calc(100vw-1rem)] sm:w-[520px] max-w-[520px] bg-white dark:bg-[#1a1d23] rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden ${isCollapsed ? 'h-auto' : 'h-auto max-h-[85vh] sm:max-h-[90vh]'}`}
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
                    ...[...catalogCables]
                      .sort((a, b) => a.fiberCount - b.fiberCount)
                      .map(c => ({ value: c.id, label: `${c.name} (${c.fiberCount}FO)` }))
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

            {/* Multiple Technical Reserves — colapsado quando vazio (botão simples).
                Quando tem reservas, mostra título + lista. Reduz ruído visual
                num campo que a maioria dos cabos não usa. */}
            {(formData.reserves || []).length === 0 ? (
              userRole !== 'MEMBER' && (
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
                      reserves: [newReserve],
                    });
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('add_technical_reserve') || 'Adicionar reserva técnica'}
                </button>
              )
            ) : (
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
            )}

            {/* Especificações — bloco compacto unificando metadata read-only.
                Antes Padrão de cores e Comprimento eram 2 seções full-width com
                cards decorativos. Agora 1 bloco com 3 linhas, paleta de cores
                escondida atrás de <details> (decorativa, raramente útil). */}
            {(() => {
              const totalReserves = (formData.reserves || []).reduce((s: number, r: any) => s + (r.length || 0), 0);
              const totalLength = Math.round(calculatedLength) + totalReserves;
              const palette = formData.colorStandard === 'EIA598'
                ? ['#3b82f6', '#f97316', '#22c55e', '#78350f', '#9ca3af', '#ffffff', '#ef4444', '#000000', '#eab308', '#a855f7', '#ec4899', '#22d3ee']
                : ['#22c55e', '#eab308', '#ffffff', '#3b82f6', '#ef4444', '#a855f7', '#78350f', '#ec4899', '#000000', '#9ca3af', '#f97316', '#22d3ee'];
              return (
                <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-lg border border-slate-200 dark:border-slate-700/50 divide-y divide-slate-200 dark:divide-slate-700/50">
                  <div className="flex justify-between items-center px-3 py-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{t('fiber_color_standard')}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formData.colorStandard === 'EIA598' ? t('standard_eia') : t('standard_abnt')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Ruler className="w-3 h-3" /> {t('geometric_length') || 'Geométrico'}
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {Math.round(calculatedLength).toLocaleString()} m
                    </span>
                  </div>
                  {totalReserves > 0 && (
                    <div className="flex justify-between items-center px-3 py-2 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('technical_reserve')} (total)
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        +{totalReserves.toLocaleString()} m
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-3 py-2 text-sm font-bold bg-emerald-50/50 dark:bg-emerald-900/10">
                    <span className="text-emerald-700 dark:text-emerald-400">{t('total_segment') || 'Total (segmento)'}</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400">
                      {totalLength.toLocaleString()} m <span className="text-[10px] font-normal text-emerald-600/70">({(totalLength / 1000).toFixed(3)} km)</span>
                    </span>
                  </div>
                  {siblingsAggregate && (
                    <div
                      className="flex justify-between items-center px-3 py-2 text-sm font-bold bg-indigo-50/60 dark:bg-indigo-900/10"
                      title={t('full_cable_tooltip') || 'Soma de todos os segmentos derivados do mesmo cabo original (identificados pelo nome base).'}
                    >
                      <span className="text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                        <Layers className="w-3 h-3" />
                        {t('full_cable') || 'Cabo completo'}
                        <span className="text-[10px] font-normal text-indigo-600/70 dark:text-indigo-400/70">
                          ({siblingsAggregate.count} {t('segments_short') || 'seg.'})
                        </span>
                      </span>
                      <span className="font-mono text-indigo-700 dark:text-indigo-400">
                        {siblingsAggregate.total.toLocaleString()} m{' '}
                        <span className="text-[10px] font-normal text-indigo-600/70 dark:text-indigo-400/70">
                          ({(siblingsAggregate.total / 1000).toFixed(3)} km)
                        </span>
                      </span>
                    </div>
                  )}
                  <details className="group">
                    <summary className="px-3 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 list-none flex items-center gap-1 select-none">
                      <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                      Ver paleta de fibras
                    </summary>
                    <div className="px-3 pb-2 flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                      {palette.map((c, i) => (
                        <div key={i} title={t('unit_fiber_label', { n: i + 1 })} className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-700 shrink-0" style={{ backgroundColor: c }} />
                      ))}
                      <span className="text-[9px] text-slate-400 ml-1">...</span>
                    </div>
                  </details>
                </div>
              );
            })()}

            {/* Picker — escreve em customColor/customWidth (override por instância).
                Estado dobrado: quando NÃO há override + tem catalog, mostra 1 linha
                com preview da cor do catálogo + "Customizar". Click expande.
                Quando há override, sempre expandido com badge + "usar catálogo".
                Sem catalog: sempre expandido (não há catalog pra usar como default). */}
            {(() => {
              const effectiveColor = formData.customColor ?? formData.color ?? '#0ea5e9';
              const effectiveWidth = formData.customWidth ?? formData.width;
              const hasOverride = formData.customColor != null || formData.customWidth != null;
              const hasCatalog = !!formData.catalogId;
              const showPicker = colorPickerOpen || hasOverride || !hasCatalog;

              return (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Palette className="w-3 h-3" /> {t('map_color')}
                      {hasOverride && hasCatalog && (
                        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 normal-case tracking-normal">
                          · override
                        </span>
                      )}
                    </span>
                    {hasOverride && hasCatalog && (
                      <button
                        type="button"
                        onClick={() => { setFormData(prev => ({ ...prev, customColor: null, customWidth: null })); setColorPickerOpen(false); }}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 normal-case tracking-normal transition-colors"
                        title="Voltar a usar a cor/espessura do catálogo"
                      >
                        <RotateCcw className="w-3 h-3" /> usar catálogo
                      </button>
                    )}
                  </label>

                  {!showPicker ? (
                    // Estado COLAPSADO — cabo segue o catálogo, mostra preview compacto + customizar
                    <button
                      type="button"
                      onClick={() => setColorPickerOpen(true)}
                      className="w-full flex items-center gap-3 bg-slate-50 dark:bg-[#22262e] hover:bg-slate-100 dark:hover:bg-slate-700/30 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-left"
                    >
                      <div
                        className="w-10 h-5 rounded shadow-sm border border-slate-300 dark:border-slate-600 shrink-0"
                        style={{ backgroundColor: effectiveColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-mono">{effectiveColor.toUpperCase()}</div>
                        <div className="text-[10px] text-slate-400">do catálogo · espessura {effectiveWidth ?? 2}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        Customizar →
                      </span>
                    </button>
                  ) : (
                    <div className="bg-slate-50 dark:bg-[#22262e] p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-6 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 shrink-0"
                          style={{ backgroundColor: effectiveColor }}
                        />
                        <input
                          type="color"
                          value={effectiveColor.substring(0, 7)}
                          onChange={(e) => setFormData(prev => ({ ...prev, customColor: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-300 dark:border-slate-600"
                          title={t('pick_custom_color') || 'Escolher cor'}
                        />
                        <CustomInput
                          value={effectiveColor.toUpperCase()}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                              setFormData(prev => ({ ...prev, customColor: v.startsWith('#') ? v : `#${v}` }));
                            }
                          }}
                          placeholder="#0EA5E9"
                          className="flex-1 font-mono text-xs uppercase"
                        />
                        <div className="flex items-center gap-1 shrink-0" title={t('cable_thickness')}>
                          <Ruler className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="number"
                            min={1}
                            max={20}
                            step={1}
                            value={effectiveWidth ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') {
                                setFormData(prev => ({ ...prev, customWidth: null }));
                                return;
                              }
                              const n = parseInt(raw, 10);
                              if (!isNaN(n)) setFormData(prev => ({ ...prev, customWidth: Math.max(1, Math.min(20, n)) }));
                            }}
                            className="w-14 h-8 px-2 text-xs text-center font-mono bg-white dark:bg-[#1a1d23] border border-slate-300 dark:border-slate-600 rounded focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {CABLE_MAP_COLORS.map(c => {
                          const isActive = effectiveColor.toLowerCase() === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, customColor: c }))}
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
                  )}
                </div>
              );
            })()}

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
              <div className="flex items-center gap-2">
                {/* Excluir = ghost icon-only (atrito visual proporcional ao risco).
                    Antes era botão filled vermelho competindo com Salvar — risco
                    de misclick numa ação destrutiva. */}
                {userRole !== 'MEMBER' && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    title={t('delete')}
                    aria-label={t('delete')}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
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
