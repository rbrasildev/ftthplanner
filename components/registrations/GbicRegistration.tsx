import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Save, Search, Fingerprint, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import {
    getGbics, createGbic, updateGbic, deleteGbic,
    GbicCatalogItem, GbicFormFactorDTO, GbicFiberModeDTO, GbicTransmissionDTO,
} from '../../services/catalogService';
import { CustomSelect, CustomInput } from '../common';

interface GbicRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const EMPTY_FORM = {
    name: '',
    brand: '',
    model: '',
    tipo: 'SFP' as GbicFormFactorDTO,
    modoFibra: 'monomodo' as GbicFiberModeDTO,
    transmissao: 'duplex' as GbicTransmissionDTO,
    rateGbps: '' as string,
    waveTxNm: '' as string,
    waveRxNm: '' as string,
    reachKm: '' as string,
    potenciaTx: -3,
    sensibilidadeRx: -20,
    description: '',
};

export const GbicRegistration: React.FC<GbicRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();
    const [items, setItems] = useState<GbicCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GbicCatalogItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const [formData, setFormData] = useState(EMPTY_FORM);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const data = await getGbics();
            setItems(data);
        } catch (error) {
            console.error('Failed to load GBICs', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item?: GbicCatalogItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                brand: item.brand ?? '',
                model: item.model ?? '',
                tipo: item.tipo,
                modoFibra: item.modoFibra,
                transmissao: item.transmissao,
                rateGbps: item.rateGbps != null ? String(item.rateGbps) : '',
                waveTxNm: item.waveTxNm != null ? String(item.waveTxNm) : '',
                waveRxNm: item.waveRxNm != null ? String(item.waveRxNm) : '',
                reachKm: item.reachKm != null ? String(item.reachKm) : '',
                potenciaTx: item.potenciaTx,
                sensibilidadeRx: item.sensibilidadeRx,
                description: item.description ?? '',
            });
        } else {
            setEditingItem(null);
            setFormData(EMPTY_FORM);
        }
        setIsModalOpen(true);
    };

    const parseOptionalNumber = (v: string): number | null => {
        if (v.trim() === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const handleSave = async () => {
        try {
            const payload = {
                name: formData.name.trim(),
                brand: formData.brand.trim() || null,
                model: formData.model.trim() || null,
                tipo: formData.tipo,
                modoFibra: formData.modoFibra,
                transmissao: formData.transmissao,
                rateGbps: parseOptionalNumber(formData.rateGbps),
                waveTxNm: parseOptionalNumber(formData.waveTxNm),
                waveRxNm: formData.transmissao === 'bidi' ? parseOptionalNumber(formData.waveRxNm) : null,
                reachKm: parseOptionalNumber(formData.reachKm),
                potenciaTx: Number(formData.potenciaTx),
                sensibilidadeRx: Number(formData.sensibilidadeRx),
                description: formData.description.trim() || null,
            };

            if (!payload.name) {
                showToast?.('Informe o nome do GBIC', 'error');
                return;
            }
            if (!Number.isFinite(payload.potenciaTx) || !Number.isFinite(payload.sensibilidadeRx)) {
                showToast?.('Potência TX e sensibilidade RX são obrigatórias', 'error');
                return;
            }

            if (editingItem) {
                await updateGbic(editingItem.id, payload);
            } else {
                await createGbic(payload);
            }
            setIsModalOpen(false);
            load();
            showToast?.(
                editingItem ? (t('toast_updated_success') || 'Atualizado com sucesso') : (t('toast_created_success') || 'Criado com sucesso'),
                'success'
            );
        } catch (error) {
            console.error('Failed to save GBIC', error);
            showToast?.('Falha ao salvar GBIC', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteGbic(id);
            load();
            setShowDeleteConfirm(null);
            showToast?.(t('toast_deleted_success') || 'Excluído com sucesso', 'success');
        } catch (error) {
            console.error('Failed to delete GBIC', error);
            showToast?.(t('error_delete') || 'Falha ao excluir', 'error');
        }
    };

    const filtered = items.filter(o => {
        const q = searchTerm.toLowerCase();
        return o.name.toLowerCase().includes(q)
            || (o.brand ?? '').toLowerCase().includes(q)
            || (o.model ?? '').toLowerCase().includes(q);
    });

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Fingerprint className="w-7 h-7 text-emerald-500" />
                        {t('reg_gbic') || 'GBIC / SFP'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('gbic_catalog_desc') || 'Cadastre modelos de transceivers ópticos (duplex e BiDi) usados em switches.'}
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar'}
                </button>
            </div>

            {/* List Container */}
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_generic') || 'Buscar...'}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Carregando...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        Nenhum GBIC cadastrado.
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Form factor</th>
                                <th className="px-6 py-4">Modo</th>
                                <th className="px-6 py-4">Taxa</th>
                                <th className="px-6 py-4">Alcance</th>
                                <th className="px-6 py-4">TX / RX</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.map(g => (
                                <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            <div>
                                                <div>{g.name}</div>
                                                {(g.brand || g.model) && (
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        {[g.brand, g.model].filter(Boolean).join(' · ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#22262e] text-[10px] font-bold uppercase w-fit">
                                                {g.tipo}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit ${
                                                g.transmissao === 'bidi'
                                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                            }`}>
                                                {g.transmissao === 'bidi' ? 'BiDi · 1FO' : 'Duplex · 2FO'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">
                                        {g.modoFibra === 'monomodo' ? 'Monomodo' : 'Multimodo'}
                                        {g.waveTxNm && (
                                            <div className="font-mono text-[11px] text-slate-500">
                                                λ {g.waveTxNm}{g.waveRxNm ? `/${g.waveRxNm}` : ''} nm
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                        {g.rateGbps ? `${g.rateGbps} Gbps` : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                        {g.reachKm ? `${g.reachKm} km` : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                        <div>TX {g.potenciaTx > 0 ? '+' : ''}{g.potenciaTx} dBm</div>
                                        <div className="text-slate-500">RX {g.sensibilidadeRx} dBm</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(g)}
                                                className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(g.id)}
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

            {/* Delete Confirmation */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#22262e] rounded-xl shadow-lg p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
                        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                            {t('confirm_delete_title') || 'Confirmar exclusão'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                            {t('confirm_delete_message') || 'Esta ação não pode ser desfeita.'}
                        </p>
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
            , document.body)}

            {/* Form Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingItem ? 'Editar GBIC' : 'Novo GBIC'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Nome */}
                            <CustomInput
                                label="Nome *"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: SFP 1G-BX 10km (BiDi U)"
                            />

                            {/* Marca/Modelo */}
                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput
                                    label="Marca"
                                    value={formData.brand}
                                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                    placeholder="Mikrotik, Cisco, Huawei..."
                                />
                                <CustomInput
                                    label="Modelo"
                                    value={formData.model}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    placeholder="S-RJ01, GLC-LH-SM..."
                                />
                            </div>

                            {/* Form factor / Modo / Transmissão */}
                            <div className="grid grid-cols-3 gap-4">
                                <CustomSelect
                                    label="Form factor *"
                                    value={formData.tipo}
                                    options={[
                                        { value: 'SFP', label: 'SFP (1G)' },
                                        { value: 'SFP+', label: 'SFP+ (10G)' },
                                        { value: 'SFP28', label: 'SFP28 (25G)' },
                                        { value: 'QSFP+', label: 'QSFP+ (40G)' },
                                        { value: 'QSFP28', label: 'QSFP28 (100G)' },
                                        { value: 'XFP', label: 'XFP' },
                                        { value: 'GBIC', label: 'GBIC (legado)' },
                                    ]}
                                    onChange={val => setFormData({ ...formData, tipo: val as GbicFormFactorDTO })}
                                    showSearch={false}
                                />
                                <CustomSelect
                                    label="Modo *"
                                    value={formData.modoFibra}
                                    options={[
                                        { value: 'monomodo', label: 'Monomodo' },
                                        { value: 'multimodo', label: 'Multimodo' },
                                    ]}
                                    onChange={val => setFormData({ ...formData, modoFibra: val as GbicFiberModeDTO })}
                                    showSearch={false}
                                />
                                <CustomSelect
                                    label="Transmissão *"
                                    value={formData.transmissao}
                                    options={[
                                        { value: 'duplex', label: 'Duplex (2 fibras)' },
                                        { value: 'bidi', label: 'BiDi (1 fibra)' },
                                    ]}
                                    onChange={val => setFormData({ ...formData, transmissao: val as GbicTransmissionDTO })}
                                    showSearch={false}
                                />
                            </div>

                            {/* Taxa / Alcance */}
                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput
                                    label="Taxa (Gbps)"
                                    type="number"
                                    step="0.1"
                                    value={formData.rateGbps}
                                    onChange={e => setFormData({ ...formData, rateGbps: e.target.value })}
                                    placeholder="1, 10, 25..."
                                />
                                <CustomInput
                                    label="Alcance (km)"
                                    type="number"
                                    step="0.1"
                                    value={formData.reachKm}
                                    onChange={e => setFormData({ ...formData, reachKm: e.target.value })}
                                    placeholder="10, 20, 40..."
                                />
                            </div>

                            {/* Comprimentos de onda */}
                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput
                                    label="λ TX (nm)"
                                    type="number"
                                    value={formData.waveTxNm}
                                    onChange={e => setFormData({ ...formData, waveTxNm: e.target.value })}
                                    placeholder="1310, 1490..."
                                />
                                <CustomInput
                                    label={formData.transmissao === 'bidi' ? 'λ RX (nm) *' : 'λ RX (nm)'}
                                    type="number"
                                    value={formData.waveRxNm}
                                    onChange={e => setFormData({ ...formData, waveRxNm: e.target.value })}
                                    placeholder={formData.transmissao === 'bidi' ? 'Obrigatório para BiDi' : 'Mesmo da TX (duplex)'}
                                    disabled={formData.transmissao === 'duplex'}
                                />
                            </div>

                            {/* Potências */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <CustomInput
                                        label="Potência TX (dBm) *"
                                        type="number"
                                        step="0.1"
                                        value={formData.potenciaTx}
                                        onChange={e => setFormData({ ...formData, potenciaTx: parseFloat(e.target.value) })}
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        Potência óptica de saída do transmissor.
                                    </p>
                                </div>
                                <div>
                                    <CustomInput
                                        label="Sensibilidade RX (dBm) *"
                                        type="number"
                                        step="0.1"
                                        value={formData.sensibilidadeRx}
                                        onChange={e => setFormData({ ...formData, sensibilidadeRx: parseFloat(e.target.value) })}
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        Mínima potência recebida para link funcional.
                                    </p>
                                </div>
                            </div>

                            {/* Descrição */}
                            <CustomInput
                                isTextarea
                                label="Descrição"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                {t('cancel') || 'Cancelar'}
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-2 font-bold shadow-lg shadow-emerald-500/20"
                            >
                                <Save className="w-4 h-4" />
                                {t('save') || 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};
