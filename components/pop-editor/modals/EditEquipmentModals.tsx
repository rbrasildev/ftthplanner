import React from 'react';
import { Pencil, AlertTriangle, X } from 'lucide-react';

interface EditEquipmentModalsProps {
    editingOLT: any;
    setEditingOLT: (olt: any) => void;
    handleSaveEditedOLT: () => void;
    editingDIO: any;
    setEditingDIO: (dio: any) => void;
    handleSaveEditedDIO: () => void;
}

export const EditEquipmentModals: React.FC<EditEquipmentModalsProps> = ({
    editingOLT,
    setEditingOLT,
    handleSaveEditedOLT,
    editingDIO,
    setEditingDIO,
    handleSaveEditedDIO
}) => {
    return (
        <>
            {/* EDIT OLT MODAL */}
            {editingOLT && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setEditingOLT(null)}>
                    <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-80 p-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit OLT</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400">Name</label>
                                <input type="text" value={editingOLT.name} onChange={e => setEditingOLT({ ...editingOLT, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-400">Slots</label>
                                    <input type="number" min="1" max="16" value={editingOLT.slots} onChange={e => setEditingOLT({ ...editingOLT, slots: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Ports/Slot</label>
                                    <input type="number" min="8" max="16" step="8" value={editingOLT.portsPerSlot} onChange={e => setEditingOLT({ ...editingOLT, portsPerSlot: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                                </div>
                            </div>
                            <div className="bg-amber-900/20 border border-amber-900/50 p-2 rounded flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                <p className="text-[10px] text-amber-400">Reducing slots/ports will remove existing connections on deleted ports.</p>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setEditingOLT(null)} className="px-3 py-1 bg-slate-700 text-xs text-white rounded">Cancel</button>
                                <button onClick={handleSaveEditedOLT} className="px-3 py-1 bg-sky-600 text-xs text-white font-bold rounded">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT DIO MODAL */}
            {editingDIO && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setEditingDIO(null)}>
                    <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-80 p-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit DIO</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400">Name</label>
                                <input type="text" value={editingDIO.name} onChange={e => setEditingDIO({ ...editingDIO, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Total Ports</label>
                                <select value={editingDIO.ports} onChange={e => setEditingDIO({ ...editingDIO, ports: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-sm text-white">
                                    <option value="12">12 Ports</option>
                                    <option value="24">24 Ports</option>
                                    <option value="36">36 Ports</option>
                                    <option value="48">48 Ports</option>
                                    <option value="72">72 Ports</option>
                                    <option value="144">144 Ports</option>
                                </select>
                            </div>
                            <div className="bg-amber-900/20 border border-amber-900/50 p-2 rounded flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                <p className="text-[10px] text-amber-400">Reducing ports will remove existing connections on deleted ports.</p>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={() => setEditingDIO(null)} className="px-3 py-1 bg-slate-700 text-xs text-white rounded">Cancel</button>
                                <button onClick={handleSaveEditedDIO} className="px-3 py-1 bg-sky-600 text-xs text-white font-bold rounded">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
