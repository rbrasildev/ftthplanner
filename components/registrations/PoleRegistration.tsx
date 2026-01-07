
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { PoleCatalogItem, getPoles, createPole, updatePole, deletePole } from '../../services/catalogService';
import { Search, Plus, Edit2, Trash2, X, Save, AlertTriangle, Loader2, Zap } from 'lucide-react';

export const PoleRegistration: React.FC = () => {
    const { t } = useLanguage();
    const [poles, setPoles] = useState<PoleCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPole, setEditingPole] = useState<PoleCatalogItem | null>(null);
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
        } catch (error) {
            console.error(error);
            alert('Failed to save pole');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('confirm_delete') || 'Are you sure?')) return;
        try {
            await deletePole(id);
            setPoles(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
            alert('Failed to delete');
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
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-6 h-6 text-yellow-500" />
                        {t('pole_catalog') || 'Cadastro de Postes'}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('pole_catalog_desc')}
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium flex items-center gap-2 transition shadow-lg shadow-sky-900/20"
                >
                    <Plus className="w-4 h-4" />
                    {t('add_new') || 'Adicionar Novo'}
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-hidden flex flex-col p-6">
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('search_placeholder_box') || 'Buscar...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-sky-500 transition-colors"
                    />
                </div>

                <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">{t('name')}</th>
                                    <th className="px-4 py-3">{t('splitter_type')}</th>
                                    <th className="px-4 py-3">{t('pole_height')}</th>
                                    <th className="px-4 py-3">{t('pole_strength')}</th>
                                    <th className="px-4 py-3">{t('pole_shape')}</th>
                                    <th className="px-4 py-3 text-right">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {filteredPoles.map(pole => (
                                    <tr key={pole.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{pole.name}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{pole.type}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{pole.height} m</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{pole.strength} daN</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{pole.shape}</td>
                                        <td className="px-4 py-3 text-right flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openModal(pole)}
                                                className="p-1 text-slate-400 hover:text-sky-500 transition-colors"
                                                title={t('edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(pole.id)}
                                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                title={t('delete')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredPoles.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                            {t('no_results') || 'Nenhum poste encontrado'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {editingPole ? (t('edit_pole') || 'Editar Poste') : (t('new_pole') || 'Novo Poste')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('name')}</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none"
                                    placeholder="Ex: Poste Concreto 10m 600daN"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('splitter_type')}</label>
                                    <select
                                        value={formData.type || 'Concreto'}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none"
                                    >
                                        <option value="Concreto">Concreto</option>
                                        <option value="Madeira">Madeira</option>
                                        <option value="Metal">Metal</option>
                                        <option value="Fibra">Fibra</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('pole_shape')}</label>
                                    <select
                                        value={formData.shape || 'Circular'}
                                        onChange={e => setFormData({ ...formData, shape: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none"
                                    >
                                        <option value="Circular">Circular</option>
                                        <option value="Duplo T">Duplo T</option>
                                        <option value="Quadrado">Quadrado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('pole_height')}</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        value={formData.height || ''}
                                        onChange={e => setFormData({ ...formData, height: Number(e.target.value) })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('pole_strength')}</label>
                                    <input
                                        type="number"
                                        step="10"
                                        required
                                        value={formData.strength || ''}
                                        onChange={e => setFormData({ ...formData, strength: Number(e.target.value) })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('description')}</label>
                                <textarea
                                    rows={3}
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none resize-none"
                                    placeholder="Detalhes adicionais..."
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm transition"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
