import React from 'react';
import { FiberCableNode } from './FiberCableNode';
import { CableData, FiberConnection, ElementLayout } from '../../types';

interface CableRendererProps {
    cables: CableData[];
    layoutMap: Record<string, ElementLayout> | undefined;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    cableStreetNames: Map<string, string>;
    isElementVisible: (layout: { x: number; y: number }, width: number, height: number) => boolean;

    onDragStart: (e: React.MouseEvent, id: string) => void;
    onRotate: (e: React.MouseEvent, id: string) => void;
    onMirror: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
    onCableMouseEnter: (id: string) => void;
    onCableMouseLeave: (id: string) => void;
    onCableClick: (e: React.MouseEvent, id: string) => void;
    onEdit: (e: React.MouseEvent, id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onHoverEnter?: (e: React.MouseEvent) => void;
    onHoverLeave?: (e: React.MouseEvent) => void;
}

// Emergency fallback: when a cable has no saved layout (both x and y = 0),
// stack cables vertically at x=42 with a 10px gap so they stay visible.
// Advances Y independently of whether each cable actually used the emergency slot,
// preventing "magnetic" behavior where moving one cable pulls others below it.
const EMERGENCY_START_Y = 42;
const EMERGENCY_X = 42;
const EMERGENCY_GAP = 10;
const CABLE_BASE_HEIGHT = 6;
const CABLE_ROW_HEIGHT = 12;
const CABLE_ALIGN = 24;
const CABLE_VISUAL_WIDTH = 192;

export const CableRenderer = React.memo<CableRendererProps>(({
    cables, layoutMap, connections, litPorts, hoveredPortId, cableStreetNames, isElementVisible,
    onDragStart, onRotate, onMirror, onPortMouseDown, onPortMouseEnter, onPortMouseLeave,
    onCableMouseEnter, onCableMouseLeave, onCableClick, onEdit, onContextMenu,
    onHoverEnter, onHoverLeave,
}) => {
    let currentEmergencyY = EMERGENCY_START_Y;

    return (
        <>
            {cables.map(cable => {
                const savedLayout = layoutMap?.[cable.id] || { x: 0, y: 0, rotation: 0 };

                const looseTubeCount = cable.looseTubeCount || 1;
                const fibersHeight = CABLE_BASE_HEIGHT + (looseTubeCount * CABLE_ROW_HEIGHT) + (cable.fiberCount * CABLE_ROW_HEIGHT);
                const remainder = fibersHeight % CABLE_ALIGN;
                const totalHeight = fibersHeight + (remainder > 0 ? CABLE_ALIGN - remainder : 0);

                const emergencyPos = { x: EMERGENCY_X, y: currentEmergencyY, rotation: 0 };
                const layout = (savedLayout.x !== 0 || savedLayout.y !== 0) ? savedLayout : emergencyPos;

                currentEmergencyY += totalHeight + EMERGENCY_GAP;

                if (!isElementVisible(layout, CABLE_VISUAL_WIDTH, totalHeight)) return null;

                return (
                    <FiberCableNode
                        key={cable.id}
                        cable={cable}
                        layout={layout}
                        connections={connections}
                        litPorts={litPorts}
                        hoveredPortId={hoveredPortId}
                        streetName={cableStreetNames.get(cable.id)}
                        onDragStart={onDragStart}
                        onRotate={onRotate}
                        onMirror={onMirror}
                        onPortMouseDown={onPortMouseDown}
                        onPortMouseEnter={onPortMouseEnter}
                        onPortMouseLeave={onPortMouseLeave}
                        onCableMouseEnter={onCableMouseEnter}
                        onCableMouseLeave={onCableMouseLeave}
                        onCableClick={onCableClick}
                        onEdit={onEdit}
                        onContextMenu={onContextMenu}
                        onHoverEnter={onHoverEnter}
                        onHoverLeave={onHoverLeave}
                        hoverData={{ id: cable.id, type: 'cable' }}
                    />
                );
            })}
        </>
    );
});

CableRenderer.displayName = 'CableRenderer';
