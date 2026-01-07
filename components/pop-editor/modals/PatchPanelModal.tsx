import React from 'react';
import { Router, Server, Link2, Link2Off, Cable as CableIcon, X } from 'lucide-react';

interface PatchPanelModalProps {
    configuringOltPortId: string | null;
    setConfiguringOltPortId: (id: string | null) => void;
    localPOP: any;
    handleDisconnectPort: () => void;
    handleConnectPort: (pid: string) => void;
}

export const PatchPanelModal: React.FC<PatchPanelModalProps> = ({
    configuringOltPortId,
    setConfiguringOltPortId,
    localPOP,
    handleDisconnectPort,
    handleConnectPort
}) => {
    if (!configuringOltPortId) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setConfiguringOltPortId(null)}>
            <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-96 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="h-10 bg-slate-700 px-4 flex items-center justify-between border-b border-slate-600">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Router className="w-4 h-4 text-sky-400" />
                        Connection for Slot/Port
                    </h3>
                    <button onClick={() => setConfiguringOltPortId(null)}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] space-y-4">
                    {/* Current Status */}
                    <div className="bg-slate-900 rounded p-3 border border-slate-700">
                        {localPOP.connections.find((c: any) => c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId) ? (
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-green-400 font-bold flex items-center gap-2">
                                    <Link2 className="w-4 h-4" /> Connected
                                </div>
                                <button onClick={handleDisconnectPort} className="px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-white rounded text-xs border border-red-900/50 flex items-center gap-1 transition">
                                    <Link2Off className="w-3 h-3" /> Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
                                <Link2Off className="w-4 h-4" /> Not Connected
                            </div>
                        )}
                    </div>

                    {/* Available DIOs */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Select DIO Port</h4>
                        <div className="space-y-3">
                            {localPOP.dios.map((dio: any) => (
                                <div key={dio.id} className="bg-slate-900/50 rounded border border-slate-700/50">
                                    <div className="px-3 py-2 bg-slate-800 text-xs font-bold text-slate-300 border-b border-slate-700/50 flex items-center gap-2">
                                        <Server className="w-3 h-3" /> {dio.name}
                                    </div>
                                    <div className="p-2 grid grid-cols-6 gap-1">
                                        {dio.portIds.map((pid: string, idx: number) => {
                                            const existingConns = localPOP.connections.filter((c: any) => c.sourceId === pid || c.targetId === pid);

                                            const isConnectedToSelf = existingConns.some((c: any) => c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId);

                                            const occupiedByOtherOLT = existingConns.some((c: any) => {
                                                if (c.sourceId === configuringOltPortId || c.targetId === configuringOltPortId) return false;
                                                const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                return partner.includes('olt');
                                            });

                                            const hasBackboneLink = existingConns.some((c: any) => {
                                                const partner = c.sourceId === pid ? c.targetId : c.sourceId;
                                                return partner.includes('fiber');
                                            });

                                            return (
                                                <button
                                                    key={pid}
                                                    disabled={occupiedByOtherOLT}
                                                    onClick={() => handleConnectPort(pid)}
                                                    className={`
                                                                    aspect-square rounded text-[9px] font-mono flex items-center justify-center border transition-all relative
                                                                    ${isConnectedToSelf ? 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-emerald-400/50 font-bold scale-110' : ''}
                                                                    ${occupiedByOtherOLT ? 'bg-slate-950 border-slate-800 text-slate-700 cursor-not-allowed' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-sky-600 hover:text-white hover:border-sky-400'}
                                                                `}
                                                >
                                                    {idx + 1}
                                                    {hasBackboneLink && !isConnectedToSelf && !occupiedByOtherOLT && (
                                                        <CableIcon className="w-3 h-3 text-sky-500 absolute -top-1 -right-1" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
