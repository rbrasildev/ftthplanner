import React, { useState, useEffect, useRef } from 'react';
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
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1.5">
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between px-4 py-2.5 
                    bg-white dark:bg-slate-950 border rounded-xl transition-all duration-300
                    ${isOpen
                        ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'}
                    ${error ? 'border-red-500 focus:ring-red-500/10' : ''}
                `}
            >
                <span className={`text-sm truncate ${selectedOption ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className={`
                    absolute z-[100] left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300
                    ${placement === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'}
                `}>
                    {/* Search Bar */}
                    {showSearch && (
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
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
                                        w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-200 group mb-0.5
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
                </div>
            )}

            {error && (
                <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>
            )}
        </div>
    );
};
