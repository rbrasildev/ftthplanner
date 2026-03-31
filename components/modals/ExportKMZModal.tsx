import React, { useState } from 'react';
import { X, FileDown, CheckSquare, Square } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

export interface ExportKMZOptions {
    poles: boolean;
    cables: boolean;
    ctos: boolean;
    drops: boolean;
}

interface ExportKMZModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (options: ExportKMZOptions) => void;
    isExporting: boolean;
}

export const ExportKMZModal: React.FC<ExportKMZModalProps> = ({ isOpen, onClose, onExport, isExporting }) => {
    const { t } = useLanguage();

    const [options, setOptions] = useState<ExportKMZOptions>({
        poles: true,
        cables: true,
        ctos: true,
        drops: true
    });

    if (!isOpen) return null;

    const toggleOption = (key: keyof ExportKMZOptions) => {
        setOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleConfirm = () => {
        onExport(options);
    };

    const CheckboxRow = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/30 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <button
                type="button"
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${checked ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-[#22262e] text-transparent border border-slate-300 dark:border-slate-700'}`}
                onClick={(e) => { e.preventDefault(); onChange(); }}
            >
                {checked && <CheckSquare className="w-4 h-4" />}
                {!checked && <Square className="w-4 h-4 opacity-0" />}
            </button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none flex-1">{label}</span>
        </label>
    );

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1a1d23] rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700/30 flex flex-col overflow-hidden transform transition-all scale-100 opacity-100">

                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center justify-between bg-slate-50/50 dark:bg-[#1a1d23]/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <FileDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Exportar KMZ</h3>
                    </div>
                    <button onClick={onClose} disabled={isExporting} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Selecione quais camadas do projeto você deseja exportar para o Google Earth:</p>

                    <div className="grid gap-2">
                        <CheckboxRow label="Postes" checked={options.poles} onChange={() => toggleOption('poles')} />
                        <CheckboxRow label="Cabos de Rede" checked={options.cables} onChange={() => toggleOption('cables')} />
                        <CheckboxRow label="Caixas (CTO/CEO e POPs)" checked={options.ctos} onChange={() => toggleOption('ctos')} />
                        <CheckboxRow label="Drops (Cabos de Clientes)" checked={options.drops} onChange={() => toggleOption('drops')} />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-[#1a1d23]/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isExporting}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isExporting || (!options.poles && !options.cables && !options.ctos && !options.drops)}
                        className={`px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg transition-all flex items-center gap-2 ${isExporting ? 'bg-emerald-400 cursor-not-allowed opacity-70' : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-emerald-600/20'}`}
                    >
                        <FileDown className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
                        {isExporting ? 'Gerando...' : 'Exportar Selecionados'}
                    </button>
                </div>
            </div>
        </div>
    );
};
