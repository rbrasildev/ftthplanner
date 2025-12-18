import React from 'react';
import { CableData, FIBER_COLORS, ElementLayout, FiberConnection } from '../../types';
import { RotateCw, GripHorizontal, ArrowRightLeft } from 'lucide-react';

interface FiberCableNodeProps {
  cable: CableData;
  layout: ElementLayout;
  connections: FiberConnection[];
  litPorts: Set<string>;
  hoveredPortId: string | null;
  onDragStart: (e: React.MouseEvent) => void;
  onRotate: (e: React.MouseEvent) => void;
  onMirror: (e: React.MouseEvent) => void;
  onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
  onPortMouseEnter: (portId: string) => void;
  onPortMouseLeave: () => void;
  onCableMouseEnter?: () => void;
  onCableMouseLeave?: () => void;
}

export const FiberCableNode: React.FC<FiberCableNodeProps> = ({
  cable,
  layout,
  connections,
  litPorts,
  hoveredPortId,
  onDragStart,
  onRotate,
  onMirror,
  onPortMouseDown,
  onPortMouseEnter,
  onPortMouseLeave,
  onCableMouseEnter,
  onCableMouseLeave
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
        className="absolute flex flex-row group z-20 cursor-default items-start"
    >
        {/* 1. THE LABEL BOX (Horizontal style, height tied to content) */}
        <div 
            className={`
                relative flex flex-col
                ${isMirrored ? 'order-2' : 'order-1'}
            `}
        >
            {/* CONTROLS (Floating above) - Bridge added with bottom overlap and removed delay */}
            <div className="absolute bottom-[calc(100%-5px)] left-0 pb-3 z-50 flex flex-col items-start opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                <div className="flex gap-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 p-0.5 shadow-lg whitespace-nowrap">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onMirror(e); }} 
                        className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer" 
                        title="Flip"
                    >
                        <ArrowRightLeft className="w-3 h-3"/>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRotate(e); }} 
                        className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer" 
                        title="Rotate"
                    >
                        <RotateCw className="w-3 h-3"/>
                    </button>
                </div>
            </div>

            {/* VISUAL BODY */}
            <div className={`
                flex flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xl overflow-hidden min-w-[160px]
                ${isMirrored ? 'rounded-r-lg border-l-0' : 'rounded-l-lg border-r-0'}
            `}>
                {/* Header / Grip */}
                <div 
                    className="h-5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 z-20 relative"
                    onMouseDown={onDragStart}
                >
                    <GripHorizontal className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                </div>

                {/* Content Area */}
                <div 
                    className="p-2.5 flex flex-col justify-center"
                    onMouseEnter={onCableMouseEnter}
                    onMouseLeave={onCableMouseLeave}
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
        <div className={`flex flex-col ${isMirrored ? 'order-1 items-end' : 'order-2 items-start'}`}>
            {tubes.map(tube => (
                <div 
                    key={`tube-${tube.tubeIdx}`} 
                    className={`
                        relative flex flex-col justify-center py-0.5
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
                                <div className={`w-full h-[1px] transition-all ${isMirrored ? 'ml-2' : 'mr-2'} ${isLit ? 'bg-red-500 shadow-[0_0_5px_#ef4444]' : 'bg-slate-400 dark:bg-slate-500 opacity-40'}`}></div>

                                {/* Port Circle */}
                                <div 
                                    id={fiberId}
                                    onMouseDown={(e) => onPortMouseDown(e, fiberId)}
                                    onMouseEnter={() => onPortMouseEnter(fiberId)}
                                    onMouseLeave={onPortMouseLeave}
                                    className={`
                                        w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 cursor-pointer select-none
                                        flex items-center justify-center hover:scale-125 transition-transform z-30
                                        absolute ${isMirrored ? '-left-2' : '-right-2'} shadow-sm ${textColor} text-[7px] font-bold
                                        ${hoveredPortId === fiberId ? 'ring-2 ring-sky-500' : ''}
                                        ${isLit ? 'ring-2 ring-red-500 shadow-[0_0_10px_#ef4444] border-red-500' : ''}
                                    `}
                                    style={{ backgroundColor: color }}
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