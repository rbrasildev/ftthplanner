import React, { useState, useEffect, useRef } from 'react';
import { Pencil, AlertTriangle, X, Server, Box, Layers, PlayCircle, Settings2, Save, Lock, Unlock, Zap, Router } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';

interface EditEquipmentModalsProps {
    editingOLT: any;
    setEditingOLT: (olt: any) => void;
    handleSaveEditedOLT: () => void;
    editingDIO: any;
    setEditingDIO: (dio: any) => void; // Updated type from any to function
    handleSaveEditedDIO: () => void;
}

/**
 * Internal Draggable Modal Wrapper (Duplicated for isolation as requested - keeping functional code safe)
 */
const DraggableModal: React.FC<{
    title: string;
    icon: React.ReactNode;
    initialPos: { x: number; y: number };
    onClose: () => void;
    headerColor: string;
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
        const handleMouseUp = () => { setIsDragging(false); };

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
        dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };

    return (
        <div
            className="absolute z-[2200] flex flex-col overflow-hidden rounded-xl shadow-2xl border border-white/20 dark:border-slate-600/50 backdrop-blur-md"
            style={{ left: pos.x, top: pos.y, width: 320, backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className={`h-12 px-4 flex items-center justify-between cursor-move select-none border-b border-white/10 ${headerColor}`} onMouseDown={handleMouseDown}>
                <div className="flex items-center gap-2 text-white font-bold text-shadow-sm">{icon}<span>{title}</span></div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5 bg-gradient-to-b from-transparent to-black/20">{children}</div>
        </div>
    );
};

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

    // Default centered positions for edit modals (dynamic based on viewport would be better but keeping simple)
    const initialPos = { x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 200 };

    return (
        <>
            {/* EDIT OLT MODAL */}
            {editingOLT && (
                <DraggableModal
                    title={t('modal_edit_olt_title')}
                    icon={<Pencil className="w-4 h-4 text-white" />}
                    initialPos={initialPos}
                    onClose={() => setEditingOLT(null)}
                    headerColor="bg-gradient-to-r from-sky-600 to-sky-800"
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-sky-300 uppercase flex items-center gap-1.5">
                                <Settings2 className="w-3.5 h-3.5" /> {t('name')}
                            </label>
                            <input
                                type="text"
                                value={editingOLT.name}
                                onChange={e => setEditingOLT({ ...editingOLT, name: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-sky-500 font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-sky-300 uppercase flex items-center gap-1.5">
                                <Settings2 className="w-3.5 h-3.5" /> {t('equipment_type')}
                            </label>

                            {!isTypeUnlocked && (editingOLT.type === 'OLT' || !editingOLT.type) ? (
                                <div className="flex items-center justify-between bg-slate-800/30 border border-slate-700/50 rounded-lg p-2.5 transition-all group ring-1 ring-emerald-500/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                            <Server className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-white block leading-tight">{t('type_olt')}</span>
                                            <span className="text-[9px] text-slate-500 block">{t('type_locked')}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsTypeUnlocked(true)}
                                        className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                        title={t('unlock') || "Desbloquear"}
                                    >
                                        <Lock className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <div className="relative">
                                        <select
                                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500 appearance-none pr-8 transition-colors"
                                            value={editingOLT.type || 'OLT'}
                                            onChange={e => setEditingOLT({ ...editingOLT, type: e.target.value })}
                                        >
                                            <option value="OLT">{t('type_olt')}</option>
                                            <option value="SWITCH">{t('type_switch')}</option>
                                            <option value="ROUTER">{t('type_router')}</option>
                                            <option value="SERVER">{t('type_server')}</option>
                                            <option value="OTHER">{t('type_other')}</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                                            {isTypeUnlocked ? (
                                                <Unlock className="w-4 h-4 text-amber-500/70" />
                                            ) : (
                                                <Settings2 className="w-4 h-4 text-slate-500" />
                                            )}
                                        </div>
                                    </div>
                                    {isTypeUnlocked && (
                                        <div className="flex items-start gap-1.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-500 leading-tight">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span>{t('type_change_warning')}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-sky-300 uppercase flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" /> {t('chassis_config')}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-800/50 p-2 rounded border border-slate-700 opacity-70">
                                    <span className="text-[10px] text-slate-400 block mb-1">{t('total_slots')}</span>
                                    <span className="text-white font-mono text-lg font-bold block">{editingOLT.structure?.slots || 1}</span>
                                </div>
                                <div className="bg-slate-800/50 p-2 rounded border border-slate-700 opacity-70">
                                    <span className="text-[10px] text-slate-400 block mb-1">
                                        {editingOLT.type === 'OLT' ? t('olt_ports') : t('active_ports')}
                                    </span>
                                    <span className="text-white font-mono text-lg font-bold block">{editingOLT.structure?.portsPerSlot || 16}</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 italic text-center">
                                {t('olt_config_locked_msg') || "Chassis capacity managed via Catalog."}
                            </p>
                        </div>

                        {(editingOLT.type === 'OLT' || !editingOLT.type) && (
                            <div className="space-y-3 bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                <label className="text-xs font-bold text-sky-300 uppercase flex items-center gap-1.5">
                                    <Settings2 className="w-3.5 h-3.5" /> {t('manage_slots')}
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {Array.from({ length: editingOLT.structure?.slots || 1 }).map((_, idx) => {
                                        const slotConfig = editingOLT.structure?.slotsConfig?.[idx] || { active: true, portCount: editingOLT.structure?.portsPerSlot || 16 };
                                        return (
                                            <div key={idx} className="flex items-center justify-between gap-3 bg-slate-800 p-2 rounded border border-slate-700">
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {t('slot_label', { n: idx + 1 })}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        className="bg-slate-900 border border-slate-700 rounded text-[10px] text-white p-1 focus:outline-none focus:border-sky-500"
                                                        value={slotConfig.active ? 'active' : 'empty'}
                                                        onChange={e => {
                                                            const newSlotsConfig = [...(editingOLT.structure?.slotsConfig || Array.from({ length: editingOLT.structure?.slots || 1 }).map(() => ({ active: true, portCount: editingOLT.structure?.portsPerSlot || 16 })))];
                                                            newSlotsConfig[idx] = { ...slotConfig, active: e.target.value === 'active' };
                                                            setEditingOLT({ ...editingOLT, structure: { ...editingOLT.structure, slotsConfig: newSlotsConfig } as any });
                                                        }}
                                                    >
                                                        <option value="active">{t('slot_active')}</option>
                                                        <option value="empty">{t('slot_empty')}</option>
                                                    </select>
                                                    {slotConfig.active && (
                                                        <select
                                                            className="bg-slate-900 border border-slate-700 rounded text-[10px] text-white p-1 focus:outline-none focus:border-sky-500"
                                                            value={slotConfig.portCount}
                                                            onChange={e => {
                                                                const newSlotsConfig = [...(editingOLT.structure?.slotsConfig || Array.from({ length: editingOLT.structure?.slots || 1 }).map(() => ({ active: true, portCount: editingOLT.structure?.portsPerSlot || 16 })))];
                                                                newSlotsConfig[idx] = { ...slotConfig, portCount: parseInt(e.target.value) };
                                                                setEditingOLT({ ...editingOLT, structure: { ...editingOLT.structure, slotsConfig: newSlotsConfig } as any });
                                                            }}
                                                        >
                                                            <option value="8">8 {t('port_count')}</option>
                                                            <option value="16">16 {t('port_count')}</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSaveEditedOLT}
                            className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg shadow-lg shadow-sky-900/30 transition-all transform hover:translate-y-[-1px] active:translate-y-[0px] flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {t('update')}
                        </button>
                    </div>
                </DraggableModal>
            )}

            {/* EDIT DIO MODAL */}
            {editingDIO && (
                <DraggableModal
                    title={t('modal_edit_dio_title')}
                    icon={<Pencil className="w-4 h-4 text-white" />}
                    initialPos={initialPos}
                    onClose={() => setEditingDIO(null)}
                    headerColor="bg-gradient-to-r from-emerald-600 to-emerald-800"
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                                <Settings2 className="w-3.5 h-3.5" /> {t('name') || "Name"}
                            </label>
                            <input
                                type="text"
                                value={editingDIO.name}
                                onChange={e => setEditingDIO({ ...editingDIO, name: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                                <Box className="w-3.5 h-3.5" /> {t('capacity_label')}
                            </label>
                            <select
                                value={editingDIO.ports}
                                onChange={e => setEditingDIO({ ...editingDIO, ports: parseInt(e.target.value) })}
                                className="w-full h-12 bg-slate-800 border-2 border-slate-700 rounded-lg px-3 text-white font-bold appearance-none hover:border-emerald-500/50 focus:border-emerald-500 transition-colors cursor-pointer"
                            >
                                <option value="12">{t('n_ports', { n: 12 })}</option>
                                <option value="24">{t('n_ports', { n: 24 })}</option>
                                <option value="36">{t('n_ports', { n: 36 })}</option>
                                <option value="48">{t('n_ports', { n: 48 })}</option>
                                <option value="72">{t('n_ports', { n: 72 })}</option>
                                <option value="144">{t('n_ports', { n: 144 })}</option>
                            </select>
                        </div>

                        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 flex gap-3">
                            <div className="mt-0.5"><AlertTriangle className="w-4 h-4 text-amber-500" /></div>
                            <p className="text-[11px] text-amber-200/80 leading-tight">
                                {t('dio_capacity_warning')}
                            </p>
                        </div>

                        <button
                            onClick={handleSaveEditedDIO}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-all transform hover:translate-y-[-1px] active:translate-y-[0px] flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {t('save_changes')}
                        </button>
                    </div>
                </DraggableModal>
            )}
        </>
    );
};
