
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { getFusions, createFusion, deleteFusion, FusionCatalogItem } from '../../services/catalogService';
import { Plus, Trash2, Zap, Search, Loader2 } from 'lucide-react';

export const FusionRegistration: React.FC = () => {
    const { t } = useLanguage();
    const [fusions, setFusions] = useState<FusionCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAttenuation, setNewAttenuation] = useState('0.01');

    useEffect(() => {
        loadFusions();
    }, []);

    const loadFusions = async () => {
        setLoading(true);
        try {
            const data = await getFusions();
            setFusions(data);
        } catch (error) {
            console.error("Failed to load fusions", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName) return;

        try {
            const created = await createFusion({
                name: newName,
                attenuation: parseFloat(newAttenuation) || 0
            });
            setFusions(prev => [...prev, created]);
            setNewName('');
            setNewAttenuation('0.01');
            setIsCreating(false);
        } catch (error) {
            console.error("Failed to create fusion", error);
            alert("Erro ao criar fusão");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('confirm_delete') || "Tem certeza?")) return;
        try {
            await deleteFusion(id);
            setFusions(prev => prev.filter(f => f.id !== id));
        } catch (error) {
            console.error("Failed to delete fusion", error);
            alert("Erro ao deletar fusão");
        }
    };

    const filteredFusions = fusions.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-7 h-7 text-sky-500" />
                        {t('reg_fusao') || "Tipos de Fusão"}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Gerencie os tipos de fusão disponíveis para os projetos.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-500/20"
                >
                    <Plus className="w-4 h-4" /> {t('add_new') || "Adicionar Novo"}
                </button>
            </div>

            {/* Create Form */}
            {isCreating && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg animate-in slide-in-from-top-2">
                    <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100">{t('new_fusion') || "Nova Fusão"}</h3>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('name') || "Nome"}</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Ex: Fusão Padrão"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('attenuation_db') || "Atenuação (dB)"}</label>
                            <input
                                type="number"
                                step="0.01"
                                value={newAttenuation}
                                onChange={e => setNewAttenuation(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-bold shadow-lg shadow-sky-500/20 transition"
                            >
                                {t('save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_generic') || "Buscar..."}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:text-slate-200 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                    </div>
                ) : filteredFusions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        Nenhuma fusão encontrada.
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">{t('name')}</th>
                                <th className="px-6 py-4">{t('attenuation')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredFusions.map(fusion => (
                                <tr key={fusion.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                                            {fusion.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                                        {fusion.attenuation} dB
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(fusion.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title={t('delete')}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
