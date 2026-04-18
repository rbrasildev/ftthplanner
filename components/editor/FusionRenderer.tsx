import React from 'react';
import { FusionNode } from './FusionNode';
import { FusionPoint, FiberConnection, ElementLayout } from '../../types';

interface FusionRendererProps {
    fusions: FusionPoint[];
    layoutMap: Record<string, ElementLayout> | undefined;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    customersByConnector: Map<string, { name: string; status?: string }>;
    isElementVisible: (layout: { x: number; y: number }, width: number, height: number) => boolean;

    onDragStart: (e: React.MouseEvent, id: string) => void;
    onAction: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
    onHoverEnter?: (e: React.MouseEvent) => void;
    onHoverLeave?: (e: React.MouseEvent) => void;
}

const DEFAULT_LAYOUT: ElementLayout = { x: 0, y: 0, rotation: 0 };

export const FusionRenderer = React.memo<FusionRendererProps>(({
    fusions, layoutMap, connections, litPorts, hoveredPortId,
    customersByConnector, isElementVisible,
    onDragStart, onAction, onPortMouseDown, onPortMouseEnter, onPortMouseLeave,
    onHoverEnter, onHoverLeave,
}) => {
    return (
        <>
            {fusions.map(fusion => {
                const layout = layoutMap?.[fusion.id] || DEFAULT_LAYOUT;
                // Viewport culling: skip off-screen fusions (48x24 bounding box)
                if (!isElementVisible(layout, 48, 24)) return null;
                const attachedCustomer = fusion.category === 'connector'
                    ? customersByConnector.get(fusion.id) ?? null
                    : null;
                return (
                    <FusionNode
                        key={fusion.id}
                        fusion={fusion}
                        layout={layout}
                        connections={connections}
                        litPorts={litPorts}
                        hoveredPortId={hoveredPortId}
                        onDragStart={onDragStart}
                        onAction={onAction}
                        onPortMouseDown={onPortMouseDown}
                        onPortMouseEnter={onPortMouseEnter}
                        onPortMouseLeave={onPortMouseLeave}
                        onHoverEnter={onHoverEnter}
                        onHoverLeave={onHoverLeave}
                        hoverData={{ id: fusion.id, type: 'fusion' }}
                        attachedCustomer={attachedCustomer}
                    />
                );
            })}
        </>
    );
});

FusionRenderer.displayName = 'FusionRenderer';
