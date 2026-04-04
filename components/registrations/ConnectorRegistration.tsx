import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { getFusions, createFusion, updateFusion, deleteFusion, FusionCatalogItem } from '../../services/catalogService';
import { Plus, Trash2, Search, Loader2, Edit2, X, Save, AlertTriangle, Plug } from 'lucide-react';
import { CustomInput, CustomSelect } from '../common';

interface ConnectorRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ConnectorRegistration: React.FC<ConnectorRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();
    const [connectors, setConnectors] = useState<FusionCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FusionCatalogItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        polishType: 'UPC',
        attenuation: '0.3'
    });

    useEffect(() => { loadConnectors(); }, []);

    const loadConnectors = async () => {
        setLoading(true);
        try {
            const data = await getFusions('connector');
            setConnectors(data);
        } catch (error) {
            console.error("Failed to load connectors", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item?: FusionCatalogItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                polishType: item.polishType || 'UPC',
                attenuation: String(item.attenuation)
            });
        } else {
            setEditingItem(null);
            setFormData({ name: '', polishType: 'UPC', attenuation: '0.3' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;
        try {
            const payload = {
                name: formData.name,
                attenuation: parseFloat(formData.attenuation) || 0,
                category: 'connector' as string,
                polishType: formData.polishType
            };
            if (editingItem) {
                const updated = await updateFusion(editingItem.id, payload);
                setConnectors(prev => prev.map(c => c.id === updated.id ? updated : c));
            } else {
                const created = await createFusion(payload);
                setConnectors(prev => [...prev, created]);
            }
            setIsModalOpen(false);
            if (showToast) showToast(editingItem ? (t('toast_updated_success') || 'Atualizado') : (t('toast_created_success') || 'Criado'), 'success');
        } catch (error) {
            console.error("Failed to save connector", error);
            if (showToast) showToast(t('error_save') || "Erro ao salvar", 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteFusion(id);
            setConnectors(prev => prev.filter(c => c.id !== id));
            setShowDeleteConfirm(null);
            if (showToast) showToast(t('toast_deleted_success') || 'Excluído', 'success');
        } catch (error) {
            console.error("Failed to delete connector", error);
            if (showToast) showToast(t('error_delete') || "Erro ao deletar", 'error');
        }
    };

    const filtered = connectors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const polishColor = (type?: string) => type === 'APC' ? 'bg-green-500' : type === 'PC' ? 'bg-slate-400' : 'bg-blue-500';

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Plug className="w-7 h-7 text-emerald-500" />
                        {t('reg_conector') || "Conectores"}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('connector_catalog_desc') || "Gerencie os tipos de conectores e seus valores de atenuação."}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || "Adicionar Novo"}
                </button>
            </div>

            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_generic') || "Buscar..."}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:text-slate-200 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_connectors_found') || "Nenhum conector encontrado."}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('name')}</th>
                                <th className="px-6 py-4">{t('polish_type') || 'Polimento'}</th>
                                <th className="px-6 py-4">{t('attenuation')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-sm ${polishColor(item.polishType)}`} />
                                            {item.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${item.polishType === 'APC' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                            {item.polishType || 'UPC'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                                        {item.attenuation} dB
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleOpenModal(item)} className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title={t('edit')}>
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setShowDeleteConfirm(item.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={t('delete')}>
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

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#22262e] rounded-xl shadow-lg p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
                        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t('confirm_delete_title')}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{t('confirm_delete_message')}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2 px-4 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition font-medium">{t('cancel')}</button>
                            <button onClick={() => handleDelete(showDeleteConfirm!)} className="flex-1 py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-700 transition font-medium shadow-md shadow-red-500/20">{t('delete')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingItem ? (t('edit_connector') || "Editar Conector") : (t('new_connector') || "Novo Conector")}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
                            <CustomInput
                                label={t('name') || "Nome"}
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t('connector_name_placeholder') || 'Ex: Conector SC/APC'}
                                autoFocus
                            />

                            <CustomSelect
                                label={t('polish_type') || "Tipo de Polimento"}
                                value={formData.polishType}
                                options={[
                                    { value: 'UPC', label: 'UPC' },
                                    { value: 'APC', label: 'APC' },
                                    { value: 'PC', label: 'PC' }
                                ]}
                                onChange={val => setFormData({ ...formData, polishType: val })}
                                showSearch={false}
                            />

                            <div className="flex items-center gap-2 ml-1">
                                <span className={`w-3 h-3 rounded-sm border ${formData.polishType === 'APC' ? 'bg-green-500 border-green-600' : 'bg-blue-500 border-blue-600'}`} />
                                <span className="text-[10px] text-slate-500">
                                    {formData.polishType === 'APC' ? (t('polish_apc_hint') || 'Conector Verde (APC - Angulado)') : (t('polish_upc_hint') || 'Conector Azul (UPC/PC - Reto)')}
                                </span>
                            </div>

                            <CustomInput
                                label={t('attenuation_db') || "Atenuação (dB)"}
                                type="number"
                                step="0.01"
                                value={formData.attenuation || ''}
                                onChange={e => setFormData({ ...formData, attenuation: e.target.value })}
                            />

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition">{t('cancel')}</button>
                                <button type="submit" className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2">
                                    <Save className="w-4 h-4" /> {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
