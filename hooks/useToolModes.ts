import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';

// All tool modes are mutually exclusive; toggling one clears the others.
// `splitterDropdown` is an open-modal flag, not a tool-mode per se, but it lives
// here because the shortcut system treats it the same as the others.
export type ToolMode = 'rotate' | 'delete' | 'smartAlign' | 'vfl' | 'otdr' | 'fusion' | 'splitterDropdown';

// The shape read via `toolModesRef.current` in pointer/drag handlers —
// keeps handlers closure-stable while still seeing latest tool flags.
export interface ToolModesSnapshot {
    isVflToolActive: boolean;
    isOtdrToolActive: boolean;
    isFusionToolActive: boolean;
    isSmartAlignMode: boolean;
    isRotateMode: boolean;
    isDeleteMode: boolean;
    isSnapping: boolean;
}

export interface UseToolModesResult {
    // Tool state flags
    isVflToolActive: boolean;
    isOtdrToolActive: boolean;
    isSmartAlignMode: boolean;
    isRotateMode: boolean;
    isDeleteMode: boolean;
    isFusionToolActive: boolean;
    showSplitterDropdown: boolean;

    // Setters (exposed for cases where callers bypass toggleToolMode — e.g. Escape key,
    // click-outside handlers, modal-driven flows that activate a tool directly).
    setIsVflToolActive: React.Dispatch<React.SetStateAction<boolean>>;
    setIsOtdrToolActive: React.Dispatch<React.SetStateAction<boolean>>;
    setIsSmartAlignMode: React.Dispatch<React.SetStateAction<boolean>>;
    setIsRotateMode: React.Dispatch<React.SetStateAction<boolean>>;
    setIsDeleteMode: React.Dispatch<React.SetStateAction<boolean>>;
    setIsFusionToolActive: React.Dispatch<React.SetStateAction<boolean>>;
    setShowSplitterDropdown: React.Dispatch<React.SetStateAction<boolean>>;

    // Ref of the current snapshot, updated on every render.
    // Used by callbacks that must read latest tool state without re-binding
    // (prevents ConnectionsLayer re-renders via useCallback deps churn).
    toolModesRef: React.MutableRefObject<ToolModesSnapshot>;

    clearAllToolModes: () => void;
    toggleToolMode: (mode: ToolMode) => void;
}

export const useToolModes = (isSnapping: boolean): UseToolModesResult => {
    const [isVflToolActive, setIsVflToolActive] = useState(false);
    const [isOtdrToolActive, setIsOtdrToolActive] = useState(false);
    const [isSmartAlignMode, setIsSmartAlignMode] = useState(false);
    const [isRotateMode, setIsRotateMode] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [isFusionToolActive, setIsFusionToolActive] = useState(false);
    const [showSplitterDropdown, setShowSplitterDropdown] = useState(false);

    const clearAllToolModes = useCallback(() => {
        setIsRotateMode(false);
        setIsDeleteMode(false);
        setIsSmartAlignMode(false);
        setIsVflToolActive(false);
        setIsOtdrToolActive(false);
        setIsFusionToolActive(false);
        setShowSplitterDropdown(false);
    }, []);

    const toggleToolMode = useCallback((mode: ToolMode) => {
        const setters: Record<ToolMode, React.Dispatch<React.SetStateAction<boolean>>> = {
            rotate: setIsRotateMode,
            delete: setIsDeleteMode,
            smartAlign: setIsSmartAlignMode,
            vfl: setIsVflToolActive,
            otdr: setIsOtdrToolActive,
            fusion: setIsFusionToolActive,
            splitterDropdown: setShowSplitterDropdown,
        };
        const getters: Record<ToolMode, boolean> = {
            rotate: isRotateMode,
            delete: isDeleteMode,
            smartAlign: isSmartAlignMode,
            vfl: isVflToolActive,
            otdr: isOtdrToolActive,
            fusion: isFusionToolActive,
            splitterDropdown: showSplitterDropdown,
        };
        const wasActive = getters[mode];
        clearAllToolModes();
        if (!wasActive) {
            setters[mode](true);
        }
    }, [isRotateMode, isDeleteMode, isSmartAlignMode, isVflToolActive, isOtdrToolActive, isFusionToolActive, showSplitterDropdown, clearAllToolModes]);

    const toolModesRef = useRef<ToolModesSnapshot>({
        isVflToolActive, isOtdrToolActive, isFusionToolActive,
        isSmartAlignMode, isRotateMode, isDeleteMode, isSnapping,
    });
    // No deps: runs every render so the ref always mirrors the latest values.
    // Cheap (plain object assignment) and matches the pre-extraction behavior.
    useLayoutEffect(() => {
        toolModesRef.current = {
            isVflToolActive, isOtdrToolActive, isFusionToolActive,
            isSmartAlignMode, isRotateMode, isDeleteMode, isSnapping,
        };
    });

    return {
        isVflToolActive, isOtdrToolActive, isSmartAlignMode, isRotateMode,
        isDeleteMode, isFusionToolActive, showSplitterDropdown,
        setIsVflToolActive, setIsOtdrToolActive, setIsSmartAlignMode,
        setIsRotateMode, setIsDeleteMode, setIsFusionToolActive, setShowSplitterDropdown,
        toolModesRef,
        clearAllToolModes, toggleToolMode,
    };
};
