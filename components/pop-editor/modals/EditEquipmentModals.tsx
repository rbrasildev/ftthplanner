import React, { useState, useEffect, useRef } from 'react';
import { Pencil, AlertTriangle, X, Server, Box, Layers, PlayCircle, Settings2, Save, Lock, Unlock, Zap, Router } from 'lucide-react';
import { useLanguage } from '../../../LanguageContext';
import { Button } from '../../common/Button';
import { CustomInput } from '../../common/CustomInput';
import { CustomSelect } from '../../common/CustomSelect';

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

    return (
        <div
            ref={modalRef}
            className="absolute z-[2200] flex flex-col rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-200"
            style={{ 
                transform: `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0)`, 
                width: 320,
                willChange: 'transform',
                transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, scale 0.2s ease'
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className="h-12 px-4 flex items-center justify-between cursor-move select-none border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl"
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
            <div className="p-5 space-y-5">{children}</div>
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
                    title={t('modal_edit_olt_title') || "Editar OLT"}
                    icon={<Server className="w-4 h-4" />}
                    initialPos={initialPos}
                    onClose={() => setEditingOLT(null)}
                    headerColor="bg-indigo-600"
                >
                    <div className="space-y-4">
                        <CustomInput
                            label={t('name')}
                            value={editingOLT.name}
                            onChange={e => setEditingOLT({ ...editingOLT, name: e.target.value })}
                        />

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                                <Settings2 className="w-3.5 h-3.5" /> {t('equipment_type')}
                            </label>

                            {!isTypeUnlocked && (editingOLT.type === 'OLT' || !editingOLT.type) ? (
                                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-lg p-2.5 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                            <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight">{t('type_olt')}</span>
                                            <span className="text-[9px] text-slate-500 dark:text-slate-400 block">{t('type_locked')}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsTypeUnlocked(true)}
                                        className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                        title={t('unlock') || "Desbloquear"}
                                    >
                                        <Lock className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <CustomSelect
                                    value={editingOLT.type || 'OLT'}
                                    onChange={val => setEditingOLT({ ...editingOLT, type: val })}
                                    options={[
                                        { value: 'OLT', label: t('type_olt') },
                                        { value: 'SWITCH', label: t('type_switch') },
                                        { value: 'ROUTER', label: t('type_router') },
                                        { value: 'SERVER', label: t('type_server') },
                                        { value: 'OTHER', label: t('type_other') }
                                    ]}
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" /> {t('chassis_config')}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700 opacity-70">
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">{t('total_slots')}</span>
                                    <span className="text-slate-700 dark:text-white font-mono text-lg font-bold block">{editingOLT.structure?.slots || 1}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-700 opacity-70">
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                                        {editingOLT.type === 'OLT' ? t('olt_ports') : t('active_ports')}
                                    </span>
                                    <span className="text-slate-700 dark:text-white font-mono text-lg font-bold block">{editingOLT.structure?.portsPerSlot || 16}</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic text-center">
                                {t('olt_config_locked_msg') || "Chassis capacity managed via Catalog."}
                            </p>
                        </div>

                        {(editingOLT.type === 'OLT' || !editingOLT.type) && (
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                                    <Settings2 className="w-3.5 h-3.5" /> {t('manage_slots')}
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {Array.from({ length: editingOLT.structure?.slots || 1 }).map((_, idx) => {
                                        const slotConfig = editingOLT.structure?.slotsConfig?.[idx] || { active: true, portCount: editingOLT.structure?.portsPerSlot || 16 };
                                        const updateSlotConfig = (patch: any) => {
                                            const newSlotsConfig = [...(editingOLT.structure?.slotsConfig || Array.from({ length: editingOLT.structure?.slots || 1 }).map(() => ({ active: true, portCount: editingOLT.structure?.portsPerSlot || 16 })))];
                                            newSlotsConfig[idx] = { ...slotConfig, ...patch };
                                            setEditingOLT({ ...editingOLT, structure: { ...editingOLT.structure, slotsConfig: newSlotsConfig } as any });
                                        };
                                        return (
                                            <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    value={slotConfig.name || ''}
                                                    placeholder={`S${idx + 1}`}
                                                    onChange={e => updateSlotConfig({ name: e.target.value || undefined })}
                                                    className="w-14 text-center text-[10px] font-bold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                                                    title={t('slot_names') || 'Nome do Slot'}
                                                />
                                                <div className="flex items-center gap-2 ml-auto">
                                                    <select
                                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-700 dark:text-white p-1 focus:outline-none focus:border-emerald-500"
                                                        value={slotConfig.active ? 'active' : 'empty'}
                                                        onChange={e => updateSlotConfig({ active: e.target.value === 'active' })}
                                                    >
                                                        <option value="active">{t('slot_active')}</option>
                                                        <option value="empty">{t('slot_empty')}</option>
                                                    </select>
                                                    {slotConfig.active && (
                                                        <select
                                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-700 dark:text-white p-1 focus:outline-none focus:border-emerald-500"
                                                            value={slotConfig.portCount}
                                                            onChange={e => updateSlotConfig({ portCount: parseInt(e.target.value) })}
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

                        <Button
                            onClick={handleSaveEditedOLT}
                            size="lg"
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-all font-bold"
                            icon={<Save className="w-4 h-4" />}
                        >
                            {t('update')}
                        </Button>
                    </div>
                </DraggableModal>
            )}

            {/* EDIT DIO MODAL */}
            {editingDIO && (
                <DraggableModal
                    title="Editar DIO"
                    icon={<Box className="w-4 h-4" />}
                    initialPos={initialPos}
                    onClose={() => setEditingDIO(null)}
                    headerColor="bg-emerald-600"
                >
                    <div className="space-y-4">
                        <CustomInput
                            label={t('name') || "Name"}
                            value={editingDIO.name}
                            onChange={e => setEditingDIO({ ...editingDIO, name: e.target.value })}
                        />

                        <CustomSelect
                            label={t('capacity_label')}
                            value={editingDIO.ports.toString()}
                            onChange={val => setEditingDIO({ ...editingDIO, ports: parseInt(val) })}
                            options={[
                                { value: "12", label: t('n_ports', { n: 12 }) },
                                { value: "24", label: t('n_ports', { n: 24 }) },
                                { value: "36", label: t('n_ports', { n: 36 }) },
                                { value: "48", label: t('n_ports', { n: 48 }) },
                                { value: "72", label: t('n_ports', { n: 72 }) },
                                { value: "144", label: t('n_ports', { n: 144 }) }
                            ]}
                        />

                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-500/30 rounded-lg p-3 flex gap-3">
                            <div className="mt-0.5"><AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500" /></div>
                            <p className="text-[11px] text-slate-600 dark:text-amber-200/80 leading-tight">
                                {t('dio_capacity_warning')}
                            </p>
                        </div>

                        <Button
                            onClick={handleSaveEditedDIO}
                            size="lg"
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-all font-bold"
                            icon={<Save className="w-4 h-4" />}
                        >
                            {t('save_changes')}
                        </Button>
                    </div>
                </DraggableModal>
            )}
        </>
    );
};
