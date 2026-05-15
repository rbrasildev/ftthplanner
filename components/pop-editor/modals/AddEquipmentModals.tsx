import React, { useState, useEffect, useRef } from 'react';
import { X, Server, Box, Layers, Cpu, Network, HardDrive, Radio, Settings, Zap, GripHorizontal } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';
import { getOLTs, OLTCatalogItem } from '../../../services/catalogService';
import { CustomInput } from '../../common/CustomInput';
import { CustomSelect } from '../../common/CustomSelect';
import type { ActiveEquipmentType } from '../../../types';

interface AddEquipmentModalsProps {
    showAddOLT: boolean;
    showAddDIO: boolean;
    showAddActive?: boolean;
    oltModalPos: { x: number; y: number };
    dioModalPos: { x: number; y: number };
    activeModalPos?: { x: number; y: number };
    onCloseOLT: () => void;
    onCloseDIO: () => void;
    onCloseActive?: () => void;
    newOLTConfig: { slots: number; portsPerSlot: number; modelName?: string; uplinkPorts?: number; catalogId?: string };
    setNewOLTConfig: (config: any) => void;
    newDIOConfig: { ports: number };
    setNewDIOConfig: (config: any) => void;
    newActiveConfig?: { type: ActiveEquipmentType; portCount: number; name?: string };
    setNewActiveConfig?: (config: any) => void;
    onAddOLT: () => void;
    onAddDIO: () => void;
    onAddActive?: () => void;
}

/**
 * Internal Draggable Modal Wrapper
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
}> = ({ title, subtitle, icon, initialPos, onClose, accentColor, width = 380, children }) => {
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
        dragOffset.current = {
            x: e.clientX - currentPos.current.x,
            y: e.clientY - currentPos.current.y
        };
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
            {/* Backdrop - click outside to close */}
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

                {/* Content area */}
                <div className="p-5">
                    {children}
                </div>
            </div>
        </>
    );
};

// --- Custom Hook for OLTs ---
const useCatalogOLTs = (show: boolean) => {
    const [olts, setOlts] = useState<OLTCatalogItem[]>([]);
    useEffect(() => {
        if (show && olts.length === 0) {
            getOLTs().then(setOlts).catch(console.error);
        }
    }, [show]);
    return olts;
};


// Tipos de ativos Ethernet — reutilizam a funcionalidade de Switch.
// A única diferença entre eles é label/ícone; a mecânica (SFP, DIO, peer) é idêntica.
const ACTIVE_TYPES: { value: ActiveEquipmentType; labelKey: string; icon: any }[] = [
    { value: 'SWITCH', labelKey: 'type_switch', icon: Network },
    { value: 'ROUTER', labelKey: 'type_router', icon: Radio },
    { value: 'SERVER', labelKey: 'type_server', icon: HardDrive },
    { value: 'OTHER', labelKey: 'type_other', icon: Cpu },
];

// DIO presets
const DIO_PRESETS = [
    { ports: 12, trays: 1 },
    { ports: 24, trays: 2 },
    { ports: 36, trays: 3 },
    { ports: 48, trays: 4 },
    { ports: 72, trays: 6 },
    { ports: 144, trays: 12 },
];

export const AddEquipmentModals: React.FC<AddEquipmentModalsProps> = ({
    showAddOLT,
    showAddDIO,
    showAddActive = false,
    oltModalPos,
    dioModalPos,
    activeModalPos = { x: 200, y: 200 },
    onCloseOLT,
    onCloseDIO,
    onCloseActive,
    newOLTConfig,
    setNewOLTConfig,
    newDIOConfig,
    setNewDIOConfig,
    newActiveConfig,
    setNewActiveConfig,
    onAddOLT,
    onAddDIO,
    onAddActive,
}) => {
    const { t } = useLanguage();
    const catalogOLTs = useCatalogOLTs(showAddOLT);

    const handleOltPresetChange = (val: string) => {
        if (val === 'custom') {
            setNewOLTConfig({ ...newOLTConfig, modelName: undefined, catalogId: undefined });
        } else {
            const selected = catalogOLTs.find(o => o.id === val);
            if (selected) {
                setNewOLTConfig({
                    slots: selected.slots || 1,
                    portsPerSlot: selected.portsPerSlot || 16,
                    modelName: selected.name,
                    catalogId: selected.id,
                    uplinkPorts: selected.uplinkPorts || 2,
                });
            }
        }
    };

    if (!showAddOLT && !showAddDIO && !showAddActive) return null;

    const totalPorts = newOLTConfig.slots * newOLTConfig.portsPerSlot;

    return (
        <>
            {showAddOLT && (
                <DraggableModal
                    title="Adicionar OLT"
                    subtitle={newOLTConfig.modelName || t('custom_configuration')}
                    icon={<Server className="w-4.5 h-4.5" />}
                    initialPos={oltModalPos}
                    onClose={onCloseOLT}
                    accentColor="indigo"
                >
                    <div className="space-y-5">
                        {/* Model from catalog */}
                        <CustomSelect
                            label={t('model')}
                            value={newOLTConfig.modelName ? catalogOLTs.find(o => o.name === newOLTConfig.modelName)?.id || 'custom' : 'custom'}
                            onChange={handleOltPresetChange}
                            options={[
                                { value: 'custom', label: t('custom_configuration') },
                                ...catalogOLTs.map(olt => ({
                                    value: olt.id,
                                    label: olt.name,
                                    sublabel: `${olt.slots || 1}x${olt.portsPerSlot || 16}`
                                }))
                            ]}
                        />

                        {/* Chassis Config */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                <Layers className="w-3 h-3" /> {t('chassis_config')}
                            </label>
                            <div className="grid grid-cols-3 gap-2 items-end">
                                <CustomInput
                                    label="Slots"
                                    type="number"
                                    min="1"
                                    max="16"
                                    value={newOLTConfig.slots}
                                    onChange={e => {
                                        const slots = parseInt(e.target.value) || 1;
                                        setNewOLTConfig({ ...newOLTConfig, slots });
                                    }}
                                />
                                <CustomInput
                                    label="Portas"
                                    type="number"
                                    min="1"
                                    max="128"
                                    value={newOLTConfig.portsPerSlot}
                                    onChange={e => setNewOLTConfig({ ...newOLTConfig, portsPerSlot: parseInt(e.target.value) })}
                                />
                                <CustomInput
                                    label="Uplink"
                                    type="number"
                                    min="0"
                                    max="8"
                                    value={newOLTConfig.uplinkPorts ?? 2}
                                    onChange={e => setNewOLTConfig({ ...newOLTConfig, uplinkPorts: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>

                        {/* Slot names if multiple slots */}
                        {newOLTConfig.slots > 1 && (
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                                    <Settings className="w-3 h-3" /> {t('slot_names') || 'Nomes dos Slots'}
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {Array.from({ length: Math.min(newOLTConfig.slots, 16) }).map((_, i) => (
                                        <input
                                            key={i}
                                            type="text"
                                            maxLength={6}
                                            placeholder={`S${i + 1}`}
                                            defaultValue={(newOLTConfig as any).slotNames?.[i] || ''}
                                            onChange={e => {
                                                const names = [...((newOLTConfig as any).slotNames || [])];
                                                names[i] = e.target.value;
                                                setNewOLTConfig({ ...newOLTConfig, slotNames: names });
                                            }}
                                            className="w-14 h-8 text-center text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#22262e] text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</div>
                                <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-tight">{totalPorts}</div>
                                <div className="text-[10px] text-slate-500">portas</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Slots</div>
                                <div className="text-lg font-black text-slate-700 dark:text-slate-300 leading-tight">{newOLTConfig.slots}</div>
                                <div className="text-[10px] text-slate-500">&times; {newOLTConfig.portsPerSlot}p</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Uplinks</div>
                                <div className="text-lg font-black text-slate-700 dark:text-slate-300 leading-tight">{newOLTConfig.uplinkPorts ?? 2}</div>
                                <div className="text-[10px] text-slate-500">portas</div>
                            </div>
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={onAddOLT}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Zap className="w-4 h-4" />
                            {t('create_device')}
                        </button>
                    </div>
                </DraggableModal>
            )}

            {showAddDIO && (
                <DraggableModal
                    title={t('modal_add_dio_title') || "Adicionar DIO"}
                    subtitle={`${newDIOConfig.ports} portas · ${Math.ceil(newDIOConfig.ports / 12)} bandeja${Math.ceil(newDIOConfig.ports / 12) > 1 ? 's' : ''}`}
                    icon={<Box className="w-4.5 h-4.5" />}
                    initialPos={dioModalPos}
                    onClose={onCloseDIO}
                    accentColor="emerald"
                >
                    <div className="space-y-5">
                        {/* Preset Grid */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                {t('specifications')}
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {DIO_PRESETS.map(preset => {
                                    const isSelected = newDIOConfig.ports === preset.ports;
                                    return (
                                        <button
                                            key={preset.ports}
                                            onClick={() => setNewDIOConfig({ ...newDIOConfig, ports: preset.ports })}
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

                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Portas totais</div>
                                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">{newDIOConfig.ports}</div>
                                <div className="text-[10px] text-slate-500">capacidade</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30">
                                <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bandejas</div>
                                <div className="text-lg font-black text-slate-700 dark:text-slate-300 leading-tight">{Math.ceil(newDIOConfig.ports / 12)}</div>
                                <div className="text-[10px] text-slate-500">12 portas cada</div>
                            </div>
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={onAddDIO}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Zap className="w-4 h-4" />
                            {t('create_device')}
                        </button>
                    </div>
                </DraggableModal>
            )}

            {showAddActive && newActiveConfig && setNewActiveConfig && onAddActive && onCloseActive && (
                <DraggableModal
                    title="Adicionar ativo Ethernet"
                    subtitle={`${newActiveConfig.portCount} porta${newActiveConfig.portCount !== 1 ? 's' : ''} SFP`}
                    icon={<Network className="w-4.5 h-4.5" />}
                    initialPos={activeModalPos}
                    onClose={onCloseActive}
                    accentColor="emerald"
                >
                    <div className="space-y-5">
                        {/* Type picker */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                Tipo de equipamento
                            </label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {ACTIVE_TYPES.map(({ value, labelKey, icon: Icon }) => {
                                    const isSelected = newActiveConfig.type === value;
                                    return (
                                        <button
                                            key={value}
                                            onClick={() => setNewActiveConfig({ ...newActiveConfig, type: value })}
                                            className={`
                                                flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border-2 transition-all
                                                ${isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                                                    : 'bg-white dark:bg-[#22262e]/50 border-slate-200 dark:border-slate-700/50 text-slate-500 hover:border-emerald-300 hover:text-emerald-500'}
                                            `}
                                            title={t(labelKey)}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="text-[9px] font-bold uppercase tracking-wide">{t(labelKey)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Name (optional) + port count */}
                        <div className="grid grid-cols-2 gap-3">
                            <CustomInput
                                label="Nome"
                                placeholder="Auto"
                                value={newActiveConfig.name ?? ''}
                                onChange={e => setNewActiveConfig({ ...newActiveConfig, name: e.target.value })}
                            />
                            <CustomInput
                                label="Portas SFP"
                                type="number"
                                min="1"
                                max="96"
                                value={newActiveConfig.portCount}
                                onChange={e => setNewActiveConfig({ ...newActiveConfig, portCount: Math.max(1, parseInt(e.target.value) || 1) })}
                            />
                        </div>

                        {/* Summary */}
                        <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/30 text-xs text-slate-600 dark:text-slate-300">
                            Este ativo usa a mesma mecânica do switch (GBIC, alocação em DIO, peer trace, LEDs TX/RX).
                            O tipo define apenas o ícone/rótulo exibido.
                        </div>

                        <button
                            onClick={onAddActive}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Zap className="w-4 h-4" />
                            {t('create_device') || 'Criar'}
                        </button>
                    </div>
                </DraggableModal>
            )}

        </>
    );
};
