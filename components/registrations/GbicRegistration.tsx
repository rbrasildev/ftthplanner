import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Save, Search, Fingerprint } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import {
    getGbics, createGbic, updateGbic, deleteGbic,
    GbicCatalogItem, GbicFormFactorDTO, GbicFiberModeDTO, GbicTransmissionDTO,
} from '../../services/catalogService';
import { CustomSelect, CustomInput } from '../common';
import { useCatalogRegistration } from '../../hooks/useCatalogRegistration';
import {
    KebabMenu, DeleteConfirmDialog, EmptyState, FilterChips,
    SortableHeader, useSortable, ListSkeleton, ModalFooter,
} from './common/CatalogPrimitives';

type SortKey = 'name' | 'tipo' | 'modoFibra' | 'rateGbps' | 'reachKm';

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

    const service = useMemo(() => ({
        list: getGbics,
        create: createGbic,
        update: updateGbic,
        remove: deleteGbic,
    }), []);

    const {
        items: allItems,
        filteredItems: searched,
        loading, saving,
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
    } = useCatalogRegistration<GbicCatalogItem>({
        service,
        showToast,
        messages: {
            created: t('toast_created_success') || 'Criado com sucesso',
            updated: t('toast_updated_success') || 'Atualizado com sucesso',
            deleted: t('toast_deleted_success') || 'Excluído com sucesso',
            errorSave: 'Falha ao salvar GBIC',
            errorDelete: t('error_delete') || 'Falha ao excluir',
        },
        filterFn: (o, term) => {
            const q = term.toLowerCase();
            return o.name.toLowerCase().includes(q)
                || (o.brand ?? '').toLowerCase().includes(q)
                || (o.model ?? '').toLowerCase().includes(q);
        },
    });

    const [tipoFilter, setTipoFilter] = useState<string | null>(null);
    const filtered = useMemo(() => {
        if (!tipoFilter) return searched;
        return searched.filter(i => i.tipo === tipoFilter);
    }, [searched, tipoFilter]);

    const [sorted, sort, handleSort] = useSortable<GbicCatalogItem, SortKey>(
        filtered, (i, k) => (i as any)[k],
    );

    const chips = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const i of searched) counts[i.tipo] = (counts[i.tipo] || 0) + 1;
        return [
            { value: null, label: 'Todos', count: searched.length },
            ...Object.keys(counts).sort().map(t => ({ value: t, label: t, count: counts[t] })),
        ];
    }, [searched]);

    const itemToDelete = allItems.find(i => i.id === showDeleteConfirm);

    const [formData, setFormData] = useState(EMPTY_FORM);

    useEffect(() => {
        if (!isModalOpen) return;
        if (!editingItem) {
            setFormData(EMPTY_FORM);
            return;
        }
        setFormData({
            name: editingItem.name,
            brand: editingItem.brand ?? '',
            model: editingItem.model ?? '',
            tipo: editingItem.tipo,
            modoFibra: editingItem.modoFibra,
            transmissao: editingItem.transmissao,
            rateGbps: editingItem.rateGbps != null ? String(editingItem.rateGbps) : '',
            waveTxNm: editingItem.waveTxNm != null ? String(editingItem.waveTxNm) : '',
            waveRxNm: editingItem.waveRxNm != null ? String(editingItem.waveRxNm) : '',
            reachKm: editingItem.reachKm != null ? String(editingItem.reachKm) : '',
            potenciaTx: editingItem.potenciaTx,
            sensibilidadeRx: editingItem.sensibilidadeRx,
            description: editingItem.description ?? '',
        });
    }, [isModalOpen, editingItem]);

    const parseOptionalNumber = (v: string): number | null => {
        if (v.trim() === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const handleSave = async () => {
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

        await save(payload);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
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
                    onClick={openCreate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || 'Adicionar'}
                </button>
            </div>

            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 space-y-3">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder={t('search_generic') || 'Buscar...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-[#f9fafb] dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm" />
                    </div>
                    {!loading && allItems.length > 0 && (
                        <FilterChips options={chips} value={tipoFilter} onChange={setTipoFilter} />
                    )}
                </div>

                {loading ? (
                    <ListSkeleton rows={5} />
                ) : sorted.length === 0 ? (
                    <EmptyState
                        icon={Fingerprint}
                        title={allItems.length === 0 ? 'Você ainda não tem GBICs cadastrados' : 'Nenhum GBIC encontrado'}
                        description={allItems.length === 0 ? 'Cadastre modelos de transceivers ópticos usados nos seus equipamentos.' : undefined}
                        ctaLabel={allItems.length === 0 ? '+ Cadastrar primeiro GBIC' : undefined}
                        onCta={allItems.length === 0 ? openCreate : undefined}
                        searchTerm={allItems.length > 0 && (searchTerm || tipoFilter) ? (searchTerm || `tipo: ${tipoFilter}`) : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                <tr>
                                    <th className="px-6 py-3"><SortableHeader label="Nome" sortKey="name" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label="Form factor" sortKey="tipo" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label="Modo" sortKey="modoFibra" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label="Taxa" sortKey="rateGbps" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label="Alcance" sortKey="reachKm" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3">TX / RX</th>
                                    <th className="px-6 py-3 text-right w-12">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sorted.map(g => (
                                    <tr key={g.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                <div>
                                                    <div>{g.name}</div>
                                                    {(g.brand || g.model) && (
                                                        <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                            {[g.brand, g.model].filter(Boolean).join(' · ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase w-fit bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                    {g.tipo}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${g.transmissao === 'bidi'
                                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'}`}>
                                                    {g.transmissao === 'bidi' ? 'BiDi · 1FO' : 'Duplex · 2FO'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 text-xs">
                                            {g.modoFibra === 'monomodo' ? 'Monomodo' : 'Multimodo'}
                                            {g.waveTxNm && (
                                                <div className="text-[11px] text-slate-500 tabular-nums">
                                                    λ {g.waveTxNm}{g.waveRxNm ? `/${g.waveRxNm}` : ''} nm
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 text-xs tabular-nums">
                                            {g.rateGbps ? `${g.rateGbps} Gbps` : '—'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 text-xs tabular-nums">
                                            {g.reachKm ? `${g.reachKm} km` : '—'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 text-xs tabular-nums">
                                            <div>TX {g.potenciaTx > 0 ? '+' : ''}{g.potenciaTx} dBm</div>
                                            <div className="text-slate-500">RX {g.sensibilidadeRx} dBm</div>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <KebabMenu actions={[
                                                { label: t('edit') || 'Editar', icon: Edit2, onClick: () => openEdit(g) },
                                                { label: t('delete') || 'Excluir', icon: Trash2, onClick: () => setShowDeleteConfirm(g.id), destructive: true },
                                            ]} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <DeleteConfirmDialog
                isOpen={!!showDeleteConfirm}
                itemType="GBIC"
                itemLabel={itemToDelete?.name || ''}
                onCancel={() => setShowDeleteConfirm(null)}
                onConfirm={confirmDelete}
            />

            {/* Form Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingItem ? 'Editar GBIC' : 'Novo GBIC'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
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

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/60 dark:bg-[#1a1d23]/60">
                            <ModalFooter
                                onCancel={closeModal}
                                primaryLabel={t('save') || 'Salvar'}
                                primaryIcon={Save}
                                primaryLoading={saving}
                                primaryType="button"
                                onPrimary={handleSave}
                            />
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};
