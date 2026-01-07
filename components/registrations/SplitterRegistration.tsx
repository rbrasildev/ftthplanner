import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, Search, Filter } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { getSplitters, createSplitter, updateSplitter, deleteSplitter, SplitterCatalogItem } from '../../services/catalogService';

export const SplitterRegistration: React.FC = () => {
    const { t } = useLanguage();
    const [splitters, setSplitters] = useState<SplitterCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SplitterCatalogItem | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'PLC',
        mode: 'Balanced',
        inputs: 1,
        outputs: 8,
        attenuation: '', // We will parse this to JSON if needed, or store as string in JSON
        description: ''
    });

    useEffect(() => {
        loadSplitters();
    }, []);

    const loadSplitters = async () => {
        setLoading(true);
        try {
            const data = await getSplitters();
            setSplitters(data);
        } catch (error) {
            console.error("Failed to load splitters", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item?: SplitterCatalogItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                type: item.type,
                mode: item.mode,
                inputs: item.inputs,
                outputs: item.outputs,
                attenuation: typeof item.attenuation === 'string' ? item.attenuation : JSON.stringify(item.attenuation),
                description: item.description || ''
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                type: 'PLC',
                mode: 'Balanced',
                inputs: 1,
                outputs: 8,
                attenuation: '',
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const payload = {
                ...formData,
                attenuation: formData.attenuation // Store as string or parse if specific format required. Backend expects Json.
                // Simple string is valid JSON value.
            };

            if (editingItem) {
                await updateSplitter(editingItem.id, payload);
            } else {
                await createSplitter(payload);
            }
            setIsModalOpen(false);
            loadSplitters();
        } catch (error) {
            console.error("Failed to save splitter", error);
            alert(t('error_saving_splitter'));
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm(t('confirm_delete') || 'Are you sure?')) {
            try {
                await deleteSplitter(id);
                loadSplitters();
            } catch (error) {
                console.error("Failed to delete", error);
            }
        }
    };

    const filteredSplitters = splitters.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {t('reg_splitter') || 'Splitter Registration'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {t('splitter_catalog_desc') || 'Manage your splitter catalog types.'}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>{t('add_splitter') || 'Add Splitter'}</span>
                </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4 mb-6 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('search_splitters')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">{t('loading')}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSplitters.map(splitter => (
                        <div key={splitter.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{splitter.name}</h3>
                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mt-1 inline-block">
                                        {splitter.type} • {splitter.mode === 'Balanced' ? t('splitter_mode_balanced') : t('splitter_mode_unbalanced')}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleOpenModal(splitter)} className="p-2 text-slate-400 hover:text-sky-500 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(splitter.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400 mb-4">
                                <div>
                                    <span className="block text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t('splitter_ports')}</span>
                                    {splitter.inputs} {t('splitter_in')} / {splitter.outputs} {t('splitter_out')}
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t('attenuation')}</span>
                                    {typeof splitter.attenuation === 'string' ? splitter.attenuation : JSON.stringify(splitter.attenuation)}
                                </div>
                            </div>

                            {splitter.description && (
                                <p className="text-sm text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-3">
                                    {splitter.description}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingItem ? t('edit_splitter') : t('new_splitter')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('splitter_name')}</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., 1:8 Balanced PLC"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('splitter_type')}</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="PLC">PLC</option>
                                        <option value="FBT">FBT</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('splitter_mode')}</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                        value={formData.mode}
                                        onChange={e => setFormData({ ...formData, mode: e.target.value })}
                                    >
                                        <option value="Balanced">{t('splitter_mode_balanced')}</option>
                                        <option value="Unbalanced">{t('splitter_mode_unbalanced')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inputs')}</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                        value={formData.inputs}
                                        onChange={e => setFormData({ ...formData, inputs: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('outputs')}</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                        value={formData.outputs}
                                        onChange={e => setFormData({ ...formData, outputs: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('attenuation_db')}</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                    value={formData.attenuation}
                                    onChange={e => setFormData({ ...formData, attenuation: e.target.value })}
                                    placeholder={formData.mode === 'Balanced' ? "e.g., 10.5" : "e.g., 5%: 14dB, 95%: 0.5dB"}
                                />
                                <p className="text-xs text-slate-500 mt-1">{t('attenuation_help')}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('description')}</label>
                                <textarea
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white min-h-[80px]"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
