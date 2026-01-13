
import React from 'react';
import { Splitter, ElementLayout, FiberConnection } from '../../types';

interface SplitterNodeProps {
    splitter: Splitter;
    layout: ElementLayout;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onAction: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
    onDoubleClick?: (id: string) => void;
    onContextMenu?: (e: React.MouseEvent, id: string) => void;
}

const SplitterNodeComponent: React.FC<SplitterNodeProps> = ({
    splitter,
    layout,
    connections,
    litPorts,
    hoveredPortId,
    onDragStart,
    onAction,
    onPortMouseDown,
    onPortMouseEnter,
    onPortMouseLeave,
    onDoubleClick,
    onContextMenu
}) => {
    const portCount = splitter.outputPortIds.length;
    // Dimensions aligned to 12px grid
    // Use 12px per port to match fiber pitch
    const width = portCount * 12;
    const height = 72;

    // Grid-Safe Rotation Logic:
    // To ensure 90-degree rotation maintains grid alignment, we force a square container.
    // The content is then centered within this square.
    const size = Math.max(width, height);
    const offsetX = (size - width) / 2;
    const offsetY = (size - height) / 2;

    // Correction for Phase Alignment (Phase 12 vs Phase 6)
    // We shift the outputs by +6px to align with Phase 12.
    // We also skew the visual triangle by 6px.
    const shiftPx = 6;
    const skewPercent = (shiftPx / width) * 100;

    const isLitIn = litPorts.has(splitter.inputPortId);

    return (
        <div
            id={splitter.id}
            style={{
                transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotation}deg)`,
                width: size,
                height: size
            }}
            className="absolute z-20 group select-none pointer-events-none"
        >
            {/* Inner Container for centering content */}
            <div className="absolute" style={{ left: offsetX, top: offsetY, width, height }}>

                {/* Header Wrapper / Controls */}
                <div
                    className="
                    absolute -top-3 left-1/2 -translate-x-1/2
                    flex justify-center
                    pb-1
                    opacity-0 group-hover:opacity-100 transition-opacity duration-150
                    scale-90 group-hover:scale-100 origin-bottom
                    z-50 pointer-events-none group-hover:pointer-events-auto
                "
                    onMouseDown={(e) => onDragStart(e, splitter.id)}
                    onClick={(e) => onAction(e, splitter.id)}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        // if (onDoubleClick) onDoubleClick(splitter.id); // Disabled Double Click for Details
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onContextMenu) onContextMenu(e, splitter.id);
                    }}
                >
                    {/* Trash Removed - using Global Delete Tool */}
                </div>

                {/* Triangle Body - Spans from Y=12 to Y=60 */}
                <div
                    style={{ height: 48, top: 12 }}
                    className="absolute inset-x-0 z-10 pointer-events-none"
                >
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                        <polygon
                            points={`${50 + skewPercent},0 ${0 + skewPercent},100 ${100 + skewPercent},100`}
                            className={`transition-colors duration-300 fill-white dark:fill-slate-900 ${isLitIn ? 'stroke-red-500' : 'stroke-slate-900 dark:stroke-slate-100'} cursor-pointer pointer-events-auto`}
                            strokeWidth="1"
                            onMouseDown={(e) => onDragStart(e, splitter.id)}
                            onClick={(e) => onAction(e, splitter.id)}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                // if (onDoubleClick) onDoubleClick(splitter.id); // Disabled Double Click for Details
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onContextMenu) onContextMenu(e, splitter.id);
                            }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-2" style={{ paddingLeft: `${shiftPx}px` }}>
                        <span className={`text-[8px] font-normal leading-none ${isLitIn ? 'text-red-500' : 'text-slate-500 dark:text-slate-100'}`}>{splitter.type}</span>
                    </div>
                </div>

                {/* Input Port (Y=12) */}
                <div
                    className="absolute top-0 left-0 w-full h-6 flex items-center justify-center z-30"
                    style={{ left: `${shiftPx}px` }}
                >
                    <div
                        id={splitter.inputPortId}
                        onMouseDown={(e) => onPortMouseDown(e, splitter.inputPortId)}
                        onMouseEnter={() => onPortMouseEnter(splitter.inputPortId)}
                        onMouseLeave={onPortMouseLeave}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            // if (onDoubleClick) onDoubleClick(splitter.id);
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onContextMenu) onContextMenu(e, splitter.id);
                        }}
                        className={`w-2.5 h-2.5 rounded-full border bg-white dark:bg-slate-900 cursor-pointer pointer-events-auto
                        hover:scale-150 transition-all text-center flex items-center justify-center
                        text-[6.5px] font-bold select-none shadow-sm
                        ${hoveredPortId === splitter.inputPortId ? 'ring-2 ring-sky-500 border-sky-400 bg-sky-50 dark:bg-sky-900' : ''}
                        ${isLitIn
                                ? 'border-red-500 bg-red-900 text-white'
                                : 'border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-500 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300'}
                    `}
                    >
                        1
                    </div>
                    <span className="absolute left-1/2 ml-3 text-[6px] text-slate-400 dark:text-slate-500 font-extrabold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase">In</span>
                </div>

                {/* Output Ports (Y=60) - Shifted 6px */}
                <div className="absolute top-12 left-1.5 w-full h-6 z-30">
                    {splitter.outputPortIds.map((pid, idx) => {
                        const isConnected = connections.some(c => c.sourceId === pid);
                        const isLitOut = litPorts.has(pid);
                        // Uniform distribution: ports at 6, 18, 30... (centers of 12px blocks)
                        // (idx * 12) + 6 - 5 (to center 10px circle)
                        const leftPos = (idx * 12) + 6 - 5;

                        return (
                            <div
                                key={pid}
                                id={pid}
                                onMouseDown={(e) => onPortMouseDown(e, pid)}
                                onMouseEnter={() => onPortMouseEnter(pid)}
                                onMouseLeave={onPortMouseLeave}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    // if (onDoubleClick) onDoubleClick(splitter.id);
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (onContextMenu) onContextMenu(e, splitter.id);
                                }}
                                className={`
                                w-2.5 h-2.5 rounded-full border bg-white dark:bg-slate-900 cursor-pointer pointer-events-auto
                                hover:scale-150 transition-all text-center absolute top-[5px]
                                text-[6.5px] font-normal select-none  flex items-center justify-center
                                ${hoveredPortId === pid ? 'ring-2 ring-sky-500 border-sky-400 bg-sky-50 dark:bg-sky-900' : ''}
                                ${isLitOut
                                        ? 'border-red-500 bg-red-900 text-white'
                                        : 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-300'
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
        </div>
    );
};

export const SplitterNode = React.memo(SplitterNodeComponent);
