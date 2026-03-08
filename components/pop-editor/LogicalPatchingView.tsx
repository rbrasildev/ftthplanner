import React, { useState, useMemo } from 'react';
import { POPData, FiberConnection, OLT, DIO } from '../../types';
import { Network, Zap, Server, Trash2, ArrowRight, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

interface LogicalPatchingViewProps {
    localPOP: POPData;
    onAddConnection: (sourceId: string, targetId: string) => void;
    onRemoveConnection: (sourceId: string, targetId: string) => void;
}

export const LogicalPatchingView: React.FC<LogicalPatchingViewProps> = ({
    localPOP,
    onAddConnection,
    onRemoveConnection
}) => {
    const { t } = useLanguage();
    const [selectedPortA, setSelectedPortA] = useState<string | null>(null);

    // Accordion States
    const [collapsedOLTs, setCollapsedOLTs] = useState<Set<string>>(new Set());
    const [collapsedDIOs, setCollapsedDIOs] = useState<Set<string>>(new Set());

    const toggleOLT = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedOLTs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleDIO = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsedDIOs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Get connection map for fast lookup: { portId: targetPortId }
    const connectionMap = useMemo(() => {
        const map: Record<string, string> = {};
        localPOP.connections.forEach(c => {
            map[c.sourceId] = c.targetId;
            map[c.targetId] = c.sourceId; // Bidirectional
        });
        return map;
    }, [localPOP.connections]);

    const handlePortClick = (portId: string, type: 'OLT' | 'DIO') => {
        if (!selectedPortA) {
            setSelectedPortA(portId);
        } else {
            // Prevent same-side connection (OLT-OLT or DIO-DIO) temporarily
            const isOlt1 = localPOP.olts.some(o => o.portIds.includes(selectedPortA));
            const isOlt2 = localPOP.olts.some(o => o.portIds.includes(portId));

            if (isOlt1 === isOlt2) {
                // Ignore or just change selection
                setSelectedPortA(portId);
                return;
            }

            // Execute Patch
            const source = isOlt1 ? selectedPortA : portId;
            const target = isOlt1 ? portId : selectedPortA;

            // Optional: check if already connected
            if (connectionMap[source] && connectionMap[source] !== target) {
                // Replace connection logic handled by parent or just remove old first
                onRemoveConnection(source, connectionMap[source]);
            }
            if (connectionMap[target] && connectionMap[target] !== source) {
                onRemoveConnection(connectionMap[target], target);
            }

            if (connectionMap[source] === target) {
                onRemoveConnection(source, target);
            } else {
                onAddConnection(source, target);
            }

            setSelectedPortA(null);
        }
    };

    return (
        <div className="flex-1 w-full h-full bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col pointer-events-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Network className="text-indigo-500 w-5 h-5" />
                    {t('patching_matrix') || 'Matriz de Manobra (Patching)'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('patching_instruct') || 'Selecione uma porta na OLT e depois no DIO para criar ou remover o cordão óptico.'}
                </p>
                {selectedPortA && (
                    <div className="mt-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 rounded-lg text-sm text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-2 animate-pulse">
                        <ArrowRight className="w-4 h-4" /> Selecionado: {selectedPortA}. Aguardando Lado B...
                        <button onClick={() => setSelectedPortA(null)} className="ml-auto text-xs bg-indigo-200 dark:bg-indigo-800 px-2 py-1 rounded hover:bg-indigo-300 dark:hover:bg-indigo-700">Cancelar</button>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Lado A: OLTs */}
                <div className="flex-1 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto custom-scrollbar">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-500" /> OLTs (Ativos)
                    </h4>
                    <div className="flex flex-col gap-6">
                        {localPOP.olts.length === 0 && <p className="text-slate-400 text-sm italic">Nenhuma OLT no POP</p>}
                        {localPOP.olts.map(olt => {
                            const portsPerSlot = olt.structure?.portsPerSlot || 16;
                            const totalSlots = Math.ceil(olt.ports / portsPerSlot);

                            return (
                                <div key={olt.id} className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <button
                                        onClick={(e) => toggleOLT(olt.id, e)}
                                        className="w-full bg-slate-100 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center">
                                            <span>{olt.name}</span>
                                            <span className="text-xs font-normal text-slate-500 ml-2">({olt.ports} portas)</span>
                                        </div>
                                        {collapsedOLTs.has(olt.id) ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </button>

                                    {!collapsedOLTs.has(olt.id) && (
                                        <div className="p-4 space-y-4">
                                            {Array.from({ length: totalSlots }).map((_, slotIdx) => {
                                                const startIdx = slotIdx * portsPerSlot;
                                                const slotPorts = olt.portIds.slice(startIdx, startIdx + portsPerSlot);

                                                if (slotPorts.length === 0) return null;

                                                return (
                                                    <div key={slotIdx} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                                        <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 uppercase flex items-center gap-2">
                                                            <Server className="w-3 h-3 text-emerald-500" /> Slot {slotIdx + 1}
                                                        </div>
                                                        <div className="p-3 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 bg-white dark:bg-slate-900/30">
                                                            {slotPorts.map((pId, localIdx) => {
                                                                const absoluteIndex = startIdx + localIdx;
                                                                const isConnected = !!connectionMap[pId];
                                                                const isSelected = selectedPortA === pId;
                                                                const targetId = connectionMap[pId];

                                                                return (
                                                                    <button
                                                                        key={pId}
                                                                        onClick={() => handlePortClick(pId, 'OLT')}
                                                                        className={`
                                                                            h-10 rounded-md border text-xs font-bold transition-all relative group
                                                                            ${isSelected ? 'bg-indigo-500 text-white border-indigo-600 shadow-inner' :
                                                                                isConnected ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:border-emerald-500' :
                                                                                    'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-white dark:hover:bg-slate-800'}
                                                                        `}
                                                                        title={isConnected ? `Conectado a ${targetId}` : `Porta Livre`}
                                                                    >
                                                                        {absoluteIndex + 1}
                                                                        {isConnected && !isSelected && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>}

                                                                        {/* Tooltip on hover */}
                                                                        {isConnected && (
                                                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                                                \u2192 {targetId.split('-p')[1]}
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Lado B: DIOs */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <Server className="w-4 h-4 text-blue-500" /> DIOs (Passivos)
                    </h4>
                    <div className="flex flex-col gap-6">
                        {localPOP.dios.length === 0 && <p className="text-slate-400 text-sm italic">Nenhum DIO no POP</p>}
                        {localPOP.dios.map(dio => {
                            const PORTS_PER_TRAY = 12;
                            const totalTrays = Math.ceil(dio.ports / PORTS_PER_TRAY);

                            return (
                                <div key={dio.id} className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <button
                                        onClick={(e) => toggleDIO(dio.id, e)}
                                        className="w-full bg-slate-100 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center">
                                            <span>{dio.name}</span>
                                            <span className="text-xs font-normal text-slate-500 ml-2">({dio.ports} portas)</span>
                                        </div>
                                        {collapsedDIOs.has(dio.id) ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </button>

                                    {!collapsedDIOs.has(dio.id) && (
                                        <div className="p-4 space-y-4">
                                            {Array.from({ length: totalTrays }).map((_, trayIdx) => {
                                                const startIdx = trayIdx * PORTS_PER_TRAY;
                                                const trayPorts = dio.portIds.slice(startIdx, startIdx + PORTS_PER_TRAY);

                                                if (trayPorts.length === 0) return null;

                                                return (
                                                    <div key={trayIdx} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                                        <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 uppercase flex items-center gap-2">
                                                            <Layers className="w-3 h-3 text-blue-500" /> Bandeja {trayIdx + 1}
                                                        </div>
                                                        <div className="p-3 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 bg-white dark:bg-slate-900/30">
                                                            {trayPorts.map((pId, localIdx) => {
                                                                const absoluteIndex = startIdx + localIdx;
                                                                const isConnected = !!connectionMap[pId];
                                                                const isSelected = selectedPortA === pId;
                                                                const targetId = connectionMap[pId];

                                                                return (
                                                                    <button
                                                                        key={pId}
                                                                        onClick={() => handlePortClick(pId, 'DIO')}
                                                                        className={`
                                                                            h-10 rounded-[4px] border text-xs font-bold transition-all relative group
                                                                            ${isSelected ? 'bg-indigo-500 text-white border-indigo-600 shadow-inner' :
                                                                                isConnected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:border-blue-500' :
                                                                                    'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-white dark:hover:bg-slate-800'}
                                                                        `}
                                                                        title={isConnected ? `Conectado a ${targetId}` : `Porta Livre`}
                                                                    >
                                                                        {absoluteIndex + 1}
                                                                        {isConnected && !isSelected && <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_3px_rgba(59,130,246,0.5)]"></div>}

                                                                        {isConnected && (
                                                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                                                                \u2192 OLT: {targetId.split('-p')[1]}
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
