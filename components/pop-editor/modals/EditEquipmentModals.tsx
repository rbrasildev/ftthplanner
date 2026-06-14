import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Server, Box, Layers, Settings, Save, Lock, Unlock, GripHorizontal, Cpu, Network, HardDrive, Radio, Tag } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';
import { CustomInput } from '../../common/CustomInput';
import { CustomSelect } from '../../common/CustomSelect';
import { getOLTs, OLTCatalogItem } from '../../../services/catalogService';

interface EditEquipmentModalsProps {
    editingOLT: any;
    setEditingOLT: (olt: any) => void;
    handleSaveEditedOLT: () => void;
    editingDIO: any;
    setEditingDIO: (dio: any) => void;
    handleSaveEditedDIO: () => void;
}

/**
 * Internal Draggable Modal Wrapper with backdrop
 */
const DraggableModal: React.FC<{
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    initialPos: { x: number; y: number };
    onClose: () => void;
    accentColor: 'indigo' | 'emerald';
    width?: number;
    children: React.ReactNode;
}> = ({ title, subtitle, icon, initialPos, onClose, accentColor, width = 480, children }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const currentPos = useRef(initialPos);

    useEffect(() => {
        let rafId: number;
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !modalRef.current) return;
            const newX = e.clientX - dragOffset.current.x;
            const newY = e.clientY - dragOffset.current.y;
            currentPos.current = { x: newX, y: newY };

            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                if (modalRef.current) {
                    modalRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
                }
            });
        };
        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove, { passive: true });
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            cancelAnimationFrame(rafId);
        };
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragOffset.current = { x: e.clientX - currentPos.current.x, y: e.clientY - currentPos.current.y };
    };

    const gradientMap = {
        indigo: 'from-indigo-50 dark:from-indigo-900/20',
        emerald: 'from-emerald-50 dark:from-emerald-900/20'
    };

    const bgMap = {
        indigo: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
        emerald: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    };

    return (
        <>
            <div
                className="fixed inset-0 z-[2199] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
                onMouseDown={onClose}
            />
            <div
                ref={modalRef}
                className="fixed z-[2200] flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1a1d23] animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-hidden"
                style={{
                    top: 0,
                    left: 0,
                    transform: `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0)`,
                    width,
                    willChange: 'transform',
                    transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, scale 0.2s ease'
                }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className={`px-5 py-4 flex items-center justify-between cursor-move select-none border-b border-slate-200 dark:border-slate-700/30 bg-gradient-to-r ${gradientMap[accentColor]} to-transparent rounded-t-2xl`}
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bgMap[accentColor]}`}>
                            {icon}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</h3>
                            {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
                        </div>
                        <GripHorizontal className="w-4 h-4 text-slate-400 shrink-0 opacity-60 ml-1" />
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content — scrolla quando passar do max-h, header fica fixo */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                    {children}
                </div>
            </div>
        </>
    );
};

// Equipment type cards
const EQUIPMENT_TYPES = [
    { value: 'OLT', labelKey: 'type_olt', icon: Server },
    { value: 'SWITCH', labelKey: 'type_switch', icon: Network },
    { value: 'ROUTER', labelKey: 'type_router', icon: Radio },
    { value: 'SERVER', labelKey: 'type_server', icon: HardDrive },
    { value: 'OTHER', labelKey: 'type_other', icon: Cpu },
] as const;

// DIO presets
const DIO_PRESETS = [
    { ports: 12, trays: 1 },
    { ports: 24, trays: 2 },
    { ports: 36, trays: 3 },
    { ports: 48, trays: 4 },
    { ports: 72, trays: 6 },
    { ports: 144, trays: 12 },
];

export const EditEquipmentModals: React.FC<EditEquipmentModalsProps> = ({
    editingOLT,
    setEditingOLT,
    handleSaveEditedOLT,
    editingDIO,
    setEditingDIO,
    handleSaveEditedDIO
}) => {
    const { t } = useLanguage();
    const [isTypeUnlocked, setIsTypeUnlocked] = useState(false);

    // Catálogo de OLT carregado on-demand (quando o usuário abre o modal de edição).
    // Permite vincular instâncias antigas ao item correto do catálogo, fazendo o trace
    // óptico puxar a potência configurada em vez do default +3 dBm Class B+.
    const [catalogOLTs, setCatalogOLTs] = useState<OLTCatalogItem[]>([]);
    useEffect(() => {
        if (editingOLT && catalogOLTs.length === 0) {
            getOLTs().then(setCatalogOLTs).catch(console.error);
        }
    }, [editingOLT, catalogOLTs.length]);

    // Centraliza no viewport. Y começa em 5vh pra dar respiro no topo —
    // se o conteúdo for grande, o scroll interno do modal cuida do resto.
    const initialPos = {
        x: Math.max(20, window.innerWidth / 2 - 240),
        y: Math.max(20, window.innerHeight * 0.05)
    };

    const currentOltType = editingOLT?.type || 'OLT';
    const totalOltPorts = editingOLT ? (editingOLT.structure?.slots || 1) * (editingOLT.structure?.portsPerSlot || 16) : 0;
    const isOltTypeLocked = !isTypeUnlocked && (currentOltType === 'OLT' || !editingOLT?.type);
    const slotsCount = editingOLT?.structure?.slots || 0;
    const hasSlotsTab = (currentOltType === 'OLT' || !editingOLT?.type) && slotsCount > 0;
    const [oltTab, setOltTab] = useState<'general' | 'slots'>('general');

    return (
        <>
            {/* EDIT OLT MODAL */}
            {editingOLT && (
                <DraggableModal
                    title={t('modal_edit_olt_title') || "Editar Equipamento Ativo"}
                    subtitle={editingOLT.name}
                    icon={<Server className="w-4.5 h-4.5" />}
                    initialPos={initialPos}
                    onClose={() => setEditingOLT(null)}
                    accentColor="indigo"
                >
                    <div className="space-y-5">
                        {/* Tabs — só aparecem se houver Placas pra gerenciar */}
                        {hasSlotsTab && (
                            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-[#15171c] rounded-xl">
                                <button
                                    onClick={() => setOltTab('general')}
                                    className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all ${
                                        oltTab === 'general'
                                            ? 'bg-white dark:bg-[#22262e] text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Geral
                                </button>
                                <button
                                    onClick={() => setOltTab('slots')}
                                    className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        oltTab === 'slots'
                                            ? 'bg-white dark:bg-[#22262e] text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Placas
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                                        oltTab === 'slots'
                                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                    }`}>{slotsCount}</span>
                                </button>
                            </div>
                        )}

                        {(!hasSlotsTab || oltTab === 'general') && <>
                        {/* Name */}
                        <CustomInput
                            label={t('name')}
                            value={editingOLT.name}
                            onChange={e => setEditingOLT({ ...editingOLT, name: e.target.value })}
                        />

                        {/* Vincular ao catálogo (só pra OLT) — define qual item do catálogo
                            o trace óptico vai usar pra puxar potência/portPowers. Sem vínculo,
                            o trace cai no longest-prefix-match por nome (frágil) e usa default
                            +3 dBm Class B+ se não bater nada. */}
                        {(currentOltType === 'OLT' || !editingOLT.type) && (
                            <div>
                                <CustomSelect
                                    label={t('catalog_link') || 'Vincular ao catálogo'}
                                    value={editingOLT.catalogId || 'none'}
                                    options={[
                                        { value: 'none', label: t('catalog_none') || '— Sem vínculo (usa nome) —' },
                                        ...catalogOLTs.map(o => ({
                                            value: o.id,
                                            label: o.name,
                                            sublabel: `${o.outputPower > 0 ? '+' : ''}${o.outputPower} dBm`,
                                        })),
                                    ]}
                                    onChange={val => setEditingOLT({
                                        ...editingOLT,
                                        catalogId: val === 'none' ? undefined : val,
                                    })}
                                    showSearch={catalogOLTs.length > 5}
                                />
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-tight flex items-start gap-1.5">
                                    <Tag className="w-3 h-3 shrink-0 mt-0.5" />
                                    {t('catalog_link_help') || 'Garante que o orçamento óptico use a potência cadastrada para esse modelo, mesmo que o nome da instância seja customizado.'}
                                </p>
                            </div>
                        )}

                        {/* Type - Cards or Locked Card */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    {t('equipment_type')}
                                </label>
                                {isOltTypeLocked && (
                                    <button
                                        onClick={() => setIsTypeUnlocked(true)}
                                        className="text-[10px] font-bold text-slate-400 hover:text-indigo-500 flex items-center gap-1 transition-colors"
                                    >
                                        <Lock className="w-3 h-3" />
                                        {t('unlock') || 'Desbloquear'}
                                    </button>
                                )}
                                {!isOltTypeLocked && currentOltType !== 'OLT' && (
                                    <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                                        <Unlock className="w-3 h-3" />
                                        Desbloqueado
                                    </span>
                                )}
                            </div>
                            {isOltTypeLocked ? (
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#22262e]/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
                                    <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
                                        <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{t('type_olt')}</div>
                                        <div className="text-[10px] text-slate-500">{t('type_locked')}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-1.5">
                                    {EQUIPMENT_TYPES.map(({ value, labelKey, icon: Icon }) => {
                                        const isSelected = currentOltType === value;
                                        return (
                                            <button
                                                key={value}
                                                onClick={() => setEditingOLT({ ...editingOLT, type: value })}
                                                className={`
                                                    flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border-2 transition-all
                                                    ${isSelected
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                                                        : 'bg-white dark:bg-[#22262e]/50 border-slate-200 dark:border-slate-700/50 text-slate-500 hover:border-indigo-300 hover:text-indigo-500'}
                                                `}
                                                title={t(labelKey)}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span className="text-[9px] font-bold uppercase tracking-wide">{t(labelKey)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Chassis Stats (read-only) */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                <Layers className="w-3 h-3" /> {t('chassis_config')}
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                    <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</div>
                                    <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-tight">{totalOltPorts}</div>
                                    <div className="text-[10px] text-slate-500">portas</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                    <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Slots</div>
                                    <div className="text-lg font-black text-slate-700 dark:text-slate-300 leading-tight">{editingOLT.structure?.slots || 1}</div>
                                    <div className="text-[10px] text-slate-500">&times; {editingOLT.structure?.portsPerSlot || 16}p</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                    <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Uplinks</div>
                                    <div className="text-lg font-black text-slate-700 dark:text-slate-300 leading-tight">{editingOLT.structure?.uplinkPorts ?? 2}</div>
                                    <div className="text-[10px] text-slate-500">portas</div>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 italic text-center mt-2">
                                {t('olt_config_locked_msg') || 'Capacidade do chassi gerenciada pelo catálogo.'}
                            </p>
                        </div>
                        </>}

                        {/* Tab: Placas */}
                        {hasSlotsTab && oltTab === 'slots' && (
                            <div>
                                <div className="space-y-1.5">
                                    {Array.from({ length: editingOLT.structure?.slots || 1 }).map((_, idx) => {
                                        const slotConfig = editingOLT.structure?.slotsConfig?.[idx] || { active: true, portCount: editingOLT.structure?.portsPerSlot || 16 };
                                        const updateSlotConfig = (patch: any) => {
                                            const newSlotsConfig = [...(editingOLT.structure?.slotsConfig || Array.from({ length: editingOLT.structure?.slots || 1 }).map(() => ({ active: true, portCount: editingOLT.structure?.portsPerSlot || 16 })))];
                                            newSlotsConfig[idx] = { ...slotConfig, ...patch };
                                            setEditingOLT({ ...editingOLT, structure: { ...editingOLT.structure, slotsConfig: newSlotsConfig } as any });
                                        };
                                        return (
                                            <div
                                                key={idx}
                                                className={`
                                                    flex items-center gap-3 p-2.5 rounded-lg border transition-all
                                                    ${slotConfig.active
                                                        ? 'bg-white dark:bg-[#22262e] border-slate-200 dark:border-slate-700/50'
                                                        : 'bg-[#f9fafb] dark:bg-[#0f1117]/50 border-slate-200 dark:border-slate-800'}
                                                `}
                                            >
                                                {/* Slot indicator + name */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className={`
                                                        w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black
                                                        ${slotConfig.active
                                                            ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600'}
                                                    `}>
                                                        {idx + 1}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        maxLength={8}
                                                        value={slotConfig.name || ''}
                                                        placeholder={`Slot ${idx + 1}`}
                                                        onChange={e => updateSlotConfig({ name: e.target.value || undefined })}
                                                        disabled={!slotConfig.active}
                                                        className="w-20 h-8 px-2 text-[11px] font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1a1d23] text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                    />
                                                </div>

                                                {/* Port count segmented (only when active) */}
                                                {slotConfig.active && (
                                                    <div className="flex items-center bg-slate-100 dark:bg-[#1a1d23] rounded-md p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
                                                        {[8, 16].map(portCount => (
                                                            <button
                                                                key={portCount}
                                                                onClick={() => updateSlotConfig({ portCount })}
                                                                className={`
                                                                    h-7 px-2.5 rounded text-[10px] font-bold transition-all
                                                                    ${slotConfig.portCount === portCount
                                                                        ? 'bg-white dark:bg-[#2a2e38] text-indigo-600 dark:text-indigo-400 shadow-sm'
                                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}
                                                                `}
                                                            >
                                                                {portCount} portas
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Toggle Switch at right */}
                                                <label className="ml-auto flex items-center gap-2 cursor-pointer shrink-0 select-none">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${slotConfig.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                        {slotConfig.active ? 'Habilitado' : 'Vazio'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSlotConfig({ active: !slotConfig.active })}
                                                        className={`
                                                            relative w-10 h-6 rounded-full transition-colors flex-shrink-0
                                                            ${slotConfig.active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}
                                                        `}
                                                        title={slotConfig.active ? 'Clique para desabilitar' : 'Clique para habilitar'}
                                                    >
                                                        <div className={`
                                                            absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                                                            ${slotConfig.active ? 'translate-x-4' : 'translate-x-0.5'}
                                                        `} />
                                                    </button>
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={handleSaveEditedOLT}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {t('update')}
                        </button>
                    </div>
                </DraggableModal>
            )}

            {/* EDIT DIO MODAL */}
            {editingDIO && (
                <DraggableModal
                    title={t('modal_edit_dio_title') || 'Editar DIO'}
                    subtitle={`${editingDIO.ports} portas · ${Math.ceil(editingDIO.ports / 12)} bandeja${Math.ceil(editingDIO.ports / 12) > 1 ? 's' : ''}`}
                    icon={<Box className="w-4.5 h-4.5" />}
                    initialPos={initialPos}
                    onClose={() => setEditingDIO(null)}
                    accentColor="emerald"
                >
                    <div className="space-y-5">
                        {/* Name */}
                        <CustomInput
                            label={t('name') || 'Nome'}
                            value={editingDIO.name}
                            onChange={e => setEditingDIO({ ...editingDIO, name: e.target.value })}
                        />

                        {/* Capacity Preset Grid */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                {t('capacity_label')}
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {DIO_PRESETS.map(preset => {
                                    const isSelected = editingDIO.ports === preset.ports;
                                    return (
                                        <button
                                            key={preset.ports}
                                            onClick={() => setEditingDIO({
                                                ...editingDIO,
                                                ports: preset.ports,
                                                portIds: Array.from({ length: preset.ports }).map((_, i) => `${editingDIO.id}-p-${i}`),
                                            })}
                                            className={`
                                                flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl border-2 transition-all
                                                ${isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                                                    : 'bg-white dark:bg-[#22262e]/50 border-slate-200 dark:border-slate-700/50 text-slate-500 hover:border-emerald-300 hover:text-emerald-500'}
                                            `}
                                        >
                                            <div className="text-lg font-black leading-tight">{preset.ports}</div>
                                            <div className="text-[9px] font-bold uppercase tracking-wide">
                                                {preset.trays} {preset.trays === 1 ? 'bandeja' : 'bandejas'}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Per-port rename list */}
                        {(() => {
                            const TRAY_SIZE = 12;
                            const portIds: string[] = editingDIO.portIds && editingDIO.portIds.length === editingDIO.ports
                                ? editingDIO.portIds
                                : Array.from({ length: editingDIO.ports }).map((_, i) => `${editingDIO.id}-p-${i}`);
                            const trayCount = Math.ceil(portIds.length / TRAY_SIZE);
                            const labels: Record<string, string> = editingDIO.portLabels || {};
                            const updateLabel = (pid: string, value: string) => {
                                const next = { ...labels };
                                if (value) next[pid] = value;
                                else delete next[pid];
                                setEditingDIO({ ...editingDIO, portIds, portLabels: next });
                            };
                            return (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                        {t('rename_ports') || 'Renomear portas'}
                                    </label>
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                        {Array.from({ length: trayCount }).map((_, tIdx) => {
                                            const trayPorts = portIds.slice(tIdx * TRAY_SIZE, (tIdx + 1) * TRAY_SIZE);
                                            if (trayPorts.length === 0) return null;
                                            return (
                                                <div key={tIdx} className="bg-slate-50 dark:bg-[#22262e]/40 border border-slate-200 dark:border-slate-700/40 rounded-lg p-2">
                                                    <div className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
                                                        {t('tray')} {tIdx + 1}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {trayPorts.map((pid, localIdx) => (
                                                            <div key={pid} className="flex items-center gap-1.5">
                                                                <span className="w-7 shrink-0 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 text-right">
                                                                    P{localIdx + 1}
                                                                </span>
                                                                <input
                                                                    type="text"
                                                                    maxLength={24}
                                                                    value={labels[pid] || ''}
                                                                    placeholder={`P${localIdx + 1}`}
                                                                    onChange={e => updateLabel(pid, e.target.value)}
                                                                    className="flex-1 min-w-0 h-7 px-2 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1d23] text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Portas totais</div>
                                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">{editingDIO.ports}</div>
                                <div className="text-[10px] text-slate-500">capacidade</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bandejas</div>
                                <div className="text-lg font-black text-slate-700 dark:text-slate-300 leading-tight">{Math.ceil(editingDIO.ports / 12)}</div>
                                <div className="text-[10px] text-slate-500">12 portas cada</div>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700 dark:text-amber-200/80 leading-relaxed">
                                {t('dio_capacity_warning')}
                            </p>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSaveEditedDIO}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {t('save_changes')}
                        </button>
                    </div>
                </DraggableModal>
            )}
        </>
    );
};
