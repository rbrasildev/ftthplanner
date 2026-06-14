import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../LanguageContext';
import { getFusions, createFusion, updateFusion, deleteFusion, FusionCatalogItem } from '../../services/catalogService';
import { Plus, Trash2, Zap, Search, Edit2, X, Save } from 'lucide-react';
import { CustomInput } from '../common';
import { parseFloatLocale } from '../../utils/parseUtils';
import { useCatalogRegistration } from '../../hooks/useCatalogRegistration';
import {
    KebabMenu, DeleteConfirmDialog, EmptyState,
    SortableHeader, useSortable, UnitInput, ListSkeleton, ModalFooter,
} from './common/CatalogPrimitives';

interface FusionRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type SortKey = 'name' | 'attenuation';

export const FusionRegistration: React.FC<FusionRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();

    const service = useMemo(() => ({
        list: () => getFusions('fusion'), create: createFusion, update: updateFusion, remove: deleteFusion,
    }), []);

    const {
        items: allItems,
        filteredItems: filtered, loading, saving,
        searchTerm, setSearchTerm,
        isModalOpen, editingItem, openCreate, openEdit, closeModal,
        showDeleteConfirm, setShowDeleteConfirm, save, confirmDelete,
    } = useCatalogRegistration<FusionCatalogItem>({
        service, showToast,
        messages: {
            created: t('toast_created_success') || 'Criado',
            updated: t('toast_updated_success') || 'Atualizado',
            deleted: t('toast_deleted_success') || 'Excluído',
            errorSave: t('error_save_fusion') || 'Erro ao salvar fusão',
            errorDelete: t('error_delete_fusion') || 'Erro ao deletar fusão',
        },
        filterFn: (item, term) => item.name.toLowerCase().includes(term.toLowerCase()),
    });

    const [sorted, sort, handleSort] = useSortable<FusionCatalogItem, SortKey>(
        filtered, (i, k) => (i as any)[k],
    );

    const [formData, setFormData] = useState({ name: '', attenuation: '0.01' });

    useEffect(() => {
        if (!isModalOpen) return;
        setFormData(editingItem
            ? { name: editingItem.name, attenuation: String(editingItem.attenuation) }
            : { name: '', attenuation: '0.01' }
        );
    }, [isModalOpen, editingItem]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;
        await save({ name: formData.name, attenuation: parseFloatLocale(formData.attenuation), category: 'fusion' });
    };

    const itemToDelete = allItems.find(i => i.id === showDeleteConfirm);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-7 h-7 text-emerald-500" />
                        {t('reg_fusao') || 'Tipos de Fusão'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('fusion_catalog_desc')}</p>
                </div>
                <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-colors">
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar Novo'}
                </button>
            </div>

            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder={t('search_generic') || 'Buscar...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:text-slate-200 dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm" />
                    </div>
                </div>

                {loading ? (
                    <ListSkeleton rows={5} />
                ) : sorted.length === 0 ? (
                    <EmptyState
                        icon={Zap}
                        title={allItems.length === 0 ? 'Você ainda não tem fusões cadastradas' : 'Nenhuma fusão encontrada'}
                        description={allItems.length === 0 ? 'Cadastre os tipos de fusão usados nos seus projetos.' : undefined}
                        ctaLabel={allItems.length === 0 ? '+ Cadastrar primeira fusão' : undefined}
                        onCta={allItems.length === 0 ? openCreate : undefined}
                        searchTerm={allItems.length > 0 && searchTerm ? searchTerm : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                <tr>
                                    <th className="px-6 py-3"><SortableHeader label={t('name') || 'Nome'} sortKey="name" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('attenuation') || 'Atenuação'} sortKey="attenuation" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3 text-right w-12">{t('actions') || 'Ações'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sorted.map(fusion => (
                                    <tr key={fusion.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                {fusion.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{fusion.attenuation} dB</td>
                                        <td className="px-6 py-3 text-right">
                                            <KebabMenu actions={[
                                                { label: t('edit') || 'Editar', icon: Edit2, onClick: () => openEdit(fusion) },
                                                { label: t('delete') || 'Excluir', icon: Trash2, onClick: () => setShowDeleteConfirm(fusion.id), destructive: true },
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
                itemType="fusão"
                itemLabel={itemToDelete?.name || ''}
                hint="Fusões já feitas nos projetos não serão afetadas."
                onCancel={() => setShowDeleteConfirm(null)}
                onConfirm={confirmDelete}
            />

            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex justify-between items-center">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                {editingItem ? (t('edit_fusion') || 'Editar fusão') : (t('new_fusion') || 'Nova fusão')}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                            <CustomInput
                                label={t('name') || 'Nome'}
                                required
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t('name_placeholder') || 'Ex: Fusão Padrão'}
                                autoFocus
                            />
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
