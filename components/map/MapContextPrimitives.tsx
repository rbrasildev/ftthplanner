import React, { useEffect, useRef, useState } from 'react';
import { Trash2, AlertTriangle, X, Check } from 'lucide-react';

// Primitivas compartilhadas pelos context menus do mapa (CableContextMenu,
// NodeContextMenu, PolygonContextMenu). Antes cada um duplicava wrapper,
// positioning logic, MenuItem e danger zone. A diferença prática mais
// importante: a confirmação de delete agora referencia o nome do item para
// reduzir risco de exclusão errada.

interface MapContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    width?: number; // largura em px (default 224 / w-56)
    children: React.ReactNode;
    /** Quando true, não fecha por click-outside (útil pra evitar fechamento durante interação interna). */
    keepOpenOnOutsideClick?: boolean;
}

export const MapContextMenu: React.FC<MapContextMenuProps> = ({ x, y, onClose, width = 224, children, keepOpenOnOutsideClick }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (keepOpenOnOutsideClick) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose, keepOpenOnOutsideClick]);

    // Positioning smart: se está na metade inferior/direita da tela, ancora pelo lado oposto.
    const flipV = y > window.innerHeight / 2;
    const flipH = x > window.innerWidth / 2;

    return (
        <div
            ref={ref}
            className="fixed z-[99999] bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/40 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
                width,
                top: flipV ? 'auto' : y,
                bottom: flipV ? window.innerHeight - y : 'auto',
                left: flipH ? 'auto' : x,
                right: flipH ? window.innerWidth - x : 'auto',
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {children}
        </div>
    );
};

interface MenuHeaderProps {
    icon: React.ReactNode;
    /** Cor de fundo do quadrado do ícone (classe Tailwind, ex: "bg-emerald-500") ou um valor de cor inline. */
    iconBg?: string;
    iconBgColor?: string; // p/ cores dinâmicas (polygon palette)
    name?: string;
    typeLabel: string;
    /** Conteúdo opcional renderizado abaixo do header (ex: badge de status). */
    extra?: React.ReactNode;
}

export const MenuHeader: React.FC<MenuHeaderProps> = ({ icon, iconBg = 'bg-emerald-500', iconBgColor, name, typeLabel, extra }) => (
    <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700/30">
        <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBgColor ? '' : iconBg}`}
            style={iconBgColor ? { backgroundColor: iconBgColor } : undefined}
        >
            <span className="text-white">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{name || typeLabel}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{typeLabel}</div>
        </div>
        {extra}
    </div>
);

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    iconColor?: string;
    danger?: boolean;
    onClick: (e: React.MouseEvent) => void;
}

export const MenuItem: React.FC<MenuItemProps> = ({ icon, label, iconColor = 'text-emerald-500 dark:text-emerald-400', danger, onClick }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors text-[13px] font-medium ${danger
            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
    >
        <span className={iconColor}>{icon}</span>
        <span>{label}</span>
    </button>
);

interface DangerDeleteProps {
    /** Nome do item — aparece na confirmação pra reduzir risco de exclusão errada. */
    itemName?: string;
    /** Rótulo padrão "Excluir CTO", "Excluir cabo" etc. */
    label: string;
    onDelete: () => void;
    onClose: () => void;
    /** Texto de cancelamento (default "Não"). */
    cancelLabel?: string;
    /** Texto de confirmação (default "Sim, excluir"). */
    confirmLabel?: string;
}

export const DangerDelete: React.FC<DangerDeleteProps> = ({ itemName, label, onDelete, onClose, cancelLabel = 'Não', confirmLabel = 'Sim, excluir' }) => {
    const [confirming, setConfirming] = useState(false);

    if (!confirming) {
        return (
            <div className="border-t border-slate-100 dark:border-slate-700/30">
                <MenuItem
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    label={label}
                    iconColor="text-red-500 dark:text-red-400"
                    danger
                    onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
                />
            </div>
        );
    }

    return (
        <div className="border-t border-slate-100 dark:border-slate-700/30">
            <div className="p-2 space-y-2 animate-in fade-in duration-150 bg-red-50 dark:bg-red-950/20">
                <div className="flex items-start gap-2 px-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold text-red-700 dark:text-red-300">
                            Excluir <span className="font-mono">{itemName ? `"${itemName}"` : 'este item'}</span>?
                        </div>
                        <div className="text-[10px] text-red-600/80 dark:text-red-400/80 leading-tight mt-0.5">
                            Esta ação não pode ser desfeita.
                        </div>
                    </div>
                </div>
                <div className="flex gap-1.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                        className="flex-1 py-1.5 bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-600/40 hover:bg-slate-50 dark:hover:bg-slate-600/30 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                        <X className="w-3 h-3" />
                        {cancelLabel}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                    >
                        <Check className="w-3 h-3" />
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
