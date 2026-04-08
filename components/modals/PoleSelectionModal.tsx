import React, { useState, useEffect } from 'react';
import { X, Search, UtilityPole, Check, Ruler, Zap, Box } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import * as catalogService from '../../services/catalogService';

interface PoleSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (poleCatalogItem: catalogService.PoleCatalogItem) => void;
}

const SHAPE_ICONS: Record<string, string> = {
    'Circular': '●',
    'Duplo T': '╋',
    'Quadrado': '■',
};

const TYPE_COLORS: Record<string, string> = {
    'Concreto': '#57534e',
    'Madeira': '#92400e',
    'Metal': '#475569',
    'Fibra': '#0369a1',
};

export const PoleSelectionModal: React.FC<PoleSelectionModalProps> = ({ isOpen, onClose, onSelect }) => {
    const { t } = useLanguage();
    const [poles, setPoles] = useState<catalogService.PoleCatalogItem[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setSelectedId(null);
            setSearch('');
            catalogService.getPoles()
                .then(data => setPoles(data))
                .catch(err => console.error("Failed to load poles", err))
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const filtered = poles.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.type.toLowerCase().includes(search.toLowerCase()) ||
        p.shape.toLowerCase().includes(search.toLowerCase())
    );

    const handleConfirm = () => {
        const pole = poles.find(p => p.id === selectedId);
        if (pole) onSelect(pole);
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-slate-200 dark:border-slate-700/30 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <UtilityPole className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                {t('select_pole') || 'Selecionar Poste'}
                            </h3>
                            <p className="text-[10px] text-slate-400">Escolha o modelo do poste para adicionar ao mapa</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 pt-3 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_pole') || 'Buscar por nome, tipo ou formato...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-700/30 rounded-lg pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5 custom-scrollbar">
                    {loading ? (
                        <div className="space-y-2 pt-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-lg animate-pulse">
                                    <div className="w-11 h-11 rounded-lg bg-slate-200 dark:bg-slate-700/40" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3.5 bg-slate-200 dark:bg-slate-700/40 rounded w-32" />
                                        <div className="h-2.5 bg-slate-100 dark:bg-slate-700/20 rounded w-48" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10">
                            <UtilityPole className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">{t('no_results') || 'Nenhum poste encontrado'}</p>
                        </div>
                    ) : (
                        filtered.map(pole => {
                            const isActive = selectedId === pole.id;
                            const typeColor = TYPE_COLORS[pole.type] || '#6b7280';
                            return (
                                <div
                                    key={pole.id}
                                    onClick={() => setSelectedId(pole.id)}
                                    onDoubleClick={() => onSelect(pole)}
                                    className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                                        ${isActive
                                            ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 shadow-sm shadow-emerald-500/10'
                                            : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-[#22262e]/50'}
                                    `}
                                >
                                    {/* Icon */}
                                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-[#22262e]'}`}>
                                        <span className="text-lg" style={{ color: typeColor }}>
                                            {SHAPE_ICONS[pole.shape] || '●'}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {pole.name}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                                <Box className="w-3 h-3" />
                                                {pole.type}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                                <Ruler className="w-3 h-3" />
                                                {pole.height}m
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                                <Zap className="w-3 h-3" />
                                                {pole.strength}daN
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {pole.shape}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Check */}
                                    {isActive && (
                                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                            <Check className="w-3.5 h-3.5 text-white" />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-700/30 flex items-center justify-between shrink-0">
                    <span className="text-[10px] text-slate-400">{filtered.length} {filtered.length === 1 ? 'modelo' : 'modelos'}</span>
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleConfirm} disabled={!selectedId}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-emerald-900/10 flex items-center gap-1.5">
                            <UtilityPole className="w-3.5 h-3.5" />
                            Adicionar Poste
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
