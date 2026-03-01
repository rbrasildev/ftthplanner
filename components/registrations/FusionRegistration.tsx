
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { getFusions, createFusion, updateFusion, deleteFusion, FusionCatalogItem } from '../../services/catalogService';
import { Plus, Trash2, Zap, Search, Loader2, Edit2, X, Save, AlertTriangle } from 'lucide-react';
import { CustomInput } from '../common';

export const FusionRegistration: React.FC = () => {
    const { t } = useLanguage();
    const [fusions, setFusions] = useState<FusionCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FusionCatalogItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        attenuation: '0.01'
    });

    useEffect(() => {
        loadFusions();
    }, []);

    const loadFusions = async () => {
        setLoading(true);
        try {
            const data = await getFusions();
            setFusions(data);
        } catch (error) {
            console.error("Failed to load fusions", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item?: FusionCatalogItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                attenuation: String(item.attenuation)
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                attenuation: '0.01'
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        try {
            const payload = {
                name: formData.name,
                attenuation: parseFloat(formData.attenuation) || 0
            };

            if (editingItem) {
                const updated = await updateFusion(editingItem.id, payload);
                setFusions(prev => prev.map(f => f.id === updated.id ? updated : f));
            } else {
                const created = await createFusion(payload);
                setFusions(prev => [...prev, created]);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save fusion", error);
            alert(t('error_save_fusion') || "Erro ao salvar fusão");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteFusion(id);
            setFusions(prev => prev.filter(f => f.id !== id));
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error("Failed to delete fusion", error);
            alert(t('error_delete_fusion') || "Erro ao deletar fusão");
        }
    };

    const filteredFusions = fusions.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-7 h-7 text-emerald-500" />
                        {t('reg_fusao') || "Tipos de Fusão"}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('fusion_catalog_desc')}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || "Adicionar Novo"}
                </button>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_generic') || "Buscar..."}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:text-slate-200 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                    </div>
                ) : filteredFusions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_fusions_found') || "Nenhuma fusão encontrada."}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('name')}</th>
                                <th className="px-6 py-4">{t('attenuation')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredFusions.map(fusion => (
                                <tr key={fusion.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                                            {fusion.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                                        {fusion.attenuation} dB
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(fusion)}
                                                className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                                title={t('edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(fusion.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title={t('delete')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Delete Confirmation Overlay */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
                        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t('confirm_delete_title')}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{t('confirm_delete_message')}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 py-2 px-4 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition font-medium"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteConfirm!)}
                                className="flex-1 py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-medium shadow-md shadow-red-500/20"
                            >
                                {t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingItem ? (t('edit_fusion') || "Editar Fusão") : (t('new_fusion') || "Nova Fusão")}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <CustomInput
                                    label={t('name') || "Nome"}
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={t('name_placeholder') || 'Ex: Fusão Padrão'}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <CustomInput
                                    label={t('attenuation_db') || "Atenuação (dB)"}
                                    type="number"
                                    step="0.01"
                                    value={formData.attenuation || ''}
                                    onChange={e => setFormData({ ...formData, attenuation: e.target.value })}
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
