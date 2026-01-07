import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save, Box, AlertTriangle, Palette, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';
import { getBoxes, createBox, updateBox, deleteBox, BoxCatalogItem } from '../../services/catalogService';

const BoxRegistration: React.FC = () => {
    const { t } = useLanguage();
    const [boxes, setBoxes] = useState<BoxCatalogItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBox, setEditingBox] = useState<BoxCatalogItem | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Initial Form State
    const [formData, setFormData] = useState<Partial<BoxCatalogItem>>({
        name: '',
        brand: '',
        model: '',
        type: 'CTO',
        reserveLoopLength: 0,
        color: '#64748b',
        description: ''
    });

    useEffect(() => {
        loadBoxes();
    }, []);

    const loadBoxes = async () => {
        setIsLoading(true);
        try {
            const data = await getBoxes();
            setBoxes(data);
        } catch (error) {
            console.error("Failed to load boxes", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (box?: BoxCatalogItem) => {
        if (box) {
            setEditingBox(box);
            setFormData({ ...box });
        } else {
            setEditingBox(null);
            setFormData({
                name: '',
                brand: '',
                model: '',
                type: 'CTO',
                reserveLoopLength: 0,
                color: '#64748b',
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBox(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingBox) {
                await updateBox(editingBox.id, formData);
            } else {
                await createBox(formData as BoxCatalogItem);
            }
            loadBoxes();
            handleCloseModal();
        } catch (error) {
            console.error("Failed to save box", error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteBox(id);
            setBoxes(prev => prev.filter(b => b.id !== id));
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error("Failed to delete box", error);
        }
    };

    const filteredBoxes = boxes.filter(box =>
        box.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        box.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        box.model?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Box className="w-8 h-8 text-sky-600" />
                            {t('box_catalog') || 'Catálogo de Caixas'}
                        </h1>
                        <p className="text-slate-500 mt-1">{t('box_catalog_desc') || 'Gerencie os modelos de caixas (CTO/CEO) disponíveis.'}</p>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition shadow-sm hover:shadow-md active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        {t('add_new') || 'Adicionar Nova'}
                    </button>
                </div>

                {/* Search */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search_placeholder_box') || "Buscar por nome, marca ou modelo..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Grid */}
                {isLoading ? (
                    <div className="text-center py-12 text-slate-500">{t('loading') || 'Carregando...'}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredBoxes.map(box => (
                            <div key={box.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: box.color }}></div>
                                <div className="p-5 pl-7">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${box.type === 'CTO' ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {box.type}
                                            </span>
                                            <h3 className="font-bold text-slate-900 leading-tight">{box.name}</h3>
                                            <p className="text-xs text-slate-500 mt-1">{box.brand} {box.model}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(box)}
                                                className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                                                title={t('edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(box.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                title={t('delete')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">{t('reserve')}:</span>
                                            <span className="font-mono font-medium">{box.reserveLoopLength}m</span>
                                        </div>
                                        {box.description && (
                                            <div className="pt-1 mt-1 border-t border-slate-200">
                                                <p className="line-clamp-2 text-slate-500 italic">{box.description}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Delete Confirmation Overlay */}
                                {showDeleteConfirm === box.id && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center animate-in fade-in">
                                        <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                                        <p className="text-sm font-medium text-slate-900 mb-3">{t('confirm_delete')}</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowDeleteConfirm(null)}
                                                className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                                            >
                                                {t('bm_cancel')}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(box.id)}
                                                className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-md transition shadow-md shadow-red-500/20"
                                            >
                                                {t('confirm_delete')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 translate-y-0">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Box className="w-6 h-6 text-sky-600" />
                                    {editingBox ? (t('edit_box') || 'Editar Caixa') : (t('new_box') || 'Nova Caixa')}
                                </h2>
                                <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('name')} *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                                        placeholder="Ex: CTO-PRECON"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('brand')}</label>
                                        <input
                                            type="text"
                                            value={formData.brand}
                                            onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                                            placeholder="Marca"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('model')}</label>
                                        <input
                                            type="text"
                                            value={formData.model}
                                            onChange={e => setFormData({ ...formData, model: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                                            placeholder="Modelo"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('type')}</label>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value as 'CTO' | 'CEO' })}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors bg-white"
                                        >
                                            <option value="CTO">{t('type_cto_termination')}</option>
                                            <option value="CEO">{t('type_ceo_splice')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('reserve_loop_length')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.reserveLoopLength}
                                            onChange={e => setFormData({ ...formData, reserveLoopLength: parseFloat(e.target.value) || 0 })}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                                        <Palette className="w-3 h-3" /> {t('ident_color')}
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={formData.color}
                                            onChange={e => setFormData({ ...formData, color: e.target.value })}
                                            className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 overflow-hidden shadow-sm"
                                        />
                                        <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200 uppercase font-mono">
                                            {formData.color}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('description')}</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors min-h-[80px]"
                                        placeholder={t('details_placeholder')}
                                    />
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium shadow-lg shadow-sky-200 transition active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        {t('save')}
                                    </button>
                                </div>

                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BoxRegistration;
