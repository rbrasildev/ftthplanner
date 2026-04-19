import React, { useState, useMemo, useEffect } from 'react';
import { POPData, CableData, FiberConnection, DIO } from '../types';
import { X, Save, AlertCircle, Link2, Search, Check, Cable as CableIcon, Split, Ruler, Flashlight } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { CustomInput } from './common/CustomInput';
import { LogicalSplicingView } from './pop-editor/LogicalSplicingView';

interface DIOEditorProps {
    dio: DIO;
    pop: POPData;
    incomingCables: CableData[];
    onClose: () => void;
    onSave: (updatedConnections: FiberConnection[]) => void;
    onUpdateDio?: (updatedDio: DIO) => void;
    onUpdateConnections?: (updatedConnections: FiberConnection[]) => void;

    // VFL Props
    litPorts?: Set<string>;
    vflSource?: string | null;
    onToggleVfl?: (portId: string) => void;

    // OTDR Prop
    onOtdrTrace?: (portId: string, distance: number) => void;

    // Layout
    isSidebarCollapsed?: boolean;
}

export const DIOEditor: React.FC<DIOEditorProps> = ({
    dio,
    pop,
    incomingCables,
    onClose,
    onSave,
    onUpdateDio,
    onUpdateConnections,
    litPorts,
    vflSource,
    onToggleVfl,
    onOtdrTrace,
    isSidebarCollapsed = false
}) => {
    const { t } = useLanguage();
    const [currentConnections, setCurrentConnections] = useState<FiberConnection[]>(pop.connections);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    // Sync local connections when pop.connections changes externally
    useEffect(() => {
        setCurrentConnections(pop.connections);
    }, [pop.connections]);

    // OTDR States
    const [isOtdrToolActive, setIsOtdrToolActive] = useState(false);
    const [otdrTargetPort, setOtdrTargetPort] = useState<string | null>(null);
    const [otdrDistance, setOtdrDistance] = useState<string>('');

    // VFL State
    const [isVflToolActive, setIsVflToolActive] = useState(false);

    const relevantCables = useMemo(() => {
        return incomingCables.filter(c => dio.inputCableIds?.includes(c.id));
    }, [incomingCables, dio.inputCableIds]);

    const handleAddLogicalConnection = (source: string, target: string) => {
        const newConn: FiberConnection = {
            id: `fusion-${Date.now()}`,
            sourceId: source,
            targetId: target,
            color: '#22c55e',
            points: []
        };
        setCurrentConnections(prev => [...prev, newConn]);
    };

    const handleRemoveLogicalConnection = (source: string, target: string) => {
        setCurrentConnections(prev => prev.filter(c =>
            !(c.sourceId === source && c.targetId === target) &&
            !(c.sourceId === target && c.targetId === source)
        ));
    };

    const handleToggleCableLink = (cableId: string) => {
        if (!onUpdateDio) return;

        const currentCables = dio.inputCableIds || [];
        let newCables;
        const fiberPrefix = `${cableId}-fiber-`;
        const cleanFiberConns = (conns: FiberConnection[]) => conns.filter(c =>
            !c.sourceId.startsWith(fiberPrefix) && !c.targetId.startsWith(fiberPrefix)
        );

        if (currentCables.includes(cableId)) {
            newCables = currentCables.filter(c => c !== cableId);
            const cleaned = cleanFiberConns(currentConnections);
            setCurrentConnections(cleaned);
            if (onUpdateConnections) onUpdateConnections(cleaned);
        } else {
            const assignedToOther = pop.dios.find(d => d.id !== dio.id && d.inputCableIds?.includes(cableId));
            if (assignedToOther) return;
            newCables = [...currentCables, cableId];
            // Defesa: limpa qualquer splice residual desse cabo antes de re-anexar.
            // Cobre o caso "removi e reconectei o cabo, bandejas aparecem com splices
            // antigas mas que não funcionam" — algum caminho deixou conexões órfãs.
            const cleaned = cleanFiberConns(currentConnections);
            if (cleaned.length !== currentConnections.length) {
                setCurrentConnections(cleaned);
                if (onUpdateConnections) onUpdateConnections(cleaned);
            }
        }

        onUpdateDio({ ...dio, inputCableIds: newCables });
    };

    const handleUpdateSplicingLayout = (newLayout: { col1: string[]; col2: string[]; col3: string[] }) => {
        if (onUpdateDio) {
            onUpdateDio({ ...dio, splicingLayout: newLayout });
        }
    };

    const handleOtdrSubmit = () => {
        if (!otdrTargetPort || !otdrDistance || !onOtdrTrace) return;
        const dist = parseFloat(otdrDistance);
        if (isNaN(dist)) return;

        onOtdrTrace(otdrTargetPort, dist);
        setOtdrTargetPort(null);
        setIsOtdrToolActive(false);
    };

    return (
        <div
            className="fixed top-0 bottom-0 right-0 z-[2200] bg-black flex items-center justify-center select-none transition-all duration-300"
            style={{ left: isSidebarCollapsed ? '80px' : '280px' }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="w-full h-full bg-white dark:bg-[#151820] flex flex-col overflow-hidden relative">

                {/* Toolbar */}
                <div className="h-12 bg-white dark:bg-[#1a1d23] border-b border-slate-200 dark:border-slate-700/30 flex items-center justify-between px-4 shrink-0 z-50 shadow-sm">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700">
                            <div className="p-1.5 rounded-lg bg-orange-600 text-white">
                                <Split className="w-4 h-4" />
                            </div>
                            <div className="select-none">
                                <h2 className="font-bold text-slate-900 dark:text-white text-sm leading-none">{dio.name}</h2>
                                <p className="text-[10px] text-slate-500 font-medium">{t('manage_splicing')}</p>
                            </div>
                        </div>

                        {onUpdateDio && (
                            <div className="h-8 w-[1px] bg-white/10 mx-2" />
                        )}

                        {onUpdateDio && (
                            <button
                                onClick={() => setIsLinkModalOpen(true)}
                                className="px-3 py-1 bg-slate-100 dark:bg-[#22262e] hover:bg-emerald-600/10 hover:border-emerald-500/50 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-all select-none"
                            >
                                <Link2 className="w-3.5 h-3.5" />
                                {t('link_cables')}
                                <span className="bg-white dark:bg-[#1a1d23] px-1.5 py-0.5 rounded text-[10px] text-slate-500">{relevantCables.length}</span>
                            </button>
                        )}

                        {onOtdrTrace && (
                            <button
                                onClick={() => {
                                    setIsOtdrToolActive(!isOtdrToolActive);
                                    setIsVflToolActive(false);
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border select-none
                                    ${isOtdrToolActive
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-[#22262e] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}
                                `}
                                title={t('tooltip_otdr')}
                            >
                                <Ruler className="w-3.5 h-3.5" />
                                {t('otdr_trace_tool')}
                            </button>
                        )}

                        {onToggleVfl && (
                            <button
                                onClick={() => {
                                    setIsVflToolActive(!isVflToolActive);
                                    setIsOtdrToolActive(false);
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border select-none
                                    ${isVflToolActive
                                        ? 'bg-red-600 border-red-500 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-[#22262e] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}
                                `}
                                title={t('tooltip_vfl')}
                            >
                                <Flashlight className="w-3.5 h-3.5" />
                                {t('vfl_trace')}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onSave(currentConnections)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm flex items-center gap-2 text-sm transition-all transform active:scale-95 select-none"
                        >
                            <Save className="w-4 h-4" /> {t('save')}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Splicing View */}
                <div className="flex-1 bg-white dark:bg-[#151820] relative overflow-hidden">
                    <LogicalSplicingView
                        dio={dio}
                        localPOP={pop}
                        incomingCables={incomingCables}
                        currentConnections={currentConnections}
                        onAddConnection={handleAddLogicalConnection}
                        onRemoveConnection={handleRemoveLogicalConnection}
                        onUpdateSplicingLayout={handleUpdateSplicingLayout}
                        isOtdrToolActive={isOtdrToolActive}
                        onSelectOtdrTarget={setOtdrTargetPort}
                        isVflToolActive={isVflToolActive}
                        litPorts={litPorts}
                        onToggleVfl={onToggleVfl}
                    />
                </div>

                {isLinkModalOpen && (
                    <div className="absolute inset-0 z-[2400] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setIsLinkModalOpen(false)}>
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/30 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                                        <Link2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('link_cables')}</h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{dio.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsLinkModalOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                {incomingCables.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 px-4">
                                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                            <CableIcon className="w-7 h-7 text-slate-400 dark:text-slate-500" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t('no_cables_available')}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs leading-relaxed">{t('no_cables_available_desc')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {incomingCables.map(cable => {
                                            const isLinked = dio.inputCableIds?.includes(cable.id);
                                            const assignedToWho = pop.dios.find(d => d.id !== dio.id && d.inputCableIds?.includes(cable.id));

                                            return (
                                                <button
                                                    key={cable.id}
                                                    onClick={() => handleToggleCableLink(cable.id)}
                                                    disabled={!!assignedToWho}
                                                    className={`
                                                        w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group
                                                        ${isLinked
                                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600'
                                                            : assignedToWho
                                                                ? 'bg-slate-50 dark:bg-[#151820] border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed'
                                                                : 'bg-white dark:bg-[#22262e]/50 border-slate-200 dark:border-slate-700/50 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'}
                                                    `}
                                                >
                                                    <div className={`
                                                        w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                                                        ${isLinked
                                                            ? 'bg-emerald-500 border-emerald-500'
                                                            : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-400'}
                                                    `}>
                                                        {isLinked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                                    </div>
                                                    <div className={`
                                                        w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                                                        ${isLinked ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}
                                                    `}>
                                                        <CableIcon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{cable.name}</div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            {t('fiber_count_label', { count: cable.fiberCount || 0 })}
                                                            {assignedToWho && (
                                                                <span className="text-red-500 dark:text-red-400 font-bold ml-2">
                                                                    &bull; {t('linked_to_dio', { name: assignedToWho.name })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/30 flex justify-end">
                                <button
                                    onClick={() => setIsLinkModalOpen(false)}
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm text-sm transition-all"
                                >
                                    {t('done') || 'Concluir'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* OTDR INPUT MODAL */}
                {otdrTargetPort && (
                    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setOtdrTargetPort(null); setIsOtdrToolActive(false); }}>
                        <div className="bg-white dark:bg-[#1a1d23] border border-slate-200 dark:border-slate-700 rounded-lg p-6 w-80 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <Ruler className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-sm leading-none mb-1">{t('otdr_title')}</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{t('otdr_trace_msg')}</p>
                                </div>
                            </div>

                            <div className="mb-4">
                                <CustomInput
                                    label={t('otdr_distance_lbl')}
                                    type="number"
                                    value={otdrDistance}
                                    onChange={(e: any) => setOtdrDistance(e.target.value)}
                                    placeholder="ex: 1250"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => { setOtdrTargetPort(null); setIsOtdrToolActive(false); }} className="flex-1 py-2 bg-slate-100 dark:bg-[#22262e] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition">{t('cancel')}</button>
                                <button onClick={handleOtdrSubmit} className="flex-1 py-2 bg-indigo-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg transition">{t('otdr_locate')}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
