import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, Search, Server } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { getOLTs, createOLT, updateOLT, deleteOLT, OLTCatalogItem } from '../../services/catalogService';

export const OLTRegistration: React.FC = () => {
    const { t } = useLanguage();
    const [olts, setOlts] = useState<OLTCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<OLTCatalogItem | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'OLT',
        outputPower: 3, // Default Class B+
        slots: 1,
        portsPerSlot: 16, // Default
        description: ''
    });

    useEffect(() => {
        loadOLTs();
    }, []);

    const loadOLTs = async () => {
        setLoading(true);
        try {
            const data = await getOLTs();
            setOlts(data);
        } catch (error) {
            console.error("Failed to load OLTs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item?: OLTCatalogItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                type: item.type || 'OLT',
                outputPower: item.outputPower,
                slots: item.slots || 1,
                portsPerSlot: item.portsPerSlot || 16,
                description: item.description || ''
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                type: 'OLT',
                outputPower: 3,
                slots: 1,
                portsPerSlot: 16,
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const payload = {
                ...formData,
                // Ensure number types
                outputPower: Number(formData.outputPower),
                slots: Number(formData.slots),
                portsPerSlot: Number(formData.portsPerSlot)
            };

            if (editingItem) {
                await updateOLT(editingItem.id, payload);
            } else {
                await createOLT(payload);
            }
            setIsModalOpen(false);
            loadOLTs();
        } catch (error) {
            console.error("Failed to save OLT", error);
            console.error("Failed to save OLT", error);
            alert(t('error_saving_olt'));
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm(t('confirm_delete'))) {
            try {
                await deleteOLT(id);
                loadOLTs();
            } catch (error) {
                console.error("Failed to delete", error);
            }
        }
    };

    const filteredOLTs = olts.filter(o =>
        o.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Server className="w-7 h-7 text-sky-500" />
                        {t('reg_active_equipment')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('olt_catalog_desc')}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-500/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new')}
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
                            placeholder={t('search_generic')}
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
                ) : filteredOLTs.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_olts_found')}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('name')}</th>
                                <th className="px-6 py-4">{t('equipment_type')}</th>
                                <th className="px-6 py-4">{t('specifications')}</th>
                                <th className="px-6 py-4">{t('olt_slots')}</th>
                                <th className="px-6 py-4">{t('ports_per_slot')}</th>
                                <th className="px-6 py-4">{t('description')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredOLTs.map(olt => (
                                <tr key={olt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            {olt.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase">
                                            {olt.type || 'OLT'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                        {olt.type === 'OLT' ? (
                                            <span>{olt.outputPower > 0 ? '+' : ''}{olt.outputPower} dBm</span>
                                        ) : (
                                            <span>{olt.outputPower} W</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {olt.slots || 1}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {olt.portsPerSlot}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                        {olt.description}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(olt)}
                                                className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(olt.id)}
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
                                {editingItem ? t('modal_edit_olt_title') : t('modal_add_olt_title')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('equipment_name')}</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g., Huawei MA5608T, Cisco 2960..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('equipment_type')}</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="OLT">{t('type_olt')}</option>
                                        <option value="SWITCH">{t('type_switch')}</option>
                                        <option value="ROUTER">{t('type_router')}</option>
                                        <option value="SERVER">{t('type_server')}</option>
                                        <option value="OTHER">{t('type_other')}</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 items-end mb-4">
                                    {/* Row 1: Labels */}
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {formData.type === 'OLT' ? t('output_power') : t('power_consumption')}
                                    </label>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {t('olt_slots')}
                                    </label>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {formData.type === 'OLT' ? t('olt_ports') : t('active_ports')}
                                    </label>

                                    {/* Row 2: Inputs */}
                                    <div className="flex flex-col">
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                            value={formData.outputPower}
                                            onChange={e => setFormData({ ...formData, outputPower: parseFloat(e.target.value) })}
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1 h-4">
                                            {formData.type === 'OLT' ? t('olt_output_power_help') : ''}
                                        </p>
                                    </div>
                                    <div className="flex flex-col">
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                            value={formData.slots}
                                            onChange={e => setFormData({ ...formData, slots: parseInt(e.target.value) })}
                                        />
                                        <div className="h-4 mt-1" /> {/* Spacer to match power help text height */}
                                    </div>
                                    <div className="flex flex-col">
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500 focus:outline-none dark:text-white"
                                            value={formData.portsPerSlot}
                                            onChange={e => setFormData({ ...formData, portsPerSlot: parseInt(e.target.value) })}
                                        />
                                        <div className="h-4 mt-1" /> {/* Spacer to match power help text height */}
                                    </div>
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
                </div>
            )}
        </div>
    );
};
