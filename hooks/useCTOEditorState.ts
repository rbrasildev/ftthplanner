import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { CTOData, CableData, ElementLayout } from '../types';

interface ViewState {
    x: number;
    y: number;
    zoom: number;
}

interface UseCTOEditorStateParams {
    cto: CTOData;
    incomingCables: CableData[];
    onSave: (updatedCTO: CTOData) => Promise<void> | void;
    onClose: () => void;
}

export function useCTOEditorState({ cto, incomingCables, onSave, onClose }: UseCTOEditorStateParams) {

    // --- HELPER: Normalize CTO with Defaults for Dirty Check ---
    const withDefaults = useCallback((data: CTOData): CTOData => {
        const next = JSON.parse(JSON.stringify(data)) as CTOData;
        if (!next.layout) next.layout = {};

        // MIGRATION: Auto-update legacy splitter connection colors (Gray -> Black)
        const migratedConnections = next.connections?.map(c => {
            if ((c.sourceId.includes('spl-') || c.targetId.includes('spl-')) && c.color === '#94a3b8') {
                return { ...c, color: '#0f172a' };
            }
            return c;
        }) || [];
        next.connections = migratedConnections;

        // Apply Defaults (Mirroring useEffect logic)
        let currentCableY = 42;
        incomingCables.forEach((cable) => {
            if (!next.layout![cable.id]) {
                const looseTubeCount = cable.looseTubeCount || 1;
                const fibersHeight = 6 + (looseTubeCount * 12) + (cable.fiberCount * 12);
                const remainder = fibersHeight % 24;
                const totalHeight = fibersHeight + (remainder > 0 ? 24 - remainder : 0);
                next.layout![cable.id] = { x: 42, y: currentCableY, rotation: 0 };
                currentCableY += totalHeight + 10;
            }
        });
        next.splitters.forEach((split, idx) => {
            if (!next.layout![split.id]) next.layout![split.id] = { x: 378, y: 78 + (idx * 120), rotation: 0 };
        });
        next.fusions.forEach((fusion, idx) => {
            if (!next.layout![fusion.id]) next.layout![fusion.id] = { x: 500, y: 100 + (idx * 50), rotation: 0 };
        });

        // Sort connections to ensure order doesn't affect JSON.stringify
        next.connections.sort((a, b) => a.id.localeCompare(b.id));

        return next;
    }, [incomingCables]);

    // --- PERSISTENCE FIX REUSABLE LOGIC ---
    const reconcileOrphans = useCallback((data: CTOData, cables: CableData[]) => {
        if (!data.layout) data.layout = {};
        if (!data.connections) data.connections = [];

        // 1. Reconcile Fusions
        const fusionLayoutKeys = Object.keys(data.layout).filter(k => k.includes('fus-'));
        const fusionsWithoutLayout = data.fusions.filter(f => !data.layout![f.id]);
        const orphanFusionKeys = fusionLayoutKeys.filter(k => !data.fusions.some(f => f.id === k));

        if (fusionsWithoutLayout.length > 0 && orphanFusionKeys.length > 0) {
            fusionsWithoutLayout.forEach((fusion, idx) => {
                if (idx < orphanFusionKeys.length) {
                    const orphanKey = orphanFusionKeys[idx];
                    data.layout![fusion.id] = data.layout![orphanKey];
                    data.connections = data.connections.map(conn => {
                        let nextConn = { ...conn };
                        if (conn.sourceId === orphanKey) nextConn.sourceId = fusion.id;
                        if (conn.targetId === orphanKey) nextConn.targetId = fusion.id;
                        return nextConn;
                    });
                    delete data.layout![orphanKey];
                }
            });
        }

        // 2. Reconcile Splitters
        const splitterLayoutKeys = Object.keys(data.layout).filter(k => k.includes('spl-'));
        const splittersWithoutLayout = data.splitters.filter(s => !data.layout![s.id]);
        const orphanSplitterKeys = splitterLayoutKeys.filter(k => !data.splitters.some(s => s.id === k));

        if (splittersWithoutLayout.length > 0 && orphanSplitterKeys.length > 0) {
            splittersWithoutLayout.forEach((split, idx) => {
                if (idx < orphanSplitterKeys.length) {
                    const orphanKey = orphanSplitterKeys[idx];
                    data.layout![split.id] = data.layout![orphanKey];
                    data.connections = data.connections.map(conn => {
                        let nextConn = { ...conn };
                        if (conn.sourceId === `${orphanKey}-in`) nextConn.sourceId = `${split.id}-in`;
                        if (conn.targetId === `${orphanKey}-in`) nextConn.targetId = `${split.id}-in`;
                        if (conn.sourceId.startsWith(`${orphanKey}-out-`)) {
                            nextConn.sourceId = conn.sourceId.replace(`${orphanKey}-out-`, `${split.id}-out-`);
                        }
                        if (conn.targetId.startsWith(`${orphanKey}-out-`)) {
                            nextConn.targetId = conn.targetId.replace(`${orphanKey}-out-`, `${split.id}-out-`);
                        }
                        return nextConn;
                    });
                    delete data.layout![orphanKey];
                }
            });
        }

        // 3. Reconcile Cables
        const cableLayoutKeys = Object.keys(data.layout).filter(k => !k.includes('fus-') && !k.includes('spl-'));
        const cablesWithoutLayout = cables.filter(c => !data.layout![c.id]);

        if (cablesWithoutLayout.length > 0 && cableLayoutKeys.length > 0) {
            const orphanLayouts = cableLayoutKeys.filter(k => !cables.some(c => c.id === k));

            if (orphanLayouts.length > 0) {
                orphanLayouts.forEach((orphanId, index) => {
                    const newCable = cablesWithoutLayout[index];
                    if (newCable) {
                        data.layout![newCable.id] = data.layout![orphanId];
                        delete data.layout![orphanId];
                        data.connections = data.connections.map(conn => {
                            let nextConn = { ...conn };
                            if (conn.sourceId.startsWith(`${orphanId}-fiber-`)) {
                                nextConn.sourceId = conn.sourceId.replace(`${orphanId}-fiber-`, `${newCable.id}-fiber-`);
                            }
                            if (conn.targetId.startsWith(`${orphanId}-fiber-`)) {
                                nextConn.targetId = conn.targetId.replace(`${orphanId}-fiber-`, `${newCable.id}-fiber-`);
                            }
                            return nextConn;
                        });
                    }
                });
            }
        }

        // 4. CLEANUP - Remove genuinely orphan cable layouts
        const finalCableLayoutsToCheck = Object.keys(data.layout).filter(k => !k.includes('fus-') && !k.includes('spl-'));
        const finalCurrentCableIds = cables.map(c => c.id);

        const layoutKeysToRemove = finalCableLayoutsToCheck.filter(layoutKey => {
            const isKept = finalCurrentCableIds.some(id => id === layoutKey || id.trim() === layoutKey.trim());
            return !isKept;
        });

        layoutKeysToRemove.forEach(key => delete data.layout![key]);
    }, []);

    // --- Apply default layouts to a CTO (shared init logic) ---
    const applyDefaultLayouts = useCallback((next: CTOData, cables: CableData[]) => {
        if (!next.layout) next.layout = {};
        let currentCableY = 42;
        cables.forEach((cable) => {
            if (!next.layout![cable.id]) {
                const looseTubeCount = cable.looseTubeCount || 1;
                const fibersHeight = 6 + (looseTubeCount * 12) + (cable.fiberCount * 12);
                const remainder = fibersHeight % 24;
                const totalHeight = fibersHeight + (remainder > 0 ? 24 - remainder : 0);
                next.layout![cable.id] = { x: 42, y: currentCableY, rotation: 0 };
                currentCableY += totalHeight + 10;
            }
        });
        next.splitters.forEach((split, idx) => {
            if (!next.layout![split.id]) next.layout![split.id] = { x: 378, y: 78 + (idx * 120), rotation: 0 };
        });
        next.fusions.forEach((fusion, idx) => {
            if (!next.layout![fusion.id]) next.layout![fusion.id] = { x: 500, y: 100 + (idx * 50), rotation: 0 };
        });
    }, []);

    // --- SAVING ACTION STATE ---
    const [savingAction, setSavingAction] = useState<'idle' | 'apply' | 'save_close'>('idle');

    // --- LOCAL CTO STATE ---
    const [localCTO, setLocalCTO] = useState<CTOData>(() => {
        const next = JSON.parse(JSON.stringify(cto)) as CTOData;
        if (!next.layout) next.layout = {};
        reconcileOrphans(next, incomingCables);
        applyDefaultLayouts(next, incomingCables);
        return next;
    });

    // SYNC LOCAL STATE WHEN PROP UPDATES (e.g. after Save or External Change)
    useEffect(() => {
        setLocalCTO(prev => {
            const next = JSON.parse(JSON.stringify(cto)) as CTOData;

            // 1. If CTO ID Changed, full reset (New Context)
            if (prev.id !== next.id) {
                const migratedConnections = next.connections?.map(c => {
                    if ((c.sourceId.includes('spl-') || c.targetId.includes('spl-')) && c.color === '#94a3b8') {
                        return { ...c, color: '#0f172a' };
                    }
                    return c;
                }) || [];
                next.connections = migratedConnections;
                if (!next.layout) next.layout = {};
                reconcileOrphans(next, incomingCables);
                applyDefaultLayouts(next, incomingCables);
                return next;
            }

            // 2. SAME CTO - SMART MERGE (Preserve Unsaved Work)
            const merged = { ...next };
            if (prev.layout) merged.layout = JSON.parse(JSON.stringify(prev.layout));
            else merged.layout = {};
            if (prev.connections) merged.connections = JSON.parse(JSON.stringify(prev.connections));
            if (prev.splitters) merged.splitters = JSON.parse(JSON.stringify(prev.splitters));
            if (prev.fusions) merged.fusions = JSON.parse(JSON.stringify(prev.fusions));
            if (prev.viewState) merged.viewState = prev.viewState;
            if (prev.inputCableIds !== undefined) merged.inputCableIds = prev.inputCableIds;

            reconcileOrphans(merged, incomingCables);
            applyDefaultLayouts(merged, incomingCables);

            if (JSON.stringify(prev) !== JSON.stringify(merged)) return merged;
            return prev;
        });
    }, [cto, incomingCables, reconcileOrphans, applyDefaultLayouts]);

    // SYNC REF for performance-critical handlers
    const localCTORef = useRef(localCTO);
    useLayoutEffect(() => {
        localCTORef.current = localCTO;
    }, [localCTO]);

    // --- DIRTY CHECK SNAPSHOT ---
    const createSnapshot = useCallback((data: CTOData): string => {
        const { viewState: _vs, ...rest } = withDefaults(data);
        if (rest.connections) {
            rest.connections = [...rest.connections].sort((a, b) => a.id.localeCompare(b.id));
        }
        return JSON.stringify(rest);
    }, [withDefaults]);
    const savedSnapshotRef = useRef<string>(createSnapshot(cto));

    // Keep snapshot in sync when prop cto changes
    useEffect(() => {
        savedSnapshotRef.current = createSnapshot(cto);
    }, [cto, createSnapshot]);

    // --- UNSAVED CHANGES MODAL ---
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // --- SAVE / CLOSE HANDLERS ---
    // viewState is passed as parameter since it's owned by the viewport, not this hook.
    const handleApply = useCallback(async (viewState: ViewState) => {
        setSavingAction('apply');
        try {
            const finalCTO = JSON.parse(JSON.stringify(localCTO)) as CTOData;
            finalCTO.viewState = viewState;
            await onSave(finalCTO);
            savedSnapshotRef.current = createSnapshot(finalCTO);
        } catch (e) {
            console.error("Apply failed", e);
        } finally {
            setSavingAction('idle');
        }
    }, [localCTO, onSave, createSnapshot]);

    const handleSaveAndClose = useCallback(async (viewState: ViewState) => {
        setSavingAction('save_close');
        try {
            const finalCTO = JSON.parse(JSON.stringify(localCTO)) as CTOData;
            finalCTO.viewState = viewState;

            // SAFEGUARD: Ensure all fusions have a layout entry before saving
            if (!finalCTO.layout) finalCTO.layout = {};
            finalCTO.fusions.forEach((f, idx) => {
                if (!finalCTO.layout![f.id]) {
                    finalCTO.layout![f.id] = { x: 500, y: 100 + (idx * 50), rotation: 0 };
                }
            });

            await onSave(finalCTO);
            onClose();
        } catch (e) {
            console.error("SaveAndClose failed", e);
        } finally {
            setSavingAction('idle');
        }
    }, [localCTO, onSave, onClose]);

    const handleCloseRequest = useCallback(() => {
        const { viewState: _vs, ...localRest } = localCTO;
        const localForCompare = { ...localRest };
        if (localForCompare.connections) {
            localForCompare.connections = [...localForCompare.connections].sort((a, b) => a.id.localeCompare(b.id));
        }
        const hasChanges = JSON.stringify(localForCompare) !== savedSnapshotRef.current;

        if (hasChanges) setShowCloseConfirm(true);
        else onClose();
    }, [localCTO, onClose]);

    return {
        localCTO,
        setLocalCTO,
        localCTORef,
        savingAction,
        showCloseConfirm,
        setShowCloseConfirm,
        handleApply,
        handleSaveAndClose,
        handleCloseRequest,
    };
}
