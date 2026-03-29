import React from 'react';
import { Router, Pencil, Trash2, Zap, Server } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { Button } from '../common/Button';

interface OLTUnitProps {
    olt: any;
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
    getPortConnectionInfo?: (portId: string) => string | undefined;
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
    getFiberColor,
    getPortConnectionInfo
}) => {
    const { t } = useLanguage();
    const slots = olt.structure?.slots || 1;
    const portsPerSlot = olt.structure?.portsPerSlot || 8;

    const portConnectionsMap = React.useMemo(() => {
        const map = new Map<string, any>();
        connections.forEach(c => {
            map.set(c.sourceId, c);
            map.set(c.targetId, c);
        });
        return map;
    }, [connections]);

    // Dynamic width: label area + (port width + gap) * ports + padding
    const maxPorts = Math.max(portsPerSlot, ...(olt.structure?.slotsConfig || []).map((s: any) => s.active ? s.portCount : 0));
    const portW = 26; // port cell width
    const labelW = 44; // slot label width
    const pad = 24; // total horizontal padding
    const dynamicWidth = Math.max(width, labelW + pad + maxPorts * (portW + 2));

    const TypeIcon = olt.type === 'SWITCH' ? Zap : olt.type === 'ROUTER' ? Router : Server;

    return (
        <div
            id={olt.id}
            style={{ transform: `translate(${position.x}px, ${position.y}px)`, width: dynamicWidth }}
            className="absolute z-20 flex flex-col group clickable-element select-none"
        >
            {/* Chassis */}
            <div className="bg-[#1a1d23] rounded-lg shadow-xl overflow-hidden border border-slate-700/50 ring-1 ring-black/20">

                {/* Front Panel - Header */}
                <div
                    className="h-8 bg-[#22262e] border-b border-slate-700/50 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => onDragStart(e, olt.id)}
                >
                    <div className="flex items-center gap-2">
                        {/* Power LED */}
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_4px_#22c55e]" />
                        <TypeIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-300 tracking-wide">{olt.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={(e) => onEdit(e, olt)} className="h-6 w-6 text-slate-500 hover:text-emerald-400">
                            <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => onDelete(e, olt)} className="h-6 w-6 text-slate-500 hover:text-rose-400">
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </div>
                </div>

                {/* Slots (Line Cards) */}
                <div className="p-1.5 space-y-1">
                    {Array.from({ length: slots }).map((_, sIdx) => {
                        const slotConfig = olt.structure?.slotsConfig?.[sIdx] || { active: true, portCount: portsPerSlot };
                        const currentPorts = slotConfig.portCount;
                        const slotLabel = slotConfig.name || `${sIdx + 1}`;

                        if (!slotConfig.active) {
                            return (
                                <div key={sIdx} className="flex items-center h-7 bg-[#15171c] rounded border border-dashed border-slate-700/40 px-2">
                                    <span className="text-[8px] font-mono text-slate-600 w-8 shrink-0 text-center">{slotLabel}</span>
                                    <span className="flex-1 text-[7px] text-slate-600 text-center uppercase tracking-[0.2em]">{t('slot_empty')}</span>
                                </div>
                            );
                        }

                        return (
                            <div key={sIdx} className="flex items-center bg-[#2a2e38] rounded border border-slate-600/30 px-1 py-1 gap-1">
                                {/* Slot Label */}
                                <div className="w-8 shrink-0 text-[8px] font-mono font-bold text-indigo-400 text-center truncate" title={slotLabel}>
                                    {slotLabel}
                                </div>
                                {/* Separator */}
                                <div className="w-px h-4 bg-slate-600/50 shrink-0" />
                                {/* Ports */}
                                <div className="flex-1 flex gap-[2px]">
                                    {Array.from({ length: currentPorts }).map((_, pIdx) => {
                                        const portId = `${olt.id}-s${sIdx + 1}-p${pIdx + 1}`;
                                        const isConnected = portConnectionsMap.has(portId);
                                        const isConfiguring = configuringOltPortId === portId;
                                        const isHovered = hoveredPortId === portId;
                                        const connInfo = isConnected && getPortConnectionInfo ? getPortConnectionInfo(portId) : undefined;

                                        return (
                                            <div
                                                key={portId}
                                                id={portId}
                                                title={connInfo ? `→ ${connInfo}` : `P${pIdx + 1} (${t('available')})`}
                                                onMouseDown={(e) => onPortClick(e, portId)}
                                                onMouseEnter={() => onPortHover(portId)}
                                                onMouseLeave={() => onPortHover(null)}
                                                className={`
                                                    flex-1 aspect-square min-w-0 rounded-sm cursor-pointer flex items-center justify-center text-[7px] font-mono font-bold transition-all
                                                    ${isConfiguring ? 'ring-1 ring-indigo-400 scale-110 z-10' : ''}
                                                    ${isHovered ? 'scale-110 z-10 brightness-125' : ''}
                                                `}
                                                style={{
                                                    backgroundColor: isConnected ? '#6366f1' : '#1e2028',
                                                    border: `1px solid ${isConnected ? '#818cf8' : '#3f4451'}`,
                                                    color: isConnected ? '#fff' : '#6b7280',
                                                    boxShadow: isConnected ? '0 0 4px rgba(99,102,241,0.4)' : 'none'
                                                }}
                                            >
                                                {pIdx + 1}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Uplink Section */}
                    {(olt.uplinkPorts || 0) > 0 && (
                        <div className="flex items-center h-7 bg-[#1e2028] rounded border border-slate-600/30 px-1 gap-1 mt-0.5">
                            <div className="w-8 shrink-0 text-[7px] font-mono font-bold text-amber-500 text-center uppercase">UP</div>
                            <div className="w-px h-4 bg-slate-600/50 shrink-0" />
                            <div className="flex-1 flex gap-1">
                                {Array.from({ length: olt.uplinkPorts }).map((_, pIdx) => {
                                    const portId = `${olt.id}-uplink-${pIdx + 1}`;
                                    const isConnected = portConnectionsMap.has(portId);
                                    const isConfiguring = configuringOltPortId === portId;
                                    const isHovered = hoveredPortId === portId;
                                    const connInfo = isConnected && getPortConnectionInfo ? getPortConnectionInfo(portId) : undefined;

                                    return (
                                        <div
                                            key={portId}
                                            id={portId}
                                            title={connInfo ? `→ ${connInfo}` : `Uplink ${pIdx + 1} (${t('available')})`}
                                            onMouseDown={(e) => onPortClick(e, portId)}
                                            onMouseEnter={() => onPortHover(portId)}
                                            onMouseLeave={() => onPortHover(null)}
                                            className={`
                                                w-7 h-5 shrink-0 rounded-sm cursor-pointer flex items-center justify-center text-[7px] font-mono font-bold transition-all
                                                ${isConfiguring ? 'ring-1 ring-amber-400 scale-110 z-10' : ''}
                                                ${isHovered ? 'scale-110 z-10' : ''}
                                            `}
                                            style={{
                                                backgroundColor: isConnected ? '#94a3b8' : '#1e2028',
                                                border: `1px solid ${isConnected ? '#cbd5e1' : '#3f4451'}`,
                                                color: isConnected ? '#0f172a' : '#6b7280',
                                            }}
                                        >
                                            U{pIdx + 1}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Bar (Model/Type) */}
                <div className="h-5 bg-[#15171c] border-t border-slate-700/30 px-3 flex justify-between items-center text-[8px] text-slate-500 font-mono select-none">
                    <span>{slots} Slot{slots > 1 ? 's' : ''}</span>
                    <span className="uppercase tracking-wider text-slate-600">{olt.type === 'OLT' ? 'GPON' : olt.type || 'ETH'}</span>
                </div>
            </div>
        </div>
    );
};
