import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Save, Search, Server, Layers, Zap, FileText, Sparkles, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { getOLTs, createOLT, updateOLT, deleteOLT, OLTCatalogItem } from '../../services/catalogService';
import { CustomSelect, CustomInput } from '../common';
import { useCatalogRegistration } from '../../hooks/useCatalogRegistration';
import {
    KebabMenu, DeleteConfirmDialog, EmptyState,
    SortableHeader, useSortable, ListSkeleton, ModalFooter,
} from './common/CatalogPrimitives';

type SortKey = 'name' | 'outputPower' | 'slots' | 'portsPerSlot' | 'uplinkPorts';

interface OLTRegistrationProps {
    showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface OLTFormData {
    name: string;
    outputPower: number;
    slots: number;
    portsPerSlot: number;
    uplinkPorts: number;
    portPowers: Record<string, string>; // string in form, parsed on save
    description: string;
}

const emptyForm: OLTFormData = {
    name: '',
    outputPower: 3, // Default Class B+
    slots: 1,
    portsPerSlot: 16,
    uplinkPorts: 0,
    portPowers: {},
    description: ''
};

export const OLTRegistration: React.FC<OLTRegistrationProps> = ({ showToast }) => {
    const { t } = useLanguage();

    const service = useMemo(() => ({
        list: getOLTs,
        create: createOLT,
        update: updateOLT,
        remove: deleteOLT,
    }), []);

    const {
        items: allItems,
        filteredItems: filteredOLTs,
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
    } = useCatalogRegistration<OLTCatalogItem>({
        service,
        showToast,
        messages: {
            created: t('toast_created_success') || 'Criado com sucesso',
            updated: t('toast_updated_success') || 'Atualizado com sucesso',
            deleted: t('toast_deleted_success') || 'Excluído com sucesso',
            errorSave: t('error_saving_olt') || 'Falha ao salvar equipamento',
            errorDelete: t('error_delete') || 'Falha ao excluir',
        },
        filterFn: (o, term) => o.name.toLowerCase().includes(term.toLowerCase()),
    });

    const [sortedOLTs, sort, handleSort] = useSortable<OLTCatalogItem, SortKey>(
        filteredOLTs, (i, k) => (i as any)[k],
    );
    const itemToDelete = allItems.find(i => i.id === showDeleteConfirm);

    const [formData, setFormData] = useState<OLTFormData>(emptyForm);

    useEffect(() => {
        if (!isModalOpen) return;
        if (editingItem) {
            const portPowersStr: Record<string, string> = {};
            if (editingItem.portPowers) {
                for (const [k, v] of Object.entries(editingItem.portPowers)) {
                    if (Number.isFinite(v)) portPowersStr[k] = String(v);
                }
            }
            setFormData({
                name: editingItem.name,
                outputPower: editingItem.outputPower,
                slots: editingItem.slots || 1,
                portsPerSlot: editingItem.portsPerSlot || 16,
                uplinkPorts: editingItem.uplinkPorts || 0,
                portPowers: portPowersStr,
                description: editingItem.description || ''
            });
        } else {
            setFormData(emptyForm);
        }
    }, [isModalOpen, editingItem]);

    const handleSave = async () => {
        const slotsN = Number(formData.slots) || 1;
        const ppsN = Number(formData.portsPerSlot) || 0;
        // Drop overrides outside the current grid AND empty/non-numeric values
        const cleanedPortPowers: Record<string, number> = {};
        for (const [k, v] of Object.entries(formData.portPowers)) {
            const m = k.match(/^(\d+)-(\d+)$/);
            if (!m) continue;
            const slot = parseInt(m[1], 10);
            const port = parseInt(m[2], 10);
            if (slot < 1 || slot > slotsN || port < 1 || port > ppsN) continue;
            const trimmed = String(v ?? '').trim();
            if (!trimmed) continue;
            const num = parseFloat(trimmed);
            if (Number.isFinite(num)) cleanedPortPowers[k] = num;
        }

        await save({
            ...formData,
            type: 'OLT' as const,
            outputPower: Number(formData.outputPower),
            slots: slotsN,
            portsPerSlot: ppsN,
            uplinkPorts: Number(formData.uplinkPorts),
            portPowers: Object.keys(cleanedPortPowers).length > 0 ? cleanedPortPowers : undefined,
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Server className="w-7 h-7 text-emerald-500" />
                        {t('reg_olt') || 'OLT'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('olt_catalog_desc') || 'Cadastre modelos de OLT (GPON) com slots, portas e uplinks.'}
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-emerald-900/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new')}
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
                            placeholder={t('search_generic')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-[#f9fafb] dark:bg-[#0f1117] border border-slate-200 dark:border-slate-700/30 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <ListSkeleton rows={5} />
                ) : sortedOLTs.length === 0 ? (
                    <EmptyState
                        icon={Server}
                        title={allItems.length === 0 ? 'Você ainda não tem OLTs cadastradas' : 'Nenhuma OLT encontrada'}
                        description={allItems.length === 0 ? 'Cadastre os modelos de OLT (GPON) usados nos seus projetos.' : undefined}
                        ctaLabel={allItems.length === 0 ? '+ Cadastrar primeira OLT' : undefined}
                        onCta={allItems.length === 0 ? openCreate : undefined}
                        searchTerm={allItems.length > 0 && searchTerm ? searchTerm : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-[#22262e]/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                <tr>
                                    <th className="px-6 py-3"><SortableHeader label={t('name') || 'Nome'} sortKey="name" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('output_power') || 'Potência'} sortKey="outputPower" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('olt_slots') || 'Slots'} sortKey="slots" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('ports_per_slot') || 'Portas/Slot'} sortKey="portsPerSlot" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3"><SortableHeader label={t('uplink_ports') || 'Uplinks'} sortKey="uplinkPorts" sort={sort} onSort={handleSort} /></th>
                                    <th className="px-6 py-3 text-right w-12">{t('actions') || 'Ações'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sortedOLTs.map(olt => (
                                    <tr key={olt.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                {olt.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">
                                            {olt.outputPower > 0 ? '+' : ''}{olt.outputPower} dBm
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{olt.slots || 1}</td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{olt.portsPerSlot}</td>
                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{olt.uplinkPorts ?? 0}</td>
                                        <td className="px-6 py-3 text-right">
                                            <KebabMenu actions={[
                                                { label: t('edit') || 'Editar', icon: Edit2, onClick: () => openEdit(olt) },
                                                { label: t('delete') || 'Excluir', icon: Trash2, onClick: () => setShowDeleteConfirm(olt.id), destructive: true },
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
                itemType="OLT"
                itemLabel={itemToDelete?.name || ''}
                hint="OLTs já instaladas nos projetos não serão afetadas."
                onCancel={() => setShowDeleteConfirm(null)}
                onConfirm={confirmDelete}
            />

            {/* Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-700/50 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/30 bg-gradient-to-r from-emerald-50 dark:from-emerald-900/20 to-transparent rounded-t-2xl shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                    <Server className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                        {editingItem ? t('modal_edit_olt_title') : t('modal_add_olt_title')}
                                    </h2>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                        {editingItem ? formData.name : (t('olt_modal_subtitle') || 'Cadastrar um modelo de OLT')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={closeModal}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            {/* SECTION: Identificação */}
                            <section>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" /> {t('section_identification') || 'Identificação'}
                                </div>
                                <CustomInput
                                    label={t('equipment_name')}
                                    required
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={t('equipment_name_placeholder') || 'e.g., Huawei MA5608T, Cisco 2960...'}
                                />
                            </section>

                            {/* SECTION: Chassi */}
                            <section>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <Layers className="w-3 h-3" /> {t('section_chassis') || 'Chassi'}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <CustomInput
                                        label={t('olt_slots') || 'Slots'}
                                        type="number"
                                        value={formData.slots}
                                        onChange={e => setFormData({ ...formData, slots: parseInt(e.target.value) || 1 })}
                                    />
                                    <CustomInput
                                        label={t('ports_per_slot') || 'Portas/slot'}
                                        type="number"
                                        value={formData.portsPerSlot}
                                        onChange={e => setFormData({ ...formData, portsPerSlot: parseInt(e.target.value) || 0 })}
                                    />
                                    <CustomInput
                                        label={t('uplink_ports') || 'Uplinks'}
                                        type="number"
                                        value={formData.uplinkPorts || 0}
                                        onChange={e => setFormData({ ...formData, uplinkPorts: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                {/* Stats */}
                                {(() => {
                                    const slotsN = Math.max(1, Number(formData.slots) || 1);
                                    const ppsN = Math.max(0, Number(formData.portsPerSlot) || 0);
                                    const upN = Math.max(0, Number(formData.uplinkPorts) || 0);
                                    return (
                                        <div className="mt-3 grid grid-cols-3 gap-2">
                                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3">
                                                <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">GPON</div>
                                                <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 leading-tight">{slotsN * ppsN}</div>
                                                <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70">portas</div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-[#22262e]/50 border border-slate-200 dark:border-slate-700/30 rounded-xl p-3">
                                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Layout</div>
                                                <div className="text-sm font-black text-slate-700 dark:text-slate-300 leading-tight">{slotsN} × {ppsN}</div>
                                                <div className="text-[10px] text-slate-500">slots × portas</div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-[#22262e]/50 border border-slate-200 dark:border-slate-700/30 rounded-xl p-3">
                                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Uplinks</div>
                                                <div className="text-lg font-black text-slate-700 dark:text-slate-300 leading-tight">{upN}</div>
                                                <div className="text-[10px] text-slate-500">portas</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </section>

                            {/* SECTION: Potência óptica */}
                            <section>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <Zap className="w-3 h-3" /> {t('section_optical_power') || 'Potência óptica'}
                                </div>
                                <div>
                                    <CustomInput
                                        label={t('output_power') || 'Potência TX global (dBm)'}
                                        type="number"
                                        step="0.1"
                                        value={formData.outputPower}
                                        onChange={e => setFormData({ ...formData, outputPower: parseFloat(e.target.value) })}
                                    />
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                                        {t('olt_output_power_help') || 'Classe B+ = 3 dBm · C+ = 5 dBm'}
                                    </p>
                                </div>

                                {/* Per-port overrides */}
                                {(() => {
                                    const slotsN = Math.max(1, Number(formData.slots) || 1);
                                    const ppsN = Math.max(0, Number(formData.portsPerSlot) || 0);
                                    if (ppsN === 0) return null;
                                    const globalPower = Number.isFinite(Number(formData.outputPower)) ? Number(formData.outputPower) : 3;
                                    const overrideCount = Object.keys(formData.portPowers).filter(k => {
                                        const m = k.match(/^(\d+)-(\d+)$/);
                                        if (!m) return false;
                                        const s = parseInt(m[1], 10), p = parseInt(m[2], 10);
                                        return s >= 1 && s <= slotsN && p >= 1 && p <= ppsN && (formData.portPowers[k] ?? '').trim() !== '';
                                    }).length;
                                    const updateOne = (key: string, value: string) => {
                                        setFormData(prev => {
                                            const next = { ...prev.portPowers };
                                            if (value.trim() === '') delete next[key];
                                            else next[key] = value;
                                            return { ...prev, portPowers: next };
                                        });
                                    };
                                    const clearAll = () => setFormData(prev => ({ ...prev, portPowers: {} }));
                                    return (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                                        {t('per_port_power') || 'Potência por porta'}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                                                        {t('per_port_power_help') || `Vazio = usa global (${globalPower} dBm)`}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {overrideCount > 0 && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                                            {overrideCount} {overrideCount === 1 ? 'override' : 'overrides'}
                                                        </span>
                                                    )}
                                                    {overrideCount > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={clearAll}
                                                            className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                                                            title={t('clear_overrides') || 'Limpar overrides'}
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                            {t('clear') || 'Limpar'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1 border border-slate-200 dark:border-slate-700/40 rounded-xl p-3 bg-[#f9fafb] dark:bg-[#0f1117]/40">
                                                {Array.from({ length: slotsN }).map((_, sIdx) => {
                                                    const slot = sIdx + 1;
                                                    return (
                                                        <div key={slot} className="bg-white dark:bg-[#1a1d23]/60 border border-slate-200 dark:border-slate-700/40 rounded-lg p-2.5">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                                                    Slot {slot}
                                                                </span>
                                                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/40" />
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                                {Array.from({ length: ppsN }).map((_, pIdx) => {
                                                                    const port = pIdx + 1;
                                                                    const key = `${slot}-${port}`;
                                                                    const value = formData.portPowers[key] ?? '';
                                                                    const hasValue = value.trim() !== '';
                                                                    return (
                                                                        <div
                                                                            key={key}
                                                                            className={`
                                                                                flex items-center rounded-md border transition-all overflow-hidden
                                                                                ${hasValue
                                                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-500/40'
                                                                                    : 'bg-white dark:bg-[#1a1d23] border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'}
                                                                            `}
                                                                        >
                                                                            <span className={`
                                                                                w-9 shrink-0 h-7 flex items-center justify-center text-[10px] font-mono font-bold
                                                                                ${hasValue
                                                                                    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-500/10'
                                                                                    : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#22262e]/40'}
                                                                            `}>
                                                                                P{port}
                                                                            </span>
                                                                            <input
                                                                                type="number"
                                                                                step="0.1"
                                                                                value={value}
                                                                                placeholder={`${globalPower}`}
                                                                                onChange={e => updateOne(key, e.target.value)}
                                                                                className="flex-1 min-w-0 h-7 px-2 text-[11px] bg-transparent text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                                                                            />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </section>

                            {/* SECTION: Descrição */}
                            <section>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <FileText className="w-3 h-3" /> {t('description')}
                                </div>
                                <CustomInput
                                    isTextarea
                                    label=""
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={t('description_placeholder') || 'Notas sobre este modelo (opcional)'}
                                />
                            </section>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/30 bg-[#f9fafb]/60 dark:bg-[#0f1117]/60 rounded-b-2xl shrink-0">
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
