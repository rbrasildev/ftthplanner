import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../../common/Button';
import { useLanguage } from '../../../LanguageContext';
import { FusionCatalogItem } from '../../../services/catalogService';

interface ConnectorTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    options: FusionCatalogItem[];
    onSelect: (id: string) => void;
}

export const ConnectorTypeModal: React.FC<ConnectorTypeModalProps> = ({ isOpen, onClose, options, onSelect }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
            <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-xl p-4 max-w-xs w-full shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {t('select_connector_type') || 'Selecionar Conector'}
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
                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {options.map(ct => (
                        <Button
                            key={ct.id}
                            variant="ghost"
                            onClick={() => { onSelect(ct.id); onClose(); }}
                            className="w-full justify-between items-center group transition-colors px-3 py-2.5 h-auto"
                        >
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-[1px] ${ct.polishType === 'APC' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                    {ct.name}
                                </span>
                            </div>
                            {ct.attenuation !== undefined && (
                                <span className="text-xs text-slate-400 font-mono">{ct.attenuation}dB</span>
                            )}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
};
