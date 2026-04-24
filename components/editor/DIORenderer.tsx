import React from 'react';
import { DIONode } from './DIONode';
import { DIOInline, FiberConnection, ElementLayout } from '../../types';

interface DIORendererProps {
    dios: DIOInline[];
    layoutMap: Record<string, ElementLayout> | undefined;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    isElementVisible: (layout: { x: number; y: number }, width: number, height: number) => boolean;

    onDragStart: (e: React.MouseEvent, id: string) => void;
    onAction: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
    onContextMenu?: (e: React.MouseEvent, id: string) => void;
    onHoverEnter?: (e: React.MouseEvent) => void;
    onHoverLeave?: (e: React.MouseEvent) => void;
}

const DEFAULT_LAYOUT: ElementLayout = { x: 0, y: 0, rotation: 0 };

export const DIORenderer = React.memo<DIORendererProps>(({
    dios, layoutMap, connections, litPorts, hoveredPortId, isElementVisible,
    onDragStart, onAction, onPortMouseDown, onPortMouseEnter, onPortMouseLeave,
    onContextMenu, onHoverEnter, onHoverLeave,
}) => {
    return (
        <>
            {dios.map(dio => {
                const layout = layoutMap?.[dio.id] || DEFAULT_LAYOUT;
                const width = 36;
                const height = 12 + dio.ports * 12;
                const size = Math.max(width, height);
                if (!isElementVisible(layout, size, size)) return null;

                return (
                    <DIONode
                        key={dio.id}
                        dio={dio}
                        layout={layout}
                        connections={connections}
                        litPorts={litPorts}
                        hoveredPortId={hoveredPortId}
                        onDragStart={onDragStart}
                        onAction={onAction}
                        onPortMouseDown={onPortMouseDown}
                        onPortMouseEnter={onPortMouseEnter}
                        onPortMouseLeave={onPortMouseLeave}
                        onContextMenu={onContextMenu}
                        onHoverEnter={onHoverEnter}
                        onHoverLeave={onHoverLeave}
                        hoverData={{ id: dio.id, type: 'dio' }}
                    />
                );
            })}
        </>
    );
});

DIORenderer.displayName = 'DIORenderer';
