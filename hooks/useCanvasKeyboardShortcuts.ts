import React, { useEffect } from 'react';
import { ToolMode } from './useToolModes';

export type HoveredElement = { id: string; type: 'cable' | 'connection' | 'splitter' | 'fusion' } | null;

interface UseCanvasKeyboardShortcutsParams {
    readOnly: boolean;
    hoveredElement: HoveredElement;
    setHoveredElement: (next: HoveredElement) => void;
    toggleToolMode: (mode: ToolMode) => void;
    setIsAutoSpliceOpen: React.Dispatch<React.SetStateAction<boolean>>;
    // Element actions — called from R/D shortcuts.
    handleRotateElement: (e: React.MouseEvent | null, id: string) => void;
    handleDeleteSplitter: (id: string) => void;
    handleDeleteFusion: (id: string) => void;
    removeConnection: (id: string) => void;
}

// Global keyboard shortcuts for the CTO editor canvas.
// Shortcuts are ignored while typing in inputs/textareas or contentEditable elements,
// and entirely disabled in read-only mode.
//
// Keys:
//   S — toggle splitter dropdown
//   F — toggle fusion tool
//   A — toggle smart align mode
//   T — toggle auto-splice modal
//   R — rotate hovered element (cable/splitter/fusion)
//   D — delete hovered element (splitter/fusion/connection)
export const useCanvasKeyboardShortcuts = ({
    readOnly,
    hoveredElement,
    setHoveredElement,
    toggleToolMode,
    setIsAutoSpliceOpen,
    handleRotateElement,
    handleDeleteSplitter,
    handleDeleteFusion,
    removeConnection,
}: UseCanvasKeyboardShortcutsParams) => {
    useEffect(() => {
        if (readOnly) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();

            if (key === 's') {
                e.preventDefault();
                toggleToolMode('splitterDropdown');
            } else if (key === 'f') {
                e.preventDefault();
                toggleToolMode('fusion');
            } else if (key === 'a') {
                e.preventDefault();
                toggleToolMode('smartAlign');
            } else if (key === 'r') {
                if (hoveredElement && (hoveredElement.type === 'cable' || hoveredElement.type === 'splitter' || hoveredElement.type === 'fusion')) {
                    e.preventDefault();
                    handleRotateElement(null, hoveredElement.id);
                }
            } else if (key === 't') {
                e.preventDefault();
                setIsAutoSpliceOpen(prev => !prev);
            } else if (key === 'd') {
                if (hoveredElement) {
                    e.preventDefault();
                    if (hoveredElement.type === 'splitter') {
                        handleDeleteSplitter(hoveredElement.id);
                    } else if (hoveredElement.type === 'fusion') {
                        handleDeleteFusion(hoveredElement.id);
                    } else if (hoveredElement.type === 'connection') {
                        removeConnection(hoveredElement.id);
                    }
                    setHoveredElement(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [readOnly, hoveredElement, setHoveredElement, toggleToolMode, setIsAutoSpliceOpen, handleRotateElement, handleDeleteSplitter, handleDeleteFusion, removeConnection]);
};
