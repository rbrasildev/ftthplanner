import React from 'react';
import { DIOInline, ElementLayout, FiberConnection } from '../../types';
import { makeDIOPortId } from '../../utils/dioPortId';

interface DIONodeProps {
    dio: DIOInline;
    layout: ElementLayout;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    onDragStart: (e: React.MouseEvent, id: string) => void;
    onAction: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
    onContextMenu?: (e: React.MouseEvent, id: string) => void;
    onHoverEnter?: (e: React.MouseEvent) => void;
    onHoverLeave?: (e: React.MouseEvent) => void;
    hoverData?: { id: string; type: string };
}

const PORT_ROW = 12;
const CAP = 12; // top + bottom inner padding (6 each)
const WIDTH = 36;

const DIONodeComponent: React.FC<DIONodeProps> = ({
    dio,
    layout,
    connections,
    litPorts,
    hoveredPortId,
    onDragStart,
    onAction,
    onPortMouseDown,
    onPortMouseEnter,
    onPortMouseLeave,
    onContextMenu,
    onHoverEnter,
    onHoverLeave,
    hoverData,
}) => {
    const portCount = dio.ports;
    const width = WIDTH;
    const height = CAP + portCount * PORT_ROW;

    // Square container so 90° rotation stays grid-aligned (same trick as SplitterNode)
    const size = Math.max(width, height);
    const offsetX = (size - width) / 2;
    const offsetY = (size - height) / 2;

    // Decide label side (left/right of body) based on rotation so it never sits on top.
    const rot = ((layout.rotation || 0) % 360 + 360) % 360;
    const useRightSide = rot > 45 && rot < 135;
    const textRot = useRightSide ? -90 : 90;

    return (
        <div
            id={dio.id}
            onMouseEnter={onHoverEnter}
            onMouseLeave={onHoverLeave}
            data-hover-id={hoverData?.id}
            data-hover-type={hoverData?.type}
            style={{
                transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotation}deg)`,
                width: size,
                height: size,
            }}
            className="absolute z-20 group select-none pointer-events-none"
        >
            <div className="absolute" style={{ left: offsetX, top: offsetY, width, height }}>
                {/* BODY — dark slate vertical chassis with rounded corners + subtle bevel */}
                <div
                    className="absolute inset-0 rounded-[3px] cursor-grab active:cursor-grabbing pointer-events-auto
                               bg-gradient-to-r from-slate-700 via-slate-800 to-slate-700
                               dark:from-slate-800 dark:via-slate-900 dark:to-slate-800
                               border border-slate-900 dark:border-black shadow-md"
                    onMouseDown={(e) => onDragStart(e, dio.id)}
                    onClick={(e) => onAction(e, dio.id)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onContextMenu) onContextMenu(e, dio.id);
                    }}
                >
                    {/* Top decorative cap — two screw dots, distinguishes from a plain rectangle */}
                    <div className="absolute top-0 left-0 right-0 h-[6px] flex items-center justify-between px-[3px] pointer-events-none">
                        <span className="block w-[2px] h-[2px] rounded-full bg-slate-500/80 dark:bg-slate-600/80" />
                        <span className="block w-[2px] h-[2px] rounded-full bg-slate-500/80 dark:bg-slate-600/80" />
                    </div>
                    {/* Bottom decorative cap */}
                    <div className="absolute bottom-0 left-0 right-0 h-[6px] flex items-center justify-between px-[3px] pointer-events-none">
                        <span className="block w-[2px] h-[2px] rounded-full bg-slate-500/80 dark:bg-slate-600/80" />
                        <span className="block w-[2px] h-[2px] rounded-full bg-slate-500/80 dark:bg-slate-600/80" />
                    </div>
                </div>

                {/* PORT ROWS */}
                {Array.from({ length: portCount }).map((_, idx) => {
                    const inId = makeDIOPortId(dio.id, idx, 'in');
                    const outId = makeDIOPortId(dio.id, idx, 'out');
                    const rowTop = 6 + idx * PORT_ROW; // 6px top cap then row stride
                    const isLitIn = litPorts.has(inId);
                    const isLitOut = litPorts.has(outId);
                    const isConnIn = connections.some(c => c.sourceId === inId || c.targetId === inId);
                    const isConnOut = connections.some(c => c.sourceId === outId || c.targetId === outId);
                    const portTitle = `${dio.name} · P${idx + 1}`;

                    // Slot indicator color: amber when both sides connected (= patched-through),
                    // slate otherwise. Pure visual, no logic enforced.
                    const patched = isConnIn && isConnOut;

                    return (
                        <div
                            key={idx}
                            className="absolute left-0 right-0 flex items-center justify-between px-[2px] z-30 pointer-events-none"
                            style={{ top: rowTop, height: PORT_ROW }}
                        >
                            {/* IN port (left) */}
                            <div
                                id={inId}
                                onMouseDown={(e) => onPortMouseDown(e, inId)}
                                onMouseEnter={() => onPortMouseEnter(inId)}
                                onMouseLeave={onPortMouseLeave}
                                title={`${portTitle} · IN`}
                                className={`w-2.5 h-2.5 rounded-full border cursor-pointer pointer-events-auto
                                    hover:scale-150 transition-all flex items-center justify-center text-[6px] font-bold shadow-sm
                                    ${hoveredPortId === inId ? 'ring-2 ring-emerald-400 border-emerald-300' : ''}
                                    ${isLitIn
                                        ? 'border-red-400 bg-red-600 text-white'
                                        : isConnIn
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : 'border-slate-900 bg-white dark:bg-slate-200 text-slate-800'}
                                `}
                            >
                                <span className="opacity-60">{idx + 1}</span>
                            </div>

                            {/* Center slot indicator — small horizontal bar */}
                            <div
                                className={`flex-1 mx-[2px] h-[2px] rounded-sm pointer-events-none transition-colors
                                    ${patched ? 'bg-amber-400/80' : 'bg-slate-500/60 dark:bg-slate-600/60'}`}
                            />

                            {/* OUT port (right) */}
                            <div
                                id={outId}
                                onMouseDown={(e) => onPortMouseDown(e, outId)}
                                onMouseEnter={() => onPortMouseEnter(outId)}
                                onMouseLeave={onPortMouseLeave}
                                title={`${portTitle} · OUT`}
                                className={`w-2.5 h-2.5 rounded-[1px] border cursor-pointer pointer-events-auto
                                    hover:scale-150 transition-all flex items-center justify-center text-[6px] font-bold shadow-sm
                                    ${hoveredPortId === outId ? 'ring-2 ring-emerald-400 border-emerald-300' : ''}
                                    ${isLitOut
                                        ? 'border-red-400 bg-red-600 text-white'
                                        : isConnOut
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : 'border-slate-900 bg-slate-300 dark:bg-slate-400 text-slate-900'}
                                `}
                            >
                                <span className="opacity-60">{idx + 1}</span>
                            </div>
                        </div>
                    );
                })}

                {/* LABEL beside the body — flips side based on rotation, like SplitterNode */}
                <div
                    className="absolute pointer-events-none -z-10 bg-white/60 dark:bg-[#1a1d23]/60 px-1 flex items-center justify-center"
                    style={{
                        top: height / 2,
                        left: useRightSide ? width + 8 : -8,
                        transform: `translate(-50%, -50%) rotate(${textRot}deg)`,
                    }}
                >
                    <span className="text-[7px] font-bold text-black dark:text-white whitespace-nowrap leading-tight">
                        {dio.name} · {portCount}p
                    </span>
                </div>
            </div>
        </div>
    );
};

export const DIONode = React.memo(DIONodeComponent);
