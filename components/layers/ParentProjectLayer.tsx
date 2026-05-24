import React, { useCallback } from 'react';
import { Pane } from 'react-leaflet';
import { NetworkState } from '../../types';
import { useLanguage } from '../../LanguageContext';
import { CTOMarker } from '../markers/CTOMarker';
import { POPMarker } from '../markers/POPMarker';
import { PoleMarker } from '../markers/PoleMarker';
import { D3ParentCablesLayer } from './D3ParentCablesLayer';

type MapMode = 'view' | 'draw_cable' | 'connect_cable' | 'edit_cable' | string;

interface ParentProjectLayerProps {
    network: NetworkState;
    visible: boolean;
    parentProjectName: string;
    mode?: MapMode;
    showLabels?: boolean;
    /** Quando true, MapView está usando o LabelsCanvasLayer e os markers daqui
     *  devem omitir seu Tooltip Leaflet pra não duplicar/sobrepor o rótulo canvas. */
    canvasLabelsActive?: boolean;
    currentZoom?: number;
    cableStartPoint?: { lat: number; lng: number } | null;
    selectedId?: string | null;
    showCables?: boolean;
    showCTOs?: boolean;
    showPOPs?: boolean;
    showPoles?: boolean;
    onBlockedEdit?: () => void;
    onCableStart?: (nodeId: string) => void;
    onCableEnd?: (nodeId: string) => void;
    onNodeClick?: (id: string, type: 'CTO' | 'POP' | 'Pole') => void;
    onHoverLabel?: (id: string | null) => void;
}

const noOp = () => {};
const noOpMove = (_id: string, _lat: number, _lng: number) => {};
const noOpDrag = (_lat: number, _lng: number) => {};

export const ParentProjectLayer: React.FC<ParentProjectLayerProps> = ({
    network,
    visible,
    parentProjectName,
    mode = 'view',
    showLabels = false,
    canvasLabelsActive = false,
    currentZoom = 18,
    cableStartPoint,
    selectedId,
    showCables = true,
    showCTOs = true,
    showPOPs = true,
    showPoles = true,
    onBlockedEdit,
    onCableStart,
    onCableEnd,
    onNodeClick,
    onHoverLabel,
}) => {
    const { t } = useLanguage();
    // For CTO/POP: in view mode → open read-only; in cable mode → connect cable
    const handleNodeClick = useCallback((id: string, type: 'CTO' | 'POP' | 'Pole') => {
        if (mode === 'view' && onNodeClick) {
            onNodeClick(id, type);
        } else if (mode !== 'draw_cable') {
            onBlockedEdit?.();
        }
    }, [mode, onNodeClick, onBlockedEdit]);

    const handleCTOClick = useCallback((id: string, _type: 'CTO') => {
        handleNodeClick(id, 'CTO');
    }, [handleNodeClick]);

    const handlePOPClick = useCallback((id: string, _type: 'POP') => {
        handleNodeClick(id, 'POP');
    }, [handleNodeClick]);

    const handlePoleClick = useCallback((id: string, _type: 'Pole') => {
        handleNodeClick(id, 'Pole');
    }, [handleNodeClick]);

    // Cable start/end: pass through to real handlers
    const handleCableStart = useCallback((id: string) => {
        onCableStart?.(id);
    }, [onCableStart]);

    const handleCableEnd = useCallback((id: string) => {
        onCableEnd?.(id);
    }, [onCableEnd]);

    // Context menu: block editing
    const handleContextMenu = useCallback((e: any, _id: string, _type: any) => {
        if (e?.originalEvent) {
            e.originalEvent.preventDefault?.();
            e.originalEvent.stopPropagation?.();
        }
        onBlockedEdit?.();
    }, [onBlockedEdit]);

    const handleCableClick = useCallback((e: any) => {
        e.originalEvent?.stopPropagation?.();
        onBlockedEdit?.();
    }, [onBlockedEdit]);

    if (!visible || !network) return null;

    return (
        <>
        {/* Parent cables: D3 SVG overlay with leaflet-zoom-hide (matches main cable layer behavior) */}
        <D3ParentCablesLayer
            cables={network.cables}
            visible={visible && showCables}
            onCableClick={handleCableClick}
        />

        {/* Parent markers: above D3 cables layer, same level as normal markers */}
        <Pane name="parent-project-markers" style={{ zIndex: 610, pointerEvents: 'auto' }}>
            {/* CTOs/CEOs — exact same CTOMarker component */}
            {showCTOs && network.ctos.map(cto => (
                <CTOMarker
                    key={`parent-cto-${cto.id}`}
                    cto={cto}
                    isSelected={selectedId === cto.id}
                    showLabels={false}
                    canvasLabelsActive={canvasLabelsActive}
                    onHoverLabel={onHoverLabel}
                    mode={mode}
                    currentZoom={currentZoom}
                    onNodeClick={handleCTOClick}
                    onMoveNode={noOpMove}
                    onCableStart={handleCableStart}
                    onCableEnd={handleCableEnd}
                    cableStartPoint={cableStartPoint}
                    onDragStart={noOp}
                    onDrag={noOpDrag}
                    onDragEnd={noOp}
                    onContextMenu={handleContextMenu}
                    userRole="MEMBER"
                />
            ))}

            {/* POPs — exact same POPMarker component */}
            {showPOPs && network.pops.map(pop => (
                <POPMarker
                    key={`parent-pop-${pop.id}`}
                    pop={pop}
                    isSelected={selectedId === pop.id}
                    showLabels={false}
                    canvasLabelsActive={canvasLabelsActive}
                    onHoverLabel={onHoverLabel}
                    mode={mode}
                    currentZoom={currentZoom}
                    onNodeClick={handlePOPClick}
                    onMoveNode={noOpMove}
                    onCableStart={handleCableStart}
                    onCableEnd={handleCableEnd}
                    cableStartPoint={cableStartPoint}
                    onDragStart={noOp}
                    onDrag={noOpDrag}
                    onDragEnd={noOp}
                    onContextMenu={handleContextMenu}
                    userRole="MEMBER"
                />
            ))}

            {/* Poles — exact same PoleMarker component */}
            {showPoles && network.poles.map(pole => (
                <PoleMarker
                    key={`parent-pole-${pole.id}`}
                    pole={pole}
                    isSelected={selectedId === pole.id}
                    showLabels={false /* labels permanentes vêm do LabelsCanvasLayer no MapView */}
                    mode={mode}
                    currentZoom={currentZoom}
                    onNodeClick={handlePoleClick}
                    onMoveNode={noOpMove}
                    onCableStart={handleCableStart}
                    onCableEnd={handleCableEnd}
                    cableStartPoint={cableStartPoint}
                    onDragStart={noOp}
                    onDrag={noOpDrag}
                    onDragEnd={noOp}
                    onContextMenu={handleContextMenu}
                />
            ))}
        </Pane>
        </>
    );
};
