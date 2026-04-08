
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../LanguageContext';
import { PoleCatalogItem, getPoles, createPole, updatePole, deletePole } from '../../services/catalogService';
import { Search, Plus, Edit2, Trash2, X, Save, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { CustomSelect, CustomInput } from '../common';

interface PoleRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PoleRegistration: React.FC<PoleRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();
    const [poles, setPoles] = useState<PoleCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPole, setEditingPole] = useState<PoleCatalogItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<PoleCatalogItem>>({
        type: 'Concreto',
        shape: 'Circular',
        height: 10,
        strength: 600
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPoles();
    }, []);

    const loadPoles = async () => {
        try {
            setLoading(true);
            const data = await getPoles();
            setPoles(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingPole) {
                const updated = await updatePole(editingPole.id, formData);
                setPoles(prev => prev.map(p => p.id === updated.id ? updated : p));
            } else {
                const created = await createPole(formData as any);
                setPoles(prev => [...prev, created]);
            }
            setIsModalOpen(false);
            setEditingPole(null);
            setFormData({ type: 'Concreto', shape: 'Circular', height: 10, strength: 600 });
            if (showToast) showToast(editingPole ? (t('toast_updated_success') || 'Atualizado com sucesso') : (t('toast_created_success') || 'Criado com sucesso'), 'success');
        } catch (error) {
            console.error(error);
            if (showToast) showToast(t('error_save') || 'Falha ao salvar poste', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deletePole(id);
            setPoles(prev => prev.filter(p => p.id !== id));
            setShowDeleteConfirm(null);
            if (showToast) showToast(t('toast_deleted_success') || 'Excluído com sucesso', 'success');
        } catch (error) {
            console.error(error);
            if (showToast) showToast(t('error_delete') || 'Falha ao excluir', 'error');
        }
    };

    const openModal = (pole?: PoleCatalogItem) => {
        if (pole) {
            setEditingPole(pole);
            setFormData(pole);
        } else {
            setEditingPole(null);
            setFormData({ type: 'Concreto', shape: 'Circular', height: 10, strength: 600 });
        }
        setIsModalOpen(true);
    };

    const filteredPoles = poles.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.type.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
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
                    onClick={() => openModal()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar Novo'}
                </button>
            </div>

            {/* List Container */}
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden shadow-sm">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_placeholder_box') || 'Buscar...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="animate-pulse">
                        <div className="bg-slate-50 dark:bg-[#22262e]/50 px-6 py-4 flex gap-10">
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-3 w-14 bg-slate-200 dark:bg-slate-700/50 rounded" />)}
                        </div>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="px-6 py-4 flex items-center gap-6 border-t border-slate-100 dark:border-slate-800">
                                <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700/50" />
                                <div className="h-4 w-28 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="h-4 w-20 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="h-4 w-12 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="h-4 w-12 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="h-4 w-16 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="ml-auto h-8 w-16 bg-slate-100 dark:bg-slate-700/50 rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : filteredPoles.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_results') || 'Nenhum poste encontrado'}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('name')}</th>
                                <th className="px-6 py-4">{t('splitter_type')}</th>
                                <th className="px-6 py-4">{t('pole_height')}</th>
                                <th className="px-6 py-4">{t('pole_strength')}</th>
                                <th className="px-6 py-4">{t('pole_shape')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredPoles.map(pole => (
                                <tr key={pole.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            {pole.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{pole.type}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{pole.height}m</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{pole.strength} daN</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{pole.shape}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openModal(pole)}
                                                className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                title={t('edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(pole.id)}
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
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#22262e] rounded-xl shadow-lg p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
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
            , document.body)}

            {/* Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {editingPole ? (t('edit_pole') || 'Editar Poste') : (t('new_pole') || 'Novo Poste')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <CustomInput
                                    label={t('name')}
                                    required
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={t('name_placeholder') || 'Ex: AS-80-G.652D'}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <CustomSelect
                                        label={t('splitter_type')}
                                        value={formData.type || 'Concreto'}
                                        options={[
                                            { value: 'Concreto', label: t('concrete') || 'Concreto' },
                                            { value: 'Madeira', label: t('wood') || 'Madeira' },
                                            { value: 'Metal', label: t('metal') || 'Metal' },
                                            { value: 'Fibra', label: t('fiber') || 'Fibra' }
                                        ]}
                                        onChange={val => setFormData({ ...formData, type: val })}
                                        showSearch={false}
                                    />
                                </div>
                                <div>
                                    <CustomSelect
                                        label={t('pole_shape')}
                                        value={formData.shape || 'Circular'}
                                        options={[
                                            { value: 'Circular', label: t('shape_circular') },
                                            { value: 'Duplo T', label: t('shape_duplot') },
                                            { value: 'Quadrado', label: t('shape_square') }
                                        ]}
                                        onChange={val => setFormData({ ...formData, shape: val })}
                                        showSearch={false}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <CustomInput
                                        label={t('pole_height')}
                                        type="number"
                                        step="0.1"
                                        required
                                        value={formData.height || ''}
                                        onChange={e => setFormData({ ...formData, height: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <CustomInput
                                        label={t('pole_strength')}
                                        type="number"
                                        step="10"
                                        required
                                        value={formData.strength || ''}
                                        onChange={e => setFormData({ ...formData, strength: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div>
                                <CustomInput
                                    isTextarea
                                    label={t('description')}
                                    rows={3}
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={t('details_placeholder')}
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2.5 bg-slate-100 dark:bg-[#22262e] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm transition"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};
