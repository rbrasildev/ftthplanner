import React from 'react';
import { CableData, getFiberColor, ElementLayout, FiberConnection } from '../../types';
import { RotateCw, GripHorizontal, ArrowRightLeft, Pencil } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

interface FiberCableNodeProps {
    cable: CableData;
    layout: ElementLayout;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onRotate: (e: React.MouseEvent, id: string) => void;
    onMirror: (e: React.MouseEvent, id: string) => void;
    onEdit?: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
    onCableMouseEnter?: (id: string) => void;
    onCableMouseLeave?: (id: string) => void;
    onCableClick?: (e: React.MouseEvent, id: string) => void;
    onContextMenu?: (e: React.MouseEvent, id: string) => void;
}

const FiberCableNodeComponent: React.FC<FiberCableNodeProps> = ({
    cable,
    layout,
    connections,
    litPorts,
    hoveredPortId,
    onDragStart,
    onRotate,
    onMirror,
    onEdit,
    onPortMouseDown,
    onPortMouseEnter,
    onPortMouseLeave,
    onCableMouseEnter,
    onCableMouseLeave,
    onCableClick,
    onContextMenu
}) => {
    const { t } = useLanguage();
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

    // Fix Vertical Alignment on Rotation:
    // When rotating 90deg, the element rotates around its center.
    // If the height is not a multiple of 24 (2 * Grid), the visual center (and thus ports) falls off-grid.
    // We add paddingBottom to force the total height to be a multiple of 24px.
    // Let's calculate the natural height of the fibers column:
    // pt-1.5 (6px) + for each tube: (fibers * 12) + gap-3 (12px) between tubes.
    const fibersHeight = 6 + tubes.reduce((acc, tube, idx) => {
        const height = tube.fiberIndices.length * 12;
        const gap = idx < tubes.length - 1 ? 12 : 0;
        return acc + height + gap;
    }, 0);

    const remainder = fibersHeight % 24;
    const paddingBottom = remainder > 0 ? 24 - remainder : 0;

    return (
        <div
            id={cable.id}
            onContextMenu={(e) => onContextMenu?.(e, cable.id)}
            style={{
                transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotation}deg)`,
                paddingBottom: `${paddingBottom}px` // invisible padding to align center
            }}
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
                <div className="absolute bottom-full right-0 pb-2 pr-1 z-50 flex flex-col items-end opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                    <div className="flex gap-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 p-0.5 shadow-sm whitespace-nowrap">
                        <button
                            onClick={(e) => { e.stopPropagation(); onMirror(e, cable.id); }}
                            className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                            title={t('action_flip')}
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRotate(e, cable.id); }}
                            className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                            title={t('action_rotate')}
                        >
                            <RotateCw className="w-4 h-4" />
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
                        style={{ borderColor: getFiberColor(tube.tubeIdx, cable.colorStandard) }}
                    >
                        {tube.fiberIndices.map(i => {
                            const fiberId = `${cable.id}-fiber-${i}`;
                            // FIXED per User Request:
                            // Colors MUST reset at the beginning of each loose tube (as per specified count).
                            // e.g. Tube 1 (1-6): Green..Violet. Tube 2 (7-12): Green..Violet.
                            // Numbering remains global (1..N).
                            const positionInTube = i % fibersPerTube;
                            const color = getFiberColor(positionInTube, cable.colorStandard);
                            const isLit = litPorts.has(fiberId);
                            const isLightColor = ['#ffffff', '#eab308', '#22d3ee', '#ec4899', '#f97316'].includes(color); // Approximate check for black text
                            const textColor = isLightColor ? 'text-black' : 'text-white';

                            return (
                                <div
                                    key={fiberId}
                                    className={`relative h-3 w-4 flex items-center ${isMirrored ? 'justify-start' : 'justify-end'}`}
                                >
                                    {/* Connecting line */}
                                    <div
                                        style={{ backgroundColor: isLit ? '#ef4444' : color, opacity: 1 }}
                                        className={`w-full h-[1px] ${isMirrored ? 'ml-2' : 'mr-2'}`}
                                    ></div>

                                    {/* Port Circle - Center at 12px height and aligned with grid */}
                                    <div

                                        id={fiberId}
                                        onMouseDown={(e) => onPortMouseDown(e, fiberId)}
                                        onMouseEnter={() => onPortMouseEnter(fiberId)}
                                        onMouseLeave={onPortMouseLeave}
                                        className={`
                                        w-2.5 h-2.5 rounded-full border border-black dark:border-white cursor-pointer select-none
                                        hover:scale-125 transition-transform z-30
                                        absolute ${isMirrored ? '-left-[7px]' : '-right-[7px]'} shadow-sm ${textColor} text-[7px] font-bold leading-none pb-[0.5px]
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
        </div >
    );
};

export const FiberCableNode = React.memo(FiberCableNodeComponent);