import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, Search, Filter, GitFork } from 'lucide-react';
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
        port1: '', // New field for Unbalanced Port 1
        port2: '', // New field for Unbalanced Port 2
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

    // Helper to extract display value from attenuation (which might be JSON)
    const getAttenuationValue = (val: any): string => {
        if (val === null || val === undefined) return '';
        let displayVal = val;

        if (typeof val === 'object') {
            // Check for new port1/port2 format
            if (val.port1 && val.port2) {
                return `P1: ${val.port1}dB / P2: ${val.port2}dB`;
            }
            displayVal = val.value || val.v || val.x || JSON.stringify(val);
        } else if (typeof val === 'string') {
            try {
                if (val.trim().startsWith('{')) {
                    const parsed = JSON.parse(val);
                    if (parsed.port1 && parsed.port2) {
                        return `P1: ${parsed.port1}dB / P2: ${parsed.port2}dB`;
                    }
                    displayVal = parsed.value || parsed.v || parsed.x || val;
                } else {
                    displayVal = val;
                }
            } catch (e) {
                displayVal = val;
            }
        }

        if (typeof displayVal === 'number' || (typeof displayVal === 'string' && !isNaN(parseFloat(displayVal)) && !displayVal.trim().startsWith('{'))) {
            return `${displayVal} dB`;
        }

        return String(displayVal);
    };

    const handleOpenModal = (item?: SplitterCatalogItem) => {
        if (item) {
            setEditingItem(item);

            // Extract port1 and port2 if available
            let p1 = '';
            let p2 = '';
            let att = getAttenuationValue(item.attenuation);
            // NOTE: getAttenuationValue returns formatted string. We need raw values for inputs.
            // Let's re-parse for the form state.

            let rawAtt = item.attenuation;
            if (typeof rawAtt === 'string' && String(rawAtt).trim().startsWith('{')) {
                try { rawAtt = JSON.parse(rawAtt); } catch (e) { }
            }

            if (rawAtt && typeof rawAtt === 'object') {
                if (rawAtt.port1) p1 = rawAtt.port1;
                if (rawAtt.port2) p2 = rawAtt.port2;
            }

            setFormData({
                name: item.name,
                type: item.type,
                mode: item.mode,
                inputs: item.inputs,
                outputs: item.outputs,
                attenuation: typeof rawAtt === 'object' && rawAtt.value ? rawAtt.value : (typeof rawAtt === 'object' ? '' : rawAtt), // Try to keep 'value' for the main input if needed, though we might hide it.
                port1: p1,
                port2: p2,
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
                port1: '',
                port2: '',
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            // Ensure we save as a JSON object with 'value' key if it's not already complex JSON
            let attenuationValue: any = formData.attenuation;

            // SPECIAL LOGIC FOR UNBALANCED
            if (formData.mode === 'Unbalanced') {
                // Construct JSON object with port1, port2, and a default value (use P1 as value or max of both?)
                // Usually unbalanced is like 70/30. The "loss" depends on the port.
                // But opticalUtils.ts expects a single 'value' for generic loss if it doesn't know better.
                // We'll store: { value: <p1>, port1: <p1>, port2: <p2> }
                // So if legacy code reads .value, it gets port1 attenuation (highest usually? or lowest?). 
                // Let's assume port 1 is the first output group.
                attenuationValue = {
                    value: formData.port1,
                    port1: formData.port1,
                    port2: formData.port2
                };
            } else {
                try {
                    const attStr = String(formData.attenuation);
                    if (attStr.trim().startsWith('{')) {
                        attenuationValue = JSON.parse(attStr);
                    } else {
                        attenuationValue = { value: formData.attenuation };
                    }
                } catch (e) {
                    attenuationValue = { value: formData.attenuation };
                }
            }

            const payload = {
                ...formData,
                attenuation: attenuationValue
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
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <GitFork className="w-7 h-7 text-sky-500" />
                        {t('reg_splitter') || 'Splitter Registration'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('splitter_catalog_desc') || 'Manage your splitter catalog types.'}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-500/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_splitter') || 'Add Splitter'}
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
                            placeholder={t('search_splitters')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="text-center text-slate-500">{t('loading')}</div>
                    </div>
                ) : filteredSplitters.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_results') || 'Nenhum splitter encontrado'}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('splitter_name')}</th>
                                <th className="px-6 py-4">{t('splitter_type')}</th>
                                <th className="px-6 py-4">{t('splitter_mode')}</th>
                                <th className="px-6 py-4">{t('splitter_ports')}</th>
                                <th className="px-6 py-4">{t('attenuation')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredSplitters.map(splitter => (
                                <tr key={splitter.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                                            {splitter.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{splitter.type}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {splitter.mode === 'Balanced' ? t('splitter_mode_balanced') : t('splitter_mode_unbalanced')}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {splitter.inputs} {t('splitter_in')} / {splitter.outputs} {t('splitter_out')}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                                        {getAttenuationValue(splitter.attenuation)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(splitter)}
                                                className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(splitter.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                                {formData.mode === 'Unbalanced' ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('attenuation_port1')}</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                                value={formData.port1}
                                                onChange={e => setFormData({ ...formData, port1: e.target.value })}
                                                placeholder="e.g. 14"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('attenuation_port2')}</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                                value={formData.port2}
                                                onChange={e => setFormData({ ...formData, port2: e.target.value })}
                                                placeholder="e.g. 0.5"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('attenuation_db')}</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                            value={formData.attenuation}
                                            onChange={e => setFormData({ ...formData, attenuation: e.target.value })}
                                            placeholder="e.g., 10.5"
                                        />
                                    </div>
                                )}

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
                                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center gap-2 font-bold shadow-lg shadow-sky-500/20"
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
