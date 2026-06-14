import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../LanguageContext';
import { PoleCatalogItem, getPoles, createPole, updatePole, deletePole } from '../../services/catalogService';
import { Search, Plus, Edit2, Trash2, X, Save, Zap } from 'lucide-react';
import { CustomSelect, CustomInput } from '../common';
import { useCatalogRegistration } from '../../hooks/useCatalogRegistration';
import {
    KebabMenu,
    DeleteConfirmDialog,
    EmptyState,
    FilterChips,
    SortableHeader,
    useSortable,
    UnitInput,
    ListSkeleton,
    ModalFooter,
} from './common/CatalogPrimitives';

interface PoleRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const emptyForm: Partial<PoleCatalogItem> = {
    type: 'Concreto', shape: 'Circular', height: 10, strength: 600,
};

type SortKey = 'name' | 'type' | 'height' | 'strength' | 'shape';

export const PoleRegistration: React.FC<PoleRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();

    const service = useMemo(() => ({
        list: getPoles, create: createPole, update: updatePole, remove: deletePole,
    }), []);

    const {
        items: allPoles,
        filteredItems: searchedPoles,
        loading,
        saving,
        searchTerm: search,
        setSearchTerm: setSearch,
        isModalOpen,
        editingItem: editingPole,
        openCreate,
        openEdit,
        closeModal,
        showDeleteConfirm,
        setShowDeleteConfirm,
        save,
        confirmDelete,
    } = useCatalogRegistration<PoleCatalogItem>({
        service,
        showToast,
        messages: {
            created: t('toast_created_success') || 'Criado com sucesso',
            updated: t('toast_updated_success') || 'Atualizado com sucesso',
            deleted: t('toast_deleted_success') || 'Excluído com sucesso',
            errorSave: t('error_save') || 'Falha ao salvar poste',
            errorDelete: t('error_delete') || 'Falha ao excluir',
        },
        filterFn: (p, term) => {
            const tl = term.toLowerCase();
            return p.name.toLowerCase().includes(tl) || p.type.toLowerCase().includes(tl);
        },
    });

    // Filter por tipo (chips). Ortogonal à search.
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const filteredPoles = useMemo(() => {
        if (!typeFilter) return searchedPoles;
        return searchedPoles.filter(p => p.type === typeFilter);
    }, [searchedPoles, typeFilter]);

    // Sort
    const [sortedPoles, sort, handleSort] = useSortable<PoleCatalogItem, SortKey>(
        filteredPoles,
        (item, key) => item[key as keyof PoleCatalogItem],
    );

    // Chips: contagem por tipo na lista atual (pós-search).
    const typeChips = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const p of searchedPoles) counts[p.type] = (counts[p.type] || 0) + 1;
        const types = ['Concreto', 'Madeira', 'Metal', 'Fibra'];
        return [
            { value: null, label: 'Todos', count: searchedPoles.length },
            ...types.filter(t => counts[t] > 0).map(t => ({ value: t, label: t, count: counts[t] })),
        ];
    }, [searchedPoles]);

    const [formData, setFormData] = useState<Partial<PoleCatalogItem>>(emptyForm);

    useEffect(() => {
        if (!isModalOpen) return;
        setFormData(editingPole ? { ...editingPole } : emptyForm);
    }, [isModalOpen, editingPole]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await save(formData);
    };

    const poleToDelete = allPoles.find(p => p.id === showDeleteConfirm) || null;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-7 h-7 text-emerald-500" />
                        {t('pole_catalog') || 'Cadastro de Postes'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('pole_catalog_desc') || 'Gerencie os tipos de postes disponíveis.'}
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-colors"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar Novo'}
                </button>
            </div>

            {/* Container */}
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden">
                {/* Search + Filter chips */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 space-y-3">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_placeholder_box') || 'Buscar por nome ou tipo...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-[#f9fafb] dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        />
                    </div>
                    {!loading && allPoles.length > 0 && (
                        <FilterChips options={typeChips} value={typeFilter} onChange={setTypeFilter} />
                    )}
                </div>

                {loading ? (
                    <ListSkeleton rows={5} />
                ) : sortedPoles.length === 0 ? (
                    <EmptyState
                        icon={Zap}
                        title={allPoles.length === 0 ? 'Você ainda não tem postes cadastrados' : 'Nenhum poste corresponde aos filtros'}
                        description={allPoles.length === 0
                            ? 'Cadastre os tipos de postes que sua equipe usa nos projetos.'
                            : undefined}
                        ctaLabel={allPoles.length === 0 ? '+ Cadastrar primeiro poste' : undefined}
                        onCta={allPoles.length === 0 ? openCreate : undefined}
                        searchTerm={allPoles.length > 0 && (search || typeFilter) ? (search || `tipo: ${typeFilter}`) : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                <tr>
                                    <th className="px-6 py-3">
                                        <SortableHeader label={t('name') || 'Nome'} sortKey="name" sort={sort} onSort={handleSort} />
                                    </th>
                                    <th className="px-6 py-3">
                                        <SortableHeader label={t('splitter_type') || 'Tipo'} sortKey="type" sort={sort} onSort={handleSort} />
                                    </th>
                                    <th className="px-6 py-3">
                                        <SortableHeader label={t('pole_height') || 'Altura'} sortKey="height" sort={sort} onSort={handleSort} />
                                    </th>
                                    <th className="px-6 py-3">
                                        <SortableHeader label={t('pole_strength') || 'Esforço'} sortKey="strength" sort={sort} onSort={handleSort} />
                                    </th>
                                    <th className="px-6 py-3">
                                        <SortableHeader label={t('pole_shape') || 'Formato'} sortKey="shape" sort={sort} onSort={handleSort} />
                                    </th>
                                    <th className="px-6 py-3 text-right w-12">{t('actions') || 'Ações'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sortedPoles.map(pole => (
                                    <tr key={pole.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                {pole.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{pole.type}</td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{pole.height}m</td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{pole.strength} daN</td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{pole.shape}</td>
                                        <td className="px-6 py-3 text-right">
                                            <KebabMenu actions={[
                                                { label: t('edit') || 'Editar', icon: Edit2, onClick: () => openEdit(pole) },
                                                { label: t('delete') || 'Excluir', icon: Trash2, onClick: () => setShowDeleteConfirm(pole.id), destructive: true },
                                            ]} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Delete confirm com contexto do item */}
            <DeleteConfirmDialog
                isOpen={!!showDeleteConfirm}
                itemType="poste"
                itemLabel={poleToDelete?.name || ''}
                hint="Projetos que já usam esse poste não serão afetados."
                onCancel={() => setShowDeleteConfirm(null)}
                onConfirm={confirmDelete}
            />

            {/* Add/Edit Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700/30 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center justify-between">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                {editingPole ? (t('edit_pole') || 'Editar poste') : (t('new_pole') || 'Novo poste')}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                            <CustomInput
                                label={t('name')}
                                required
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t('name_placeholder') || 'Ex: AS-80-G.652D'}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <CustomSelect
                                    label={t('splitter_type')}
                                    value={formData.type || 'Concreto'}
                                    options={[
                                        { value: 'Concreto', label: t('concrete') || 'Concreto' },
                                        { value: 'Madeira', label: t('wood') || 'Madeira' },
                                        { value: 'Metal', label: t('metal') || 'Metal' },
                                        { value: 'Fibra', label: t('fiber') || 'Fibra' },
                                    ]}
                                    onChange={val => setFormData({ ...formData, type: val })}
                                    showSearch={false}
                                />
                                <CustomSelect
                                    label={t('pole_shape')}
                                    value={formData.shape || 'Circular'}
                                    options={[
                                        { value: 'Circular', label: t('shape_circular') },
                                        { value: 'Duplo T', label: t('shape_duplot') },
                                        { value: 'Quadrado', label: t('shape_square') },
                                    ]}
                                    onChange={val => setFormData({ ...formData, shape: val })}
                                    showSearch={false}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <UnitInput
                                    label={t('pole_height')}
                                    unit="m"
                                    step="0.1"
                                    min={0}
                                    required
                                    value={formData.height ?? ''}
                                    onChange={v => setFormData({ ...formData, height: v })}
                                />
                                <UnitInput
                                    label={t('pole_strength')}
                                    unit="daN"
                                    step="10"
                                    min={0}
                                    required
                                    value={formData.strength ?? ''}
                                    onChange={v => setFormData({ ...formData, strength: v })}
                                />
                            </div>

                            <CustomInput
                                isTextarea
                                label={t('description')}
                                rows={3}
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
