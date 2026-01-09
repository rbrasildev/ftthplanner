
import React, { useState, useEffect } from 'react';
import {
    getCables, createCable, updateCable, deleteCable, CableCatalogItem
} from '../../services/catalogService';
import { Plus, Edit2, Trash2, Search, Cable } from 'lucide-react';

const SPEC_COLORS = ['#10b981', '#86efac', '#3b82f6', '#93c5fd', '#f59e0b', '#fcd34d', '#ef4444', '#fca5a5', '#8b5cf6', '#c4b5fd', '#ec4899', '#f9a8d4', '#6b7280', '#d1d5db'];

const CableRegistration: React.FC = () => {
    const [cables, setCables] = useState<CableCatalogItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCable, setEditingCable] = useState<CableCatalogItem | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<CableCatalogItem>>({
        name: '',
        brand: '',
        model: '',
        defaultLevel: 'DISTRIBUICAO',
        fiberCount: 12,
        looseTubeCount: 1,
        fibersPerTube: 12,
        attenuation: 0.35,
        fiberProfile: 'ABNT',
        description: '',
        deployedSpec: { color: '#10b981', width: 3 },
        plannedSpec: { color: '#86efac', width: 3 }
    });

    useEffect(() => {
        loadCables();
    }, []);

    const loadCables = async () => {
        try {
            const data = await getCables();
            setCables(data);
        } catch (error) {
            console.error("Failed to load cables", error);
        }
    };

    const handleOpenModal = (cable?: CableCatalogItem) => {
        if (cable) {
            setEditingCable(cable);
            setFormData(cable);
        } else {
            setEditingCable(null);
            setFormData({
                name: '',
                brand: '',
                model: '',
                defaultLevel: 'DISTRIBUICAO',
                fiberCount: 12,
                looseTubeCount: 1,
                fibersPerTube: 12,
                attenuation: 0.35,
                fiberProfile: 'ABNT',
                description: '',
                deployedSpec: { color: '#10b981', width: 3 },
                plannedSpec: { color: '#86efac', width: 3 }
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formData.name) return alert('Código é obrigatório');

            if (editingCable) {
                await updateCable(editingCable.id, formData);
            } else {
                await createCable(formData as Omit<CableCatalogItem, 'id' | 'updatedAt'>);
            }
            loadCables();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save cable", error);
            alert("Erro ao salvar cabo");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este cabo?")) {
            await deleteCable(id);
            loadCables();
        }
    };

    const filteredCables = cables.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.brand?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Cable className="w-7 h-7 text-sky-500" />
                        Catálogo de Cabos
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Gerencie os modelos de cabos disponíveis para projetos
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition shadow-lg shadow-sky-500/20"
                >
                    <Plus className="w-4 h-4" /> Novo Cabo
                </button>
            </div>

            {/* List Container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por código ou marca..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                        />
                    </div>
                </div>

                {filteredCables.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        Nenhum cabo encontrado.
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Fibras</th>
                                <th className="px-6 py-4">Nível</th>
                                <th className="px-6 py-4 text-center">Cores (Imp/Proj)</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredCables.map(cable => (
                                <tr key={cable.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        {cable.name}
                                        <div className="text-xs text-slate-500 font-normal">{cable.brand} - {cable.model}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {cable.fiberCount} ({cable.looseTubeCount}x{cable.fibersPerTube})
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold text-slate-600 dark:text-slate-300">
                                            {cable.defaultLevel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <div
                                                className="w-4 h-4 rounded-full border border-slate-200 shadow-sm"
                                                style={{ backgroundColor: cable.deployedSpec?.color }}
                                                title="Cor Implantado"
                                            ></div>
                                            <div
                                                className="w-4 h-4 rounded-full border border-dashed border-slate-300 shadow-sm"
                                                style={{ backgroundColor: cable.plannedSpec?.color }}
                                                title="Cor Projetado"
                                            ></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(cable)}
                                                className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cable.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                {editingCable ? 'Editar Cabo' : 'Novo Cabo'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Main Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Código (Nome)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                                        placeholder="Ex: Cabo 12F AS-80"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Marca</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 transition-all"
                                        placeholder="Marca do cabo"
                                        value={formData.brand}
                                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Modelo</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 transition-all"
                                        placeholder="Modelo técnico"
                                        value={formData.model}
                                        onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Nível Padrão</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 transition-all"
                                        value={formData.defaultLevel}
                                        onChange={e => setFormData({ ...formData, defaultLevel: e.target.value })}
                                    >
                                        <option value="DISTRIBUICAO">DISTRIBUIÇÃO</option>
                                        <option value="TRONCO">TRONCO</option>
                                        <option value="DROP">DROP</option>
                                    </select>
                                </div>
                            </div>

                            {/* Tech Specs */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Especificações Técnicas</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total de Fibras</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-sky-500"
                                            value={formData.fiberCount}
                                            onChange={e => setFormData({ ...formData, fiberCount: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nº de Looses</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-sky-500"
                                            value={formData.looseTubeCount}
                                            onChange={e => setFormData({ ...formData, looseTubeCount: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Fibras por Loose</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-sky-500"
                                            value={formData.fibersPerTube}
                                            onChange={e => setFormData({ ...formData, fibersPerTube: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Atenuação/Km (dB)</label>
                                        <input
                                            type="number" step="0.01"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-sky-500"
                                            value={formData.attenuation}
                                            onChange={e => setFormData({ ...formData, attenuation: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Padrão de Cores</label>
                                    <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1 mb-3">
                                        <button
                                            onClick={() => setFormData({ ...formData, fiberProfile: 'ABNT' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${formData.fiberProfile === 'ABNT' || !formData.fiberProfile ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'}`}
                                        >
                                            ABNT (Brasil)
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, fiberProfile: 'EIA' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${formData.fiberProfile === 'EIA' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'}`}
                                        >
                                            EIA-598-A (Intl)
                                        </button>
                                    </div>

                                    {/* Visual Color Preview */}
                                    <div className="flex gap-1 justify-center">
                                        {(formData.fiberProfile === 'EIA' ?
                                            ['#0000FF', '#FFA500', '#008000', '#A52A2A', '#808080', '#FFFFFF', '#FF0000', '#000000', '#FFFF00', '#EE82EE', '#FFC0CB', '#00FFFF']
                                            :
                                            ['#008000', '#FFFF00', '#FFFFFF', '#0000FF', '#FF0000', '#EE82EE', '#A52A2A', '#FFC0CB', '#000000', '#808080', '#FFA500', '#00FFFF']
                                        ).map((c, i) => (
                                            <div key={i} className="w-4 h-4 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: c }} title={`Fibra ${i + 1}`} />
                                        ))}
                                        <span className="text-slate-400 text-xs self-end ml-1">...</span>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Descrição</label>
                                <textarea
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 transition-all"
                                    rows={3}
                                    placeholder="Detalhes adicionais..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            {/* Visual Representation */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Deployed Specs */}
                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Representação Implantado</h4>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cor</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {SPEC_COLORS.slice(0, 7).map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setFormData({ ...formData, deployedSpec: { ...formData.deployedSpec!, color: c } })}
                                                        className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-transform hover:scale-110 ${formData.deployedSpec?.color === c ? 'ring-2 ring-sky-600 ring-offset-1 scale-110' : ''}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                                <input
                                                    type="color"
                                                    className="w-8 h-8 p-0 rounded cursor-pointer border-0"
                                                    value={formData.deployedSpec?.color}
                                                    onChange={e => setFormData({ ...formData, deployedSpec: { ...formData.deployedSpec!, color: e.target.value } })}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Espessura</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center"
                                                value={formData.deployedSpec?.width}
                                                onChange={e => setFormData({ ...formData, deployedSpec: { ...formData.deployedSpec!, width: Number(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Planned Specs */}
                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Representação Não Implantado</h4>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cor</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {SPEC_COLORS.slice(7, 14).map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setFormData({ ...formData, plannedSpec: { ...formData.plannedSpec!, color: c } })}
                                                        className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-transform hover:scale-110 ${formData.plannedSpec?.color === c ? 'ring-2 ring-sky-600 ring-offset-1 scale-110' : ''}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                                <input
                                                    type="color"
                                                    className="w-8 h-8 p-0 rounded cursor-pointer border-0"
                                                    value={formData.plannedSpec?.color}
                                                    onChange={e => setFormData({ ...formData, plannedSpec: { ...formData.plannedSpec!, color: e.target.value } })}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Espessura</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center"
                                                value={formData.plannedSpec?.width}
                                                onChange={e => setFormData({ ...formData, plannedSpec: { ...formData.plannedSpec!, width: Number(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/80 rounded-b-2xl sticky bottom-0 z-10 backdrop-blur-sm">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2.5 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 shadow-sm hover:shadow-md transition-all transform active:scale-95"
                            >
                                Salvar Cabo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CableRegistration;
