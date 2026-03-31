import React, { useState, useEffect, useRef } from 'react';
import { Move, X, Server, Box, Layers, PlayCircle, Settings2 } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';
import { getOLTs, OLTCatalogItem } from '../../../services/catalogService';
import { Button } from '../../common/Button';
import { CustomInput } from '../../common/CustomInput';
import { CustomSelect } from '../../common/CustomSelect';

interface AddEquipmentModalsProps {
    showAddOLT: boolean;
    showAddDIO: boolean;
    oltModalPos: { x: number; y: number };
    dioModalPos: { x: number; y: number };
    onCloseOLT: () => void;
    onCloseDIO: () => void;
    // onDragStart removed - handled internally
    newOLTConfig: { slots: number; portsPerSlot: number; modelName?: string; uplinkPorts?: number; type?: string };
    setNewOLTConfig: (config: any) => void;
    newDIOConfig: { ports: number };
    setNewDIOConfig: (config: any) => void;
    onAddOLT: () => void;
    onAddDIO: () => void;
}

/**
 * Internal Draggable Modal Wrapper
 * Isolates re-renders to this component during drag operations.
 */
const DraggableModal: React.FC<{
    title: string;
    icon: React.ReactNode;
    initialPos: { x: number; y: number };
    onClose: () => void;
    headerColor: string; // Tailwind class
    children: React.ReactNode;
}> = ({ title, icon, initialPos, onClose, headerColor, children }) => {
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
            // Lock cursor and prevent text selection during drag
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

    return (
        <div
            ref={modalRef}
            className="absolute z-[2200] flex flex-col rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1d23] animate-in fade-in zoom-in-95 duration-200"
            style={{
                transform: `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0)`,
                width: 320,
                willChange: 'transform',
                transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, scale 0.2s ease'
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div
                className="h-12 px-4 flex items-center justify-between cursor-move select-none border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#22262e]/50 rounded-t-xl"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                    <div className={`p-1.5 rounded-lg ${headerColor} text-white`}>
                        {icon}
                    </div>
                    <span className="text-sm">{title}</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <X className="w-5 h-5" />
                </Button>
            </div>

            {/* Content area */}
            <div className="p-5 space-y-5">
                {children}
            </div>
        </div>
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

export const AddEquipmentModals: React.FC<AddEquipmentModalsProps> = ({
    showAddOLT,
    showAddDIO,
    oltModalPos,
    dioModalPos,
    onCloseOLT,
    onCloseDIO,
    newOLTConfig,
    setNewOLTConfig,
    newDIOConfig,
    setNewDIOConfig,
    onAddOLT,
    onAddDIO
}) => {
    const { t } = useLanguage();
    const catalogOLTs = useCatalogOLTs(showAddOLT);

    const handleOltPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'custom') {
            setNewOLTConfig({ ...newOLTConfig, modelName: undefined });
        } else {
            const selected = catalogOLTs.find(o => o.id === val);
            if (selected) {
                setNewOLTConfig({
                    slots: selected.slots || 1,
                    portsPerSlot: selected.portsPerSlot || 16,
                    modelName: selected.name,
                    uplinkPorts: selected.uplinkPorts || 2,
                    type: selected.type || 'OLT'
                });
            }
        }
    };

    if (!showAddOLT && !showAddDIO) return null;

    return (
        <>
            {showAddOLT && (
                <DraggableModal
                    title={t('modal_add_olt_title') || "Adicionar OLT"}
                    icon={<Server className="w-4 h-4" />}
                    initialPos={oltModalPos}
                    onClose={onCloseOLT}
                    headerColor="bg-indigo-600"
                >
                    <div className="space-y-4">
                        {/* Catalog Selection */}
                        <CustomSelect
                            label={t('model')}
                            value={newOLTConfig.modelName ? catalogOLTs.find(o => o.name === newOLTConfig.modelName)?.id || 'custom' : 'custom'}
                            onChange={(val) => handleOltPresetChange({ target: { value: val } } as any)}
                            options={[
                                { value: 'custom', label: t('custom_configuration') },
                                ...catalogOLTs.map(olt => ({
                                    value: olt.id,
                                    label: olt.name,
                                    sublabel: `${olt.slots || 1}x${olt.portsPerSlot || 16}`
                                }))
                            ]}
                        />

                        <CustomSelect
                            label={t('equipment_type')}
                            value={newOLTConfig.type || 'OLT'}
                            onChange={val => setNewOLTConfig({ ...newOLTConfig, type: val })}
                            options={[
                                { value: 'OLT', label: t('type_olt') },
                                { value: 'SWITCH', label: t('type_switch') },
                                { value: 'ROUTER', label: t('type_router') },
                                { value: 'SERVER', label: t('type_server') },
                                { value: 'OTHER', label: t('type_other') }
                            ]}
                        />

                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" /> {t('chassis_config')}
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <CustomInput
                                    label={t('total_slots')}
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
                                    label={newOLTConfig.type === 'OLT' ? t('olt_ports') : t('active_ports')}
                                    type="number"
                                    min="1"
                                    max="128"
                                    value={newOLTConfig.portsPerSlot}
                                    onChange={e => setNewOLTConfig({ ...newOLTConfig, portsPerSlot: parseInt(e.target.value) })}
                                />
                            </div>

                            {/* Slot name preview */}
                            {newOLTConfig.slots > 1 && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">{t('slot_names') || 'Nomes dos Slots'}</label>
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
                                                className="w-14 h-7 text-center text-[10px] font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#22262e] text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                            <CustomInput
                                label={t('uplink_ports') || 'Uplinks'}
                                type="number"
                                min="0"
                                max="8"
                                value={newOLTConfig.uplinkPorts ?? 2}
                                onChange={e => setNewOLTConfig({ ...newOLTConfig, uplinkPorts: parseInt(e.target.value) })}
                            />

                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/30 rounded-lg p-3 flex items-start gap-3">
                            <div className="mt-0.5">
                                <PlayCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t('preview')}</h4>
                                <p className="text-[11px] text-slate-600 dark:text-indigo-200/70 leading-tight">
                                    {t('equipment_preview_msg', {
                                        type: t(`type_${(newOLTConfig.type || 'OLT').toLowerCase()}`),
                                        total: newOLTConfig.slots * newOLTConfig.portsPerSlot,
                                        slots: newOLTConfig.slots,
                                        ports: newOLTConfig.portsPerSlot
                                    })}
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={onAddOLT}
                            size="lg"
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-900/30 transition-all font-bold"
                            icon={<Server className="w-4 h-4" />}
                        >
                            {t('create_device')}
                        </Button>
                    </div>
                </DraggableModal>
            )}

            {showAddDIO && (
                <DraggableModal
                    title="Adicionar DIO"
                    icon={<Box className="w-4 h-4" />}
                    initialPos={dioModalPos}
                    onClose={onCloseDIO}
                    headerColor="bg-emerald-600"
                >
                    <div className="space-y-4">
                        <CustomSelect
                            label={t('specifications')}
                            value={newDIOConfig.ports.toString()}
                            onChange={val => setNewDIOConfig({ ...newDIOConfig, ports: parseInt(val) })}
                            options={[
                                { value: "12", label: `12 ${t('ports_label') || "Portas"} (1 ${t('tray') === 'tray' ? 'bandeja' : t('tray')})` },
                                { value: "24", label: `24 ${t('ports_label') || "Portas"} (2 ${t('trays') === 'trays' ? 'bandejas' : t('trays')})` },
                                { value: "36", label: `36 ${t('ports_label') || "Portas"} (3 ${t('bandejas') || "bandejas"})` },
                                { value: "48", label: `48 ${t('ports_label') || "Portas"} (4 ${t('bandejas') || "bandejas"})` },
                                { value: "72", label: `72 ${t('ports_label') || "Portas"} (6 ${t('bandejas') || "bandejas"})` },
                                { value: "144", label: `144 ${t('ports_label') || "Portas"} (12 ${t('bandejas') || "bandejas"})` }
                            ]}
                        />

                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-500/30 rounded-lg p-3 flex items-start gap-3">
                            <div className="mt-0.5">
                                <PlayCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t('preview')}</h4>
                                <p className="text-[11px] text-slate-600 dark:text-emerald-200/70 leading-tight">
                                    {t('dio_preview_msg', {
                                        ports: newDIOConfig.ports,
                                        trays: Math.ceil(newDIOConfig.ports / 12)
                                    })}
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={onAddDIO}
                            size="lg"
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-all font-bold"
                            icon={<Box className="w-4 h-4" />}
                        >
                            {t('create_device')}
                        </Button>
                    </div>
                </DraggableModal>
            )}
        </>
    );
};
