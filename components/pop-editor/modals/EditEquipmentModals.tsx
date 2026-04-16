import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Server, Box, Layers, Settings, Save, Lock, Unlock, GripHorizontal, Cpu, Network, HardDrive, Radio, Power, PowerOff } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';
import { CustomInput } from '../../common/CustomInput';

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
}> = ({ title, subtitle, icon, initialPos, onClose, accentColor, width = 400, children }) => {
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
                className="absolute inset-0 z-[2199] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
                onMouseDown={onClose}
            />
            <div
                ref={modalRef}
                className="absolute z-[2200] flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1a1d23] animate-in fade-in zoom-in-95 duration-200"
                style={{
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

                {/* Content */}
                <div className="p-5">
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

    const initialPos = { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 250 };

    const currentOltType = editingOLT?.type || 'OLT';
    const totalOltPorts = editingOLT ? (editingOLT.structure?.slots || 1) * (editingOLT.structure?.portsPerSlot || 16) : 0;
    const isOltTypeLocked = !isTypeUnlocked && (currentOltType === 'OLT' || !editingOLT?.type);

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
                        {/* Name */}
                        <CustomInput
                            label={t('name')}
                            value={editingOLT.name}
                            onChange={e => setEditingOLT({ ...editingOLT, name: e.target.value })}
                        />

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

                        {/* Manage Slots (OLT only) */}
                        {(currentOltType === 'OLT' || !editingOLT.type) && (editingOLT.structure?.slots || 1) > 0 && (
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                    <Settings className="w-3 h-3" /> {t('manage_slots')}
                                </label>
                                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
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
                                                    flex items-center gap-2 p-2 rounded-lg border transition-all
                                                    ${slotConfig.active
                                                        ? 'bg-white dark:bg-[#22262e] border-slate-200 dark:border-slate-700/50'
                                                        : 'bg-slate-50 dark:bg-[#151820]/50 border-slate-200 dark:border-slate-800 opacity-70'}
                                                `}
                                            >
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    value={slotConfig.name || ''}
                                                    placeholder={`S${idx + 1}`}
                                                    onChange={e => updateSlotConfig({ name: e.target.value || undefined })}
                                                    className="w-14 h-8 text-center text-[10px] font-bold rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1a1d23] text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shrink-0"
                                                />

                                                <button
                                                    onClick={() => updateSlotConfig({ active: !slotConfig.active })}
                                                    className={`
                                                        h-8 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all
                                                        ${slotConfig.active
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}
                                                    `}
                                                    title={slotConfig.active ? t('slot_active') : t('slot_empty')}
                                                >
                                                    {slotConfig.active ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                                                    {slotConfig.active ? t('slot_active') : t('slot_empty')}
                                                </button>

                                                {slotConfig.active && (
                                                    <div className="ml-auto flex gap-1 shrink-0">
                                                        {[8, 16].map(portCount => (
                                                            <button
                                                                key={portCount}
                                                                onClick={() => updateSlotConfig({ portCount })}
                                                                className={`
                                                                    h-8 px-2.5 rounded-md text-[10px] font-bold transition-all
                                                                    ${slotConfig.portCount === portCount
                                                                        ? 'bg-indigo-500 text-white'
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}
                                                                `}
                                                            >
                                                                {portCount}p
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
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
                                            onClick={() => setEditingDIO({ ...editingDIO, ports: preset.ports })}
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
