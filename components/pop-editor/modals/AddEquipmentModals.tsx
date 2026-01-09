import React, { useState, useEffect, useRef } from 'react';
import { Move, X, Server, Box, Layers, PlayCircle, Settings2 } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';
import { getOLTs, OLTCatalogItem } from '../../../services/catalogService';

interface AddEquipmentModalsProps {
    showAddOLT: boolean;
    showAddDIO: boolean;
    oltModalPos: { x: number; y: number };
    dioModalPos: { x: number; y: number };
    onCloseOLT: () => void;
    onCloseDIO: () => void;
    // onDragStart removed - handled internally
    newOLTConfig: { slots: number; portsPerSlot: number; modelName?: string };
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
    const [pos, setPos] = useState(initialPos);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setPos({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y
        };
    };

    return (
        <div
            className="absolute z-[2200] flex flex-col overflow-hidden rounded-xl shadow-2xl border border-white/20 dark:border-slate-600/50 backdrop-blur-md"
            style={{
                left: pos.x,
                top: pos.y,
                width: 320,
                backgroundColor: 'rgba(15, 23, 42, 0.95)' // Dark theme glass base
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div
                className={`h-12 px-4 flex items-center justify-between cursor-move select-none border-b border-white/10 ${headerColor}`}
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2 text-white font-bold text-shadow-sm">
                    {icon}
                    <span>{title}</span>
                </div>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5 bg-gradient-to-b from-transparent to-black/20">
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
                    modelName: selected.name
                });
            }
        }
    };

    if (!showAddOLT && !showAddDIO) return null;

    return (
        <>
            {showAddOLT && (
                <DraggableModal
                    title={t('add_olt') || "Add Active Equipment (OLT)"}
                    icon={<Server className="w-5 h-5 text-indigo-200" />}
                    initialPos={oltModalPos}
                    onClose={onCloseOLT}
                    headerColor="bg-gradient-to-r from-indigo-600 to-indigo-800"
                >
                    <div className="space-y-4">
                        {/* Catalog Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-1.5">
                                <Server className="w-3.5 h-3.5" /> {t('model') || "Model"}
                            </label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                onChange={handleOltPresetChange}
                                defaultValue="custom"
                            >
                                <option value="custom">Custom Configuration</option>
                                {catalogOLTs.length > 0 && <optgroup label="Catalog">
                                    {catalogOLTs.map(olt => (
                                        <option key={olt.id} value={olt.id}>
                                            {olt.name} ({olt.slots || 1}x{olt.portsPerSlot || 16})
                                        </option>
                                    ))}
                                </optgroup>}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" /> {t('chassis_config') || "Chassis Configuration"}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                                    <span className="text-[10px] text-slate-400 block mb-1">{t('total_slots') || "Total Slots"}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="16"
                                        value={newOLTConfig.slots}
                                        onChange={e => setNewOLTConfig({ ...newOLTConfig, slots: parseInt(e.target.value) })}
                                        className="w-full bg-transparent text-white font-mono text-lg font-bold focus:outline-none"
                                    />
                                </div>
                                <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                                    <span className="text-[10px] text-slate-400 block mb-1">{t('ports_per_slot') || "Ports / Slot"}</span>
                                    <input
                                        type="number"
                                        min="8"
                                        max="16"
                                        step="8"
                                        value={newOLTConfig.portsPerSlot}
                                        onChange={e => setNewOLTConfig({ ...newOLTConfig, portsPerSlot: parseInt(e.target.value) })}
                                        className="w-full bg-transparent text-white font-mono text-lg font-bold focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3 flex items-start gap-3">
                            <div className="mt-0.5">
                                <PlayCircle className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-indigo-300">{t('preview') || "Preview"}</h4>
                                <p className="text-[11px] text-indigo-200/70 leading-tight">
                                    {t('olt_preview_msg', {
                                        total: newOLTConfig.slots * newOLTConfig.portsPerSlot,
                                        slots: newOLTConfig.slots,
                                        ports: newOLTConfig.portsPerSlot
                                    }) || `This will create a ${newOLTConfig.slots * newOLTConfig.portsPerSlot} port OLT (${newOLTConfig.slots} slots × ${newOLTConfig.portsPerSlot} ports).`}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onAddOLT}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-900/30 transition-all transform hover:translate-y-[-1px] active:translate-y-[0px] flex items-center justify-center gap-2"
                        >
                            <Server className="w-4 h-4" /> {t('create_device') || "Create Device"}
                        </button>
                    </div>
                </DraggableModal>
            )}

            {showAddDIO && (
                <DraggableModal
                    title={t('add_dio') || "Add Passive Equipment (DIO)"}
                    icon={<Box className="w-5 h-5 text-emerald-200" />}
                    initialPos={dioModalPos}
                    onClose={onCloseDIO}
                    headerColor="bg-gradient-to-r from-emerald-600 to-emerald-800"
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                                <Settings2 className="w-3.5 h-3.5" /> {t('specifications') || "Specifications"}
                            </label>
                            <div className="relative">
                                <select
                                    value={newDIOConfig.ports}
                                    onChange={e => setNewDIOConfig({ ...newDIOConfig, ports: parseInt(e.target.value) })}
                                    className="w-full h-12 bg-slate-800 border-2 border-slate-700 rounded-lg px-3 text-white font-bold appearance-none hover:border-emerald-500/50 focus:border-emerald-500 transition-colors cursor-pointer"
                                >
                                    <option value="12">12 {t('ports') || "Ports"} (1 {t('tray') || "Tray"})</option>
                                    <option value="24">24 {t('ports') || "Ports"} (2 {t('trays') || "Trays"})</option>
                                    <option value="36">36 {t('ports') || "Ports"} (3 {t('trays') || "Trays"})</option>
                                    <option value="48">48 {t('ports') || "Ports"} (4 {t('trays') || "Trays"})</option>
                                    <option value="72">72 {t('ports') || "Ports"} (6 {t('trays') || "Trays"})</option>
                                    <option value="144">144 {t('ports') || "Ports"} (12 {t('trays') || "Trays"})</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <Settings2 className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 flex items-start gap-3">
                            <div className="mt-0.5">
                                <PlayCircle className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-emerald-300">{t('preview') || "Preview"}</h4>
                                <p className="text-[11px] text-emerald-200/70 leading-tight">
                                    {t('dio_preview_msg', {
                                        ports: newDIOConfig.ports,
                                        trays: Math.ceil(newDIOConfig.ports / 12)
                                    }) || `Creates a Rack-mountable DIO with ${newDIOConfig.ports} splice capacity organized in ${Math.ceil(newDIOConfig.ports / 12)} trays.`}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onAddDIO}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-all transform hover:translate-y-[-1px] active:translate-y-[0px] flex items-center justify-center gap-2"
                        >
                            <Box className="w-4 h-4" /> {t('create_device') || "Create Device"}
                        </button>
                    </div>
                </DraggableModal>
            )}
        </>
    );
};