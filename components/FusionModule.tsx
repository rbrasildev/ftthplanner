import React, { useState } from 'react';
import { FusionType } from '../types';
import { useLanguage } from '../LanguageContext';
import { X, Plus, Trash2, Zap } from 'lucide-react';

interface FusionModuleProps {
    isOpen: boolean;
    onClose: () => void;
    fusionTypes: FusionType[];
    onAddFusionType: (name: string, attenuation: number) => void;
    onDeleteFusionType: (id: string) => void;
}

export const FusionModule: React.FC<FusionModuleProps> = ({
    isOpen, onClose, fusionTypes, onAddFusionType, onDeleteFusionType
}) => {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [attenuation, setAttenuation] = useState('0.01');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        onAddFusionType(name, parseFloat(attenuation) || 0);
        setName('');
        setAttenuation('0.01');
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 uppercase tracking-tight">Módulo de Fusão</h2>
                            <p className="text-xs text-slate-500 font-medium">Cadastro de Tipos de Fusão</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 bg-slate-50 dark:bg-slate-950/30">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Fusão</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: Fusão Padrão"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Atenuação (dB)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={attenuation}
                            onChange={e => setAttenuation(e.target.value)}
                            placeholder="0.01"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!name}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Cadastrar Fusão
                    </button>
                </form>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-xs font-bold text-slate-400 uppercase">Fusões Cadastradas</h3>
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                            {fusionTypes.length}
                        </span>
                    </div>

                    {fusionTypes.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            Nenhuma fusão cadastrada.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {fusionTypes.map(ft => (
                                <div key={ft.id} className="group flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-amber-500/50 transition-colors shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{ft.name}</div>
                                            <div className="text-xs text-slate-500 font-mono">{ft.attenuation.toFixed(2)} dB</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onDeleteFusionType(ft.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
