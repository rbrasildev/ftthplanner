import React from 'react';
import { CableData, FIBER_COLORS, ElementLayout, FiberConnection } from '../../types';
import { RotateCw, GripHorizontal, ArrowRightLeft } from 'lucide-react';

interface FiberCableNodeProps {
    cable: CableData;
    layout: ElementLayout;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onAction: (e: React.MouseEvent, id: string) => void;
    onMirror: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
    onCableMouseEnter?: (id: string) => void;
    onCableMouseLeave?: (id: string) => void;
    onCableClick?: (e: React.MouseEvent, id: string) => void;
}

const FiberCableNodeComponent: React.FC<FiberCableNodeProps> = ({
    cable,
    layout,
    connections,
    litPorts,
    hoveredPortId,
    onDragStart,
    onAction,
    onMirror,
    onPortMouseDown,
    onPortMouseEnter,
    onPortMouseLeave,
    onCableMouseEnter,
    onCableMouseLeave,
    onCableClick
}) => {
    const looseTubeCount = cable.looseTubeCount || 1;
    const fibersPerTube = Math.ceil(cable.fiberCount / looseTubeCount);

    // Visual orientation
    // Standard (false) = Label on Left, Ports on Right
    // Mirrored (true) = Ports on Left, Label on Right
    const isMirrored = !!layout.mirrored;

    const tubes = Array.from({ length: looseTubeCount }).map((_, tubeIdx) => {
        const startFiber = tubeIdx * fibersPerTube;
        const endFiber = Math.min(startFiber + fibersPerTube, cable.fiberCount);
        return {
            tubeIdx,
            fiberIndices: Array.from({ length: endFiber - startFiber }).map((_, i) => startFiber + i)
        };
    });

    return (
        <div
            style={{ transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotation}deg)` }}
            className="absolute flex flex-row group z-20 cursor-default items-stretch"
        >
            {/* 1. THE LABEL BOX (Horizontal style, height tied to content) */}
            <div
                className={`
                relative flex flex-col
                ${isMirrored ? 'order-2' : 'order-1'}
            `}
            >
                {/* CONTROLS (Floating above) - Adjusted to be closer and easier to catch */}
                <div className="absolute top-0 right-0 -mt-6 pr-1 z-50 flex flex-col items-end opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                    <div className="flex gap-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 p-0.5 shadow-sm whitespace-nowrap">
                        <button
                            onClick={(e) => { e.stopPropagation(); onMirror(e, cable.id); }}
                            className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                            title="Flip"
                        >
                            <ArrowRightLeft className="w-3 h-3" />
                        </button>

                    </div>
                </div>

                {/* VISUAL BODY - Draggable Area Updated */}
                <div
                    className={`
                        flex flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden w-[168px] h-full
                        ${isMirrored ? 'border-l-0' : 'border-r-0'}
                        cursor-grab active:cursor-grabbing
                    `}
                    onMouseDown={(e) => onDragStart(e, cable.id)}
                >


                    {/* Content Area - Now grows to match fibers height */}
                    <div
                        className="p-2.5 flex flex-col justify-center flex-1"
                        onMouseEnter={() => onCableMouseEnter?.(cable.id)}
                        onMouseLeave={() => onCableMouseLeave?.(cable.id)}
                        onClick={(e) => onCableClick?.(e, cable.id)}
                    >
                        <span className="text-[11px] font-extrabold text-slate-900 dark:text-white leading-tight line-clamp-2 uppercase select-none">
                            {cable.name}
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase tracking-wider">
                            {cable.fiberCount} FIBRAS
                        </span>
                    </div>
                </div>
            </div>

            {/* 2. THE FIBERS (Positioned relative to the box) */}
            <div className={`flex flex-col ${isMirrored ? 'order-1 items-end' : 'order-2 items-start'} gap-3`}>
                {tubes.map(tube => (
                    <div
                        key={`tube-${tube.tubeIdx}`}
                        className={`
                        relative flex flex-col justify-center pt-1.5
                        ${isMirrored ? 'border-r-2 pr-1' : 'border-l-2 pl-1'}
                    `}
                        style={{ borderColor: FIBER_COLORS[tube.tubeIdx % FIBER_COLORS.length] }}
                    >
                        {tube.fiberIndices.map(i => {
                            const fiberId = `${cable.id}-fiber-${i}`;
                            const color = FIBER_COLORS[i % FIBER_COLORS.length];
                            const isLit = litPorts.has(fiberId);
                            const isLightColor = [1, 2, 3, 8, 10, 11, 12].includes((i % 12) + 1);
                            const textColor = isLightColor ? 'text-black' : 'text-white';

                            return (
                                <div
                                    key={fiberId}
                                    className={`relative h-3 w-4 flex items-center ${isMirrored ? 'justify-start' : 'justify-end'}`}
                                >
                                    {/* Connecting line */}
                                    <div className={`w-full h-[1px] transition-all ${isMirrored ? 'ml-2' : 'mr-2'} ${isLit ? 'bg-red-500' : 'bg-slate-400 dark:bg-slate-500 opacity-40'}`}></div>

                                    {/* Port Circle - Center at 12px height and aligned with grid */}
                                    <div
                                        id={fiberId}
                                        onMouseDown={(e) => onPortMouseDown(e, fiberId)}
                                        onMouseEnter={() => onPortMouseEnter(fiberId)}
                                        onMouseLeave={onPortMouseLeave}
                                        className={`
                                        w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-600 cursor-pointer select-none
                                        hover:scale-125 transition-transform z-30
                                        absolute ${isMirrored ? '-left-[7px]' : '-right-[7px]'} shadow-sm ${textColor} text-[7px] font-bold
                                        flex items-center justify-center
                                        ${hoveredPortId === fiberId ? 'ring-2 ring-sky-500' : ''}
                                        ${isLit ? 'ring-2 ring-red-500 border-red-500' : ''}
                                    `}
                                        style={{
                                            backgroundColor: color
                                        }}
                                    >
                                        {i + 1}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const FiberCableNode = React.memo(FiberCableNodeComponent);