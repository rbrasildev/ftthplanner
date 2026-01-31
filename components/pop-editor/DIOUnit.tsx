import React, { useState } from 'react';
import { Server, Link2, Plug, Pencil, Trash2, Layers } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { getFiberColor } from '../../types';

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
    onHoverPort: (portId: string | null) => void;
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
    onHoverPort
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
                    onMouseDown={(e) => onDragStart(e, dio.id)}
                >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <div className="p-1 bg-emerald-100 dark:bg-emerald-500/20 rounded-md">
                            <Server className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {dio.name}
                    </span>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => onLinkCables(e, dio.id)}
                            className="p-1 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded transition-colors"
                            title="Link Cables"
                        >
                            <Link2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => onSplice(e, dio.id)}
                            className="p-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                            title="Manage Splices"
                        >
                            <Plug className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => onEdit(e, dio)}
                            className="p-1 text-slate-400 hover:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => onDelete(e, dio)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950/50">

                    {/* Linked Cables Chips */}
                    <div className="mb-3">
                        {linkedCables.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 select-none">
                                {linkedCables.map(c => (
                                    <span key={c.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800/50">
                                        {c.name}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-slate-300 dark:border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                <span className="text-[9px] text-slate-400 italic">No cables linked</span>
                            </div>
                        )}
                    </div>

                    {/* Ports Grid */}
                    <div className="grid grid-cols-12 gap-1.5">
                        {dio.portIds.map((pid: string, idx: number) => {
                            const existingConns = connections.filter((c: any) => c.sourceId === pid || c.targetId === pid);
                            const patchConn = existingConns.find((c: any) => {
                                const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                return partner.includes('olt');
                            });

                            const isConnected = !!patchConn;

                            let highlightForActiveOLT = false;
                            if (configuringOltPortId) {
                                if (patchConn && (patchConn.sourceId === configuringOltPortId || patchConn.targetId === configuringOltPortId)) {
                                    highlightForActiveOLT = true;
                                }
                            }

                            const portColor = patchConn ? patchConn.color : null;
                            const isTrayStart = idx % 12 === 0;
                            const trayIndex = Math.floor(idx / 12);
                            const trayColor = getFiberColor(trayIndex, 'ABNT');
                            const isWhiteFiber = trayColor.toLowerCase() === '#ffffff';

                            return (
                                <React.Fragment key={pid}>
                                    {isTrayStart && (
                                        <div className="col-span-12 flex items-center gap-2 mt-2 mb-1">
                                            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1 select-none">
                                                <Layers className="w-2.5 h-2.5" />
                                                {t('tray')} {Math.floor(idx / 12) + 1}
                                            </span>
                                            <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-700" />
                                        </div>
                                    )}
                                    <div
                                        id={pid}
                                        onMouseEnter={() => handlePortEnter(pid)}
                                        onMouseLeave={handlePortLeave}
                                        className={`
                                            aspect-square rounded-full border-2 flex items-center justify-center text-[8px] font-mono transition-all select-none font-bold
                                            ${highlightForActiveOLT ? 'ring-2 ring-indigo-500 scale-125 z-50 shadow-lg' : ''}
                                            ${hoveredPortId === pid ? 'scale-125 border-slate-400 z-10 shadow' : ''}
                                            ${!isConnected ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' : ''}
                                        `}
                                        style={isConnected ? {
                                            backgroundColor: portColor || '#cbd5e1',
                                            borderColor: isWhiteFiber ? '#cbd5e1' : trayColor, // Ensure visibility for white fibers
                                            color: '#000',
                                            boxShadow: highlightForActiveOLT ? `0 0 10px ${portColor}` : `0 0 2px ${portColor}80`
                                        } : {
                                            borderColor: isWhiteFiber ? '#cbd5e1' : trayColor,
                                            color: isWhiteFiber ? '#475569' : trayColor, // Use darker text for white fiber
                                            backgroundColor: isWhiteFiber ? '#f8fafc' : `${trayColor}15`
                                        }}
                                        title={`Port ${(idx % 12) + 1} (${t('tray')} ${trayIndex + 1})`}
                                    >
                                        {(idx % 12) + 1}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
