
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
    onHoverEnter?: (e: React.MouseEvent) => void;
    onHoverLeave?: (e: React.MouseEvent) => void;
    hoverData?: { id: string; type: string };
    // For connectors (category==='connector'), the single customer attached to this element.
    // Fusions never have customers, so this is only meaningful when isConnector.
    attachedCustomer?: { name: string; status?: string | null } | null;
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
    onPortMouseLeave,
    onHoverEnter,
    onHoverLeave,
    hoverData,
    attachedCustomer = null,
}) => {
    const portA = `${fusion.id}-a`;
    const portB = `${fusion.id}-b`;

    const isConnectedA = connections.some(c => c.targetId === portA || c.sourceId === portA);
    const isConnectedB = connections.some(c => c.targetId === portB || c.sourceId === portB);

    const isLitA = litPorts.has(portA);
    const isLitB = litPorts.has(portB);

    const isConnector = fusion.category === 'connector';
    const isAPC = fusion.polishType === 'APC';
    const connectorColor = isAPC ? { bg: 'bg-green-500', border: 'border-green-600', ring: 'ring-green-400' }
        : { bg: 'bg-blue-500', border: 'border-blue-600', ring: 'ring-blue-400' };

    return (
        <div
            id={fusion.id}
            onMouseEnter={onHoverEnter}
            onMouseLeave={onHoverLeave}
            data-hover-id={hoverData?.id}
            data-hover-type={hoverData?.type}
            style={{
                transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotation}deg)`,
                height: '12px',
                width: '24px'
            }}
            className="absolute z-20 flex flex-col items-center justify-center group select-none hover:z-50"
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
            </div>

            {/* Body */}
            <div
                className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => onDragStart(e, fusion.id)}
                onClick={(e) => onAction(e, fusion.id)}
            >
                {/* Center Body */}
                <div className={`
                    w-2.5 h-2.5 border z-20 shadow-sm transition-colors duration-300
                    ${isConnector ? `rounded-[1px] ${isLitA || isLitB ? 'bg-red-400 border-red-500' : `${connectorColor.bg} ${connectorColor.border}`}` : `rounded-full border-black dark:border-black ${isLitA || isLitB ? 'bg-red-400' : 'bg-[#949494] dark:bg-slate-500'}`}
                `} />

                {/* Left Port */}
                <div
                    id={portA}
                    onMouseDown={(e) => onPortMouseDown(e, portA)}
                    onMouseEnter={() => onPortMouseEnter(portA)}
                    onMouseLeave={onPortMouseLeave}
                    className={`
                        w-2 h-2 cursor-pointer select-none transition-all z-30 absolute left-[2px]
                        ${isConnector ? `rounded-[1px] ${isLitA ? `ring-2 ring-red-400 bg-red-500 ${connectorColor.border}` : `${connectorColor.bg} ${connectorColor.border}`} border` : `rounded-full bg-[#2E2D39] dark:bg-black border-[#2E2D39] dark:border-black border`}
                        ${hoveredPortId === portA ? `ring-2 ${isConnector ? connectorColor.ring : 'ring-emerald-400'} scale-125` : ''}
                        ${!isConnector && isLitA ? 'ring-2 ring-red-400 bg-red-500' : ''}
                    `}
                >
                    {!isLitA && isConnectedA && !isConnector && <div className="w-0.5 h-0.5 bg-emerald-500 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                </div>

                {/* Right Port */}
                <div
                    id={portB}
                    onMouseDown={(e) => onPortMouseDown(e, portB)}
                    onMouseEnter={() => onPortMouseEnter(portB)}
                    onMouseLeave={onPortMouseLeave}
                    className={`
                        w-2 h-2 cursor-pointer select-none transition-all z-30 absolute right-[2px]
                        ${isConnector ? `rounded-[1px] ${isLitB ? `ring-2 ring-red-400 bg-red-500 ${connectorColor.border}` : `${connectorColor.bg} ${connectorColor.border}`} border` : `rounded-full bg-[#2E2D39] dark:bg-black border-[#2E2D39] dark:border-black border`}
                        ${hoveredPortId === portB ? `ring-2 ${isConnector ? connectorColor.ring : 'ring-emerald-400'} scale-125` : ''}
                        ${!isConnector && isLitB ? 'ring-2 ring-red-400 bg-red-500' : ''}
                    `}
                >
                    {!isLitB && isConnectedB && !isConnector && <div className="w-0.5 h-0.5 bg-emerald-500 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                </div>

                {/* Attached Customer Label — only for connectors. Extends horizontally from the RIGHT tip
                    (portB) of the connector, so it reads as "cable coming out of the connector end",
                    not hanging off the side of the body. */}
                {isConnector && attachedCustomer && (() => {
                    const isOffline = attachedCustomer.status === 'offline';
                    return (
                        <div
                            className="absolute flex items-center pointer-events-none"
                            style={{
                                // Anchor at the right port and extend further right.
                                left: 'calc(100% + 1px)',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 40
                            }}
                            title={attachedCustomer.name}
                        >
                            {/* Triangle pointing left toward the connector tip */}
                            <div className={`w-0 h-0 border-t-[2px] border-t-transparent border-b-[2px] border-b-transparent border-r-[3px] ${isOffline ? 'border-r-red-500/80' : 'border-r-green-500/80'} mr-[-1px]`} />
                            <div className={`${isOffline ? 'bg-red-500/90 dark:bg-red-600/90' : 'bg-green-500/90 dark:bg-green-600/90'} text-white rounded-[1px] shadow-sm flex items-center justify-center px-[2px] py-[1px] min-h-[8px]`}>
                                <span className="text-[6px] font-black uppercase tracking-tighter whitespace-nowrap">
                                    {attachedCustomer.name}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export const FusionNode = React.memo(FusionNodeComponent);
