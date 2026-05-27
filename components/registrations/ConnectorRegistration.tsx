import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../LanguageContext';
import { getFusions, createFusion, updateFusion, deleteFusion, FusionCatalogItem } from '../../services/catalogService';
import { Plus, Trash2, Search, Edit2, X, Save, Plug } from 'lucide-react';
import { CustomInput, CustomSelect } from '../common';
import { parseFloatLocale } from '../../utils/parseUtils';
import { useCatalogRegistration } from '../../hooks/useCatalogRegistration';
import {
    KebabMenu, DeleteConfirmDialog, EmptyState, FilterChips,
    SortableHeader, useSortable, UnitInput, ListSkeleton, ModalFooter,
} from './common/CatalogPrimitives';

interface ConnectorRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type SortKey = 'name' | 'polishType' | 'attenuation';

export const ConnectorRegistration: React.FC<ConnectorRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();

    const service = useMemo(() => ({
        list: () => getFusions('connector'), create: createFusion, update: updateFusion, remove: deleteFusion,
    }), []);

    const {
        items: allItems,
        filteredItems: searched,
        loading, searchTerm, setSearchTerm,
        isModalOpen, editingItem, openCreate, openEdit, closeModal,
        showDeleteConfirm, setShowDeleteConfirm, save, confirmDelete, saving,
    } = useCatalogRegistration<FusionCatalogItem>({
        service, showToast,
        messages: {
            created: t('toast_created_success') || 'Criado',
            updated: t('toast_updated_success') || 'Atualizado',
            deleted: t('toast_deleted_success') || 'Excluído',
            errorSave: t('error_save') || 'Erro ao salvar',
            errorDelete: t('error_delete') || 'Erro ao deletar',
        },
        filterFn: (item, term) => item.name.toLowerCase().includes(term.toLowerCase()),
    });

    const [polishFilter, setPolishFilter] = useState<string | null>(null);
    const filtered = useMemo(() => {
        if (!polishFilter) return searched;
        return searched.filter(i => (i.polishType || 'UPC') === polishFilter);
    }, [searched, polishFilter]);

    const [sorted, sort, handleSort] = useSortable<FusionCatalogItem, SortKey>(
        filtered, (i, k) => k === 'polishType' ? (i.polishType || 'UPC') : (i as any)[k],
    );

    const chips = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const i of searched) {
            const k = i.polishType || 'UPC';
            counts[k] = (counts[k] || 0) + 1;
        }
        return [
            { value: null, label: 'Todos', count: searched.length },
            ...['UPC', 'APC', 'PC'].filter(t => counts[t] > 0).map(t => ({ value: t, label: t, count: counts[t] })),
        ];
    }, [searched]);

    const [formData, setFormData] = useState({ name: '', polishType: 'UPC', attenuation: '0.3' });

    useEffect(() => {
        if (!isModalOpen) return;
        setFormData(editingItem
            ? { name: editingItem.name, polishType: editingItem.polishType || 'UPC', attenuation: String(editingItem.attenuation) }
            : { name: '', polishType: 'UPC', attenuation: '0.3' }
        );
    }, [isModalOpen, editingItem]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;
        await save({
            name: formData.name,
            attenuation: parseFloatLocale(formData.attenuation),
            category: 'connector',
            polishType: formData.polishType,
        });
    };

    const polishColor = (type?: string) => type === 'APC' ? 'bg-green-500' : type === 'PC' ? 'bg-slate-400' : 'bg-blue-500';
    const itemToDelete = allItems.find(i => i.id === showDeleteConfirm);

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Plug className="w-7 h-7 text-emerald-500" />
                        {t('reg_conector') || 'Conectores'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('connector_catalog_desc') || 'Gerencie os tipos de conectores e seus valores de atenuação.'}
                    </p>
                </div>
                <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-colors">
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar Novo'}
                </button>
            </div>

            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 space-y-3">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder={t('search_generic') || 'Buscar...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:text-slate-200 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm" />
                    </div>
                    {!loading && allItems.length > 0 && (
                        <FilterChips options={chips} value={polishFilter} onChange={setPolishFilter} />
                    )}
                </div>

                {loading ? (
                    <ListSkeleton rows={5} />
                ) : sorted.length === 0 ? (
                    <EmptyState
                        icon={Plug}
                        title={allItems.length === 0 ? 'Você ainda não tem conectores cadastrados' : 'Nenhum conector encontrado'}
                        description={allItems.length === 0 ? 'Cadastre os tipos de conectores usados nos seus projetos.' : undefined}
                        ctaLabel={allItems.length === 0 ? '+ Cadastrar primeiro conector' : undefined}
                        onCta={allItems.length === 0 ? openCreate : undefined}
                        searchTerm={allItems.length > 0 && (searchTerm || polishFilter) ? (searchTerm || `polimento: ${polishFilter}`) : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                <tr>
                                    <th className="px-6 py-3"><SortableHeader label={t('name') || 'Nome'} sortKey="name" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('polish_type') || 'Polimento'} sortKey="polishType" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('attenuation') || 'Atenuação'} sortKey="attenuation" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3 text-right w-12">{t('actions') || 'Ações'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sorted.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-sm ${polishColor(item.polishType)} shrink-0`} />
                                                {item.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${item.polishType === 'APC' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                {item.polishType || 'UPC'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{item.attenuation} dB</td>
                                        <td className="px-6 py-3 text-right">
                                            <KebabMenu actions={[
                                                { label: t('edit') || 'Editar', icon: Edit2, onClick: () => openEdit(item) },
                                                { label: t('delete') || 'Excluir', icon: Trash2, onClick: () => setShowDeleteConfirm(item.id), destructive: true },
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
                itemType="conector"
                itemLabel={itemToDelete?.name || ''}
                hint="Conexões já feitas com esse conector não serão afetadas."
                onCancel={() => setShowDeleteConfirm(null)}
                onConfirm={confirmDelete}
            />

            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex justify-between items-center">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                {editingItem ? (t('edit_connector') || 'Editar conector') : (t('new_connector') || 'Novo conector')}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                            <CustomInput
                                label={t('name') || 'Nome'} required value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t('connector_name_placeholder') || 'Ex: Conector SC/APC'}
                                autoFocus
                            />

                            <CustomSelect
                                label={t('polish_type') || 'Tipo de Polimento'}
                                value={formData.polishType}
                                options={[{ value: 'UPC', label: 'UPC' }, { value: 'APC', label: 'APC' }, { value: 'PC', label: 'PC' }]}
                                onChange={val => setFormData({ ...formData, polishType: val })}
                                showSearch={false}
                            />

                            <div className="flex items-center gap-2 -mt-2">
                                <span className={`w-2.5 h-2.5 rounded-sm ${formData.polishType === 'APC' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {formData.polishType === 'APC' ? (t('polish_apc_hint') || 'Conector verde (APC — Angulado)') : (t('polish_upc_hint') || 'Conector azul (UPC/PC — Reto)')}
                                </span>
                            </div>

                            <UnitInput
                                label={t('attenuation_db') || 'Atenuação'}
                                unit="dB"
                                step="0.01"
                                min={0}
                                required
                                value={formData.attenuation}
                                onChange={v => setFormData({ ...formData, attenuation: String(v) })}
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
