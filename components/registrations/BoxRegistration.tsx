import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save, Box, AlertTriangle, Palette, MoreHorizontal, Loader2 } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { getBoxes, createBox, updateBox, deleteBox, BoxCatalogItem } from '../../services/catalogService';

const BoxRegistration: React.FC = () => {
    const { t } = useLanguage();
    const [boxes, setBoxes] = useState<BoxCatalogItem[]>([]);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBox, setEditingBox] = useState<BoxCatalogItem | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Initial Form State
    const [formData, setFormData] = useState<Partial<BoxCatalogItem>>({
        name: '',
        brand: '',
        model: '',
        type: 'CTO',
        reserveLoopLength: 0,
        color: '#64748b',
        description: ''
    });

    useEffect(() => {
        loadBoxes();
    }, []);

    const loadBoxes = async () => {
        setIsLoading(true);
        try {
            const data = await getBoxes();
            setBoxes(data);
        } catch (error) {
            console.error("Failed to load boxes", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (box?: BoxCatalogItem) => {
        if (box) {
            setEditingBox(box);
            setFormData({ ...box });
        } else {
            setEditingBox(null);
            setFormData({
                name: '',
                brand: '',
                model: '',
                type: 'CTO',
                reserveLoopLength: 0,
                color: '#64748b',
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBox(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingBox) {
                await updateBox(editingBox.id, formData);
            } else {
                await createBox(formData as BoxCatalogItem);
            }
            loadBoxes();
            handleCloseModal();
        } catch (error) {
            console.error("Failed to save box", error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteBox(id);
            setBoxes(prev => prev.filter(b => b.id !== id));
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error("Failed to delete box", error);
        }
    };

    const filteredBoxes = boxes.filter(box =>
        box.name.toLowerCase().includes(search.toLowerCase()) ||
        box.brand?.toLowerCase().includes(search.toLowerCase()) ||
        box.model?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Box className="w-7 h-7 text-sky-500" />
                        {t('box_catalog') || 'Catálogo de Caixas'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('box_catalog_desc') || 'Gerencie os modelos de caixas de emenda e CTOs.'}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-500/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar Nova'}
                </button>
            </div>

            {/* List Container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_placeholder_box') || 'Buscar...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                    </div>
                ) : filteredBoxes.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_results') || 'Nenhuma caixa encontrada'}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('name')}</th>
                                <th className="px-6 py-4">{t('type')}</th>
                                <th className="px-6 py-4">{t('brand')} / {t('model')}</th>
                                <th className="px-6 py-4">{t('reserve')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredBoxes.map(box => (
                                <tr key={box.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full border border-slate-200 shadow-sm"
                                                style={{ backgroundColor: box.color }}
                                            ></div>
                                            {box.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${box.type === 'CTO' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
                                            {box.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {box.brand} <span className="text-slate-400">/</span> {box.model}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                                        {box.reserveLoopLength}m
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(box)}
                                                className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                                title={t('edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(box.id)}
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
                                {t('cancel') || 'Cancelar'}
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteConfirm!)}
                                className="flex-1 py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-medium shadow-md shadow-red-500/20"
                            >
                                {t('delete') || 'Excluir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 translate-y-0 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Box className="w-6 h-6 text-sky-600" />
                                {editingBox ? (t('edit_box') || 'Editar Caixa') : (t('new_box') || 'Nova Caixa')}
                            </h2>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('name')} *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                                    placeholder={t('name_placeholder') || 'Ex: CTO-PRECON'}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('brand')}</label>
                                    <input
                                        type="text"
                                        value={formData.brand}
                                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                                        placeholder={t('brand')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('model')}</label>
                                    <input
                                        type="text"
                                        value={formData.model}
                                        onChange={e => setFormData({ ...formData, model: e.target.value })}
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                                        placeholder={t('model')}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('type')}</label>
                                    <select
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as 'CTO' | 'CEO' })}
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                                    >
                                        <option value="CTO">{t('type_cto_termination')}</option>
                                        <option value="CEO">{t('type_ceo_splice')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('reserve_loop_length')}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.reserveLoopLength}
                                        onChange={e => setFormData({ ...formData, reserveLoopLength: parseFloat(e.target.value) || 0 })}
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-2">
                                    <Palette className="w-3 h-3" /> {t('ident_color')}
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 overflow-hidden shadow-sm"
                                    />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 uppercase font-mono">
                                        {formData.color}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('description')}</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors min-h-[80px]"
                                    placeholder={t('details_placeholder')}
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium shadow-lg shadow-sky-200/50 transition active:scale-95 flex items-center justify-center gap-2"
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

export default BoxRegistration;
