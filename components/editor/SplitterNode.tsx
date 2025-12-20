
import React from 'react';
import { Splitter, ElementLayout, FiberConnection } from '../../types';
import { RotateCw, Trash2 } from 'lucide-react';

interface SplitterNodeProps {
    splitter: Splitter;
    layout: ElementLayout;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onRotate: (e: React.MouseEvent, id: string) => void;
    onDelete: (e: React.MouseEvent) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
}

const SplitterNodeComponent: React.FC<SplitterNodeProps> = ({
    splitter,
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
    const portCount = splitter.outputPortIds.length;
    // Dimensions aligned to 12px grid
    // Use 24px (2 slots) per port to ensure symmetry around a grid line
    const width = portCount * 24;
    const height = 72;

    const isLitIn = litPorts.has(splitter.inputPortId);

    return (
        <div
            style={{
                transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotation}deg)`,
                width,
                height
            }}
            className="absolute z-20 group select-none"
        >
            {/* Header Wrapper / Controls */}
            <div
                className="
                absolute -top-10 left-1/2 -translate-x-1/2
                w-[120px] flex justify-center
                pb-5
                opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out delay-500 group-hover:delay-0
                scale-90 group-hover:scale-100 origin-bottom
                z-50 pointer-events-none group-hover:pointer-events-auto
            "
                onMouseDown={(e) => onDragStart(e, splitter.id)}
            >
                <div className="
                bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-600 rounded-full 
                px-2 py-0.5 
                flex items-center gap-1.5 
                shadow-lg shadow-black/10 dark:shadow-black/50
                cursor-grab active:cursor-grabbing
            ">
                    <span className="text-[7px] font-bold text-slate-800 dark:text-white whitespace-nowrap max-w-[60px] truncate">{splitter.name}</span>
                    <div className="h-2 w-[1px] bg-slate-200 dark:bg-slate-600/50"></div>

                    <button onClick={(e) => onRotate(e, splitter.id)} className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white transition-colors p-0.5 transition"><RotateCw className="w-3 h-3" /></button>
                    <button onClick={onDelete} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200 transition-colors p-0.5 transition"><Trash2 className="w-3 h-3" /></button>
                </div>
            </div>

            {/* Triangle Body - Spans from Y=12 to Y=60 */}
            <div
                style={{ height: 48, top: 12 }}
                className="absolute inset-x-0 drop-shadow-xl z-10"
                onMouseDown={(e) => onDragStart(e, splitter.id)}
            >
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                    <polygon
                        points="50,0 0,100 100,100"
                        className={`transition-colors duration-300 fill-slate-50/50 dark:fill-slate-800/50 ${isLitIn ? 'stroke-red-500' : 'stroke-slate-300 dark:stroke-slate-600'}`}
                        strokeWidth="1"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className={`text-[8px] font-bold leading-none ${isLitIn ? 'text-red-500' : 'text-slate-500 dark:text-slate-600'}`}>{splitter.type}</span>
                </div>
            </div>

            {/* Input Port (Y=12) */}
            <div
                className="absolute top-0 left-0 w-full h-6 flex items-center justify-center z-30"
            >
                <div
                    id={splitter.inputPortId}
                    onMouseDown={(e) => onPortMouseDown(e, splitter.inputPortId)}
                    onMouseEnter={() => onPortMouseEnter(splitter.inputPortId)}
                    onMouseLeave={onPortMouseLeave}
                    className={`w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 border-2 cursor-pointer select-none hover:scale-110 hover:shadow-lg transition-all flex items-center justify-center
                    ${hoveredPortId === splitter.inputPortId ? 'ring-2 ring-sky-500' : ''}
                    ${isLitIn ? 'border-red-500 shadow-[0_0_10px_#ef4444] bg-red-900' : 'border-emerald-500 hover:shadow-emerald-500/50'}
                `}
                >
                    {!isLitIn && connections.some(c => c.targetId === splitter.inputPortId) && <div className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full" />}
                    {isLitIn && <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_5px_#fff]" />}
                </div>
                <span className="absolute left-1/2 ml-4 text-[6px] text-slate-400 dark:text-slate-500 font-extrabold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase">In</span>
            </div>

            {/* Output Ports (Y=60) */}
            <div className="absolute top-12 left-0 w-full h-6 z-30">
                {splitter.outputPortIds.map((pid, idx) => {
                    const isConnected = connections.some(c => c.sourceId === pid);
                    const isLitOut = litPorts.has(pid);
                    const halfCount = portCount / 2;
                    // Uniform distribution: ports at 12, 36, 60, 84, ...
                    // Symmetric around width/2
                    const leftPos = (idx * 24) + 12 - 7; // -7 to center 14px circle on point

                    return (
                        <div
                            key={pid}
                            id={pid}
                            onMouseDown={(e) => onPortMouseDown(e, pid)}
                            onMouseEnter={() => onPortMouseEnter(pid)}
                            onMouseLeave={onPortMouseLeave}
                            className={`
                            w-3.5 h-3.5 rounded-full border bg-white dark:bg-slate-900 cursor-pointer 
                            hover:scale-150 transition-all text-center absolute top-[5px]
                            text-[6.5px] font-bold select-none shadow-sm flex items-center justify-center
                            ${hoveredPortId === pid ? 'ring-2 ring-sky-500 border-sky-400 bg-sky-50 dark:bg-sky-900' : ''}
                            ${isLitOut
                                    ? 'border-red-500 bg-red-900 text-white shadow-[0_0_8px_#ef4444]'
                                    : isConnected
                                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-[0_0_5px_rgba(34,197,94,0.3)]'
                                        : 'border-slate-300 dark:border-slate-500 text-slate-400 dark:text-slate-500 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300'
                                }
                        `}
                            style={{
                                left: `${leftPos}px`,
                            }}
                        >
                            {idx + 1}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const SplitterNode = React.memo(SplitterNodeComponent);
