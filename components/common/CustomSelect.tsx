import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    sublabel?: string;
}

interface CustomSelectProps {
    label?: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    showSearch?: boolean;
    error?: string;
    className?: string;
    placement?: 'top' | 'bottom';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    label,
    options,
    value,
    onChange,
    placeholder = "Selecione uma opção...",
    searchPlaceholder = "Buscar...",
    showSearch = true,
    error,
    className = "",
    placement = "bottom"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    // Dropdown precisa portar pra escapar de overflow:hidden de ancestrais
    // (cards, modais com overflow-hidden, etc). coords são calculadas pelo
    // bounding rect do botão e re-recalculadas em open / scroll / resize.
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeUp: boolean } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const DROPDOWN_MAX_H = 320; // search bar (~70) + lista (max-h-60 = 240) + padding
    const VIEWPORT_GUTTER = 8;

    const positionDropdown = () => {
        const btn = buttonRef.current;
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        const spaceAbove = r.top;
        // Prefere a direção definida pelo prop, mas faz flip se não couber.
        const wantsUp = placement === 'top';
        const placeUp = wantsUp
            ? (spaceAbove >= Math.min(DROPDOWN_MAX_H, spaceAbove) || spaceAbove > spaceBelow)
            : (spaceBelow < DROPDOWN_MAX_H && spaceAbove > spaceBelow);
        const top = placeUp ? Math.max(VIEWPORT_GUTTER, r.top - 8) : r.bottom + 8;
        setCoords({ top, left: r.left, width: r.width, placeUp });
    };

    useEffect(() => {
        if (!isOpen) return;
        positionDropdown();
        const handleClickOutside = (event: MouseEvent) => {
            const t = event.target as Node;
            if (wrapperRef.current?.contains(t)) return;
            if (dropdownRef.current?.contains(t)) return;
            setIsOpen(false);
        };
        const reposition = () => positionDropdown();
        // Capture phase pra não ser bloqueado por stopPropagation de pais (modais).
        document.addEventListener('mousedown', handleClickOutside, true);
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, placement]);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div className={className} ref={wrapperRef}>
            {label && (
                <label className="block text-[10px] font-medium text-slate-700 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    {label}
                </label>
            )}

            <div className="relative">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between px-4 py-2.5
                    bg-white dark:bg-[#22262e] border rounded-lg transition-all duration-300
                    ${isOpen
                        ? 'border-emerald-500 ring-4 ring-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
                    ${error ? 'border-red-500 focus:ring-red-500/10' : ''}
                `}
            >
                <span className={`text-sm truncate ${selectedOption ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} />
            </button>

            {/* Dropdown — portado pra escapar overflow:hidden de ancestrais. */}
            {isOpen && coords && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[9999] bg-white dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        transform: coords.placeUp ? 'translateY(-100%)' : undefined,
                        transformOrigin: coords.placeUp ? 'bottom' : 'top',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Search Bar */}
                    {showSearch && (
                        <div className="p-3 border-b border-slate-100 dark:border-slate-700/30">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full bg-slate-50 dark:bg-[#1a1d23] border border-slate-100 dark:border-slate-700 rounded-sm pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto p-1.5 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`
                                        w-full flex items-center justify-between px-3 py-2.5 rounded-sm text-left transition-all duration-200 group mb-0.5
                                        ${value === option.value
                                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}
                                    `}
                                >
                                    <div className="flex flex-col">
                                        <span className={`text-sm font-semibold ${value === option.value ? 'text-emerald-700 dark:text-emerald-400' : 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400'}`}>
                                            {option.label}
                                        </span>
                                        {option.sublabel && (
                                            <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                                                {option.sublabel}
                                            </span>
                                        )}
                                    </div>
                                    {value === option.value && (
                                        <Check className="w-4 h-4 text-emerald-500" />
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-sm italic">
                                Nenhum resultado encontrado.
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
            </div>

            {error && (
                <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>
            )}
        </div>
    );
};
