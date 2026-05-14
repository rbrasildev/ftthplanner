import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../../common/Button';
import { useLanguage } from '../../../LanguageContext';
import { SplitterCatalogItem } from '../../../services/catalogService';

export type SplitterFilterMode = 'Balanced' | 'Unbalanced';

interface SplitterSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    options: SplitterCatalogItem[];
    filter: SplitterFilterMode;
    onFilterChange: (filter: SplitterFilterMode) => void;
    onSelect: (e: React.MouseEvent, item: SplitterCatalogItem) => void;
}

export const SplitterSelectionModal: React.FC<SplitterSelectionModalProps> = ({
    isOpen, onClose, options, filter, onFilterChange, onSelect,
}) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    const filtered = options.filter(s => s.mode === filter);

    const tabClass = (active: boolean) =>
        `flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
            active
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        }`;

    return (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-4 max-w-xs w-full shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {t('select_splitter')}
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex bg-slate-100 dark:bg-[#22262e] p-1 rounded-xl mb-3 gap-1">
                    <button onClick={() => onFilterChange('Balanced')} className={tabClass(filter === 'Balanced')}>
                        {t('splitter_mode_balanced')}
                    </button>
                    <button onClick={() => onFilterChange('Unbalanced')} className={tabClass(filter === 'Unbalanced')}>
                        {t('splitter_mode_unbalanced')}
                    </button>
                </div>

                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-slate-500 italic">
                            {t('no_templates') || 'No templates available'}
                        </div>
                    ) : (
                        filtered.map(item => (
                            <Button
                                key={item.id}
                                variant="ghost"
                                onClick={(e) => { onSelect(e, item); onClose(); }}
                                className="w-full justify-between items-center group transition-colors px-3 py-2.5 h-auto"
                            >
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                    {item.name}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                    {item.outputs} {t('outputs') || 'outputs'}
                                </span>
                            </Button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
