import { useState, useEffect } from 'react';

// Tracks whether the Alt key is currently held down globally.
// Used to temporarily override snap-to-grid during drag — same pattern Figma/Illustrator
// use to bypass the grid for pixel-precise placement without toggling the setting.
//
// Returns `true` while Alt is pressed, `false` otherwise. Listeners also clear state
// on `blur` and `Escape` to avoid sticky-Alt when the window loses focus mid-hold.
export const useAltKeyHeld = (): boolean => {
    const [isAltHeld, setIsAltHeld] = useState(false);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && !isAltHeld) setIsAltHeld(true);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (!e.altKey && isAltHeld) setIsAltHeld(false);
        };
        const clear = () => setIsAltHeld(false);

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', clear);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', clear);
        };
    }, [isAltHeld]);

    return isAltHeld;
};
