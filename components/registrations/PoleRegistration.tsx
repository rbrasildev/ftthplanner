
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
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-7 h-7 text-sky-500" />
                        {t('pole_catalog') || 'Cadastro de Postes'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('pole_catalog_desc') || 'Gerencie os tipos de postes disponíveis.'}
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-500/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar Novo'}
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

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                    </div>
                ) : filteredPoles.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_results') || 'Nenhum poste encontrado'}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
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
                                            <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                                            {pole.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{pole.type}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{pole.height} m</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{pole.strength} daN</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{pole.shape}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openModal(pole)}
                                                className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                                title={t('edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(pole.id)}
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
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none dark:text-white"
                                    placeholder="Ex: Poste Concreto 10m 600daN"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('splitter_type')}</label>
                                    <select
                                        value={formData.type || 'Concreto'}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none dark:text-white"
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
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none dark:text-white"
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
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none dark:text-white"
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
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('description')}</label>
                                <textarea
                                    rows={3}
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none resize-none dark:text-white"
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
                                    className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
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
