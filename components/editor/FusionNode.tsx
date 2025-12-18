
import React from 'react';
import { FusionPoint, ElementLayout, FiberConnection } from '../../types';
import { RotateCw, Trash2 } from 'lucide-react';

interface FusionNodeProps {
    fusion: FusionPoint;
    layout: ElementLayout;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    onDragStart: (e: React.MouseEvent) => void;
    onRotate: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
}

export const FusionNode: React.FC<FusionNodeProps> = ({
    fusion,
    layout,
    connections,
    litPorts,
    hoveredPortId,
    onDragStart,
    onRotate,
    onDelete,
    onPortMouseDown,
    onPortMouseEnter,
    onPortMouseLeave
}) => {
    const portA = `${fusion.id}-a`;
    const portB = `${fusion.id}-b`;
    
    const isConnectedA = connections.some(c => c.targetId === portA || c.sourceId === portA);
    const isConnectedB = connections.some(c => c.targetId === portB || c.sourceId === portB);
    
    const isLitA = litPorts.has(portA);
    const isLitB = litPorts.has(portB);

    return (
        <div
            style={{ 
                transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotation}deg)`, 
                height: '32px', // Larger hit area to keep controls clickable
                width: '32px' 
            }}
            className="absolute z-20 flex flex-col items-center justify-center group select-none hover:z-50"
        >
            {/* Header Wrapper / Controls - Moved closer to body to maintain hover */}
            <div
                className="
                    absolute bottom-[24px]
                    w-[80px] flex justify-center
                    pb-1
                    invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150
                    scale-90 group-hover:scale-100 origin-bottom
                    z-50 pointer-events-none group-hover:pointer-events-auto
                "
                onMouseDown={onDragStart}
            >
                <div className="
                    bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg
                    px-1 py-0.5 
                    flex items-center gap-1 
                    shadow-md shadow-black/20
                    cursor-grab active:cursor-grabbing
                ">
                    <span className="text-[6px] font-bold text-slate-800 dark:text-white whitespace-nowrap max-w-[30px] truncate uppercase">{fusion.name}</span>
                    <div className="h-2 w-[1px] bg-slate-200 dark:bg-slate-600"></div>

                    <button
                        onClick={onRotate}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white transition-colors cursor-pointer"
                        title="Rotate"
                    >
                        <RotateCw className="w-2.5 h-2.5" />
                    </button>

                    <button
                        onClick={onDelete}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200 transition-colors cursor-pointer"
                        title="Remove"
                    >
                        <Trash2 className="w-2.5 h-2.5" />
                    </button>
                </div>
            </div>

            {/* Body - Slightly Smaller for tighter stacking */}
            <div
                className="relative w-full h-3 flex items-center justify-center cursor-grab active:cursor-grabbing mt-2"
                onMouseDown={onDragStart}
            >
                {/* Center Body */}
                <div className={`
                    w-3 h-3 rounded-full border border-slate-800 dark:border-black z-20 shadow-sm transition-colors duration-300
                    ${isLitA || isLitB ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-400 dark:bg-slate-500'}
                `} />

                {/* Left Port */}
                <div
                    id={portA}
                    onMouseDown={(e) => onPortMouseDown(e, portA)}
                    onMouseEnter={() => onPortMouseEnter(portA)}
                    onMouseLeave={onPortMouseLeave}
                    className={`
                        w-2 h-2 rounded-full bg-slate-900 dark:bg-black border border-slate-800 dark:border-slate-700
                        cursor-pointer select-none transition-all z-30 absolute left-2
                        ${hoveredPortId === portA ? 'ring-2 ring-sky-400 scale-125' : ''} 
                        ${isLitA ? 'ring-2 ring-red-500 shadow-[0_0_5px_#ef4444] bg-red-600' : ''}
                    `}
                >
                    {!isLitA && isConnectedA && <div className="w-0.5 h-0.5 bg-emerald-500 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />}
                </div>

                {/* Right Port */}
                <div
                    id={portB}
                    onMouseDown={(e) => onPortMouseDown(e, portB)}
                    onMouseEnter={() => onPortMouseEnter(portB)}
                    onMouseLeave={onPortMouseLeave}
                    className={`
                        w-2 h-2 rounded-full bg-slate-900 dark:bg-black border border-slate-800 dark:border-slate-700
                        cursor-pointer select-none transition-all z-30 absolute right-2
                        ${hoveredPortId === portB ? 'ring-2 ring-sky-400 scale-125' : ''} 
                        ${isLitB ? 'ring-2 ring-red-500 shadow-[0_0_5px_#ef4444] bg-red-600' : ''}
                    `}
                >
                    {!isLitB && isConnectedB && <div className="w-0.5 h-0.5 bg-emerald-500 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />}
                </div>
            </div>
        </div>
    );
};
