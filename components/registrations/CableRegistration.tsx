
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    getCables, createCable, updateCable, deleteCable, CableCatalogItem
} from '../../services/catalogService';
import { Plus, Edit2, Trash2, Search, Cable, X, Save } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { CustomSelect, CustomInput } from '../common';
import { useCatalogRegistration } from '../../hooks/useCatalogRegistration';
import {
    KebabMenu, DeleteConfirmDialog, EmptyState, FilterChips,
    SortableHeader, useSortable, UnitInput, ListSkeleton, ModalFooter,
} from './common/CatalogPrimitives';

const SPEC_COLORS = ['#10b981', '#86efac', '#3b82f6', '#93c5fd', '#f59e0b', '#fcd34d', '#ef4444', '#fca5a5', '#8b5cf6', '#c4b5fd', '#ec4899', '#f9a8d4', '#6b7280', '#d1d5db'];

interface CableRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const emptyForm: Partial<CableCatalogItem> = {
    name: '', brand: '', model: '', defaultLevel: 'DISTRIBUICAO',
    fiberCount: 12, looseTubeCount: 1, fibersPerTube: 12,
    attenuation: 0.35, fiberProfile: 'ABNT', description: '',
    deployedSpec: { color: '#10b981', width: 3 },
    plannedSpec: { color: '#86efac', width: 3 },
};

type SortKey = 'name' | 'brand' | 'model' | 'fiberCount' | 'defaultLevel';

const CableRegistration: React.FC<CableRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();

    const service = useMemo(() => ({
        list: getCables, create: createCable, update: updateCable, remove: deleteCable,
    }), []);

    const {
        items: allItems,
        filteredItems: filtered, loading: isLoading, saving,
        searchTerm, setSearchTerm,
        isModalOpen, editingItem: editingCable, openCreate, openEdit, closeModal,
        showDeleteConfirm, setShowDeleteConfirm, save, confirmDelete,
    } = useCatalogRegistration<CableCatalogItem>({
        service, showToast,
        messages: {
            created: t('toast_created_success') || 'Criado',
            updated: t('toast_updated_success') || 'Atualizado',
            deleted: t('toast_deleted_success') || 'Excluído',
            errorSave: t('error_save_cable') || 'Falha ao salvar cabo',
            errorDelete: t('error_delete') || 'Falha ao excluir',
        },
        filterFn: (c, term) => {
            const tl = term.toLowerCase();
            return c.name.toLowerCase().includes(tl) || (c.brand?.toLowerCase().includes(tl) ?? false);
        },
    });

    const [levelFilter, setLevelFilter] = useState<string | null>(null);
    const finalFiltered = useMemo(() => {
        if (!levelFilter) return filtered;
        return filtered.filter(c => c.defaultLevel === levelFilter);
    }, [filtered, levelFilter]);

    const [sorted, sort, handleSort] = useSortable<CableCatalogItem, SortKey>(
        finalFiltered, (i, k) => (i as any)[k],
    );

    const chips = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of filtered) counts[c.defaultLevel] = (counts[c.defaultLevel] || 0) + 1;
        const levels = ['TRONCO', 'DISTRIBUICAO', 'DROP'];
        return [
            { value: null, label: 'Todos', count: filtered.length },
            ...levels.filter(l => counts[l] > 0).map(l => ({
                value: l, label: l === 'DISTRIBUICAO' ? 'Distribuição' : l.charAt(0) + l.slice(1).toLowerCase(),
                count: counts[l],
            })),
        ];
    }, [filtered]);

    const [formData, setFormData] = useState<Partial<CableCatalogItem>>(emptyForm);

    useEffect(() => {
        if (!isModalOpen) return;
        setFormData(editingCable ? { ...editingCable } : emptyForm);
    }, [isModalOpen, editingCable]);

    const handleSave = async () => {
        if (!formData.name) {
            if (showToast) showToast(t('name_required') || 'Nome é obrigatório', 'error');
            return;
        }
        await save(formData);
    };

    const itemToDelete = allItems.find(i => i.id === showDeleteConfirm);

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Cable className="w-7 h-7 text-emerald-500" />
                        {t('cable_catalog')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('cable_catalog_desc')}</p>
                </div>
                <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-colors">
                    <Plus className="w-4 h-4" /> {t('add_new')}
                </button>
            </div>

            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 space-y-3">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder={t('search_placeholder_cable')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm" />
                    </div>
                    {!isLoading && allItems.length > 0 && (
                        <FilterChips options={chips} value={levelFilter} onChange={setLevelFilter} />
                    )}
                </div>

                {isLoading ? (
                    <ListSkeleton rows={5} />
                ) : sorted.length === 0 ? (
                    <EmptyState
                        icon={Cable}
                        title={allItems.length === 0 ? 'Você ainda não tem cabos cadastrados' : 'Nenhum cabo encontrado'}
                        description={allItems.length === 0 ? 'Cadastre os tipos de cabos usados nos seus projetos.' : undefined}
                        ctaLabel={allItems.length === 0 ? '+ Cadastrar primeiro cabo' : undefined}
                        onCta={allItems.length === 0 ? openCreate : undefined}
                        searchTerm={allItems.length > 0 && (searchTerm || levelFilter) ? (searchTerm || `tipo: ${levelFilter}`) : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                <tr>
                                    <th className="px-6 py-3"><SortableHeader label={t('name') || 'Nome'} sortKey="name" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('brand') || 'Marca'} sortKey="brand" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('model') || 'Modelo'} sortKey="model" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('type') || 'Tipo'} sortKey="defaultLevel" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('fiber_count') || 'Fibras'} sortKey="fiberCount" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3 text-right w-12">{t('actions') || 'Ações'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sorted.map(cable => (
                                    <tr key={cable.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cable.deployedSpec?.color || '#10b981' }} />
                                                {cable.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{cable.brand}</td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{cable.model}</td>
                                        <td className="px-6 py-3">
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                {cable.defaultLevel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">
                                            {cable.fiberCount}FO <span className="text-slate-400">({cable.looseTubeCount}×{cable.fibersPerTube})</span>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <KebabMenu actions={[
                                                { label: t('edit') || 'Editar', icon: Edit2, onClick: () => openEdit(cable) },
                                                { label: t('delete') || 'Excluir', icon: Trash2, onClick: () => setShowDeleteConfirm(cable.id), destructive: true },
                                            ]} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <DeleteConfirmDialog
                isOpen={!!showDeleteConfirm}
                itemType="cabo"
                itemLabel={itemToDelete?.name || ''}
                hint="Cabos já lançados nos projetos não serão afetados."
                onCancel={() => setShowDeleteConfirm(null)}
                onConfirm={confirmDelete}
            />

            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700/30 animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex justify-between items-center sticky top-0 z-10 bg-white/95 dark:bg-[#1a1d23]/95 backdrop-blur">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                {editingCable ? t('edit_cable') : t('new_cable')}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-3">
                                    <CustomInput label={t('name')} required placeholder={t('name_placeholder') || 'Ex: AS-80-G.652D'}
                                        value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <CustomInput label={t('brand')} value={formData.brand || ''} onChange={e => setFormData({ ...formData, brand: e.target.value })} placeholder={t('brand_placeholder')} />
                                <CustomInput label={t('model')} value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} placeholder={t('model_placeholder')} />
                                <CustomSelect
                                    label={t('type')} value={formData.defaultLevel || 'DISTRIBUICAO'}
                                    options={[
                                        { value: 'DISTRIBUICAO', label: 'DISTRIBUIÇÃO' },
                                        { value: 'TRONCO', label: 'TRONCO' },
                                        { value: 'DROP', label: 'DROP' },
                                    ]}
                                    onChange={val => setFormData({ ...formData, defaultLevel: val })} showSearch={false}
                                />
                            </div>

                            {/* Tech Specs */}
                            <div className="p-4 bg-slate-50 dark:bg-[#22262e]/40 rounded-xl border border-slate-100 dark:border-slate-700/30">
                                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">{t('specifications')}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <CustomInput label={t('fiber_count')} type="number" value={formData.fiberCount} onChange={e => setFormData({ ...formData, fiberCount: parseInt(e.target.value) })} />
                                    <CustomInput label={t('loose_tubes')} type="number" value={formData.looseTubeCount} onChange={e => setFormData({ ...formData, looseTubeCount: Number(e.target.value) })} />
                                    <CustomInput label={t('fibers_per_tube') || 'Fibras por Tubo'} type="number" value={formData.fibersPerTube} onChange={e => setFormData({ ...formData, fibersPerTube: Number(e.target.value) })} />
                                    <UnitInput label={t('attenuation_db') || 'Atenuação'} unit="dB" step="0.01" min={0}
                                        value={formData.attenuation ?? 0}
                                        onChange={v => setFormData({ ...formData, attenuation: v })} />
                                </div>

                                <div className="mt-4">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                        {t('fiber_color_standard')}
                                    </label>
                                    <div className="flex bg-slate-200/60 dark:bg-slate-700/50 rounded-lg p-1 mb-3">
                                        <button type="button"
                                            onClick={() => setFormData({ ...formData, fiberProfile: 'ABNT' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${formData.fiberProfile === 'ABNT' || !formData.fiberProfile ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'}`}>
                                            {t('standard_abnt')}
                                        </button>
                                        <button type="button"
                                            onClick={() => setFormData({ ...formData, fiberProfile: 'EIA' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${formData.fiberProfile === 'EIA' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'}`}>
                                            {t('standard_eia')}
                                        </button>
                                    </div>

                                    <div className="flex gap-1 justify-center">
                                        {(formData.fiberProfile === 'EIA'
                                            ? ['#0000FF', '#FFA500', '#008000', '#A52A2A', '#808080', '#FFFFFF', '#FF0000', '#000000', '#FFFF00', '#EE82EE', '#FFC0CB', '#00FFFF']
                                            : ['#008000', '#FFFF00', '#FFFFFF', '#0000FF', '#FF0000', '#EE82EE', '#A52A2A', '#FFC0CB', '#000000', '#808080', '#FFA500', '#00FFFF']
                                        ).map((c, i) => (
                                            <div key={i} className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700" style={{ backgroundColor: c }} />
                                        ))}
                                        <span className="text-slate-400 text-xs self-end ml-1">...</span>
                                    </div>
                                </div>
                            </div>

                            <CustomInput isTextarea label={t('description')} rows={3} placeholder={t('details_placeholder')}
                                value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />

                            {/* Specs visuais (cor/espessura) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { key: 'deployedSpec' as const, label: 'Implantado', colors: SPEC_COLORS.slice(0, 7) },
                                    { key: 'plannedSpec' as const, label: 'Planejado', colors: SPEC_COLORS.slice(7, 14) },
                                ].map(spec => {
                                    const current = formData[spec.key];
                                    return (
                                        <div key={spec.key} className="p-3 border border-slate-200 dark:border-slate-700/30 rounded-xl bg-slate-50 dark:bg-[#22262e]/40">
                                            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Exibição · {spec.label}</h4>
                                            <div className="flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-semibold text-slate-400 mb-1.5">Cor</label>
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {spec.colors.map(c => (
                                                            <button key={c} type="button"
                                                                onClick={() => setFormData({ ...formData, [spec.key]: { ...current!, color: c } })}
                                                                className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 transition-transform hover:scale-110 ${current?.color === c ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-800' : ''}`}
                                                                style={{ backgroundColor: c }} />
                                                        ))}
                                                        <input type="color" className="w-7 h-7 p-0 rounded cursor-pointer border-0"
                                                            value={current?.color}
                                                            onChange={e => setFormData({ ...formData, [spec.key]: { ...current!, color: e.target.value } })} />
                                                    </div>
                                                </div>
                                                <div className="w-20">
                                                    <label className="block text-[10px] font-semibold text-slate-400 mb-1.5">Espessura</label>
                                                    <input type="number" min={1}
                                                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/30 bg-white dark:bg-[#1a1d23] text-slate-900 dark:text-white text-center text-sm tabular-nums focus:outline-none focus:border-emerald-500"
                                                        value={current?.width}
                                                        onChange={e => setFormData({ ...formData, [spec.key]: { ...current!, width: Number(e.target.value) } })} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/60 dark:bg-[#22262e]/60 sticky bottom-0 z-10 backdrop-blur">
                            <ModalFooter
                                onCancel={closeModal}
                                primaryLabel={t('save') || 'Salvar'}
                                primaryIcon={Save}
                                primaryLoading={saving}
                                primaryType="button"
                                onPrimary={handleSave}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default CableRegistration;
