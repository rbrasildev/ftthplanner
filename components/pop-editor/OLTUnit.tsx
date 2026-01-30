import React from 'react';
import { Router, Pencil, Trash2, Zap, Server } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

interface OLTUnitProps {
    olt: any; // Using any for agility, ideally would be the specific OLT type
    position: { x: number; y: number };
    width: number;
    connections: any[];
    configuringOltPortId: string | null;
    hoveredPortId: string | null;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onEdit: (e: React.MouseEvent, olt: any) => void;
    onDelete: (e: React.MouseEvent, olt: any) => void;
    onPortClick: (e: React.MouseEvent, portId: string) => void;
    onPortHover: (portId: string | null) => void;
    getFiberColor: (index: number, standard: string) => string;
}

export const OLTUnit: React.FC<OLTUnitProps> = ({
    olt,
    position,
    width,
    connections,
    configuringOltPortId,
    hoveredPortId,
    onDragStart,
    onEdit,
    onDelete,
    onPortClick,
    onPortHover,
    getFiberColor
}) => {
    const { t } = useLanguage();
    const slots = olt.structure?.slots || 1;
    const portsPerSlot = olt.structure?.portsPerSlot || 8;
    // Premium Look: Gradients, better borders, depth effects
    return (
        <div
            style={{ transform: `translate(${position.x}px, ${position.y}px)`, width }}
            className="absolute z-20 flex flex-col group clickable-element transition-transform duration-75 select-none"
        >
            {/* Card Container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/10">
                {/* Header */}
                <div
                    className="h-9 bg-gradient-to-r from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => onDragStart(e, olt.id)}
                >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <div className="p-1 bg-indigo-100 dark:bg-indigo-500/20 rounded-md">
                            {olt.type === 'SWITCH' ? (
                                <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : olt.type === 'ROUTER' ? (
                                <Router className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                                <Server className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            )}
                        </div>
                        {olt.name}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => onEdit(e, olt)}
                            className="p-1 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => onDelete(e, olt)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Body (Slots) */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950/50 space-y-2.5">
                    {Array.from({ length: slots }).map((_, sIdx) => {
                        const slotConfig = olt.structure?.slotsConfig?.[sIdx] || { active: true, portCount: portsPerSlot };
                        const currentPortsPerSlot = slotConfig.portCount;
                        const slotColor = '#6366f1'; // Indigo-500

                        if (!slotConfig.active) {
                            return (
                                <div key={sIdx} className="flex items-center gap-2 bg-slate-100/50 dark:bg-slate-900/40 p-1.5 rounded border border-dashed border-slate-300 dark:border-slate-800 opacity-60">
                                    <div className="w-8 text-[9px] font-mono text-center font-bold px-1 py-0.5 rounded bg-slate-200/50 dark:bg-black/50 text-slate-400">
                                        S{sIdx + 1}
                                    </div>
                                    <div className="flex-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center py-1">
                                        {t('slot_empty')}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={sIdx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div
                                    className="w-8 text-[9px] font-mono text-center font-bold px-1 py-0.5 rounded bg-slate-100 dark:bg-black"
                                    style={{ color: slotColor, borderLeft: `2px solid ${slotColor}` }}
                                >
                                    S{sIdx + 1}
                                </div>
                                <div className="flex-1 grid grid-cols-8 gap-1">
                                    {Array.from({ length: currentPortsPerSlot }).map((_, pIdx) => {
                                        const portId = `${olt.id}-s${sIdx + 1}-p${pIdx + 1}`;
                                        const existingConn = connections.find(c => c.sourceId === portId || c.targetId === portId);
                                        const isConnected = !!existingConn;
                                        const isBeingConfigured = configuringOltPortId === portId;

                                        return (
                                            <div
                                                key={portId}
                                                id={portId}
                                                onMouseDown={(e) => onPortClick(e, portId)}
                                                onMouseEnter={() => onPortHover(portId)}
                                                onMouseLeave={() => onPortHover(null)}
                                                className={`
                                                    aspect-square rounded border cursor-pointer select-none flex items-center justify-center text-[8px] font-mono transition-all
                                                    ${isBeingConfigured ? 'ring-2 ring-indigo-500 scale-125 z-10' : ''}
                                                    ${hoveredPortId === portId ? 'scale-125 border-slate-400 z-10 shadow' : ''}
                                                `}
                                                style={{
                                                    backgroundColor: isConnected ? slotColor : 'transparent',
                                                    borderColor: isConnected ? slotColor : 'inherit',
                                                    color: isConnected ? '#fff' : 'inherit',
                                                    boxShadow: isConnected ? `0 0 5px ${slotColor}80` : 'none'
                                                }}
                                                title={`Slot ${sIdx + 1} Port ${pIdx + 1}`}
                                            >
                                                {pIdx + 1}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer/Meta (Model Info) */}
                <div className="bg-slate-50 dark:bg-slate-900/80 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-[9px] text-slate-400 font-mono">
                    <span>{slots} Slot{slots > 1 ? 's' : ''} {olt.type || 'OLT'}</span>
                    <span className="uppercase tracking-wider">
                        {olt.type === 'OLT' ? 'GPON' : 'ETHERNET'}
                    </span>
                </div>
            </div>
        </div>
    );
};
