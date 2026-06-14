import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// =====================================================================
// Primitives compartilhados pelas 9 telas de Cadastros (Poste, Caixa,
// Cabo, Splitter, OLT, GBIC, Fusão, Conector, Clientes). Cada componente
// é autocontido — pode ser importado individualmente.
// =====================================================================

// --- KebabMenu ----------------------------------------------------------
export interface KebabAction {
    label: string;
    icon: React.ElementType;
    onClick: (e: React.MouseEvent) => void;
    destructive?: boolean;
    disabled?: boolean;
}

// Dropdown precisa escapar de qualquer container com overflow:hidden /
// overflow-x-auto (cards arredondados e wrappers de tabela). Portal pra
// document.body resolve. Posição calculada pelo bounding rect do botão,
// com fallback se ultrapassa edge do viewport.
const MENU_WIDTH = 176;
const MENU_GUTTER = 8;

export const KebabMenu: React.FC<{ actions: KebabAction[]; align?: 'left' | 'right' }> = ({ actions, align = 'right' }) => {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const positionMenu = () => {
        const btn = btnRef.current;
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const menuH = menuRef.current?.offsetHeight ?? actions.length * 36 + 8;
        // X: alinha pela direita por padrão; se sair da viewport, alinha pela esquerda.
        let left = align === 'right' ? r.right - MENU_WIDTH : r.left;
        if (left + MENU_WIDTH > window.innerWidth - MENU_GUTTER) {
            left = window.innerWidth - MENU_WIDTH - MENU_GUTTER;
        }
        if (left < MENU_GUTTER) left = MENU_GUTTER;
        // Y: abre pra baixo; se não couber, flip pra cima.
        let top = r.bottom + 4;
        if (top + menuH > window.innerHeight - MENU_GUTTER) {
            top = r.top - menuH - 4;
        }
        setCoords({ top, left });
    };

    const openMenu = () => {
        positionMenu();
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
            setOpen(false);
        };
        // Fecha em scroll / resize — recalcular posição enquanto o user rola
        // dá impressão de "menu seguindo" porém mantém aberto, geralmente
        // desejável; mas o caso de uso aqui (tabela densa, scroll vertical)
        // fecha pra evitar o menu flutuante "perdido" no meio da página.
        const closeOnScroll = () => setOpen(false);
        document.addEventListener('mousedown', handler);
        window.addEventListener('scroll', closeOnScroll, true);
        window.addEventListener('resize', closeOnScroll);
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('scroll', closeOnScroll, true);
            window.removeEventListener('resize', closeOnScroll);
        };
    }, [open]);

    // Após render, re-posicionar com altura real do menu (1a render usa estimativa).
    useEffect(() => {
        if (open) positionMenu();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, actions.length]);

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors"
                title="Mais ações"
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <MoreVertical className="w-4 h-4" />
            </button>
            {open && coords && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    className="fixed bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700/40 rounded-xl shadow-xl z-[9999] py-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {actions.map((a, i) => (
                        <button
                            key={i}
                            role="menuitem"
                            onClick={(e) => { e.stopPropagation(); setOpen(false); a.onClick(e); }}
                            disabled={a.disabled}
                            className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${a.destructive
                                ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/40'}`}
                        >
                            <a.icon className="w-3.5 h-3.5" />
                            {a.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
};

// --- DeleteConfirmDialog ------------------------------------------------
// Confirma deleção COM o nome do item — evita deletar errado.
export const DeleteConfirmDialog: React.FC<{
    isOpen: boolean;
    itemLabel: string;
    itemType: string;
    description?: string;
    hint?: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}> = ({ isOpen, itemLabel, itemType, description, hint, onCancel, onConfirm, confirmLabel = 'Excluir', cancelLabel = 'Cancelar' }) => {
    if (!isOpen) return null;
    return createPortal(
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onCancel}
        >
            <div
                className="bg-white dark:bg-[#22262e] rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                            Excluir {itemType}?
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {description || <>O {itemType} <strong className="font-bold">"{itemLabel}"</strong> será removido permanentemente.</>}
                        </p>
                        {hint && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">{hint}</p>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/40 rounded-lg transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-sm transition-colors"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- EmptyState ---------------------------------------------------------
export const EmptyState: React.FC<{
    icon: React.ElementType;
    title: string;
    description?: string;
    ctaLabel?: string;
    onCta?: () => void;
    /** Variante "no-search-results" — sem CTA, copy adaptada. */
    searchTerm?: string;
}> = ({ icon: Icon, title, description, ctaLabel, onCta, searchTerm }) => {
    if (searchTerm) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                <Icon className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Nada encontrado pra "{searchTerm}"
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tenta outro termo de busca.</p>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/40 flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md">{description}</p>
            )}
            {ctaLabel && onCta && (
                <button
                    onClick={onCta}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                >
                    {ctaLabel}
                </button>
            )}
        </div>
    );
};

// --- FilterChips --------------------------------------------------------
export interface FilterOption {
    value: string | null;
    label: string;
    count?: number;
}

export const FilterChips: React.FC<{
    options: FilterOption[];
    value: string | null;
    onChange: (v: string | null) => void;
}> = ({ options, value, onChange }) => (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {options.map(opt => {
            const active = value === opt.value;
            return (
                <button
                    key={opt.value ?? '__all__'}
                    onClick={() => onChange(opt.value)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap ${active
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60'}`}
                >
                    {opt.label}
                    {opt.count !== undefined && (
                        <span className={`ml-1.5 tabular-nums ${active ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'}`}>
                            {opt.count}
                        </span>
                    )}
                </button>
            );
        })}
    </div>
);

// --- SortableHeader -----------------------------------------------------
export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
    key: K;
    dir: SortDir;
}

export const SortableHeader = <K extends string>({
    label, sortKey, sort, onSort, align = 'left',
}: {
    label: string;
    sortKey: K;
    sort: SortState<K> | null;
    onSort: (key: K) => void;
    align?: 'left' | 'right' | 'center';
}) => {
    const isActive = sort?.key === sortKey;
    const dir = isActive ? sort!.dir : null;
    const Icon = dir === 'asc' ? ChevronUp : dir === 'desc' ? ChevronDown : ChevronsUpDown;
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className={`group inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${align === 'right' ? 'flex-row-reverse' : align === 'center' ? 'justify-center' : ''}`}
        >
            {label}
            <Icon className={`w-3 h-3 transition-opacity ${isActive ? 'opacity-100 text-emerald-500' : 'opacity-30 group-hover:opacity-60'}`} />
        </button>
    );
};

// Hook util pra ordenar lista com toggle asc/desc por coluna.
export function useSortable<T, K extends string>(
    items: T[],
    accessor: (item: T, key: K) => any,
    initial: SortState<K> | null = null,
): [T[], SortState<K> | null, (key: K) => void] {
    const [sort, setSort] = useState<SortState<K> | null>(initial);

    const handleSort = (key: K) => {
        setSort(prev => {
            if (!prev || prev.key !== key) return { key, dir: 'asc' };
            if (prev.dir === 'asc') return { key, dir: 'desc' };
            return null; // 3o click reseta
        });
    };

    const sorted = React.useMemo(() => {
        if (!sort) return items;
        const arr = [...items];
        arr.sort((a, b) => {
            const av = accessor(a, sort.key);
            const bv = accessor(b, sort.key);
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
            const as = String(av).toLowerCase();
            const bs = String(bv).toLowerCase();
            return sort.dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
        });
        return arr;
    }, [items, sort, accessor]);

    return [sorted, sort, handleSort];
}

// --- UnitInput ----------------------------------------------------------
// Number input com unit suffix dentro do campo. Padrão BR/ERP.
export const UnitInput: React.FC<{
    label?: string;
    value: number | string;
    onChange: (v: number) => void;
    unit: string;
    step?: string;
    min?: number;
    max?: number;
    required?: boolean;
    placeholder?: string;
    error?: string;
}> = ({ label, value, onChange, unit, step = '1', min, max, required, placeholder, error }) => (
    <div className="w-full">
        {label && (
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1.5 uppercase text-[10px] tracking-wider">
                {label}
            </label>
        )}
        <div className="relative">
            <input
                type="number"
                step={step}
                min={min}
                max={max}
                required={required}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className={`w-full pl-4 pr-14 py-2.5 bg-white dark:bg-[#1a1d23] border rounded-lg transition-colors text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 ${error
                    ? 'border-red-500 ring-4 ring-red-500/10'
                    : 'border-slate-200 dark:border-slate-700/30 hover:border-slate-300 dark:hover:border-slate-700'}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-slate-500 font-bold pointer-events-none">
                {unit}
            </span>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>}
    </div>
);

// --- ListSkeleton (clean, low-noise) -----------------------------------
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
                <div
                    className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse"
                    style={{ width: `${30 + (i % 4) * 15}%` }}
                />
            </div>
        ))}
    </div>
);

// --- ModalFooter pattern: Cancel ghost + Primary filled ----------------
export const ModalFooter: React.FC<{
    onCancel: () => void;
    cancelLabel?: string;
    primaryLabel: string;
    primaryIcon?: React.ElementType;
    primaryType?: 'submit' | 'button';
    onPrimary?: () => void;
    primaryLoading?: boolean;
    primaryDisabled?: boolean;
}> = ({ onCancel, cancelLabel = 'Cancelar', primaryLabel, primaryIcon: PrimaryIcon, primaryType = 'submit', onPrimary, primaryLoading, primaryDisabled }) => (
    <div className="flex justify-end gap-2 pt-2">
        <button
            type="button"
            onClick={onCancel}
            disabled={primaryLoading}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/40 rounded-lg transition-colors disabled:opacity-50"
        >
            {cancelLabel}
        </button>
        <button
            type={primaryType}
            onClick={onPrimary}
            disabled={primaryLoading || primaryDisabled}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {primaryLoading
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : PrimaryIcon && <PrimaryIcon className="w-3.5 h-3.5" />}
            {primaryLabel}
        </button>
    </div>
);
