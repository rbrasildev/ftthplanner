import React, { useState, useEffect } from 'react';
import { X, MapPin, Trash2, Edit2, Check, Settings, Info, Share2, Plus, Unlink, Loader2, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { PoleData, PoleStatus, CableData, POLE_STATUS_COLORS } from '../types';
import { useLanguage } from '../LanguageContext';
import { getPoles, PoleCatalogItem } from '../services/catalogService';
import { CustomSelect } from './common';

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
    const [status, setStatus] = useState<PoleStatus>(pole.status || 'PLANNED');
    const [catalogId, setCatalogId] = useState(pole.catalogId || '');
    const [linkedCableIds, setLinkedCableIds] = useState<string[]>(pole.linkedCableIds || []);
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const [polesCatalog, setPolesCatalog] = useState<PoleCatalogItem[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        setNewName(pole.name);
        setStatus(pole.status || 'PLANNED');
        setCatalogId(pole.catalogId || '');
        setLinkedCableIds(pole.linkedCableIds || []);
    }, [pole.id, pole.name, pole.status, pole.catalogId, pole.linkedCableIds]);

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

    const handleSaveRename = async () => {
        if (newName !== pole.name) {
            await onRename(pole.id, newName);
        }
        setIsRenaming(false);
    };

    const handleSave = async () => {
        setIsSavingLocal(true);
        try {
            const updates: Partial<PoleData> = {};
            if (newName !== pole.name) updates.name = newName;
            if (status !== pole.status) updates.status = status;
            if (catalogId !== pole.catalogId) {
                const selected = polesCatalog.find(p => p.id === catalogId);
                if (selected) {
                    updates.catalogId = selected.id;
                    updates.type = selected.type;
                    updates.height = selected.height;
                }
            }
            if (JSON.stringify(linkedCableIds) !== JSON.stringify(pole.linkedCableIds)) {
                updates.linkedCableIds = linkedCableIds;
            }

            if (Object.keys(updates).length > 0) {
                await onUpdate(pole.id, updates);
                if (newName !== pole.name) onRename(pole.id, newName);
                if (status !== pole.status) onUpdateStatus(pole.id, status);
            }
            onClose();
        } catch (error) {
            console.error('Failed to save pole properties', error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    const handleRemoveCable = (cableId: string) => {
        setLinkedCableIds(prev => prev.filter(id => id !== cableId));
    };

    const linkedCables = (cables || []).filter(c => linkedCableIds.includes(c.id));

    return (
        <div className="fixed top-20 right-4 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-right overflow-hidden transition-colors z-[2000]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    {isRenaming ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                                className="bg-slate-50 dark:bg-slate-950 border border-emerald-500/50 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 dark:text-white w-full focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
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
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                        title={isCollapsed ? t('expand') : t('collapse')}
                    >
                        {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Status Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-2 tracking-wider">
                            <Settings className="w-3 h-3" /> {t('status')}
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {(['PLANNED', 'ANALYSING', 'LICENSED'] as PoleStatus[]).map((statusOption) => (
                                <button
                                    key={statusOption}
                                    onClick={() => setStatus(statusOption)}
                                    className={`
                                    px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between
                                    ${status === statusOption
                                            ? `bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10`
                                            : 'bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}
                                `}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: POLE_STATUS_COLORS[statusOption] }}></div>
                                        {t(`status_${statusOption}`)}
                                    </div>
                                    {status === statusOption && <Check className="w-4 h-4 text-emerald-500" />}
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
                                    <CustomSelect
                                        value={catalogId}
                                        options={polesCatalog.map(p => ({
                                            value: p.id,
                                            label: p.name,
                                            sublabel: `${p.type} • ${p.height}m`
                                        }))}
                                        onChange={(val) => setCatalogId(val)}
                                        placeholder={t('select_pole_type')}
                                        showSearch={false}
                                    />
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
                                        {polesCatalog.find(p => p.id === catalogId)?.shape || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1 block">
                                        {t('pole_strength')}
                                    </label>
                                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-bold">
                                        {polesCatalog.find(p => p.id === catalogId)?.strength ? `${polesCatalog.find(p => p.id === catalogId)?.strength} daN` : 'N/A'}
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

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            onClick={handleSave}
                            disabled={isSavingLocal}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/10 dark:shadow-emerald-900/20"
                        >
                            {isSavingLocal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                            {t('apply')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
