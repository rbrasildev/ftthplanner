import React, { useState } from 'react';
import { Server, Link2, Plug, Pencil, Trash2 } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { Button } from '../common/Button';

interface DIOUnitProps {
    dio: any;
    position: { x: number; y: number };
    width: number;
    linkedCables: any[];
    connections: any[];
    configuringOltPortId: string | null;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onLinkCables: (e: React.MouseEvent, id: string) => void;
    onSplice: (e: React.MouseEvent, id: string) => void;
    onEdit: (e: React.MouseEvent, dio: any) => void;
    onDelete: (e: React.MouseEvent, dio: any) => void;
    onPortClick: (e: React.MouseEvent, portId: string) => void;
    onHoverPort: (portId: string | null) => void;
    getPortConnectionInfo?: (portId: string) => string | undefined;
}

export const DIOUnit: React.FC<DIOUnitProps> = ({
    dio,
    position,
    width,
    linkedCables,
    connections,
    configuringOltPortId,
    onDragStart,
    onLinkCables,
    onSplice,
    onEdit,
    onDelete,
    onPortClick,
    onHoverPort,
    getPortConnectionInfo
}) => {
    const { t } = useLanguage();
    const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);

    const handlePortEnter = (pid: string) => {
        setHoveredPortId(pid);
        onHoverPort(pid);
    };

    const handlePortLeave = () => {
        setHoveredPortId(null);
        onHoverPort(null);
    };

    const portConnectionsMap = React.useMemo(() => {
        const map = new Map<string, any[]>();
        connections.forEach((c: any) => {
            if (!map.has(c.sourceId)) map.set(c.sourceId, []);
            if (!map.has(c.targetId)) map.set(c.targetId, []);
            map.get(c.sourceId)!.push(c);
            map.get(c.targetId)!.push(c);
        });
        return map;
    }, [connections]);

    const TRAY_SIZE = 12;
    const trayCount = Math.ceil((dio.portIds?.length || 0) / TRAY_SIZE);

    // Dynamic width based on ports per tray (all in one row)
    const portW = 24;
    const labelW = 40;
    const pad = 20;
    const dynamicWidth = Math.max(width, labelW + pad + TRAY_SIZE * (portW + 2));

    return (
        <div
            id={dio.id}
            style={{ transform: `translate(${position.x}px, ${position.y}px)`, width: dynamicWidth }}
            className="absolute z-20 flex flex-col group clickable-element select-none"
        >
            {/* Chassis */}
            <div className="bg-[#1a1d23] rounded-lg shadow-xl overflow-hidden border border-slate-700/50 ring-1 ring-black/20">

                {/* Header */}
                <div
                    className="h-8 bg-[#22262e] border-b border-slate-700/50 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => onDragStart(e, dio.id)}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_4px_#06b6d4]" />
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-300 tracking-wide">{dio.name}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{dio.ports}P</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={(e) => onLinkCables(e, dio.id)} className="h-6 w-6 text-slate-500 hover:text-cyan-400" title={t('link_cables') || 'Vincular Cabos'}>
                            <Link2 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => onSplice(e, dio.id)} className="h-6 w-6 text-slate-500 hover:text-indigo-400" title={t('manage_fusions') || 'Fusões'}>
                            <Plug className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => onEdit(e, dio)} className="h-6 w-6 text-slate-500 hover:text-emerald-400">
                            <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => onDelete(e, dio)} className="h-6 w-6 text-slate-500 hover:text-rose-400">
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </div>
                </div>

                {/* Linked Cables Bar */}
                {linkedCables.length > 0 && (
                    <div className="px-2 py-1 bg-[#1e2028] border-b border-slate-700/30 flex items-center gap-1.5">
                        <Link2 className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        <div className="flex flex-wrap gap-1">
                            {linkedCables.map((c: any) => (
                                <span key={c.id} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-400 border border-cyan-800/40">
                                    {c.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Trays */}
                <div className="p-1.5 space-y-1">
                    {Array.from({ length: trayCount }).map((_, tIdx) => {
                        const trayPorts = dio.portIds.slice(tIdx * TRAY_SIZE, (tIdx + 1) * TRAY_SIZE);
                        if (trayPorts.length === 0) return null;

                        return (
                            <div key={tIdx} className="flex items-center bg-[#2a2e38] rounded border border-slate-600/30 px-1 py-1 gap-1">
                                {/* Tray Label */}
                                <div className="w-7 shrink-0 text-[7px] font-mono font-bold text-cyan-500 text-center" title={`${t('tray')} ${tIdx + 1}`}>
                                    T{tIdx + 1}
                                </div>
                                <div className="w-px h-4 bg-slate-600/50 shrink-0" />
                                {/* Ports */}
                                <div className="flex-1 flex gap-[2px]">
                                    {trayPorts.map((pid: string, localIdx: number) => {
                                        const existingConns = portConnectionsMap.get(pid) || [];
                                        const patchConn = existingConns.find((c: any) => {
                                            const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                            return partner.includes('olt');
                                        });
                                        const isConnected = !!patchConn;
                                        const isSpliced = existingConns.some((c: any) =>
                                            c.sourceId.includes('fiber') || c.targetId.includes('fiber')
                                        );

                                        const isHovered = hoveredPortId === pid;
                                        let highlightForActiveOLT = false;
                                        if (configuringOltPortId && patchConn) {
                                            highlightForActiveOLT = patchConn.sourceId === configuringOltPortId || patchConn.targetId === configuringOltPortId;
                                        }

                                        const connInfo = isConnected && getPortConnectionInfo ? getPortConnectionInfo(pid) : undefined;

                                        return (
                                            <div
                                                key={pid}
                                                id={pid}
                                                title={(() => {
                                                    const label = `P${localIdx + 1} (${t('tray')} ${tIdx + 1})`;
                                                    if (connInfo) return `${label} → ${connInfo}`;
                                                    if (isSpliced) return `${label} - Spliced`;
                                                    return `${label} (${t('available')})`;
                                                })()}
                                                onMouseDown={(e) => onPortClick(e, pid)}
                                                onMouseEnter={() => handlePortEnter(pid)}
                                                onMouseLeave={handlePortLeave}
                                                className={`
                                                    flex-1 aspect-square min-w-0 rounded-sm cursor-pointer flex items-center justify-center text-[7px] font-mono font-bold transition-all relative
                                                    ${highlightForActiveOLT ? 'ring-1 ring-indigo-400 scale-110 z-10' : ''}
                                                    ${isHovered ? 'scale-110 z-10 brightness-125' : ''}
                                                `}
                                                style={{
                                                    backgroundColor: isConnected ? '#06b6d4' : '#1e2028',
                                                    border: `1px solid ${isConnected ? '#22d3ee' : '#3f4451'}`,
                                                    color: isConnected ? '#fff' : '#6b7280',
                                                    boxShadow: isConnected ? '0 0 4px rgba(6,182,212,0.4)' : 'none'
                                                }}
                                            >
                                                {localIdx + 1}
                                                {isSpliced && (
                                                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Bar */}
                <div className="h-5 bg-[#15171c] border-t border-slate-700/30 px-3 flex justify-between items-center text-[8px] text-slate-500 font-mono select-none">
                    <span>{trayCount} {t('tray')}{trayCount > 1 ? 's' : ''}</span>
                    <span className="uppercase tracking-wider text-slate-600">DIO</span>
                </div>
            </div>
        </div>
    );
};
