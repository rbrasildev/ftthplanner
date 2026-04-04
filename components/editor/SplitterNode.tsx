
import React from 'react';
import { Splitter, ElementLayout, FiberConnection } from '../../types';
import { useLanguage } from '../../LanguageContext';
import { SplitterCatalogItem } from '../../services/catalogService';

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
    attachedCustomers?: Record<number, { name: string; status?: string }>; // portIndex -> Customer Data
    catalogItem?: SplitterCatalogItem; // Metadata for identifying high-power ports
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
    onContextMenu,
    attachedCustomers = {},
    catalogItem
}) => {
    const { t } = useLanguage();
    const portCount = splitter.outputPortIds.length;
    // Dimensions aligned to 12px grid
    // Use 12px per port to match fiber pitch
    const width = portCount === 2 ? 18 : portCount * 12;
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
    const isConnectorized = splitter.connectorType === 'Connectorized';
    const polishType = splitter.polishType || catalogItem?.polishType || '';
    const isAPC = polishType === 'APC';
    // APC = green, UPC/PC = blue
    const polishColor = isAPC ? { bg: 'bg-green-500', border: 'border-green-600', text: 'text-white', hoverBorder: 'hover:border-green-400' }
        : { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white', hoverBorder: 'hover:border-blue-400' };

    // --- High-Power Port Identification (Unbalanced Splitters) ---
    // Rule: The port with the lowest attenuation (dB) has the highest power output.
    const highPowerPortIndex = React.useMemo(() => {
        if (!catalogItem || !catalogItem.attenuation) return -1;
        
        let att: any = catalogItem.attenuation;
        if (typeof att === 'string' && att.trim().startsWith('{')) {
            try {
                att = JSON.parse(att);
            } catch (e) {
                return -1;
            }
        }

        if (typeof att === 'object' && att !== null) {
            const p1 = parseFloat(att.port1);
            const p2 = parseFloat(att.port2);
            if (!isNaN(p1) && !isNaN(p2)) {
                // Return index of port with LOWER attenuation (Higher Power)
                return p1 < p2 ? 0 : 1;
            }
        }
        return -1;
    }, [catalogItem]);

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
                    style={{ height: 46, top: 12 }}
                    className="absolute inset-x-0 z-10 pointer-events-none"
                >
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                        <polygon
                            points={`${50 + skewPercent},0 ${ (portCount === 2 ? 10 : 2) + skewPercent},100 ${(portCount === 2 ? 90 : 98) + skewPercent},100`}
                            className={`transition-colors duration-300 ${isConnectorized ? 'fill-white dark:fill-slate-800' : 'fill-[#949494] dark:fill-slate-600'} ${isLitIn ? 'stroke-red-400' : 'stroke-slate-900 dark:stroke-slate-100'} cursor-pointer pointer-events-auto`}
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
                    <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-3" style={{ paddingLeft: `${shiftPx}px` }}>
                        <span className={`text-[8px] font-normal leading-none ${isLitIn ? 'text-red-500' : (!isConnectorized ? 'text-white' : 'text-slate-500 dark:text-slate-100')}`}>{splitter.type}</span>
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
                        className={`w-2.5 h-2.5 rounded-full border cursor-pointer pointer-events-auto
                        hover:scale-150 transition-all text-center flex items-center justify-center
                        text-[6.5px] font-bold select-none shadow-sm
                        ${hoveredPortId === splitter.inputPortId ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50 dark:bg-emerald-900' : ''}
                        ${isLitIn
                                ? 'border-red-400 bg-red-600 text-white'
                                : 'border-slate-900 dark:border-slate-300 bg-black dark:bg-[#151820] text-white dark:text-slate-100'}
                    `}
                    >
                        1
                    </div>
                    <span className={`absolute left-1/2 ml-3 text-[6px] font-extrabold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase ${!isConnectorized ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>In</span>
                </div>

                {/* Output Ports (Y=60) - Shifted 6px and moved slightly lower for "half-out" effect */}
                <div className="absolute top-[48px] left-1.5 w-full h-6 z-30">
                    {splitter.outputPortIds.map((pid, idx) => {
                        const isConnected = connections.some(c => c.sourceId === pid);
                        const isLitOut = litPorts.has(pid);
                        const customerData = attachedCustomers[idx];
                        const customerName = customerData?.name;
                        const isOffline = customerData?.status === 'offline';

                        const isHighPower = idx === highPowerPortIndex;
                        const is1x2 = portCount === 2;
                        const isUnbalanced = highPowerPortIndex !== -1;
                        const isSecondaryUnbalanced = is1x2 && isUnbalanced && !isHighPower;

                        // Triangle Base Corners (Dynamic based on width and 6px skew):
                        // For 1x2, we use 10% and 90% to avoid them being "glued".
                        const baseL = is1x2 ? 10 : 2;
                        const baseR = is1x2 ? 90 : 98;
                        const leftCorner = ( (baseL / 100) * width + 6) - 6;
                        const rightCorner = ( (baseR / 100) * width + 6) - 6;
                        const targetCenter = is1x2 ? (idx === 0 ? leftCorner : rightCorner) : (idx * 12) + 6;
                        
                        const actualLeft = targetCenter - (isHighPower ? 7 : 5);
                        const actualTop = is1x2 ? (isHighPower ? 4 : 6) : (isHighPower ? 3 : 5);

                        return (
                            <div
                                key={pid}
                                id={pid}
                                onMouseDown={(e) => onPortMouseDown(e, pid)}
                                onMouseEnter={() => onPortMouseEnter(pid)}
                                onMouseLeave={onPortMouseLeave}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (onContextMenu) onContextMenu(e, splitter.id);
                                }}
                                title={customerName
                                    ? t('customer_port_tooltip', { name: customerName })
                                    : t('port_label', { number: idx + 1 })
                                }
                                className={`
                                border cursor-pointer pointer-events-auto
                                hover:scale-150 transition-all text-center absolute
                                text-[6.5px] font-semibold select-none flex items-center justify-center
                                ${isHighPower ? 'w-3.5 h-3.5 z-40' : 'w-2.5 h-2.5'}
                                ${isConnectorized ? 'rounded-[1px]' : 'rounded-full'} 
                                ${hoveredPortId === pid ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50 dark:bg-emerald-900' : ''}
                                ${isLitOut
                                        ? 'border-red-400 bg-red-600 text-white'
                                        : customerName
                                            ? (isOffline ? 'border-red-500 bg-red-50 text-red-700 font-bold' : 'border-green-500 bg-green-50 text-green-700 font-bold')
                                            : isSecondaryUnbalanced
                                                ? 'border-slate-950 dark:border-slate-300 bg-white dark:bg-white text-slate-950 dark:text-slate-950 font-bold border-[1.5px]'
                                                : !isConnectorized
                                                    ? 'border-slate-950 dark:border-slate-300 bg-black dark:bg-[#151820] text-white dark:text-slate-100'
                                                    : `${polishColor.bg} ${polishColor.border} ${polishColor.text} ${polishColor.hoverBorder}`
                                    }
                            `}
                                style={{
                                    left: `${actualLeft}px`,
                                    top: `${actualTop}px`
                                }}
                            >
                                {customerName && (
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                        style={{ 
                                            top: `15px`,
                                            zIndex: 40 
                                        }}
                                    >
                                        <div className={`w-0 h-0 border-l-[2px] border-l-transparent border-r-[2px] border-r-transparent border-b-[3px] ${isOffline ? 'border-b-red-500/80' : 'border-b-green-500/80'} mb-[-1px]`} />
                                        <div className={`${isOffline ? 'bg-red-500/90 dark:bg-red-600/90' : 'bg-green-500/90 dark:bg-green-600/90'} text-white rounded-[1px] shadow-sm flex items-center justify-center p-[1px] min-w-[8px]`}>
                                            <span 
                                                className="text-[6px] font-black uppercase tracking-tighter whitespace-nowrap"
                                                style={{ 
                                                    writingMode: 'vertical-rl',
                                                    textOrientation: 'mixed'
                                                }}
                                            >
                                                {customerName}
                                            </span>
                                        </div>
                                    </div>
                                )}
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
