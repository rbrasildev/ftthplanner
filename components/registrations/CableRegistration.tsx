
import React, { useState, useEffect } from 'react';
import {
    getCables, createCable, updateCable, deleteCable, CableCatalogItem
} from '../../services/catalogService';
import { Plus, Edit2, Trash2, Search, Cable, AlertTriangle, X, Save } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { CustomSelect, CustomInput } from '../common';

const SPEC_COLORS = ['#10b981', '#86efac', '#3b82f6', '#93c5fd', '#f59e0b', '#fcd34d', '#ef4444', '#fca5a5', '#8b5cf6', '#c4b5fd', '#ec4899', '#f9a8d4', '#6b7280', '#d1d5db'];

const CableRegistration: React.FC = () => {
    const { t } = useLanguage();
    const [cables, setCables] = useState<CableCatalogItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCable, setEditingCable] = useState<CableCatalogItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<CableCatalogItem>>({
        name: '',
        brand: '',
        model: '',
        defaultLevel: 'DISTRIBUICAO',
        fiberCount: 12,
        looseTubeCount: 1,
        fibersPerTube: 12,
        attenuation: 0.35,
        fiberProfile: 'ABNT',
        description: '',
        deployedSpec: { color: '#10b981', width: 3 },
        plannedSpec: { color: '#86efac', width: 3 }
    });

    useEffect(() => {
        loadCables();
    }, []);

    const loadCables = async () => {
        try {
            const data = await getCables();
            setCables(data);
        } catch (error) {
            console.error("Failed to load cables", error);
        }
    };

    const handleOpenModal = (cable?: CableCatalogItem) => {
        if (cable) {
            setEditingCable(cable);
            setFormData(cable);
        } else {
            setEditingCable(null);
            setFormData({
                name: '',
                brand: '',
                model: '',
                defaultLevel: 'DISTRIBUICAO',
                fiberCount: 12,
                looseTubeCount: 1,
                fibersPerTube: 12,
                attenuation: 0.35,
                fiberProfile: 'ABNT',
                description: '',
                deployedSpec: { color: '#10b981', width: 3 },
                plannedSpec: { color: '#86efac', width: 3 }
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formData.name) return alert(t('name_required'));

            if (editingCable) {
                await updateCable(editingCable.id, formData);
            } else {
                await createCable(formData as Omit<CableCatalogItem, 'id' | 'updatedAt'>);
            }
            loadCables();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save cable", error);
            alert(t('error_save_cable'));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteCable(id);
            loadCables();
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error("Failed to delete cable", error);
        }
    };

    const filteredCables = cables.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.brand?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Cable className="w-7 h-7 text-emerald-500" />
                        {t('cable_catalog')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('cable_catalog_desc')}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20"
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
                            placeholder={t('search_placeholder_cable')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {filteredCables.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_results')}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('name')}</th>
                                <th className="px-6 py-4">{t('brand')}</th>
                                <th className="px-6 py-4">{t('model')}</th>
                                <th className="px-6 py-4">{t('fiber_count')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredCables.map(cable => (
                                <tr key={cable.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        {cable.name}
                                        <div className="text-xs text-slate-500 font-normal">{cable.brand} - {cable.model}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {cable.brand}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {cable.model}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {cable.fiberCount} ({cable.looseTubeCount}x{cable.fibersPerTube})
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(cable)}
                                                className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                                title={t('edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(cable.id)}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingCable ? t('edit_cable') : t('new_cable')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Main Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-3">
                                    <CustomInput
                                        label={t('name')}
                                        required
                                        placeholder={t('name_placeholder') || 'Ex: AS-80-G.652D'}
                                        value={formData.name || ''}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <CustomInput
                                        label={t('brand')}
                                        value={formData.brand || ''}
                                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                        placeholder={t('brand_placeholder')}
                                    />
                                </div>
                                <div>
                                    <CustomInput
                                        label={t('model')}
                                        value={formData.model || ''}
                                        onChange={e => setFormData({ ...formData, model: e.target.value })}
                                        placeholder={t('model_placeholder')}
                                    />
                                </div>
                                <div>
                                    <CustomSelect
                                        label={t('type')}
                                        value={formData.defaultLevel || 'DISTRIBUICAO'}
                                        options={[
                                            { value: 'DISTRIBUICAO', label: 'DISTRIBUIÇÃO' },
                                            { value: 'TRONCO', label: 'TRONCO' },
                                            { value: 'DROP', label: 'DROP' }
                                        ]}
                                        onChange={val => setFormData({ ...formData, defaultLevel: val })}
                                        showSearch={false}
                                    />
                                </div>
                            </div>

                            {/* Tech Specs */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">{t('specifications')}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <CustomInput
                                            label={t('fiber_count')}
                                            type="number"
                                            value={formData.fiberCount}
                                            onChange={e => setFormData({ ...formData, fiberCount: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <CustomInput
                                            label={t('loose_tubes')}
                                            type="number"
                                            value={formData.looseTubeCount}
                                            onChange={e => setFormData({ ...formData, looseTubeCount: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <CustomInput
                                            label={t('fibers_per_tube') || 'Fibras por Tubo'}
                                            type="number"
                                            value={formData.fibersPerTube}
                                            onChange={e => setFormData({ ...formData, fibersPerTube: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <CustomInput
                                            label={t('attenuation_db')}
                                            type="number"
                                            step="0.01"
                                            value={formData.attenuation}
                                            onChange={e => setFormData({ ...formData, attenuation: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t('fiber_color_standard')}</label>
                                    <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1 mb-3">
                                        <button
                                            onClick={() => setFormData({ ...formData, fiberProfile: 'ABNT' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${formData.fiberProfile === 'ABNT' || !formData.fiberProfile ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'}`}
                                        >
                                            {t('standard_abnt')}
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, fiberProfile: 'EIA' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${formData.fiberProfile === 'EIA' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'}`}
                                        >
                                            {t('standard_eia')}
                                        </button>
                                    </div>

                                    {/* Visual Color Preview */}
                                    <div className="flex gap-1 justify-center">
                                        {(formData.fiberProfile === 'EIA' ?
                                            ['#0000FF', '#FFA500', '#008000', '#A52A2A', '#808080', '#FFFFFF', '#FF0000', '#000000', '#FFFF00', '#EE82EE', '#FFC0CB', '#00FFFF']
                                            :
                                            ['#008000', '#FFFF00', '#FFFFFF', '#0000FF', '#FF0000', '#EE82EE', '#A52A2A', '#FFC0CB', '#000000', '#808080', '#FFA500', '#00FFFF']
                                        ).map((c, i) => (
                                            <div key={i} className="w-4 h-4 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: c }} title={`${t('unit_fiber_label').replace('{n}', (i + 1).toString())}`} />
                                        ))}
                                        <span className="text-slate-400 text-xs self-end ml-1">...</span>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <CustomInput
                                    isTextarea
                                    label={t('description')}
                                    rows={3}
                                    placeholder={t('details_placeholder')}
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            {/* Visual Representation */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Deployed Specs */}
                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Exibição: Implantado</h4>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cor</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {SPEC_COLORS.slice(0, 7).map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setFormData({ ...formData, deployedSpec: { ...formData.deployedSpec!, color: c } })}
                                                        className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-transform hover:scale-110 ${formData.deployedSpec?.color === c ? 'ring-2 ring-sky-600 ring-offset-1 scale-110' : ''}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                                <input
                                                    type="color"
                                                    className="w-8 h-8 p-0 rounded cursor-pointer border-0"
                                                    value={formData.deployedSpec?.color}
                                                    onChange={e => setFormData({ ...formData, deployedSpec: { ...formData.deployedSpec!, color: e.target.value } })}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Espessura</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center"
                                                value={formData.deployedSpec?.width}
                                                onChange={e => setFormData({ ...formData, deployedSpec: { ...formData.deployedSpec!, width: Number(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Planned Specs */}
                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Exibição: Planejado</h4>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cor</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {SPEC_COLORS.slice(7, 14).map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setFormData({ ...formData, plannedSpec: { ...formData.plannedSpec!, color: c } })}
                                                        className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-transform hover:scale-110 ${formData.plannedSpec?.color === c ? 'ring-2 ring-sky-600 ring-offset-1 scale-110' : ''}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                                <input
                                                    type="color"
                                                    className="w-8 h-8 p-0 rounded cursor-pointer border-0"
                                                    value={formData.plannedSpec?.color}
                                                    onChange={e => setFormData({ ...formData, plannedSpec: { ...formData.plannedSpec!, color: e.target.value } })}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Espessura</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center"
                                                value={formData.plannedSpec?.width}
                                                onChange={e => setFormData({ ...formData, plannedSpec: { ...formData.plannedSpec!, width: Number(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/80 rounded-b-2xl sticky bottom-0 z-10 backdrop-blur-sm">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
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

export default CableRegistration;
