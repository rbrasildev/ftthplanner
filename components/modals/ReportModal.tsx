import React, { useMemo, useState } from 'react';
import { X, Download, Search, FileSpreadsheet, Building2, Share2, UtilityPole, User } from 'lucide-react';
import { CTOIcon } from '../icons/TelecomIcons';
import { CTOData, POPData, CableData, PoleData, Customer, NetworkState } from '../../types';
import { useLanguage } from '../../LanguageContext';
import { generateReportXLSX, ReportSelection } from '../../utils/reportXlsx';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: ReportSelection;     // o que caiu na área selecionada
    network: NetworkState;
    projectName: string;
}

type TabKey = 'ctos' | 'pops' | 'cables' | 'poles' | 'customers';

interface TabConfig {
    key: TabKey;
    label: string;
    icon: React.ReactNode;
    count: number;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, candidates, network, projectName }) => {
    const { t } = useLanguage();

    // Conjunto de IDs marcados, por tipo. Começa com tudo marcado.
    const initialSelected = useMemo(() => ({
        ctos: new Set(candidates.ctos.map(c => c.id)),
        pops: new Set(candidates.pops.map(p => p.id)),
        cables: new Set(candidates.cables.map(c => c.id)),
        poles: new Set(candidates.poles.map(p => p.id)),
        customers: new Set(candidates.customers.map(c => c.id)),
    }), [candidates]);
    const [selected, setSelected] = useState(initialSelected);

    // Re-inicializa quando candidates muda (nova seleção no mapa)
    React.useEffect(() => {
        setSelected(initialSelected);
        setSearch('');
    }, [initialSelected]);

    const [activeTab, setActiveTab] = useState<TabKey>('ctos');
    const [search, setSearch] = useState('');

    const tabs: TabConfig[] = useMemo(() => [
        { key: 'ctos', label: t('layer_ctos') || 'CTOs/CEOs', icon: <CTOIcon className="w-3.5 h-3.5" />, count: candidates.ctos.length },
        { key: 'pops', label: 'POPs', icon: <Building2 className="w-3.5 h-3.5" />, count: candidates.pops.length },
        { key: 'cables', label: t('layer_cables') || 'Cabos', icon: <Share2 className="w-3.5 h-3.5" />, count: candidates.cables.length },
        { key: 'poles', label: t('layer_poles') || 'Postes', icon: <UtilityPole className="w-3.5 h-3.5" />, count: candidates.poles.length },
        { key: 'customers', label: t('layer_customers') || 'Clientes', icon: <User className="w-3.5 h-3.5" />, count: candidates.customers.length },
    ], [candidates, t]);

    // Primeira aba não-vazia ao abrir
    React.useEffect(() => {
        if (!isOpen) return;
        const firstNonEmpty = tabs.find(tt => tt.count > 0);
        if (firstNonEmpty) setActiveTab(firstNonEmpty.key);
    }, [isOpen, candidates]);

    if (!isOpen) return null;

    const totalSelected =
        selected.ctos.size + selected.pops.size + selected.cables.size +
        selected.poles.size + selected.customers.size;

    const toggleId = (tab: TabKey, id: string) => {
        setSelected(prev => {
            const set = new Set(prev[tab]);
            if (set.has(id)) set.delete(id); else set.add(id);
            return { ...prev, [tab]: set };
        });
    };

    const setAllInTab = (tab: TabKey, ids: string[], on: boolean) => {
        setSelected(prev => {
            const set = new Set(on ? ids : []);
            return { ...prev, [tab]: set };
        });
    };

    const getItemsForTab = (tab: TabKey): Array<{ id: string; label: string; sub?: string }> => {
        const q = search.trim().toLowerCase();
        const filterByName = (name: string, sub?: string) => {
            if (!q) return true;
            return name.toLowerCase().includes(q) || (sub || '').toLowerCase().includes(q);
        };
        switch (tab) {
            case 'ctos':
                return candidates.ctos
                    .map(c => ({ id: c.id, label: c.name, sub: `${c.type || 'CTO'} · ${c.status}` }))
                    .filter(x => filterByName(x.label, x.sub));
            case 'pops':
                return candidates.pops
                    .map(p => ({ id: p.id, label: p.name, sub: p.status }))
                    .filter(x => filterByName(x.label, x.sub));
            case 'cables':
                return candidates.cables
                    .map(c => ({ id: c.id, label: c.name, sub: `${c.fiberCount}fo · ${c.status}` }))
                    .filter(x => filterByName(x.label, x.sub));
            case 'poles':
                return candidates.poles
                    .map(p => ({ id: p.id, label: p.name, sub: p.status }))
                    .filter(x => filterByName(x.label, x.sub));
            case 'customers':
                return candidates.customers
                    .map(c => ({ id: c.id, label: c.name, sub: c.document || c.phone || '' }))
                    .filter(x => filterByName(x.label, x.sub));
        }
    };

    const handleExport = async () => {
        const sel: ReportSelection = {
            ctos: candidates.ctos.filter(c => selected.ctos.has(c.id)),
            pops: candidates.pops.filter(p => selected.pops.has(p.id)),
            cables: candidates.cables.filter(c => selected.cables.has(c.id)),
            poles: candidates.poles.filter(p => selected.poles.has(p.id)),
            customers: candidates.customers.filter(c => selected.customers.has(c.id)),
        };
        try {
            await generateReportXLSX(sel, network, projectName);
        } catch (e) {
            console.error('XLSX export failed', e);
        }
        onClose();
    };

    const visibleItems = getItemsForTab(activeTab);
    const allTabIds = visibleItems.map(i => i.id);
    const allInTabSelected = allTabIds.length > 0 && allTabIds.every(id => selected[activeTab].has(id));

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1a1d23] w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <FileSpreadsheet className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {t('report_modal_title') || 'Relatório da Área'}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {totalSelected} {t('report_selected_total') || 'selecionados no total'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                        aria-label="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="shrink-0 flex border-b border-slate-200 dark:border-slate-700 px-2 overflow-x-auto">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.key;
                        const isDisabled = tab.count === 0;
                        return (
                            <button
                                key={tab.key}
                                disabled={isDisabled}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-colors border-b-2 whitespace-nowrap
                                    ${isActive
                                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                        : isDisabled
                                            ? 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {selected[tab.key].size}/{tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Search + Select all */}
                <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-700/50">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={allInTabSelected}
                            onChange={(e) => setAllInTab(activeTab, allTabIds, e.target.checked)}
                            className="accent-emerald-500 w-4 h-4"
                            disabled={allTabIds.length === 0}
                        />
                        {t('select_all') || 'Selecionar todos'}
                    </label>
                    <div className="flex-1 relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('search') || 'Buscar...'}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#22262e] border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
                    {visibleItems.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-xs text-slate-400">
                            {search
                                ? (t('no_results') || 'Nenhum resultado')
                                : (t('report_no_items_in_tab') || 'Nenhum item nesta aba')}
                        </div>
                    ) : (
                        visibleItems.map(item => {
                            const isChecked = selected[activeTab].has(item.id);
                            return (
                                <label
                                    key={item.id}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleId(activeTab, item.id)}
                                        className="accent-emerald-500 w-4 h-4 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.label}</div>
                                        {item.sub && (
                                            <div className="text-[10px] text-slate-400 truncate">{item.sub}</div>
                                        )}
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        {t('cancel') || 'Cancelar'}
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={totalSelected === 0}
                        className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm
                            ${totalSelected === 0
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                    >
                        <Download className="w-3.5 h-3.5" />
                        {t('report_export_xlsx') || 'Exportar XLSX'} ({totalSelected})
                    </button>
                </div>
            </div>
        </div>
    );
};
