import React, { useState, useEffect } from 'react';
import { X, Search, UtilityPole, Check } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import * as catalogService from '../../services/catalogService';

interface PoleSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (poleCatalogItem: catalogService.PoleCatalogItem) => void;
}

export const PoleSelectionModal: React.FC<PoleSelectionModalProps> = ({ isOpen, onClose, onSelect }) => {
    const { t } = useLanguage();
    const [poles, setPoles] = useState<catalogService.PoleCatalogItem[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            catalogService.getPoles()
                .then(data => setPoles(data))
                .catch(err => console.error("Failed to load poles", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const filtered = poles.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.type.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="h-14 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between shrink-0">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <UtilityPole className="w-5 h-5 text-sky-500" />
                        {t('select_pole') || 'Selecionar Poste'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_pole') || 'Buscar modelo de poste...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {loading ? (
                        <div className="text-center py-10 text-slate-500 animate-pulse">
                            Loading...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            {t('no_results') || 'Nenhum poste encontrado'}
                        </div>
                    ) : (
                        filtered.map(pole => (
                            <div
                                key={pole.id}
                                onClick={() => onSelect(pole)}
                                className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-sky-500/30 hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                                        <UtilityPole className="w-5 h-5 text-slate-500 group-hover:text-sky-500" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{pole.name}</div>
                                        <div className="text-xs text-slate-500 flex gap-2">
                                            <span>{pole.type}</span>
                                            <span>•</span>
                                            <span>{pole.height}m</span>
                                            <span>•</span>
                                            <span>{pole.strength}daN</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Check className="w-4 h-4 text-sky-500" />
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
};
