import React, { useState, useMemo } from 'react';
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

    // VFL Props
    litPorts?: Set<string>;
    vflSource?: string | null;
    onToggleVfl?: (portId: string) => void;

    // OTDR Prop
    onOtdrTrace?: (portId: string, distance: number) => void;
}

export const DIOEditor: React.FC<DIOEditorProps> = ({
    dio,
    pop,
    incomingCables,
    onClose,
    onSave,
    onUpdateDio,
    litPorts,
    vflSource,
    onToggleVfl,
    onOtdrTrace
}) => {
    const { t } = useLanguage();
    const [currentConnections, setCurrentConnections] = useState<FiberConnection[]>(pop.connections);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

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
        if (currentCables.includes(cableId)) {
            newCables = currentCables.filter(c => c !== cableId);
        } else {
            // Check if assigned to other DIO
            const assignedToOther = pop.dios.find(d => d.id !== dio.id && d.inputCableIds?.includes(cableId));
            if (assignedToOther) return;
            newCables = [...currentCables, cableId];
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
            className="fixed inset-0 z-[2200] bg-black flex items-center justify-center select-none"
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="w-full h-full bg-white dark:bg-slate-950 flex flex-col overflow-hidden relative">

                {/* Toolbar */}
                <div className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 z-50 shadow-sm">
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
                                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600/10 hover:border-emerald-500/50 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-all select-none"
                            >
                                <Link2 className="w-3.5 h-3.5" />
                                {t('link_cables')}
                                <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-500">{relevantCables.length}</span>
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
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}
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
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}
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
                <div className="flex-1 bg-white dark:bg-slate-950 relative overflow-hidden">
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
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-[450px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="h-12 bg-slate-50 dark:bg-slate-800/50 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-slate-900 dark:text-white font-bold flex items-center gap-2 text-sm">
                                    <div className="p-1 rounded bg-emerald-600 text-white">
                                        <Link2 className="w-3.5 h-3.5" />
                                    </div>
                                    {t('link_cables')}
                                </h3>
                                <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-4 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2 bg-white dark:bg-slate-950">
                                {incomingCables.length === 0 && (
                                    <div className="text-center p-8 text-slate-500">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>{t('no_cables_available')}</p>
                                    </div>
                                )}
                                 {incomingCables.map(cable => {
                                    const isLinked = dio.inputCableIds?.includes(cable.id);
                                    const assignedToWho = pop.dios.find(d => d.id !== dio.id && d.inputCableIds?.includes(cable.id));

                                    return (
                                        <button
                                            key={cable.id}
                                            onClick={() => handleToggleCableLink(cable.id)}
                                            disabled={!!assignedToWho}
                                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left
                                                ${isLinked
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-500 text-emerald-900 dark:text-white'
                                                    : (assignedToWho ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400')}
                                            `}
                                        >
                                            <div className="flex-1">
                                                <div className="font-bold text-xs mb-0.5 flex items-center gap-2">
                                                    <CableIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    {cable.name}
                                                    {assignedToWho && <span className="text-[10px] text-red-500 dark:text-red-400 font-bold uppercase ml-auto">{t('linked_to_dio', { name: assignedToWho.name })}</span>}
                                                </div>
                                                <div className="text-[10px] opacity-60 font-mono ml-5.5">{cable.fiberCount} {t('fibers')}</div>
                                            </div>
                                            {isLinked && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 ml-4 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* OTDR INPUT MODAL */}
                {otdrTargetPort && (
                    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setOtdrTargetPort(null); setIsOtdrToolActive(false); }}>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6 w-80 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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
                                <button onClick={() => { setOtdrTargetPort(null); setIsOtdrToolActive(false); }} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition">{t('cancel')}</button>
                                <button onClick={handleOtdrSubmit} className="flex-1 py-2 bg-indigo-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg transition">{t('otdr_locate')}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
