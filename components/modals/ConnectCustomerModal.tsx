import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { CTOData, Customer } from '../../types';
import { Network, Server, Router, Unplug, X } from 'lucide-react';

interface ConnectCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (ctoId: string, splitterId: string | null, portIndex: number | null) => void;
    cto: CTOData | null;
    allCustomers: Customer[];
}

export const ConnectCustomerModal: React.FC<ConnectCustomerModalProps> = ({ isOpen, onClose, onConnect, cto, allCustomers }) => {
    const { t } = useLanguage();
    const [selectedSplitterId, setSelectedSplitterId] = useState<string>('none');
    const [selectedPortIndex, setSelectedPortIndex] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setSelectedSplitterId('none');
            setSelectedPortIndex('');
            if (cto?.splitters && cto.splitters.length > 0) {
                // Ensure we only consider splitters that explicitly allow connections (or are undefined which defaults to true)
                const validSplitters = cto.splitters.filter(s => s.allowCustomConnections !== false);
                if (validSplitters.length > 0) {
                    setSelectedSplitterId(validSplitters[0].id);
                } else {
                    setSelectedSplitterId('none');
                }
            }
        }
    }, [isOpen, cto]);

    const handleConnect = () => {
        if (!cto) return;
        const splitterId = selectedSplitterId === 'none' ? null : selectedSplitterId;
        const portIndex = selectedPortIndex ? parseInt(selectedPortIndex) : null;
        onConnect(cto.id, splitterId, portIndex);
    };

    if (!isOpen || !cto) return null;

    const currentSplitter = cto.splitters.find(s => s.id === selectedSplitterId);

    // Parse splitter type to get total ports (e.g. "1x8" -> 8)
    // Default to 16 if parsing fails, but ideally should be accurate
    const splitterCapacity = currentSplitter ? parseInt(currentSplitter.type.split('x')[1] || '16') : 0;
    const availablePorts = currentSplitter ? Array.from({ length: splitterCapacity }, (_, i) => i) : [];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
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
                <div className="p-5 space-y-6 overflow-y-auto">

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

                    {/* Splitter Selection */}
                    {cto.splitters.length > 0 ? (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                                <Network className="w-3 h-3" />
                                {t('select_splitter')}
                            </label>
                            <select
                                className="w-full p-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={selectedSplitterId}
                                onChange={(e) => setSelectedSplitterId(e.target.value)}
                            >
                                {cto.splitters.map(s => (
                                    <option key={s.id} value={s.id} disabled={s.allowCustomConnections === false}>
                                        {s.name} ({s.type}) {s.allowCustomConnections === false ? ` - ${t('connector_blocked')}` : ''}
                                    </option>
                                ))}
                            </select>
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
                                    // Check occupancy
                                    const occupant = allCustomers.find(c =>
                                        c.ctoId === cto.id &&
                                        c.splitterId === currentSplitter.id &&
                                        c.splitterPortIndex === portIndex
                                    );

                                    const isOccupied = !!occupant;
                                    const isSelected = selectedPortIndex === portIndex.toString();

                                    return (
                                        <button
                                            key={portIndex}
                                            disabled={isOccupied}
                                            onClick={() => setSelectedPortIndex(portIndex.toString())}
                                            title={isOccupied ? t('error_port_occupied_desc', { name: occupant.name }) : t('port_free')}
                                            className={`
                                                relative h-10 rounded border text-xs font-bold transition-all flex items-center justify-center
                                                ${isOccupied
                                                    ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-300 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200 dark:ring-indigo-900 z-10 scale-105'
                                                        : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:text-indigo-600 text-slate-700 dark:text-slate-300'
                                                }
                                            `}
                                        >
                                            {portIndex + 1}
                                            {isOccupied && (
                                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-400 rounded-full border border-white dark:border-slate-900" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Occupant Legend/Info */}
                            <div className="text-xs text-slate-500 min-h-[1.5em] mt-1 pl-1">
                                {(() => {
                                    if (selectedPortIndex !== '') {
                                        // Selected state
                                        return <span className="text-indigo-600 font-medium">{t('selected_port_info', { port: parseInt(selectedPortIndex) + 1 })}</span>
                                    }
                                    return <span className="text-slate-400 italic">{t('select_free_port')}</span>
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleConnect}
                        disabled={!currentSplitter || !selectedPortIndex}
                        className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {t('confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};
