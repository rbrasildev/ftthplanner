import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Customer } from '../../types';
import { useLanguage } from '../../LanguageContext';

interface CustomerSearchInputProps {
    onSelect: (customer: Customer) => void;
    allCustomers: Customer[];
}

export const CustomerSearchInput: React.FC<CustomerSearchInputProps> = ({ onSelect, allCustomers }) => {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const filtered = useMemo(() => {
        if (!query || query.length < 2) return [];
        return allCustomers.filter(c =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.document?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    }, [query, allCustomers]);

    return (
        <div className="relative mb-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder={t('search_existing_customer')}
                />
            </div>
            {isOpen && filtered.length > 0 && (
                <div className="absolute z-[1100] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    {filtered.map(c => (
                        <button
                            key={c.id}
                            onClick={() => {
                                onSelect(c);
                                setQuery('');
                                setIsOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                        >
                            <div className="font-bold text-slate-800 dark:text-slate-200">{c.name}</div>
                            <div className="text-[10px] text-slate-500">{c.document || '---'}</div>
                        </button>
                    ))}
                </div>
            )}
            {isOpen && query.length >= 2 && filtered.length === 0 && (
                <div className="absolute z-[1100] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 text-center text-xs text-slate-500">
                    {t('no_customers_found')}
                </div>
            )}
            {isOpen && (
                <div className="fixed inset-0 z-[1050]" onClick={() => setIsOpen(false)} />
            )}
        </div>
    );
};
