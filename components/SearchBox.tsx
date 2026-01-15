import React, { useState, useEffect, useRef } from 'react';
import { Search, Server, Box, MapPin, LucideIcon, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { Coordinates } from '../types';

interface SearchBoxProps {
    onSearch: (term: string) => void;
    results: { id: string, name: string, type: 'CTO' | 'POP' | 'PIN', coordinates: Coordinates }[];
    onResultClick: (item: { id: string, name: string, type: 'CTO' | 'POP' | 'PIN', coordinates: Coordinates }) => void;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ onSearch, results, onResultClick }) => {
    const { t } = useLanguage();
    const [inputValue, setInputValue] = useState('');
    const [showResults, setShowResults] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    // Initial Search
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        setShowResults(true);

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

        debounceTimeout.current = setTimeout(() => {
            onSearch(val);
        }, 300);
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (item: any) => {
        onResultClick(item);
        if (item.type === 'PIN') {
            setInputValue(item.name);
            // Do NOT clear search for Pin, so it isn't removed from App state 
        } else {
            setInputValue('');
            onSearch(''); // Reset search
        }
        setShowResults(false);
    };

    return (
        <div className="space-y-2" ref={wrapperRef}>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Localizar</label>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={t('search_placeholder')}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
                />

                {inputValue && (
                    <button
                        onClick={() => {
                            setInputValue('');
                            onSearch('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}

                {/* Search Dropdown Logic */}
                {showResults && inputValue.trim().length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-[3000] max-h-60 overflow-y-auto p-1">
                        {results.length > 0 ? (
                            results.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors flex items-center gap-3 group/item"
                                >
                                    <div className={`p-1.5 rounded-md ${item.type === 'POP' ? 'bg-indigo-100 text-indigo-600' :
                                        item.type === 'PIN' ? 'bg-red-100 text-red-600' :
                                            'bg-orange-100 text-orange-600'
                                        }`}>
                                        {item.type === 'POP' ? <Server className="w-3 h-3" /> :
                                            item.type === 'PIN' ? <MapPin className="w-3 h-3" /> :
                                                <Box className="w-3 h-3" />}
                                    </div>
                                    <span className="font-medium text-slate-700 dark:text-slate-200 group-hover/item:text-sky-600 dark:group-hover/item:text-sky-400 transition-colors truncate">{item.name}</span>
                                </button>
                            ))
                        ) : (
                            <div className="p-4 text-xs text-slate-400 text-center italic">{t('search_no_results')}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
