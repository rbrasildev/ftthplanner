import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Download, MapPin, ChevronDown, ChevronUp, FileText, Loader2 } from 'lucide-react';
import {
    PoleData, PoleApprovalStatus, POLE_APPROVAL_COLORS,
    PoleSituation, POLE_SITUATION_COLORS, CableData, CTOData
} from '../types';
import { useLanguage } from '../LanguageContext';
import { exportPolesToCSV, exportPoleReportPDF } from '../utils/poleExportUtils';
import { getPoles as getCatalogPoles, PoleCatalogItem } from '../services/catalogService';

type PoleFilter = 'all' | 'irregular' | 'new' | 'no_photo' | 'pending' | 'approved';

interface PoleTableViewProps {
    poles: PoleData[];
    cables: CableData[];
    ctos: CTOData[];
    projectName?: string;
    onSelectPole: (poleId: string) => void;
    onClose: () => void;
}

export const PoleTableView: React.FC<PoleTableViewProps> = ({
    poles, cables, ctos, projectName = 'Projeto FTTH', onSelectPole, onClose
}) => {
    const { t } = useLanguage();
    const [filter, setFilter] = useState<PoleFilter>('all');
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [catalog, setCatalog] = useState<PoleCatalogItem[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(true);

    useEffect(() => {
        getCatalogPoles().then(data => setCatalog(data)).catch(() => {}).finally(() => setLoadingCatalog(false));
    }, []);

    const catalogMap = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);

    const getPoleType = (pole: PoleData) => {
        if (pole.type) return pole.type;
        if (pole.catalogId) return catalogMap.get(pole.catalogId)?.type || '-';
        return '-';
    };

    const getPoleHeight = (pole: PoleData) => {
        if (pole.height) return `${pole.height}m`;
        if (pole.catalogId) {
            const h = catalogMap.get(pole.catalogId)?.height;
            return h ? `${h}m` : '-';
        }
        return '-';
    };

    const filters: { key: PoleFilter; label: string; color?: string }[] = [
        { key: 'all', label: 'Todos' },
        { key: 'irregular', label: t('pole_approval_IRREGULAR'), color: '#ef4444' },
        { key: 'pending', label: t('pole_approval_PENDING'), color: '#eab308' },
        { key: 'approved', label: t('pole_approval_APPROVED'), color: '#22c55e' },
        { key: 'new', label: t('pole_situation_NEW'), color: '#3b82f6' },
        { key: 'no_photo', label: 'Sem Foto', color: '#94a3b8' },
    ];

    const filteredPoles = useMemo(() => {
        let result = [...poles];

        // Apply filter
        switch (filter) {
            case 'irregular': result = result.filter(p => p.approvalStatus === 'IRREGULAR'); break;
            case 'pending': result = result.filter(p => !p.approvalStatus || p.approvalStatus === 'PENDING'); break;
            case 'approved': result = result.filter(p => p.approvalStatus === 'APPROVED'); break;
            case 'new': result = result.filter(p => p.situation === 'NEW'); break;
            case 'no_photo': result = result.filter(p => !p.hasPhoto); break;
        }

        // Apply search
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.utilityCode && p.utilityCode.toLowerCase().includes(q)) ||
                (p.addressReference && p.addressReference.toLowerCase().includes(q))
            );
        }

        // Apply sort
        result.sort((a, b) => {
            let va: any = (a as any)[sortField] || '';
            let vb: any = (b as any)[sortField] || '';
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [poles, filter, search, sortField, sortDir]);

    const toggleSort = (field: string) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const getLinkedCablesInfo = (pole: PoleData) => {
        const linked = cables.filter(c => pole.linkedCableIds?.includes(c.id));
        return linked.length > 0 ? linked.map(c => c.name).join(', ') : '-';
    };

    const getLinkedCTOInfo = (pole: PoleData) => {
        const linked = ctos.filter(c => c.poleId === pole.id);
        return linked.length > 0 ? linked.map(c => c.name).join(', ') : '-';
    };

    // Summary stats
    const stats = useMemo(() => ({
        total: poles.length,
        approved: poles.filter(p => p.approvalStatus === 'APPROVED').length,
        pending: poles.filter(p => !p.approvalStatus || p.approvalStatus === 'PENDING').length,
        irregular: poles.filter(p => p.approvalStatus === 'IRREGULAR').length,
        newPoles: poles.filter(p => p.situation === 'NEW').length,
    }), [poles]);

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return null;
        return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
    };

    return (
        <div className="fixed inset-4 top-16 bg-white dark:bg-[#1a1d23] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/30 z-[2000] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                    <h2 className="font-bold text-slate-800 dark:text-white text-sm">
                        Tabela de Postes
                    </h2>
                    <div className="flex gap-2 ml-4">
                        {[
                            { label: 'Total', value: stats.total, color: '#6b7280' },
                            { label: t('pole_approval_APPROVED'), value: stats.approved, color: '#22c55e' },
                            { label: t('pole_approval_PENDING'), value: stats.pending, color: '#eab308' },
                            { label: t('pole_approval_IRREGULAR'), value: stats.irregular, color: '#ef4444' },
                            { label: t('pole_situation_NEW'), value: stats.newPoles, color: '#3b82f6' },
                        ].map(s => (
                            <span key={s.label} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.value}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => exportPolesToCSV(poles, cables, ctos)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition">
                        <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button onClick={() => exportPoleReportPDF(poles, cables, ctos, projectName)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition">
                        <FileText className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/30 flex items-center gap-3 shrink-0">
                <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar poste..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#151820] border border-slate-200 dark:border-slate-700/30 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div className="flex gap-1">
                    {filters.map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1
                                ${filter === f.key
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-white dark:bg-[#151820] text-slate-400 border-slate-200 dark:border-slate-700/30 hover:border-slate-300'}
                            `}>
                            {f.color && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }} />}
                            {f.label}
                        </button>
                    ))}
                </div>
                <span className="text-[10px] text-slate-400 font-bold">{filteredPoles.length} postes</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                {loadingCatalog ? (
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="flex gap-3 animate-pulse">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700/40 rounded w-28" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-700/40 rounded w-20" />
                                <div className="h-4 bg-slate-100 dark:bg-slate-700/20 rounded w-24" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-700/40 rounded w-16" />
                                <div className="h-4 bg-slate-100 dark:bg-slate-700/20 rounded w-20" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-700/40 rounded w-20" />
                                <div className="h-4 bg-slate-100 dark:bg-slate-700/20 rounded w-32" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-700/40 rounded w-24" />
                                <div className="h-4 bg-slate-100 dark:bg-slate-700/20 rounded w-14" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-700/40 rounded w-24" />
                                <div className="h-4 bg-slate-100 dark:bg-slate-700/20 rounded w-24" />
                            </div>
                        ))}
                    </div>
                ) : (
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-[#22262e] z-10">
                        <tr className="text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {[
                                { field: 'name', label: 'Poste', width: 'w-28' },
                                { field: 'utilityCode', label: 'Cód. Conc.', width: 'w-24' },
                                { field: 'type', label: 'Tipo', width: 'w-20' },
                                { field: 'height', label: 'Altura', width: 'w-16' },
                                { field: 'situation', label: t('pole_situation'), width: 'w-24' },
                                { field: 'approvalStatus', label: 'Aprovação', width: 'w-24' },
                                { field: '', label: 'Cabo', width: 'w-32' },
                                { field: '', label: 'CTO/Caixa', width: 'w-28' },
                                { field: 'roadSide', label: 'Lado', width: 'w-16' },
                                { field: '', label: 'Latitude', width: 'w-24' },
                                { field: '', label: 'Longitude', width: 'w-24' },
                            ].map(col => (
                                <th key={col.label} className={`px-3 py-2.5 ${col.width} ${col.field ? 'cursor-pointer hover:text-slate-600 select-none' : ''}`}
                                    onClick={() => col.field && toggleSort(col.field)}>
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {col.field && <SortIcon field={col.field} />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/20">
                        {filteredPoles.map(pole => (
                            <tr key={pole.id}
                                onClick={() => onSelectPole(pole.id)}
                                className="hover:bg-slate-50 dark:hover:bg-[#22262e]/50 cursor-pointer transition-colors">
                                <td className="px-3 py-2">
                                    <div className="font-bold text-slate-700 dark:text-slate-300 truncate">{pole.name}</div>
                                </td>
                                <td className="px-3 py-2 text-slate-500">{pole.utilityCode || '-'}</td>
                                <td className="px-3 py-2 text-slate-500">{getPoleType(pole)}</td>
                                <td className="px-3 py-2 text-slate-500">{getPoleHeight(pole)}</td>
                                <td className="px-3 py-2">
                                    {pole.situation ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                            style={{ backgroundColor: `${POLE_SITUATION_COLORS[pole.situation]}15`, color: POLE_SITUATION_COLORS[pole.situation] }}>
                                            {t(`pole_situation_${pole.situation}`)}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td className="px-3 py-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                        style={{
                                            backgroundColor: `${POLE_APPROVAL_COLORS[pole.approvalStatus || 'PENDING']}15`,
                                            color: POLE_APPROVAL_COLORS[pole.approvalStatus || 'PENDING']
                                        }}>
                                        {t(`pole_approval_${pole.approvalStatus || 'PENDING'}`)}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-slate-500 truncate max-w-[8rem]">{getLinkedCablesInfo(pole)}</td>
                                <td className="px-3 py-2 text-slate-500 truncate max-w-[7rem]">{getLinkedCTOInfo(pole)}</td>
                                <td className="px-3 py-2 text-slate-500">{pole.roadSide ? t(`pole_road_side_${pole.roadSide}`) : '-'}</td>
                                <td className="px-3 py-2 text-slate-500">{pole.coordinates.lat.toFixed(6)}</td>
                                <td className="px-3 py-2 text-slate-500">{pole.coordinates.lng.toFixed(6)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
                {!loadingCatalog && filteredPoles.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm">Nenhum poste encontrado</div>
                )}
            </div>
        </div>
    );
};
