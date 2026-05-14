import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Save, Search, Filter, GitFork, AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { getSplitters, createSplitter, updateSplitter, deleteSplitter, SplitterCatalogItem } from '../../services/catalogService';
import { CustomSelect, CustomInput } from '../common';
import { parseFloatLocale } from '../../utils/parseUtils';
import { useCatalogRegistration } from '../../hooks/useCatalogRegistration';

interface SplitterRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const emptyForm = {
    name: '',
    type: 'PLC',
    mode: 'Balanced',
    inputs: 1,
    outputs: 8,
    connectorType: 'Unconnectorized',
    polishType: '' as string,
    allowCustomConnections: false,
    attenuation: '',
    port1: '',
    port2: '',
    description: ''
};

export const SplitterRegistration: React.FC<SplitterRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();

    const service = useMemo(() => ({
        list: getSplitters,
        create: createSplitter,
        update: updateSplitter,
        remove: deleteSplitter,
    }), []);

    const {
        filteredItems: filteredSplitters,
        loading,
        saving,
        searchTerm,
        setSearchTerm,
        isModalOpen,
        editingItem,
        openCreate,
        openEdit,
        closeModal,
        showDeleteConfirm,
        setShowDeleteConfirm,
        save,
        confirmDelete,
    } = useCatalogRegistration<SplitterCatalogItem>({
        service,
        showToast,
        messages: {
            created: t('toast_created_success') || 'Criado com sucesso',
            updated: t('toast_updated_success') || 'Atualizado com sucesso',
            deleted: t('toast_deleted_success') || 'Excluído com sucesso',
            errorSave: t('error_saving_splitter') || 'Falha ao salvar splitter',
            errorDelete: t('error_delete') || 'Falha ao excluir',
        },
        filterFn: (s, term) => {
            const t = term.toLowerCase();
            return s.name.toLowerCase().includes(t) || s.type.toLowerCase().includes(t);
        },
    });

    const [formData, setFormData] = useState(emptyForm);

    // Helper to extract display value from attenuation (which might be JSON)
    const getAttenuationValue = (val: any): string => {
        if (val === null || val === undefined) return '-';
        let displayVal = val;

        if (typeof val === 'object') {
            // Unbalanced: port1/port2 with actual values
            if (val.port1 !== undefined && val.port2 !== undefined && (val.port1 !== '' || val.port2 !== '')) {
                if (val.port1 && val.port2) return `P1: ${val.port1} dB / P2: ${val.port2} dB`;
                return '-';
            }
            // Try known keys: value, v, x, or first numeric value found
            if (val.value !== undefined && val.value !== '') displayVal = val.value;
            else if (val.v !== undefined) displayVal = val.v;
            else if (val.x !== undefined) displayVal = val.x;
            else {
                const keys = Object.keys(val).filter(k => !['port1', 'port2', 'value'].includes(k));
                const firstVal = keys.length > 0 ? val[keys[0]] : null;
                if (firstVal !== null && firstVal !== undefined && firstVal !== '') displayVal = firstVal;
                else return '-';
            }
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

    // Sincroniza form com editingItem ao abrir o modal. Reextrai port1/port2/value
    // do shape persistido (que pode ser objeto JSON, string-com-objeto, ou número plano)
    // pra repopular os inputs corretamente.
    useEffect(() => {
        if (!isModalOpen) return;
        if (!editingItem) {
            setFormData(emptyForm);
            return;
        }

        let p1 = '';
        let p2 = '';
        let rawAtt: any = editingItem.attenuation;
        if (typeof rawAtt === 'string' && rawAtt.trim().startsWith('{')) {
            try { rawAtt = JSON.parse(rawAtt); } catch { /* keep as string */ }
        }
        if (rawAtt && typeof rawAtt === 'object') {
            if (rawAtt.port1) p1 = rawAtt.port1;
            if (rawAtt.port2) p2 = rawAtt.port2;
        }

        let attValue = '';
        if (rawAtt && typeof rawAtt === 'object') {
            if (rawAtt.value !== undefined) attValue = String(rawAtt.value);
            else if (rawAtt.x !== undefined) attValue = String(rawAtt.x);
            else {
                const keys = Object.keys(rawAtt).filter(k => k !== 'port1' && k !== 'port2');
                if (keys.length > 0) attValue = String(rawAtt[keys[0]]);
            }
        } else if (rawAtt !== undefined && rawAtt !== null) {
            attValue = String(rawAtt);
        }

        setFormData({
            name: editingItem.name,
            type: editingItem.type,
            mode: editingItem.mode,
            inputs: editingItem.inputs,
            outputs: editingItem.outputs,
            connectorType: editingItem.connectorType || 'Unconnectorized',
            polishType: editingItem.polishType || '',
            allowCustomConnections: (editingItem.connectorType === 'Connectorized')
                ? (editingItem.allowCustomConnections !== false)
                : (editingItem.allowCustomConnections === true),
            attenuation: attValue,
            port1: p1,
            port2: p2,
            description: editingItem.description || ''
        });
    }, [isModalOpen, editingItem]);

    const handleSave = async () => {
        // Normaliza vírgula → ponto e mantém como string (forma serializada que o backend
        // espera). parseFloatLocale tolera locale pt-BR sem precisar repetir replace(',','.').
        const normalize = (v: any) => {
            if (v === null || v === undefined || v === '') return v;
            return String(parseFloatLocale(v));
        };

        let attenuationValue: any = normalize(formData.attenuation);

        if (formData.mode === 'Unbalanced') {
            // Shape: { value, port1, port2 }. `value` espelha port1 por compatibilidade
            // com leitores antigos; opticalUtils trata unbalanced via port1/port2.
            const p1 = normalize(formData.port1);
            const p2 = normalize(formData.port2);
            attenuationValue = { value: p1, port1: p1, port2: p2 };
        } else {
            try {
                const attStr = String(formData.attenuation);
                if (attStr.trim().startsWith('{')) {
                    attenuationValue = JSON.parse(attStr);
                } else {
                    attenuationValue = { value: normalize(formData.attenuation) };
                }
            } catch {
                attenuationValue = { value: normalize(formData.attenuation) };
            }
        }

        await save({ ...formData, attenuation: attenuationValue });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <GitFork className="w-7 h-7 text-emerald-500" />
                        {t('reg_splitter') || 'Splitter Registration'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('splitter_catalog_desc') || 'Manage your splitter catalog types.'}
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_splitter') || 'Add Splitter'}
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
                            placeholder={t('search_splitters')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="animate-pulse">
                        <div className="bg-slate-50 dark:bg-[#22262e]/50 px-6 py-4 flex gap-8">
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-3 w-14 bg-slate-200 dark:bg-slate-700/50 rounded" />)}
                        </div>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="px-6 py-4 flex items-center gap-6 border-t border-slate-100 dark:border-slate-800">
                                <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700/50" />
                                <div className="h-4 w-28 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="h-5 w-14 bg-slate-100 dark:bg-slate-700/50 rounded-full" />
                                <div className="h-4 w-20 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="h-4 w-10 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="h-4 w-16 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                <div className="ml-auto h-8 w-16 bg-slate-100 dark:bg-slate-700/50 rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : filteredSplitters.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('no_results') || 'Nenhum splitter encontrado'}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('splitter_name')}</th>
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
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            {splitter.name}
                                        </div>
                                    </td>
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
                                                onClick={() => openEdit(splitter)}
                                                className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(splitter.id)}
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/30 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('confirm_delete_title')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('confirm_delete_message')}</p>
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-[#1a1d23]/50 flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 transform active:scale-95 transition-all"
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
                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700/30 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center justify-between bg-slate-50/50 dark:bg-[#1a1d23]/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <GitFork className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                                        {editingItem ? t('edit_splitter') : t('new_splitter')}
                                    </h3>
                                    <p className="text-xs text-slate-500">{t('splitter_catalog_desc') || 'Gerencie os modelos de splitters no catálogo.'}</p>
                                </div>
                            </div>
                            <button onClick={closeModal} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-[#1a1d23]">
                            <div>
                                <CustomInput
                                    label={t('splitter_name')}
                                    required
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={t('splitter_name_placeholder') || 'Ex: 1:8 Balanced PLC'}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <CustomSelect
                                        label={t('splitter_mode')}
                                        value={formData.mode}
                                        options={[
                                            { value: 'Balanced', label: t('splitter_mode_balanced') },
                                            { value: 'Unbalanced', label: t('splitter_mode_unbalanced') }
                                        ]}
                                        onChange={val => setFormData({ ...formData, mode: val })}
                                        showSearch={false}
                                    />
                                </div>
                            </div>



                            <div>
                                <CustomSelect
                                    label={t('splitter_connector_type')}
                                    value={formData.connectorType || 'Unconnectorized'}
                                    options={[
                                        { value: 'Unconnectorized', label: t('unconnectorized') || 'Não Conectorizado' },
                                        { value: 'Connectorized', label: t('connectorized') || 'Conectorizado' }
                                    ]}
                                    onChange={val => setFormData({ ...formData, connectorType: val, polishType: val === 'Connectorized' ? (formData.polishType || 'UPC') : '', allowCustomConnections: val === 'Connectorized' })}
                                    showSearch={false}
                                />
                            </div>

                            {formData.connectorType === 'Connectorized' && (
                                <div>
                                    <CustomSelect
                                        label={t('polish_type') || 'Tipo de Polimento'}
                                        value={formData.polishType || 'UPC'}
                                        options={[
                                            { value: 'UPC', label: 'UPC' },
                                            { value: 'APC', label: 'APC' },
                                            { value: 'PC', label: 'PC' }
                                        ]}
                                        onChange={val => setFormData({ ...formData, polishType: val })}
                                        showSearch={false}
                                    />
                                    <div className="flex items-center gap-2 mt-1.5 ml-1">
                                        <span className={`w-3 h-3 rounded-full border ${formData.polishType === 'APC' ? 'bg-green-500 border-green-600' : 'bg-blue-500 border-blue-600'}`} />
                                        <span className="text-[10px] text-slate-500">{formData.polishType === 'APC' ? t('polish_apc_hint') || 'Conector Verde (APC - Angulado)' : t('polish_upc_hint') || 'Conector Azul (UPC/PC - Reto)'}</span>
                                    </div>
                                </div>
                            )}

                            <label className="flex items-center gap-2 mt-4 ml-1 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={!!formData.allowCustomConnections}
                                    onChange={e => setFormData({ ...formData, allowCustomConnections: e.target.checked })}
                                    className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 dark:focus:ring-emerald-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t('allow_custom_connections') || 'Permitir conexão de clientes'}
                                </span>
                            </label>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <CustomInput
                                        label={t('inputs')}
                                        type="number"
                                        value={formData.inputs}
                                        onChange={e => setFormData({ ...formData, inputs: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <CustomInput
                                        label={t('outputs')}
                                        type="number"
                                        value={formData.outputs}
                                        onChange={e => setFormData({ ...formData, outputs: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div>
                                {formData.mode === 'Unbalanced' ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <CustomInput
                                                label={t('attenuation_port1')}
                                                value={formData.port1 || ''}
                                                onChange={e => setFormData({ ...formData, port1: e.target.value })}
                                                placeholder={t('attenuation_placeholder') || 'e.g. 14'}
                                            />
                                        </div>
                                        <div>
                                            <CustomInput
                                                label={t('attenuation_port2')}
                                                value={formData.port2 || ''}
                                                onChange={e => setFormData({ ...formData, port2: e.target.value })}
                                                placeholder={t('attenuation_placeholder') || 'e.g. 0.5'}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <CustomInput
                                            label={t('attenuation_db')}
                                            value={formData.attenuation || ''}
                                            onChange={e => setFormData({ ...formData, attenuation: e.target.value })}
                                            placeholder={t('attenuation_placeholder') || 'e.g., 10.5'}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <CustomInput
                                    isTextarea
                                    label={t('description')}
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-[#1a1d23]/50 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={closeModal}
                                className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95 transition-all"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};
