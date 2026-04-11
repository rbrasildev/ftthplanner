import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { CTOData, Customer } from '../../types';
import { Network, Server, Router, Unplug, X, Loader2, Zap } from 'lucide-react';
import { getSplitterPortCount } from '../../utils/splitterUtils';

type AttachmentMode = 'splitter' | 'connector';

interface ConnectPayload {
    splitterId?: string | null;
    splitterPortIndex?: number | null;
    connectorId?: string | null;
}

interface ConnectCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (ctoId: string, payload: ConnectPayload) => void;
    cto: CTOData | null;
    allCustomers: Customer[];
    customerId?: string;
}

export const ConnectCustomerModal: React.FC<ConnectCustomerModalProps> = ({ isOpen, onClose, onConnect, cto, allCustomers, customerId }) => {
    const { t } = useLanguage();
    const [mode, setMode] = useState<AttachmentMode>('splitter');
    const [selectedSplitterId, setSelectedSplitterId] = useState<string>('none');
    const [selectedPortIndex, setSelectedPortIndex] = useState<string>('');
    const [selectedConnectorId, setSelectedConnectorId] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(false);

    // Connectors are FusionPoints in cto.fusions with category === 'connector'.
    const connectors = (cto?.fusions || []).filter(f => f.category === 'connector');

    useEffect(() => {
        if (!isOpen || !cto) return;

        // Reset state on open.
        setSelectedPortIndex('');
        setSelectedConnectorId('');

        const currentCustomer = customerId ? allCustomers.find(c => c.id === customerId) : null;
        const alreadyHere = currentCustomer && currentCustomer.ctoId === cto.id;

        // Pre-select whichever attachment the customer already has on this CTO.
        if (alreadyHere && currentCustomer.connectorId) {
            const stillExists = connectors.some(c => c.id === currentCustomer.connectorId);
            if (stillExists) {
                setMode('connector');
                setSelectedConnectorId(currentCustomer.connectorId);
                setSelectedSplitterId('none');
                return;
            }
        }

        if (alreadyHere && currentCustomer.splitterId) {
            const existingSplitter = cto.splitters.find(s => s.id === currentCustomer.splitterId && s.allowCustomConnections !== false);
            if (existingSplitter) {
                setMode('splitter');
                setSelectedSplitterId(existingSplitter.id);
                if (currentCustomer.splitterPortIndex !== null && currentCustomer.splitterPortIndex !== undefined) {
                    setSelectedPortIndex(String(currentCustomer.splitterPortIndex));
                }
                return;
            }
        }

        // Default: splitter tab, first valid splitter selected (or none).
        const validSplitters = cto.splitters?.filter(s => s.allowCustomConnections !== false) || [];
        if (validSplitters.length > 0) {
            setMode('splitter');
            setSelectedSplitterId(validSplitters[0].id);
        } else if (connectors.length > 0) {
            // No usable splitter but there are connectors — start on connector tab.
            setMode('connector');
            setSelectedSplitterId('none');
        } else {
            setMode('splitter');
            setSelectedSplitterId('none');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, cto, customerId, allCustomers]);

    const handleConnect = async () => {
        if (!cto) return;
        setIsConnecting(true);
        try {
            if (mode === 'connector') {
                await onConnect(cto.id, { connectorId: selectedConnectorId || null, splitterId: null, splitterPortIndex: null });
            } else {
                const splitterId = selectedSplitterId === 'none' ? null : selectedSplitterId;
                const portIndex = selectedPortIndex ? parseInt(selectedPortIndex) : null;
                await onConnect(cto.id, { splitterId, splitterPortIndex: portIndex, connectorId: null });
            }
        } finally {
            setIsConnecting(false);
        }
    };

    if (!isOpen || !cto) return null;

    const currentSplitter = cto.splitters.find(s => s.id === selectedSplitterId);
    const splitterCapacity = getSplitterPortCount(currentSplitter);
    const availablePorts = currentSplitter ? Array.from({ length: splitterCapacity }, (_, i) => i) : [];

    // Customer being (re)connected — used to highlight their current port/connector.
    const currentCustomer = customerId ? allCustomers.find(c => c.id === customerId) : null;

    const canConfirm = mode === 'connector'
        ? !!selectedConnectorId
        : (!!currentSplitter && selectedPortIndex !== '');

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1a1d23] rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700/30 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-[#22262e]/50 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Unplug className="w-5 h-5 text-indigo-500" />
                            {t('connect_customer_title')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {t('connect_customer_desc')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-5 overflow-y-auto">

                    {/* CTO Info Card */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">{t('target_cto')}</div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
                                <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 dark:text-slate-100 text-lg">{cto.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">ID: {cto.id.substring(0, 8)}...</div>
                            </div>
                        </div>
                    </div>

                    {/* MODE TABS — splitter vs connector */}
                    <div className="flex bg-slate-100 dark:bg-[#22262e] p-1 rounded-lg gap-1">
                        <button
                            onClick={() => setMode('splitter')}
                            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                                mode === 'splitter'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <Network className="w-3.5 h-3.5" />
                            {t('splitter') || 'Splitter'}
                        </button>
                        <button
                            onClick={() => setMode('connector')}
                            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                                mode === 'connector'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <Zap className="w-3.5 h-3.5" />
                            {t('connector') || 'Conector'} ({connectors.length})
                        </button>
                    </div>

                    {/* SPLITTER MODE */}
                    {mode === 'splitter' && (
                        <>
                            {/* Splitter Selection */}
                            {cto.splitters.length > 0 ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                                        <Network className="w-3 h-3" />
                                        {t('select_splitter')}
                                    </label>
                                    {cto.splitters.every(s => s.allowCustomConnections === false) ? (
                                        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800 flex gap-2 items-start">
                                            <X className="w-4 h-4 mt-0.5" />
                                            <div>{t('no_valid_splitters_error') || "Nenhum splitter nesta CTO permite conexões de clientes."}</div>
                                        </div>
                                    ) : (
                                        <select
                                            className="w-full p-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#22262e] text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            value={selectedSplitterId}
                                            onChange={(e) => { setSelectedSplitterId(e.target.value); setSelectedPortIndex(''); }}
                                        >
                                            <option value="none" disabled>{t('select')}</option>
                                            {cto.splitters.filter(s => s.allowCustomConnections !== false).map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.type})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800 flex gap-2 items-start">
                                    <div className="mt-0.5">⚠️</div>
                                    <div>{t('no_splitters_found_error')}</div>
                                </div>
                            )}

                            {/* Port Selection Grid */}
                            {currentSplitter && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                                            <Router className="w-3 h-3" />
                                            {t('select_port')}
                                        </label>
                                        <span className="text-xs text-slate-400">
                                            {t('ports_total', { count: availablePorts.length })}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
                                        {availablePorts.map(portIndex => {
                                            const occupant = allCustomers.find(c =>
                                                c.ctoId === cto.id &&
                                                c.splitterId === currentSplitter.id &&
                                                c.splitterPortIndex === portIndex &&
                                                c.id !== customerId
                                            );

                                            const isOccupied = !!occupant;
                                            const isSelected = selectedPortIndex === portIndex.toString();
                                            const isCurrentOwn = !!currentCustomer
                                                && currentCustomer.ctoId === cto.id
                                                && currentCustomer.splitterId === currentSplitter.id
                                                && currentCustomer.splitterPortIndex === portIndex;

                                            return (
                                                <button
                                                    key={portIndex}
                                                    disabled={isOccupied}
                                                    onClick={() => setSelectedPortIndex(portIndex.toString())}
                                                    title={
                                                        isOccupied
                                                            ? t('error_port_occupied_desc', { name: occupant.name })
                                                            : isCurrentOwn
                                                                ? t('port_current_own') || 'Porta atual deste cliente'
                                                                : t('port_free')
                                                    }
                                                    className={`
                                                        relative h-10 rounded border text-xs font-bold transition-all flex items-center justify-center
                                                        ${isOccupied
                                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-300 cursor-not-allowed'
                                                            : isSelected
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200 dark:ring-indigo-900 z-10 scale-105'
                                                                : isCurrentOwn
                                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500'
                                                                    : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:text-indigo-600 text-slate-700 dark:text-slate-300'
                                                        }
                                                    `}
                                                >
                                                    {portIndex + 1}
                                                    {isOccupied && (
                                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-400 rounded-full border border-white dark:border-slate-900" />
                                                    )}
                                                    {isCurrentOwn && !isOccupied && (
                                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-slate-900" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="text-xs text-slate-500 min-h-[1.5em] mt-1 pl-1">
                                        {(() => {
                                            if (selectedPortIndex !== '') {
                                                const isCurrent = !!currentCustomer
                                                    && currentCustomer.ctoId === cto.id
                                                    && currentCustomer.splitterId === currentSplitter.id
                                                    && currentCustomer.splitterPortIndex === parseInt(selectedPortIndex);
                                                if (isCurrent) {
                                                    return <span className="text-emerald-600 font-medium">{t('selected_port_current', { port: parseInt(selectedPortIndex) + 1 }) || `Porta ${parseInt(selectedPortIndex) + 1} (atual)`}</span>
                                                }
                                                return <span className="text-indigo-600 font-medium">{t('selected_port_info', { port: parseInt(selectedPortIndex) + 1 })}</span>
                                            }
                                            return <span className="text-slate-400 italic">{t('select_free_port')}</span>
                                        })()}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* CONNECTOR MODE */}
                    {mode === 'connector' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                                <Zap className="w-3 h-3" />
                                {t('select_connector') || 'Selecionar Conector'}
                            </label>
                            {connectors.length === 0 ? (
                                <div className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800 flex gap-2 items-start">
                                    <div className="mt-0.5">⚠️</div>
                                    <div>{t('no_connectors_in_cto') || 'Esta CTO não possui conectores. Adicione um conector no editor da CTO.'}</div>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                                        {connectors.map(conn => {
                                            const occupant = allCustomers.find(c =>
                                                c.ctoId === cto.id &&
                                                c.connectorId === conn.id &&
                                                c.id !== customerId
                                            );
                                            const isOccupied = !!occupant;
                                            const isSelected = selectedConnectorId === conn.id;
                                            const isCurrentOwn = !!currentCustomer
                                                && currentCustomer.ctoId === cto.id
                                                && currentCustomer.connectorId === conn.id;
                                            const isAPC = conn.polishType === 'APC';

                                            return (
                                                <button
                                                    key={conn.id}
                                                    disabled={isOccupied}
                                                    onClick={() => setSelectedConnectorId(conn.id)}
                                                    title={
                                                        isOccupied
                                                            ? t('error_connector_occupied_desc', { name: occupant.name }) || `Ocupado por ${occupant.name}`
                                                            : isCurrentOwn
                                                                ? t('connector_current_own') || 'Conector atual deste cliente'
                                                                : (conn.name || 'Conector')
                                                    }
                                                    className={`
                                                        relative h-14 rounded border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 px-1
                                                        ${isOccupied
                                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-300 cursor-not-allowed'
                                                            : isSelected
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200 dark:ring-indigo-900 z-10 scale-105'
                                                                : isCurrentOwn
                                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500'
                                                                    : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:text-indigo-600 text-slate-700 dark:text-slate-300'
                                                        }
                                                    `}
                                                >
                                                    <span className={`w-2.5 h-2.5 rounded-[1px] ${isAPC ? 'bg-green-500' : 'bg-blue-500'}`} />
                                                    <span className="truncate max-w-full leading-tight">{conn.name}</span>
                                                    {isOccupied && (
                                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-400 rounded-full border border-white dark:border-slate-900" />
                                                    )}
                                                    {isCurrentOwn && !isOccupied && (
                                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-slate-900" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="text-xs text-slate-500 min-h-[1.5em] mt-1 pl-1">
                                        {(() => {
                                            if (selectedConnectorId) {
                                                const conn = connectors.find(c => c.id === selectedConnectorId);
                                                const isCurrent = !!currentCustomer
                                                    && currentCustomer.ctoId === cto.id
                                                    && currentCustomer.connectorId === selectedConnectorId;
                                                if (isCurrent) {
                                                    return <span className="text-emerald-600 font-medium">{conn?.name} ({t('current') || 'atual'})</span>
                                                }
                                                return <span className="text-indigo-600 font-medium">{conn?.name}</span>
                                            }
                                            return <span className="text-slate-400 italic">{t('select_free_connector') || 'Selecione um conector livre'}</span>
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 bg-slate-50 dark:bg-[#22262e]/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleConnect}
                        disabled={!canConfirm || isConnecting}
                        className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
                    >
                        {isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isConnecting ? t('saving') || 'Salvando...' : t('confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};
