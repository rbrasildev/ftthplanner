import React, { useState, useEffect } from 'react';
import { X, MapPin, Trash2, Edit2, Check, Settings, Info, Share2, Plus, Unlink, Loader2 } from 'lucide-react';
import { PoleData, PoleStatus, CableData, POLE_STATUS_COLORS } from '../types';
import { useLanguage } from '../LanguageContext';
import { getPoles, PoleCatalogItem } from '../services/catalogService';

interface PoleDetailsPanelProps {
    pole: PoleData;
    cables: CableData[];
    onRename: (id: string, newName: string) => void;
    onUpdateStatus: (id: string, status: PoleStatus) => void;
    onUpdate: (id: string, updates: Partial<PoleData>) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export const PoleDetailsPanel: React.FC<PoleDetailsPanelProps> = ({
    pole,
    cables = [],
    onRename,
    onUpdateStatus,
    onUpdate,
    onDelete,
    onClose
}) => {
    const { t } = useLanguage();
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(pole.name);
    const [polesCatalog, setPolesCatalog] = useState<PoleCatalogItem[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);

    useEffect(() => {
        loadCatalog();
    }, []);

    const loadCatalog = async () => {
        try {
            setLoadingCatalog(true);
            const data = await getPoles();
            setPolesCatalog(data);
        } catch (error) {
            console.error('Failed to load poles catalog', error);
        } finally {
            setLoadingCatalog(false);
        }
    };

    const handleSaveRename = () => {
        if (newName.trim() && newName !== pole.name) {
            onRename(pole.id, newName);
        }
        setIsRenaming(false);
    };

    const handleRemoveCable = (cableId: string) => {
        const currentLinks = pole.linkedCableIds || [];
        onUpdate(pole.id, { linkedCableIds: currentLinks.filter(id => id !== cableId) });
    };

    const handleUpdateType = (catalogId: string) => {
        const selected = polesCatalog.find(p => p.id === catalogId);
        if (!selected) return;
        onUpdate(pole.id, {
            catalogId: selected.id,
            type: selected.type,
            height: selected.height
        });
    };

    const linkedCables = (cables || []).filter(c => (pole.linkedCableIds || []).includes(c.id));

    return (
        <div className="fixed top-20 right-4 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-right overflow-hidden transition-colors z-[2000]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    {isRenaming ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                                className="bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 text-sm font-bold text-slate-800 dark:text-white w-full"
                            />
                            <button onClick={handleSaveRename} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                <Check className="w-4 h-4 text-emerald-600" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 overflow-hidden group">
                            <h3 className="font-bold text-slate-800 dark:text-white truncate text-sm">
                                {pole.name}
                            </h3>
                            <button onClick={() => setIsRenaming(true)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit2 className="w-3 h-3 text-slate-400" />
                            </button>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0">
                    <X className="w-5 h-5 text-slate-400" />
                </button>
            </div>

            <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Status Selection */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-2 tracking-wider">
                        <Settings className="w-3 h-3" /> {t('status')}
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                        {(['PLANNED', 'ANALYSING', 'LICENSED'] as PoleStatus[]).map((status) => (
                            <button
                                key={status}
                                onClick={() => onUpdateStatus(pole.id, status)}
                                className={`
                                    px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between
                                    ${pole.status === status
                                        ? `bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white`
                                        : 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30'}
                                `}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: POLE_STATUS_COLORS[status] }}></div>
                                    {t(`status_${status}`)}
                                </div>
                                {pole.status === status && <Check className="w-4 h-4 text-emerald-500" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Technical Info */}
                <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-2 tracking-wider">
                        <Info className="w-3 h-3" /> {t('technical_specifications')}
                    </label>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-4 border border-slate-100 dark:border-slate-800">
                        <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1.5 block">
                                {t('selection_pole_type')}
                            </label>
                            {loadingCatalog ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {t('loading')}
                                </div>
                            ) : (
                                <select
                                    value={pole.catalogId || ''}
                                    onChange={(e) => handleUpdateType(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
                                >
                                    <option value="">{t('select_pole_type')}</option>
                                    {polesCatalog.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1 block">
                                    {t('pole_height')}
                                </label>
                                <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-bold">
                                    {pole.height ? `${pole.height}m` : 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1 block">
                                    {t('pole_shape')}
                                </label>
                                <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-bold">
                                    {polesCatalog.find(p => p.id === pole.catalogId)?.shape || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1 block">
                                    {t('pole_strength')}
                                </label>
                                <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-bold">
                                    {polesCatalog.find(p => p.id === pole.catalogId)?.strength ? `${polesCatalog.find(p => p.id === pole.catalogId)?.strength} daN` : 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1 block">
                                    {t('type')}
                                </label>
                                <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-bold">
                                    {pole.type || 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Linked Cables Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-2 tracking-wider">
                            <Share2 className="w-3 h-3" /> {t('linked_cables')}
                        </label>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">
                            {linkedCables.length}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {linkedCables.length === 0 ? (
                            <div className="text-center py-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400">{t('unlinked')}</span>
                            </div>
                        ) : (
                            linkedCables.map(cable => (
                                <div key={cable.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 group transition-all hover:border-slate-200 dark:hover:border-slate-700">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cable.color || '#0ea5e9' }}></div>
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                                            {cable.name}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveCable(cable.id)}
                                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title={t('remove')}
                                    >
                                        <Unlink className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => {
                            if (window.confirm(t('confirm_delete_pole_confirm') || 'Deseja excluir este poste?')) {
                                onDelete(pole.id);
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl text-xs font-bold transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('delete')}
                    </button>
                </div>
            </div>
        </div>
    );
};
