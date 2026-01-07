
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
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Cable className="w-8 h-8 text-sky-600" />
                        Catálogo de Cabos
                    </h1>
                    <p className="text-slate-500">Gerencie os modelos de cabos disponíveis para projetos</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" /> Novo Cabo
                </button>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Buscar por código ou marca..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all shadow-sm"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCables.map(cable => (
                    <div key={cable.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(cable)} className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors">
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(cable.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-slate-800 text-lg">{cable.name}</h3>
                                <p className="text-sm text-slate-500">{cable.brand} - {cable.model}</p>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex justify-between">
                                <span>Fibras:</span>
                                <span className="font-medium">{cable.fiberCount} ({cable.looseTubeCount}x{cable.fibersPerTube})</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Nível:</span>
                                <span className="font-medium text-sky-600">{cable.defaultLevel}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Atenuação:</span>
                                <span>{cable.attenuation} dB/km</span>
                            </div>
                        </div>

                        {/* Visual Preview */}
                        <div className="mt-4 flex gap-4 pt-4 border-t border-slate-100">
                            <div className='flex flex-col gap-1 items-center flex-1'>
                                <span className="text-xs text-slate-400">Implantado</span>
                                <div className="h-1 w-full rounded-full" style={{ backgroundColor: cable.deployedSpec?.color, height: cable.deployedSpec?.width ? `${Math.min(cable.deployedSpec.width, 6)}px` : '3px' }}></div>
                            </div>
                            <div className='flex flex-col gap-1 items-center flex-1'>
                                <span className="text-xs text-slate-400">Projetado</span>
                                <div className="h-1 w-full rounded-full border border-dashed border-slate-300" style={{ backgroundColor: cable.plannedSpec?.color, height: cable.plannedSpec?.width ? `${Math.min(cable.plannedSpec.width, 6)}px` : '3px', opacity: 0.7 }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10 backdrop-blur-md">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingCable ? 'Editar Cabo' : 'Novo Cabo'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Main Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Código (Nome)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                                        placeholder="Ex: Cabo 12F AS-80"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-sky-500 transition-all"
                                        placeholder="Marca do cabo"
                                        value={formData.brand}
                                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-sky-500 transition-all"
                                        placeholder="Modelo técnico"
                                        value={formData.model}
                                        onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nível Padrão</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-sky-500 transition-all bg-white"
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
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Especificações Técnicas</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Total de Fibras</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-sky-500 bg-white"
                                            value={formData.fiberCount}
                                            onChange={e => setFormData({ ...formData, fiberCount: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Nº de Looses</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-sky-500 bg-white"
                                            value={formData.looseTubeCount}
                                            onChange={e => setFormData({ ...formData, looseTubeCount: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Fibras por Loose</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-sky-500 bg-white"
                                            value={formData.fibersPerTube}
                                            onChange={e => setFormData({ ...formData, fibersPerTube: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Atenuação/Km (dB)</label>
                                        <input
                                            type="number" step="0.01"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-sky-500 bg-white"
                                            value={formData.attenuation}
                                            onChange={e => setFormData({ ...formData, attenuation: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-medium text-slate-500 mb-2">Padrão de Cores</label>
                                    <div className="flex bg-slate-200 rounded-lg p-1 mb-3">
                                        <button
                                            onClick={() => setFormData({ ...formData, fiberProfile: 'ABNT' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${formData.fiberProfile === 'ABNT' || !formData.fiberProfile ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                                        >
                                            ABNT (Brasil)
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, fiberProfile: 'EIA' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${formData.fiberProfile === 'EIA' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                                <textarea
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-sky-500 transition-all"
                                    rows={3}
                                    placeholder="Detalhes adicionais..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            {/* Visual Representation */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Deployed Specs */}
                                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                                    <h4 className="font-semibold text-slate-700 mb-3 border-b border-slate-200 pb-2">Representação Implantado</h4>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Cor</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {SPEC_COLORS.slice(0, 7).map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setFormData({ ...formData, deployedSpec: { ...formData.deployedSpec!, color: c } })}
                                                        className={`w-6 h-6 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110 ${formData.deployedSpec?.color === c ? 'ring-2 ring-sky-600 ring-offset-1 scale-110' : ''}`}
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
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Espessura</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center"
                                                value={formData.deployedSpec?.width}
                                                onChange={e => setFormData({ ...formData, deployedSpec: { ...formData.deployedSpec!, width: Number(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Planned Specs */}
                                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                                    <h4 className="font-semibold text-slate-700 mb-3 border-b border-slate-200 pb-2">Representação Não Implantado</h4>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Cor</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {SPEC_COLORS.slice(7, 14).map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setFormData({ ...formData, plannedSpec: { ...formData.plannedSpec!, color: c } })}
                                                        className={`w-6 h-6 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110 ${formData.plannedSpec?.color === c ? 'ring-2 ring-sky-600 ring-offset-1 scale-110' : ''}`}
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
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Espessura</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center"
                                                value={formData.plannedSpec?.width}
                                                onChange={e => setFormData({ ...formData, plannedSpec: { ...formData.plannedSpec!, width: Number(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl sticky bottom-0 z-10">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
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
