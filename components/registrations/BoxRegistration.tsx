import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Edit2, Trash2, X, Save, Box, Palette } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { getBoxes, createBox, updateBox, deleteBox, BoxCatalogItem } from '../../services/catalogService';
import { CustomSelect, CustomInput } from '../common';
import { useCatalogRegistration } from '../../hooks/useCatalogRegistration';
import {
    KebabMenu, DeleteConfirmDialog, EmptyState, FilterChips,
    SortableHeader, useSortable, UnitInput, ListSkeleton, ModalFooter,
} from './common/CatalogPrimitives';

interface BoxRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const emptyForm: Partial<BoxCatalogItem> = {
    name: '', brand: '', model: '', type: 'CTO',
    reserveLoopLength: 0, color: '#64748b', description: '',
};

type SortKey = 'name' | 'type' | 'brand' | 'reserveLoopLength';

const BoxRegistration: React.FC<BoxRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();

    const service = useMemo(() => ({
        list: getBoxes, create: createBox, update: updateBox, remove: deleteBox,
    }), []);

    const {
        items: allItems,
        filteredItems: filtered, loading, saving,
        searchTerm: search, setSearchTerm: setSearch,
        isModalOpen, editingItem: editingBox, openCreate, openEdit, closeModal,
        showDeleteConfirm, setShowDeleteConfirm, save, confirmDelete,
    } = useCatalogRegistration<BoxCatalogItem>({
        service, showToast,
        messages: {
            created: t('toast_created_success') || 'Criado',
            updated: t('toast_updated_success') || 'Atualizado',
            deleted: t('toast_deleted_success') || 'Excluído',
            errorSave: t('error_save') || 'Falha ao salvar',
            errorDelete: t('error_delete') || 'Falha ao excluir',
        },
        filterFn: (box, term) => {
            const tl = term.toLowerCase();
            return box.name.toLowerCase().includes(tl)
                || (box.brand?.toLowerCase().includes(tl) ?? false)
                || (box.model?.toLowerCase().includes(tl) ?? false);
        },
    });

    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const finalFiltered = useMemo(() => {
        if (!typeFilter) return filtered;
        return filtered.filter(b => b.type === typeFilter);
    }, [filtered, typeFilter]);

    const [sorted, sort, handleSort] = useSortable<BoxCatalogItem, SortKey>(
        finalFiltered, (i, k) => (i as any)[k],
    );

    const chips = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const b of filtered) counts[b.type] = (counts[b.type] || 0) + 1;
        return [
            { value: null, label: 'Todos', count: filtered.length },
            ...['CTO', 'CEO'].filter(t => counts[t] > 0).map(t => ({ value: t, label: t, count: counts[t] })),
        ];
    }, [filtered]);

    const [formData, setFormData] = useState<Partial<BoxCatalogItem>>(emptyForm);

    useEffect(() => {
        if (!isModalOpen) return;
        setFormData(editingBox ? { ...editingBox } : emptyForm);
    }, [isModalOpen, editingBox]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await save(formData);
    };

    const itemToDelete = allItems.find(i => i.id === showDeleteConfirm);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Box className="w-7 h-7 text-emerald-500" />
                        {t('box_catalog') || 'Catálogo de Caixas'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('box_catalog_desc') || 'Gerencie os modelos de caixas de emenda e CTOs.'}
                    </p>
                </div>
                <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-colors">
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar Nova'}
                </button>
            </div>

            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 space-y-3">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder={t('search_placeholder_box') || 'Buscar...'} value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm" />
                    </div>
                    {!loading && allItems.length > 0 && (
                        <FilterChips options={chips} value={typeFilter} onChange={setTypeFilter} />
                    )}
                </div>

                {loading ? (
                    <ListSkeleton rows={5} />
                ) : sorted.length === 0 ? (
                    <EmptyState
                        icon={Box}
                        title={allItems.length === 0 ? 'Você ainda não tem caixas cadastradas' : 'Nenhuma caixa encontrada'}
                        description={allItems.length === 0 ? 'Cadastre os modelos de caixas (CTOs e CEOs) usados nos projetos.' : undefined}
                        ctaLabel={allItems.length === 0 ? '+ Cadastrar primeira caixa' : undefined}
                        onCta={allItems.length === 0 ? openCreate : undefined}
                        searchTerm={allItems.length > 0 && (search || typeFilter) ? (search || `tipo: ${typeFilter}`) : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                <tr>
                                    <th className="px-6 py-3"><SortableHeader label={t('name') || 'Nome'} sortKey="name" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('type') || 'Tipo'} sortKey="type" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={`${t('brand') || 'Marca'} / ${t('model') || 'Modelo'}`} sortKey="brand" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('reserve') || 'Reserva'} sortKey="reserveLoopLength" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3 text-right w-12">{t('actions') || 'Ações'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sorted.map(box => (
                                    <tr key={box.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0" style={{ backgroundColor: box.color }} />
                                                {box.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${box.type === 'CTO' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
                                                {box.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                            {box.brand} <span className="text-slate-300 dark:text-slate-700">/</span> {box.model}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{box.reserveLoopLength}m</td>
                                        <td className="px-6 py-3 text-right">
                                            <KebabMenu actions={[
                                                { label: t('edit') || 'Editar', icon: Edit2, onClick: () => openEdit(box) },
                                                { label: t('delete') || 'Excluir', icon: Trash2, onClick: () => setShowDeleteConfirm(box.id), destructive: true },
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
                itemType="caixa"
                itemLabel={itemToDelete?.name || ''}
                hint="Caixas já instaladas nos projetos não serão afetadas."
                onCancel={() => setShowDeleteConfirm(null)}
                onConfirm={confirmDelete}
            />

            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700/30 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/30">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Box className="w-5 h-5 text-emerald-600" />
                                {editingBox ? (t('edit_box') || 'Editar caixa') : (t('new_box') || 'Nova caixa')}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <CustomInput
                                label={t('name') || 'Nome'} required
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t('name_placeholder') || 'Ex: CTO-PRECON'}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput label={t('brand') || 'Marca'} value={formData.brand || ''}
                                    onChange={e => setFormData({ ...formData, brand: e.target.value })} placeholder={t('brand')} />
                                <CustomInput label={t('model') || 'Modelo'} value={formData.model || ''}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })} placeholder={t('model')} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <CustomSelect
                                    label={t('type') || 'Tipo'}
                                    value={formData.type || 'CTO'}
                                    options={[
                                        { value: 'CTO', label: t('type_cto_termination') },
                                        { value: 'CEO', label: t('type_ceo_splice') },
                                    ]}
                                    onChange={val => setFormData({ ...formData, type: val as 'CTO' | 'CEO' })}
                                    showSearch={false}
                                />
                                <UnitInput
                                    label={t('reserve_loop_length') || 'Reserva'}
                                    unit="m"
                                    min={0}
                                    value={formData.reserveLoopLength ?? 0}
                                    onChange={v => setFormData({ ...formData, reserveLoopLength: v })}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 tracking-wider flex items-center gap-1.5">
                                    <Palette className="w-3 h-3" /> {t('ident_color') || 'Cor de identificação'}
                                </label>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={formData.color}
                                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 overflow-hidden" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#22262e] px-2 py-1 rounded border border-slate-200 dark:border-slate-700/30 uppercase tabular-nums">
                                        {formData.color}
                                    </span>
                                </div>
                            </div>

                            <CustomInput
                                isTextarea
                                label={t('description') || 'Descrição'}
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder={t('details_placeholder')}
                            />

                            <ModalFooter
                                onCancel={closeModal}
                                primaryLabel={t('save') || 'Salvar'}
                                primaryIcon={Save}
                                primaryLoading={saving}
                            />
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default BoxRegistration;
