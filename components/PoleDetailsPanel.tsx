import React, { useState, useEffect, useCallback } from 'react';
import {
    X, MapPin, Edit2, Check, Settings, Info, Share2, Unlink, Loader2, Activity,
    ChevronDown, ChevronUp, Plus, Trash2, Camera, CheckSquare, Square, Image, ClipboardList, Package
} from 'lucide-react';
import {
    PoleData, PoleStatus, CableData, POLE_STATUS_COLORS,
    PoleApprovalStatus, POLE_APPROVAL_COLORS, PoleSituation, PoleRoadSide,
    CTOData, PoleEquipmentData, PoleChecklistData, PolePhotoData
} from '../types';
import { useLanguage } from '../LanguageContext';
import { getPoles, PoleCatalogItem } from '../services/catalogService';
import * as poleDocService from '../services/poleDocService';
import { CustomSelect } from './common';

type TabKey = 'data' | 'equipments' | 'photos' | 'checklist';

const EQUIPMENT_TYPES = ['CTO', 'caixa_emenda', 'reserva_tecnica', 'estai', 'ancoragem', 'transformador', 'iluminacao'] as const;
const SITUATIONS: PoleSituation[] = ['EXISTING', 'NEW', 'SHARED', 'REPLACE'];
const ROAD_SIDES: PoleRoadSide[] = ['LEFT', 'RIGHT'];
const APPROVAL_STATUSES: PoleApprovalStatus[] = ['APPROVED', 'PENDING', 'IRREGULAR'];

interface PoleDetailsPanelProps {
    pole: PoleData;
    cables: CableData[];
    ctos?: CTOData[];
    projectId?: string;
    onRename: (id: string, newName: string) => void;
    onUpdateStatus: (id: string, status: PoleStatus) => void;
    onUpdate: (id: string, updates: Partial<PoleData>) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export const PoleDetailsPanel: React.FC<PoleDetailsPanelProps> = ({
    pole, cables = [], ctos = [], projectId,
    onRename, onUpdateStatus, onUpdate, onDelete, onClose
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TabKey>('data');
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(pole.name);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Data tab state
    const [status, setStatus] = useState<PoleStatus>(pole.status || 'PLANNED');
    const [catalogId, setCatalogId] = useState(pole.catalogId || '');
    const [linkedCableIds, setLinkedCableIds] = useState<string[]>(pole.linkedCableIds || []);
    const [utilityCode, setUtilityCode] = useState(pole.utilityCode || '');
    const [situation, setSituation] = useState<PoleSituation | undefined>(pole.situation);
    const [roadSide, setRoadSide] = useState<PoleRoadSide | undefined>(pole.roadSide);
    const [addressReference, setAddressReference] = useState(pole.addressReference || '');
    const [observations, setObservations] = useState(pole.observations || '');
    const [approvalStatus, setApprovalStatus] = useState<PoleApprovalStatus>(pole.approvalStatus || 'PENDING');
    const [lastInspectionDate, setLastInspectionDate] = useState(pole.lastInspectionDate || '');
    const [isSaving, setIsSaving] = useState(false);
    const [polesCatalog, setPolesCatalog] = useState<PoleCatalogItem[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);

    // Equipments tab state
    const [equipments, setEquipments] = useState<PoleEquipmentData[]>([]);
    const [loadingEquipments, setLoadingEquipments] = useState(false);
    const [newEquipType, setNewEquipType] = useState<string>('CTO');
    const [newEquipName, setNewEquipName] = useState('');
    const [newEquipQty, setNewEquipQty] = useState(1);

    // Photos tab state
    const [photos, setPhotos] = useState<PolePhotoData[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [newPhotoUrl, setNewPhotoUrl] = useState('');
    const [newPhotoCaption, setNewPhotoCaption] = useState('');

    // Checklist tab state
    const [checklist, setChecklist] = useState<PoleChecklistData>({
        poleId: pole.id,
        hasIdentification: false,
        hasPhoto: false,
        distanceVerified: false,
        heightInformed: false,
        cableLinked: false,
        ctoOrBoxLinked: false,
        noElectricalConflict: false,
        readyToSubmit: false,
    });
    const [loadingChecklist, setLoadingChecklist] = useState(false);

    useEffect(() => {
        setNewName(pole.name);
        setStatus(pole.status || 'PLANNED');
        setCatalogId(pole.catalogId || '');
        setLinkedCableIds(pole.linkedCableIds || []);
        setUtilityCode(pole.utilityCode || '');
        setSituation(pole.situation);
        setRoadSide(pole.roadSide);
        setAddressReference(pole.addressReference || '');
        setObservations(pole.observations || '');
        setApprovalStatus(pole.approvalStatus || 'PENDING');
        setLastInspectionDate(pole.lastInspectionDate || '');
    }, [pole.id]);

    useEffect(() => { loadCatalog(); }, []);

    useEffect(() => {
        if (projectId && activeTab === 'equipments') loadEquipments();
        if (projectId && activeTab === 'photos') loadPhotos();
        if (projectId && activeTab === 'checklist') loadChecklist();
    }, [activeTab, projectId, pole.id]);

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

    const loadEquipments = async () => {
        if (!projectId) return;
        try {
            setLoadingEquipments(true);
            const data = await poleDocService.getPoleEquipments(projectId, pole.id);
            setEquipments(data);
        } catch (error) {
            console.error('Failed to load equipments', error);
        } finally {
            setLoadingEquipments(false);
        }
    };

    const loadPhotos = async () => {
        if (!projectId) return;
        try {
            setLoadingPhotos(true);
            const data = await poleDocService.getPolePhotos(projectId, pole.id);
            setPhotos(data);
        } catch (error) {
            console.error('Failed to load photos', error);
        } finally {
            setLoadingPhotos(false);
        }
    };

    const loadChecklist = async () => {
        if (!projectId) return;
        try {
            setLoadingChecklist(true);
            const data = await poleDocService.getPoleChecklist(projectId, pole.id);
            setChecklist({ ...data, poleId: pole.id });
        } catch (error) {
            console.error('Failed to load checklist', error);
        } finally {
            setLoadingChecklist(false);
        }
    };

    const handleSaveRename = async () => {
        if (newName !== pole.name) await onRename(pole.id, newName);
        setIsRenaming(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
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
                    updates.shape = selected.shape;
                    updates.strength = selected.strength;
                }
            }
            if (JSON.stringify(linkedCableIds) !== JSON.stringify(pole.linkedCableIds)) updates.linkedCableIds = linkedCableIds;
            if (utilityCode !== (pole.utilityCode || '')) updates.utilityCode = utilityCode;
            if (situation !== pole.situation) updates.situation = situation;
            if (roadSide !== pole.roadSide) updates.roadSide = roadSide;
            if (addressReference !== (pole.addressReference || '')) updates.addressReference = addressReference;
            if (observations !== (pole.observations || '')) updates.observations = observations;
            if (approvalStatus !== (pole.approvalStatus || 'PENDING')) updates.approvalStatus = approvalStatus;
            if (lastInspectionDate !== (pole.lastInspectionDate || '')) updates.lastInspectionDate = lastInspectionDate;

            if (Object.keys(updates).length > 0) {
                await onUpdate(pole.id, updates);
                if (updates.name) onRename(pole.id, updates.name);
                if (updates.status) onUpdateStatus(pole.id, updates.status);
                // Also update server-side documentation fields
                if (projectId) {
                    await poleDocService.updatePoleDetails(projectId, pole.id, {
                        utilityCode: utilityCode || null,
                        situation: situation || null,
                        roadSide: roadSide || null,
                        addressReference: addressReference || null,
                        observations: observations || null,
                        approvalStatus,
                        lastInspectionDate: lastInspectionDate || null,
                    });
                }
            }
            onClose();
        } catch (error) {
            console.error('Failed to save pole properties', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddEquipment = async () => {
        if (!projectId || !newEquipName.trim()) return;
        try {
            await poleDocService.createPoleEquipment(projectId, pole.id, {
                type: newEquipType, name: newEquipName.trim(), quantity: newEquipQty,
            });
            setNewEquipName('');
            setNewEquipQty(1);
            loadEquipments();
        } catch (error) {
            console.error('Failed to add equipment', error);
        }
    };

    const handleDeleteEquipment = async (equipmentId: string) => {
        if (!projectId) return;
        try {
            await poleDocService.deletePoleEquipment(projectId, pole.id, equipmentId);
            setEquipments(prev => prev.filter(e => e.id !== equipmentId));
        } catch (error) {
            console.error('Failed to delete equipment', error);
        }
    };

    const handleAddPhoto = async () => {
        if (!projectId || !newPhotoUrl.trim()) return;
        try {
            await poleDocService.addPolePhoto(projectId, pole.id, {
                url: newPhotoUrl.trim(), caption: newPhotoCaption.trim() || undefined,
            });
            setNewPhotoUrl('');
            setNewPhotoCaption('');
            loadPhotos();
        } catch (error) {
            console.error('Failed to add photo', error);
        }
    };

    const handleDeletePhoto = async (photoId: string) => {
        if (!projectId) return;
        try {
            await poleDocService.deletePolePhoto(projectId, pole.id, photoId);
            setPhotos(prev => prev.filter(p => p.id !== photoId));
        } catch (error) {
            console.error('Failed to delete photo', error);
        }
    };

    const handleToggleChecklist = async (field: keyof PoleChecklistData) => {
        if (!projectId || field === 'id' || field === 'poleId') return;
        const updated = { ...checklist, [field]: !checklist[field] };
        setChecklist(updated);
        try {
            await poleDocService.upsertPoleChecklist(projectId, pole.id, updated);
        } catch (error) {
            console.error('Failed to save checklist', error);
        }
    };

    const linkedCables = (cables || []).filter(c => linkedCableIds.includes(c.id));
    const linkedCTOs = (ctos || []).filter(c => c.poleId === pole.id);
    const completedChecks = Object.entries(checklist).filter(([k, v]) => k !== 'id' && k !== 'poleId' && v === true).length;
    const totalChecks = 8;

    const tabs: { key: TabKey; icon: React.ReactNode; label: string }[] = [
        { key: 'data', icon: <Info className="w-3.5 h-3.5" />, label: t('pole_tab_data') },
        { key: 'equipments', icon: <Package className="w-3.5 h-3.5" />, label: t('pole_tab_equipments') },
        { key: 'photos', icon: <Image className="w-3.5 h-3.5" />, label: t('pole_tab_photos') },
        { key: 'checklist', icon: <ClipboardList className="w-3.5 h-3.5" />, label: t('pole_tab_checklist') },
    ];

    return (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/30 overflow-hidden transition-colors z-[2000]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${POLE_APPROVAL_COLORS[approvalStatus]}20` }}>
                        <MapPin className="w-5 h-5" style={{ color: POLE_APPROVAL_COLORS[approvalStatus] }} />
                    </div>
                    {isRenaming ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                                className="bg-slate-50 dark:bg-[#151820] border border-emerald-500/50 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 dark:text-white w-full focus:outline-none focus:ring-4 focus:ring-emerald-500/10" />
                            <button onClick={handleSaveRename} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                <Check className="w-4 h-4 text-emerald-600" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 overflow-hidden cursor-pointer" onClick={() => setIsRenaming(true)}>
                            <h3 className="font-bold text-slate-800 dark:text-white truncate text-sm">{pole.name}</h3>
                            {utilityCode && <span className="text-[10px] text-slate-400 shrink-0">({utilityCode})</span>}
                            <Edit2 className="w-3 h-3 text-slate-400 shrink-0" />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                        title={isCollapsed ? t('expand') : t('collapse')}>
                        {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
            </div>

            {!isCollapsed && (
                <>
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 dark:border-slate-700/30">
                        {tabs.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-all border-b-2
                                    ${activeTab === tab.key
                                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}
                                `}>
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="max-h-[65vh] overflow-y-auto custom-scrollbar">
                        {/* ========== DATA TAB ========== */}
                        {activeTab === 'data' && (
                            <div className="p-5 space-y-5">
                                {/* Approval Status */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        {t('pole_approval_status')}
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {APPROVAL_STATUSES.map(s => (
                                            <button key={s} onClick={() => setApprovalStatus(s)}
                                                className={`px-2 py-2 rounded-lg text-[10px] font-bold transition-all border flex items-center justify-center gap-1.5
                                                    ${approvalStatus === s
                                                        ? 'border-current shadow-sm'
                                                        : 'bg-white dark:bg-[#151820] text-slate-400 border-slate-200 dark:border-slate-700/30 hover:border-slate-300'}
                                                `}
                                                style={approvalStatus === s ? { color: POLE_APPROVAL_COLORS[s], borderColor: POLE_APPROVAL_COLORS[s], backgroundColor: `${POLE_APPROVAL_COLORS[s]}10` } : {}}>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: POLE_APPROVAL_COLORS[s] }} />
                                                {t(`pole_approval_${s}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Status + Situation row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('status')}</label>
                                        <select value={status} onChange={e => setStatus(e.target.value as PoleStatus)}
                                            className="w-full bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                            {(['PLANNED', 'ANALYSING', 'LICENSED'] as PoleStatus[]).map(s => (
                                                <option key={s} value={s}>{t(`status_${s}`)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('pole_situation')}</label>
                                        <select value={situation || ''} onChange={e => setSituation(e.target.value as PoleSituation || undefined)}
                                            className="w-full bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                            <option value="">-</option>
                                            {SITUATIONS.map(s => (
                                                <option key={s} value={s}>{t(`pole_situation_${s}`)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Utility Code + Road Side */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('pole_utility_code')}</label>
                                        <input value={utilityCode} onChange={e => setUtilityCode(e.target.value)}
                                            placeholder={t('pole_utility_code_placeholder')}
                                            className="w-full bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('pole_road_side')}</label>
                                        <select value={roadSide || ''} onChange={e => setRoadSide(e.target.value as PoleRoadSide || undefined)}
                                            className="w-full bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                            <option value="">-</option>
                                            {ROAD_SIDES.map(s => (
                                                <option key={s} value={s}>{t(`pole_road_side_${s}`)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Pole Type from Catalog */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('selection_pole_type')}</label>
                                    {loadingCatalog ? (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                                            <Loader2 className="w-3 h-3 animate-spin" /> {t('loading')}
                                        </div>
                                    ) : (
                                        <CustomSelect value={catalogId}
                                            options={polesCatalog.map(p => ({ value: p.id, label: p.name, sublabel: `${p.type} • ${p.height}m • ${p.strength}daN` }))}
                                            onChange={val => setCatalogId(val)} placeholder={t('select_pole_type')} showSearch={false} />
                                    )}
                                </div>

                                {/* Technical Info Grid */}
                                <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 space-y-2 border border-slate-100 dark:border-slate-700/30">
                                    <div className="grid grid-cols-4 gap-2">
                                        {(() => {
                                            const selected = polesCatalog.find(p => p.id === catalogId);
                                            return [
                                            { label: t('pole_height'), value: selected?.height ? `${selected.height}m` : pole.height ? `${pole.height}m` : 'N/A' },
                                            { label: t('pole_shape'), value: selected?.shape || pole.shape || 'N/A' },
                                            { label: t('pole_strength'), value: selected?.strength ? `${selected.strength}daN` : pole.strength ? `${pole.strength}daN` : 'N/A' },
                                            { label: t('type'), value: selected?.type || pole.type || 'N/A' },
                                        ].map((item, i) => (
                                            <div key={i}>
                                                <label className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase block">{item.label}</label>
                                                <div className="px-2 py-1 bg-slate-100 dark:bg-[#22262e] rounded text-[11px] text-slate-800 dark:text-slate-200 font-bold truncate">{item.value}</div>
                                            </div>
                                        ));
                                        })()}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                                        <div>Lat: {pole.coordinates.lat.toFixed(6)}</div>
                                        <div>Lng: {pole.coordinates.lng.toFixed(6)}</div>
                                    </div>
                                </div>

                                {/* Address Reference */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('pole_address_reference')}</label>
                                    <input value={addressReference} onChange={e => setAddressReference(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                </div>

                                {/* Observations */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('pole_observations')}</label>
                                    <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2}
                                        className="w-full bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
                                </div>

                                {/* Last Inspection */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t('pole_last_inspection')}</label>
                                    <input type="date" value={lastInspectionDate ? lastInspectionDate.substring(0, 10) : ''} onChange={e => setLastInspectionDate(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                </div>

                                {/* Linked Cables */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5 tracking-wider">
                                            <Share2 className="w-3 h-3" /> {t('linked_cables')}
                                        </label>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-[#22262e] text-slate-500 rounded-full">{linkedCables.length}</span>
                                    </div>
                                    {linkedCables.length === 0 ? (
                                        <div className="text-center py-3 bg-slate-50/50 dark:bg-[#22262e]/20 rounded-lg border border-dashed border-slate-200 dark:border-slate-700/30">
                                            <span className="text-[10px] text-slate-400">{t('unlinked')}</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {linkedCables.map(cable => (
                                                <div key={cable.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-[#22262e]/50 rounded-lg border border-slate-100 dark:border-slate-700/30 group">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cable.color || '#0ea5e9' }} />
                                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{cable.name}</span>
                                                    </div>
                                                    <button onClick={() => setLinkedCableIds(prev => prev.filter(id => id !== cable.id))}
                                                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                                        <Unlink className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Linked CTOs */}
                                {linkedCTOs.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5 tracking-wider">
                                            CTOs/CEOs Vinculados
                                        </label>
                                        <div className="space-y-1">
                                            {linkedCTOs.map(cto => (
                                                <div key={cto.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-[#22262e]/50 rounded-lg border border-slate-100 dark:border-slate-700/30">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cto.type === 'CEO' ? '#8b5cf6' : '#0ea5e9' }} />
                                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{cto.name}</span>
                                                    <span className="text-[10px] text-slate-400">{cto.type || 'CTO'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Save Button */}
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/30">
                                    <button onClick={handleSave} disabled={isSaving}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/10">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                        {t('apply')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ========== EQUIPMENTS TAB ========== */}
                        {activeTab === 'equipments' && (
                            <div className="p-5 space-y-4">
                                {loadingEquipments ? (
                                    <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                                ) : (
                                    <>
                                        {equipments.length === 0 ? (
                                            <div className="text-center py-6 bg-slate-50/50 dark:bg-[#22262e]/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/30">
                                                <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                                <span className="text-xs text-slate-400">{t('pole_no_equipments')}</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {equipments.map(eq => (
                                                    <div key={eq.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-[#22262e]/50 rounded-lg border border-slate-100 dark:border-slate-700/30 group">
                                                        <div className="overflow-hidden">
                                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{eq.name}</div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {t(`pole_equipment_type_${eq.type}` as any) || eq.type} • Qtd: {eq.quantity}
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleDeleteEquipment(eq.id)}
                                                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add Equipment Form */}
                                        <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 space-y-2 border border-slate-100 dark:border-slate-700/30">
                                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t('pole_equipment_add')}</label>
                                            <select value={newEquipType} onChange={e => setNewEquipType(e.target.value)}
                                                className="w-full bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none">
                                                {EQUIPMENT_TYPES.map(t2 => (
                                                    <option key={t2} value={t2}>{t(`pole_equipment_type_${t2}` as any) || t2}</option>
                                                ))}
                                            </select>
                                            <div className="grid grid-cols-3 gap-2">
                                                <input value={newEquipName} onChange={e => setNewEquipName(e.target.value)}
                                                    placeholder={t('pole_equipment_name')}
                                                    className="col-span-2 bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none" />
                                                <input type="number" min={1} value={newEquipQty} onChange={e => setNewEquipQty(parseInt(e.target.value) || 1)}
                                                    className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none text-center" />
                                            </div>
                                            <button onClick={handleAddEquipment} disabled={!newEquipName.trim()}
                                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition">
                                                <Plus className="w-3.5 h-3.5" /> {t('pole_equipment_add')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ========== PHOTOS TAB ========== */}
                        {activeTab === 'photos' && (
                            <div className="p-5 space-y-4">
                                {loadingPhotos ? (
                                    <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                                ) : (
                                    <>
                                        {photos.length === 0 ? (
                                            <div className="text-center py-6 bg-slate-50/50 dark:bg-[#22262e]/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/30">
                                                <Camera className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                                <span className="text-xs text-slate-400">{t('pole_no_photos')}</span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                {photos.map(photo => (
                                                    <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/30">
                                                        <img src={photo.url} alt={photo.caption || 'Pole photo'}
                                                            className="w-full h-24 object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="12">Erro</text></svg>'; }} />
                                                        {photo.caption && (
                                                            <div className="px-1.5 py-1 text-[10px] text-slate-600 dark:text-slate-400 truncate">{photo.caption}</div>
                                                        )}
                                                        <button onClick={() => handleDeletePhoto(photo.id)}
                                                            className="absolute top-1 right-1 p-1 bg-black/50 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add Photo Form */}
                                        <div className="bg-slate-50 dark:bg-[#22262e]/50 rounded-xl p-3 space-y-2 border border-slate-100 dark:border-slate-700/30">
                                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t('pole_photo_add')}</label>
                                            <input value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)}
                                                placeholder={t('pole_photo_url')}
                                                className="w-full bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none" />
                                            <input value={newPhotoCaption} onChange={e => setNewPhotoCaption(e.target.value)}
                                                placeholder={t('pole_photo_caption')}
                                                className="w-full bg-white dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none" />
                                            <button onClick={handleAddPhoto} disabled={!newPhotoUrl.trim()}
                                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition">
                                                <Camera className="w-3.5 h-3.5" /> {t('pole_photo_add')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ========== CHECKLIST TAB ========== */}
                        {activeTab === 'checklist' && (
                            <div className="p-5 space-y-4">
                                {loadingChecklist ? (
                                    <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                                ) : (
                                    <>
                                        {/* Progress */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-slate-100 dark:bg-[#22262e] rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(completedChecks / totalChecks) * 100}%` }} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-500">{completedChecks}/{totalChecks}</span>
                                        </div>

                                        <div className="space-y-1">
                                            {([
                                                { key: 'hasIdentification', label: t('pole_checklist_has_identification') },
                                                { key: 'hasPhoto', label: t('pole_checklist_has_photo') },
                                                { key: 'distanceVerified', label: t('pole_checklist_distance_verified') },
                                                { key: 'heightInformed', label: t('pole_checklist_height_informed') },
                                                { key: 'cableLinked', label: t('pole_checklist_cable_linked') },
                                                { key: 'ctoOrBoxLinked', label: t('pole_checklist_cto_linked') },
                                                { key: 'noElectricalConflict', label: t('pole_checklist_no_electrical_conflict') },
                                                { key: 'readyToSubmit', label: t('pole_checklist_ready_to_submit') },
                                            ] as { key: keyof PoleChecklistData; label: string }[]).map(item => (
                                                <button key={item.key}
                                                    onClick={() => handleToggleChecklist(item.key)}
                                                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all border text-left
                                                        ${checklist[item.key]
                                                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                                                            : 'bg-white dark:bg-[#151820] border-slate-200 dark:border-slate-700/30 hover:border-slate-300'}
                                                    `}>
                                                    {checklist[item.key]
                                                        ? <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                                                        : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />}
                                                    <span className={`text-xs font-medium ${checklist[item.key] ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                        {item.label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
