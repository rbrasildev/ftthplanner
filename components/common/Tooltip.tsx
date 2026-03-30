import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactElement;
    side?: 'right' | 'top' | 'bottom';
    enabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, side = 'right', enabled = true }) => {
    const [show, setShow] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (show && triggerRef.current && tooltipRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const tip = tooltipRef.current.getBoundingClientRect();

            let top = 0, left = 0;
            if (side === 'right') {
                top = rect.top + rect.height / 2 - tip.height / 2;
                left = rect.right + 8;
            } else if (side === 'top') {
                top = rect.top - tip.height - 8;
                left = rect.left + rect.width / 2 - tip.width / 2;
            } else {
                top = rect.bottom + 8;
                left = rect.left + rect.width / 2 - tip.width / 2;
            }

            // Clamp to viewport
            top = Math.max(8, Math.min(top, window.innerHeight - tip.height - 8));
            left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8));

            setCoords({ top, left });
        }
    }, [show, side]);

    if (!enabled) return children;

    return (
        <div
            ref={triggerRef}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            className="relative"
        >
            {children}
            {show && (
                <div
                    ref={tooltipRef}
                    className="fixed z-[9999] px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold shadow-lg pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
                    style={{ top: coords.top, left: coords.left }}
                >
                    {content}
                </div>
            )}
        </div>
    );
};
