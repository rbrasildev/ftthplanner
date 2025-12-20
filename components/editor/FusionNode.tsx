
import React from 'react';
import { FusionPoint, ElementLayout, FiberConnection } from '../../types';
import { RotateCw, Trash2 } from 'lucide-react';

interface FusionNodeProps {
    fusion: FusionPoint;
    layout: ElementLayout;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onAction: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
}

const FusionNodeComponent: React.FC<FusionNodeProps> = ({
    fusion,
    layout,
    connections,
    litPorts,
    hoveredPortId,
    onDragStart,
    onAction,
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
                height: '12px', // Aligned to 1x12 for perfect stacking
                width: '24px'   // Fits grid
            }}
            className="absolute z-20 flex flex-col items-center justify-center group select-none hover:z-50 -mt-[6px]"
        >
            {/* Header Wrapper / Controls */}
            <div
                className="
                    absolute -top-3 left-1/2 -translate-x-1/2
                    flex justify-center
                    pb-1
                    invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150
                    scale-90 group-hover:scale-100 origin-bottom
                    z-50 pointer-events-none group-hover:pointer-events-auto
                "
                onMouseDown={(e) => onDragStart(e, fusion.id)}
                onClick={(e) => onAction(e, fusion.id)}
            >
                {/* Trash Removed - using Global Delete Tool */}
            </div>

            {/* Body */}
            <div
                className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => onDragStart(e, fusion.id)}
                onClick={(e) => onAction(e, fusion.id)}
            >
                {/* Center Body - Compact Circle (10px to fit in 12px with border) */}
                <div className={`
                    w-2.5 h-2.5 rounded-full border border-black z-20 shadow-sm transition-colors duration-300
                    ${isLitA || isLitB ? 'bg-red-500' : 'bg-slate-400'}
                `} />

                {/* Left Port - Edge */}
                <div
                    id={portA}
                    onMouseDown={(e) => onPortMouseDown(e, portA)}
                    onMouseEnter={() => onPortMouseEnter(portA)}
                    onMouseLeave={onPortMouseLeave}
                    className={`
                        w-2 h-2 rounded-full bg-black border border-black
                        cursor-pointer select-none transition-all z-30 absolute left-[2px]
                        ${hoveredPortId === portA ? 'ring-2 ring-sky-400 scale-125' : ''} 
                        ${isLitA ? 'ring-2 ring-red-500 bg-red-600' : ''}
                    `}
                >
                    {!isLitA && isConnectedA && <div className="w-0.5 h-0.5 bg-emerald-500 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                </div>

                {/* Right Port - Edge */}
                <div
                    id={portB}
                    onMouseDown={(e) => onPortMouseDown(e, portB)}
                    onMouseEnter={() => onPortMouseEnter(portB)}
                    onMouseLeave={onPortMouseLeave}
                    className={`
                        w-2 h-2 rounded-full bg-black border border-black
                        cursor-pointer select-none transition-all z-30 absolute right-[2px]
                        ${hoveredPortId === portB ? 'ring-2 ring-sky-400 scale-125' : ''} 
                        ${isLitB ? 'ring-2 ring-red-500 bg-red-600' : ''}
                    `}
                >
                    {!isLitB && isConnectedB && <div className="w-0.5 h-0.5 bg-emerald-500 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                </div>
            </div>
        </div>
    );
};

export const FusionNode = React.memo(FusionNodeComponent);
