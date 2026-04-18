import React, { useRef, useEffect, useLayoutEffect } from 'react';

interface UseGlobalDragListenersParams {
    isActive: boolean;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
}

// Attaches window-level mousemove/mouseup listeners only while `isActive` is true.
// Uses refs so the latest handler closures are read without re-binding listeners on every render.
export const useGlobalDragListeners = ({
    isActive,
    onMouseMove,
    onMouseUp,
}: UseGlobalDragListenersParams) => {
    const moveRef = useRef(onMouseMove);
    const upRef = useRef(onMouseUp);

    useLayoutEffect(() => { moveRef.current = onMouseMove; });
    useLayoutEffect(() => { upRef.current = onMouseUp; });

    useEffect(() => {
        if (!isActive) return;
        const onMove = (e: MouseEvent) => moveRef.current(e as unknown as React.MouseEvent);
        const onUp = (e: MouseEvent) => upRef.current(e as unknown as React.MouseEvent);

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isActive]);
};
