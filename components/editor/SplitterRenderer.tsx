import React from 'react';
import { SplitterNode } from './SplitterNode';
import { Splitter, FiberConnection, ElementLayout } from '../../types';
import { SplitterCatalogItem } from '../../services/catalogService';
import { findSplitterCatalog } from '../../utils/splitterUtils';

interface SplitterRendererProps {
    splitters: Splitter[];
    layoutMap: Record<string, ElementLayout> | undefined;
    connections: FiberConnection[];
    litPorts: Set<string>;
    hoveredPortId: string | null;
    availableSplitters: SplitterCatalogItem[];
    customersBySplitterPort: Map<string, Map<number, { name: string; status?: string }>>;
    isElementVisible: (layout: { x: number; y: number }, width: number, height: number) => boolean;

    onDragStart: (e: React.MouseEvent, id: string) => void;
    onAction: (e: React.MouseEvent, id: string) => void;
    onPortMouseDown: (e: React.MouseEvent, portId: string) => void;
    onPortMouseEnter: (portId: string) => void;
    onPortMouseLeave: () => void;
    onDoubleClick: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onHoverEnter?: (e: React.MouseEvent) => void;
    onHoverLeave?: (e: React.MouseEvent) => void;
}

const DEFAULT_LAYOUT: ElementLayout = { x: 0, y: 0, rotation: 0 };

export const SplitterRenderer = React.memo<SplitterRendererProps>(({
    splitters, layoutMap, connections, litPorts, hoveredPortId,
    availableSplitters, customersBySplitterPort, isElementVisible,
    onDragStart, onAction, onPortMouseDown, onPortMouseEnter, onPortMouseLeave,
    onDoubleClick, onContextMenu, onHoverEnter, onHoverLeave,
}) => {
    return (
        <>
            {splitters.map(splitter => {
                const layout = layoutMap?.[splitter.id] || DEFAULT_LAYOUT;
                const splitterWidth = splitter.outputPortIds.length * 24;
                if (!isElementVisible(layout, splitterWidth, 72)) return null;

                // O(1) lookup via memoized map. Convert Map<portIndex,info> → Record<portIndex,info>
                // to preserve SplitterNode's existing prop shape.
                const inner = customersBySplitterPort.get(splitter.id);
                const attachedCustomers: Record<number, { name: string; status?: string }> = {};
                if (inner) {
                    inner.forEach((info, portIdx) => { attachedCustomers[portIdx] = info; });
                }

                const catalogItem = findSplitterCatalog(splitter, availableSplitters);

                return (
                    <SplitterNode
                        key={splitter.id}
                        splitter={splitter}
                        layout={layout}
                        connections={connections}
                        litPorts={litPorts}
                        hoveredPortId={hoveredPortId}
                        catalogItem={catalogItem}
                        onDragStart={onDragStart}
                        onAction={onAction}
                        onPortMouseDown={onPortMouseDown}
                        onPortMouseEnter={onPortMouseEnter}
                        onPortMouseLeave={onPortMouseLeave}
                        onDoubleClick={onDoubleClick}
                        onContextMenu={onContextMenu}
                        attachedCustomers={attachedCustomers}
                        onHoverEnter={onHoverEnter}
                        onHoverLeave={onHoverLeave}
                        hoverData={{ id: splitter.id, type: 'splitter' }}
                    />
                );
            })}
        </>
    );
});

SplitterRenderer.displayName = 'SplitterRenderer';
