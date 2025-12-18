
import React from 'react';
import { Splitter, ElementLayout, FiberConnection } from '../../types';
import { RotateCw, Trash2 } from 'lucide-react';

interface SplitterNodeProps {
  splitter: Splitter;
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

export const SplitterNode: React.FC<SplitterNodeProps> = ({
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
  const width = portCount <= 2 ? 30 : (portCount <= 8 ? 80 : 160);
  const height = 45;
  
  const isLitIn = litPorts.has(splitter.inputPortId);

  return (
    <div 
        style={{ transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotation}deg)`, width }}
        className="absolute z-20 flex flex-col items-center group select-none"
    >
        {/* Header Wrapper / Controls */}
        <div 
            className="
                absolute -top-9
                w-[120px] flex justify-center
                pb-4
                opacity-0 group-hover:opacity-100 transition-all duration-200 ease-out delay-75
                scale-90 group-hover:scale-100 origin-bottom
                z-50 pointer-events-none group-hover:pointer-events-auto
            "
            onMouseDown={onDragStart}
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
                
                <button onClick={onRotate} className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white transition-colors p-0.5 transition"><RotateCw className="w-3 h-3"/></button>
                <button onClick={onDelete} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-200 transition-colors p-0.5 transition"><Trash2 className="w-3 h-3"/></button>
            </div>
        </div>

        {/* Input Port (Top) */}
        <div className="relative z-30 mb-[-2px]">
            <div 
                id={splitter.inputPortId}
                onMouseDown={(e) => onPortMouseDown(e, splitter.inputPortId)}
                onMouseEnter={() => onPortMouseEnter(splitter.inputPortId)}
                onMouseLeave={onPortMouseLeave}
                className={`w-3 h-3 rounded-full bg-white dark:bg-slate-800 border-2 cursor-pointer select-none hover:scale-110 hover:shadow-lg transition-all flex items-center justify-center 
                    ${hoveredPortId === splitter.inputPortId ? 'ring-2 ring-sky-500' : ''}
                    ${isLitIn ? 'border-red-500 shadow-[0_0_10px_#ef4444] bg-red-900' : 'border-emerald-500 hover:shadow-emerald-500/50'}
                `}
            >
                {!isLitIn && connections.some(c => c.targetId === splitter.inputPortId) && <div className="w-1 h-1 bg-emerald-500 dark:bg-emerald-400 rounded-full" />}
                {isLitIn && <div className="w-1 h-1 bg-red-500 rounded-full shadow-[0_0_5px_#fff]" />}
            </div>
            <span className="absolute -left-3 top-0.5 text-[6px] text-slate-400 dark:text-slate-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">IN</span>
        </div>

        {/* Triangle Body */}
        <div style={{ height }} className="w-full relative drop-shadow-xl z-20" onMouseDown={onDragStart}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                <polygon 
                    points="50,0 0,100 100,100" 
                    className={`transition-colors duration-300 fill-slate-50 dark:fill-slate-800 ${isLitIn ? 'stroke-red-500' : 'stroke-slate-300 dark:stroke-slate-600'}`}
                    strokeWidth="1" 
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pt-2 pointer-events-none">
                <span className={`text-[8px] font-bold ${isLitIn ? 'text-red-500' : 'text-slate-500 dark:text-slate-600'}`}>{splitter.type}</span>
            </div>
        </div>

        {/* Output Ports (Bottom Strip) */}
        <div className="w-full flex justify-between px-0.5 z-30 -mt-2">
            {splitter.outputPortIds.map((pid, idx) => {
                const isConnected = connections.some(c => c.sourceId === pid);
                const isLitOut = litPorts.has(pid);
                return (
                    <div 
                        key={pid}
                        id={pid}
                        onMouseDown={(e) => onPortMouseDown(e, pid)}
                        onMouseEnter={() => onPortMouseEnter(pid)}
                        onMouseLeave={onPortMouseLeave}
                        className={`
                            w-2.5 h-2.5 rounded-full border bg-white dark:bg-slate-900 cursor-pointer 
                            hover:scale-150 transition-all flex items-center justify-center 
                            text-[6px] font-bold select-none shadow-sm
                            ${hoveredPortId === pid ? 'ring-1 ring-sky-500 border-sky-400 bg-sky-50 dark:bg-sky-900' : ''}
                            ${isLitOut
                                ? 'border-red-500 bg-red-900 text-white shadow-[0_0_8px_#ef4444]'
                                : isConnected 
                                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-[0_0_5px_rgba(34,197,94,0.3)]' 
                                    : 'border-slate-300 dark:border-slate-500 text-slate-400 dark:text-slate-500 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300'
                            }
                        `}
                    >
                        {idx + 1}
                    </div>
                );
            })}
        </div>
    </div>
  );
};
