import React, { useCallback } from 'react';
import { useLanguage } from '../LanguageContext';
import { 
    NetworkState, 
    CTOData, 
    POPData, 
    CableData, 
    PoleData, 
    Coordinates, 
    CTOStatus,
    Project
} from '../types';
import * as projectService from '../services/projectService';
import { autoSnapNetwork } from '../utils/geometryUtils';

interface UseNetworkOperationsProps {
    currentProject: Project | null;
    updateCurrentNetwork: (updater: (prev: NetworkState) => NetworkState) => void;
    getCurrentNetwork: () => NetworkState;
    showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
    setIsSaving: (saving: boolean) => void;
    setCurrentProject: React.Dispatch<React.SetStateAction<Project | null>>;
    setEditingCTO: (cto: CTOData | null) => void;
    setEditingPOP: (pop: POPData | null) => void;
    setEditingCable: (cable: CableData | null) => void;
    setSelectedId: (id: string | null) => void;
    setToolMode: (mode: any) => void;
    setDrawingPath: React.Dispatch<React.SetStateAction<Coordinates[]>>;
    setDrawingFromId: (id: string | null) => void;
    setIsPoleModalOpen: (open: boolean) => void;
    setPendingPoleLocation: (loc: Coordinates | null) => void;
    pendingPoleLocation: Coordinates | null;
    setMultiConnectionIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setHighlightedCableId: (id: string | null) => void;
    syncTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
    skipNextAutoSyncRef: React.MutableRefObject<boolean>;
    systemSettings: { snapDistance: number };
    migrateNodeData: (node: CTOData | POPData, oldCableId: string, newCableId: string) => CTOData | POPData;
    parentNetwork?: NetworkState | null;
}

export const useNetworkOperations = (props: UseNetworkOperationsProps) => {
    const { t } = useLanguage();
    const {
        currentProject,
        updateCurrentNetwork,
        getCurrentNetwork,
        showToast,
        setIsSaving,
        setCurrentProject,
        setEditingCTO,
        setEditingPOP,
        setEditingCable,
        setSelectedId,
        setToolMode,
        setDrawingPath,
        setDrawingFromId,
        setIsPoleModalOpen,
        setPendingPoleLocation,
        pendingPoleLocation,
        setMultiConnectionIds,
        setHighlightedCableId,
        syncTimeoutRef,
        skipNextAutoSyncRef,
        systemSettings,
        migrateNodeData,
        parentNetwork
    } = props;

    // --- NODE OPS ---

    const handleAddPoint = useCallback((lat: number, lng: number, toolMode: string) => {
        if (toolMode === 'add_cto') {
            updateCurrentNetwork(prev => {
                const newCTO: CTOData = {
                    id: `cto-${Date.now()}`,
                    name: `CTO-${prev.ctos.length + 1}`,
                    status: 'PLANNED',
                    coordinates: { lat, lng },
                    splitters: [], fusions: [], connections: [], inputCableIds: [], clientCount: 0
                };
                return { ...prev, ctos: [...prev.ctos, newCTO] };
            });
            showToast(t('toast_cto_added'));
        } else if (toolMode === 'add_pop') {
            updateCurrentNetwork(prev => {
                const newPOP: POPData = {
                    id: `pop-${Date.now()}`,
                    name: `POP-${(prev.pops?.length || 0) + 1}`,
                    status: 'PLANNED',
                    coordinates: { lat, lng },
                    olts: [], dios: [], fusions: [], connections: [], inputCableIds: []
                };
                return { ...prev, pops: [...(prev.pops || []), newPOP] };
            });
            showToast(t('toast_pop_added'));
        } else if (toolMode === 'add_pole') {
            setPendingPoleLocation({ lat, lng });
            setIsPoleModalOpen(true);
        } else if (toolMode === 'draw_cable') {
            setDrawingPath(prev => [...prev, { lat, lng }]);
        }
    }, [updateCurrentNetwork, t, setPendingPoleLocation, setIsPoleModalOpen, setDrawingPath]);

    const handleMoveNode = useCallback((id: string, lat: number, lng: number) => {
        updateCurrentNetwork(prev => {
            const oldNode = prev.ctos.find(c => c.id === id) || prev.pops.find(p => p.id === id) || (prev.poles || []).find(p => p.id === id);
            if (!oldNode) return prev;

            const oldLat = oldNode.coordinates.lat;
            const oldLng = oldNode.coordinates.lng;

            let updatedCTOs = prev.ctos;
            let updatedPOPs = prev.pops;
            let updatedPoles = prev.poles || [];

            if (prev.ctos.some(c => c.id === id)) {
                updatedCTOs = prev.ctos.map(c => c.id === id ? { ...c, coordinates: { lat, lng } } : c);
            } else if (prev.pops.some(p => p.id === id)) {
                updatedPOPs = prev.pops.map(p => p.id === id ? { ...p, coordinates: { lat, lng } } : p);
            } else if (updatedPoles.some(p => p.id === id)) {
                updatedPoles = updatedPoles.map(p => p.id === id ? { ...p, coordinates: { lat, lng } } : p);
                updatedCTOs = updatedCTOs.map(c => c.poleId === id ? { ...c, coordinates: { lat, lng } } : c);
                updatedPOPs = updatedPOPs.map(p => p.poleId === id ? { ...p, coordinates: { lat, lng } } : p);
            }

            const updatedCables = prev.cables.map(cable => {
                let changed = false;
                const newCoords = cable.coordinates.map(coord => {
                    const d = Math.sqrt(Math.pow(coord.lat - oldLat, 2) + Math.pow(coord.lng - oldLng, 2));
                    if (d < 0.00000001) {
                        changed = true;
                        return { lat, lng };
                    }
                    return coord;
                });

                if (cable.fromNodeId === id) {
                    newCoords[0] = { lat, lng };
                    changed = true;
                }
                if (cable.toNodeId === id) {
                    newCoords[newCoords.length - 1] = { lat, lng };
                    changed = true;
                }
                return changed ? { ...cable, coordinates: newCoords } : cable;
            });

            return { ...prev, ctos: updatedCTOs, pops: updatedPOPs, cables: updatedCables, poles: updatedPoles };
        });
    }, [updateCurrentNetwork]);

    const handleDeleteCTO = useCallback((id: string) => {
        setSelectedId(null);
        updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.filter(c => c.id !== id) }));
        showToast(t('toast_cto_deleted'));
    }, [updateCurrentNetwork, t, setSelectedId]);

    const handleDeletePOP = useCallback((id: string) => {
        setSelectedId(null);
        updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.filter(p => p.id !== id) }));
        showToast(t('toast_pop_deleted'));
    }, [updateCurrentNetwork, t, setSelectedId]);

    const handleDeletePole = useCallback((id: string) => {
        setSelectedId(null);
        updateCurrentNetwork(prev => {
            const updatedPoles = (prev.poles || []).filter(p => p.id !== id);
            const updatedCables = prev.cables.map(cable => {
                if (cable.fromNodeId === id) return { ...cable, fromNodeId: undefined };
                if (cable.toNodeId === id) return { ...cable, toNodeId: undefined };
                return cable;
            });
            const updatedCTOs = prev.ctos.map(c => c.poleId === id ? { ...c, poleId: undefined } : c);
            const updatedPOPs = prev.pops.map(p => p.poleId === id ? { ...p, poleId: undefined } : p);
            return { ...prev, poles: updatedPoles, cables: updatedCables, ctos: updatedCTOs, pops: updatedPOPs };
        });
        showToast(t('toast_pole_deleted'));
    }, [updateCurrentNetwork, t, setSelectedId]);

    const handleSaveCTO = async (updatedCTO: CTOData) => {
        if (!currentProject) return;
        const hasPendingSync = !!syncTimeoutRef.current;
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
        }
        const newNetwork: NetworkState = {
            ...currentProject.network,
            ctos: currentProject.network.ctos.map(c => c.id === updatedCTO.id ? updatedCTO : c)
        };
        setCurrentProject(prev => prev ? { ...prev, network: newNetwork, updatedAt: Date.now() } : null);
        setEditingCTO(updatedCTO);
        
        if (!hasPendingSync) {
            skipNextAutoSyncRef.current = true;
        }
        setIsSaving(true);
        try {
            await projectService.updateCTO(currentProject.id, updatedCTO.id, updatedCTO);
            showToast(t('toast_cto_splicing_saved'));
        } catch (e) {
            showToast(t('error_saving_changes'), 'error');
            throw e;
        } finally {
            if (!hasPendingSync) setIsSaving(false);
        }
    };

    const handleSavePOP = async (updatedPOP: POPData) => {
        if (!currentProject) return;
        const hasPendingSync = !!syncTimeoutRef.current;
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
        }
        const newNetwork: NetworkState = {
            ...currentProject.network,
            pops: (currentProject.network.pops || []).map(p => p.id === updatedPOP.id ? updatedPOP : p)
        };
        setCurrentProject(prev => prev ? { ...prev, network: newNetwork, updatedAt: Date.now() } : null);
        setEditingPOP(updatedPOP);
        setHighlightedCableId(null);
        
        if (!hasPendingSync) {
            skipNextAutoSyncRef.current = true;
        }
        setIsSaving(true);
        try {
            await projectService.updatePOP(currentProject.id, updatedPOP.id, updatedPOP);
            showToast(t('toast_pop_saved'));
        } catch (e) {
            showToast(t('error_saving_changes'), 'error');
            throw e;
        } finally {
            if (!hasPendingSync) setIsSaving(false);
        }
    };

    const handleSelectPole = useCallback((catalogItem: any) => {
        if (pendingPoleLocation) {
            const newPole: PoleData = {
                id: `pole-${Date.now()}`,
                name: catalogItem.name,
                status: 'PLANNED',
                coordinates: pendingPoleLocation,
                catalogId: catalogItem.id,
                type: catalogItem.type,
                height: catalogItem.height
            };
            updateCurrentNetwork(prev => ({ ...prev, poles: [...(prev.poles || []), newPole] }));
            showToast(t('toast_pole_added'));
            setIsPoleModalOpen(false);
            setPendingPoleLocation(null);
        }
    }, [pendingPoleLocation, updateCurrentNetwork, t, setIsPoleModalOpen, setPendingPoleLocation]);

    const handleRenameCTO = useCallback((id: string, name: string) => updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.map(c => c.id === id ? { ...c, name } : c) })), [updateCurrentNetwork]);
    const handleUpdateCTOStatus = useCallback((id: string, status: CTOStatus) => updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.map(c => c.id === id ? { ...c, status } : c) })), [updateCurrentNetwork]);

    const handleRenamePOP = useCallback((id: string, name: string) => updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.map(p => p.id === id ? { ...p, name } : p) })), [updateCurrentNetwork]);
    const handleUpdatePOPStatus = useCallback((id: string, status: CTOStatus) => updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.map(p => p.id === id ? { ...p, status } : p) })), [updateCurrentNetwork]);

    // --- CABLE OPS ---

    const finalizeCableCreation = useCallback((path: Coordinates[], fromId: string | null = null, toId: string | null = null) => {
        if (path.length < 2) return;

        // Detect which IDs belong to the parent project (don't modify their inputCableIds)
        const parentNodeIds = new Set<string>();
        if (parentNetwork) {
            parentNetwork.ctos.forEach(c => parentNodeIds.add(c.id));
            parentNetwork.pops.forEach(p => parentNodeIds.add(p.id));
            (parentNetwork.poles || []).forEach(p => parentNodeIds.add(p.id));
        }

        updateCurrentNetwork(prev => {
            const newCable: CableData = {
                id: `cable-${Date.now()}`,
                name: `CBL-${prev.cables.length + 1}`,
                status: 'DEPLOYED',
                fiberCount: 12,
                fromNodeId: fromId,
                toNodeId: toId,
                coordinates: path
            };
            // Only update inputCableIds for nodes in the CURRENT project, not parent
            const updatedCTOs = prev.ctos.map(cto => {
                if ((cto.id === toId || cto.id === fromId) && !parentNodeIds.has(cto.id)) return { ...cto, inputCableIds: [...(cto.inputCableIds || []), newCable.id] };
                return cto;
            });
            const updatedPOPs = prev.pops.map(pop => {
                if ((pop.id === toId || pop.id === fromId) && !parentNodeIds.has(pop.id)) return { ...pop, inputCableIds: [...(pop.inputCableIds || []), newCable.id] };
                return pop;
            });
            return { ...prev, cables: [...prev.cables, newCable], ctos: updatedCTOs, pops: updatedPOPs };
        });
        showToast(t('toast_cable_created'));
        setDrawingPath([]);
        setDrawingFromId(null);
        setToolMode('view');
    }, [updateCurrentNetwork, t, setDrawingPath, setDrawingFromId, setToolMode, parentNetwork]);

    const handleConnectCable = useCallback((cableId: string, nodeId: string, pointIndex: number) => {
        // Detect parent node IDs
        const parentNodeIds = new Set<string>();
        if (parentNetwork) {
            parentNetwork.ctos.forEach(c => parentNodeIds.add(c.id));
            parentNetwork.pops.forEach(p => parentNodeIds.add(p.id));
            (parentNetwork.poles || []).forEach(p => parentNodeIds.add(p.id));
        }
        const isParentNode = parentNodeIds.has(nodeId);

        updateCurrentNetwork(prev => {
            const cable = prev.cables.find(c => c.id === cableId);
            // Look in current project first, then parent network
            let node = prev.ctos.find(c => c.id === nodeId) || prev.pops.find(p => p.id === nodeId) || (prev.poles || []).find(p => p.id === nodeId);
            if (!node && parentNetwork) {
                node = parentNetwork.ctos.find(c => c.id === nodeId) || parentNetwork.pops.find(p => p.id === nodeId) || (parentNetwork.poles || []).find(p => p.id === nodeId);
            }
            if (!cable || !node) return prev;

            const oldNodeId = pointIndex === 0 ? cable.fromNodeId : cable.toNodeId;
            let updatedCTOs = prev.ctos;
            let updatedPOPs = prev.pops;

            if (oldNodeId && oldNodeId !== nodeId) {
                updatedCTOs = updatedCTOs.map(c => c.id === oldNodeId ? { ...c, inputCableIds: (c.inputCableIds || []).filter(id => id !== cableId) } : c);
                updatedPOPs = updatedPOPs.map(p => p.id === oldNodeId ? { ...p, inputCableIds: (p.inputCableIds || []).filter(id => id !== cableId) } : p);
            }

            // Skip duplicate check for parent nodes (their inputCableIds are read-only)
            if (!isParentNode && 'inputCableIds' in node && (node.inputCableIds || []).includes(cableId)) {
                showToast(t('error_cto_duplicate_cable'), 'info');
                return prev;
            }

            if (pointIndex === 0 || pointIndex === cable.coordinates.length - 1) {
                const isPole = (prev.poles || []).some(p => p.id === nodeId) || (isParentNode && parentNetwork && (parentNetwork.poles || []).some(p => p.id === nodeId));
                const newCoords = [...cable.coordinates];
                newCoords[pointIndex] = node.coordinates;
                showToast(t(pointIndex === 0 ? 'toast_cable_connected_start' : 'toast_cable_connected_end', { name: node.name }));

                if (isPole) {
                    return {
                        ...prev,
                        cables: prev.cables.map(c => c.id === cableId ? { ...c, coordinates: newCoords } : c),
                        // Only update local poles' linkedCableIds
                        poles: isParentNode ? prev.poles : (prev.poles || []).map(p => p.id === nodeId ? { ...p, linkedCableIds: Array.from(new Set([...(p.linkedCableIds || []), cableId])) } : p)
                    };
                }

                return {
                    ...prev,
                    cables: prev.cables.map(c => c.id === cableId ? { ...c, coordinates: newCoords, [pointIndex === 0 ? 'fromNodeId' : 'toNodeId']: node.id } : c),
                    // Only update local nodes' inputCableIds (parent nodes won't match in prev.ctos/pops anyway, but be explicit)
                    ctos: isParentNode ? updatedCTOs : updatedCTOs.map(c => c.id === nodeId ? { ...c, inputCableIds: (c.inputCableIds || []).includes(cableId) ? c.inputCableIds : [...(c.inputCableIds || []), cableId] } : c),
                    pops: isParentNode ? updatedPOPs : updatedPOPs.map(p => p.id === nodeId ? { ...p, inputCableIds: (p.inputCableIds || []).includes(cableId) ? p.inputCableIds : [...(p.inputCableIds || []), cableId] } : p)
                };
            }

            const isPole = (prev.poles || []).some(p => p.id === nodeId) || (isParentNode && parentNetwork && (parentNetwork.poles || []).some(p => p.id === nodeId));
            if (isPole) {
                const newCoords = [...cable.coordinates];
                newCoords[pointIndex] = node.coordinates;
                showToast(t('toast_cable_anchored_pole', { name: node.name }));
                return {
                    ...prev,
                    cables: prev.cables.map(c => c.id === cableId ? { ...c, coordinates: newCoords } : c),
                    poles: isParentNode ? prev.poles : (prev.poles || []).map(p => p.id === nodeId ? { ...p, linkedCableIds: Array.from(new Set([...(p.linkedCableIds || []), cableId])) } : p)
                };
            }

            const coordSegment1 = cable.coordinates.slice(0, pointIndex + 1);
            const coordSegment2 = cable.coordinates.slice(pointIndex);
            coordSegment1[coordSegment1.length - 1] = node.coordinates;
            coordSegment2[0] = node.coordinates;
            const newCableId = crypto.randomUUID();

            if (cable.toNodeId) {
                updatedCTOs = updatedCTOs.map(c => c.id === cable.toNodeId ? migrateNodeData(c, cableId, newCableId) as CTOData : c);
                updatedPOPs = updatedPOPs.map(p => p.id === cable.toNodeId ? migrateNodeData(p, cableId, newCableId) as POPData : p);
            }

            const cable1 = { ...cable, coordinates: coordSegment1, toNodeId: node.id, name: `${cable.name} (A)` };
            const cable2 = { ...cable, id: newCableId, name: `${cable.name.replace(' (A)', '')} (B)`, fromNodeId: node.id, toNodeId: cable.toNodeId, coordinates: coordSegment2 };

            showToast(t('toast_cable_split', { name: node.name }));
            setMultiConnectionIds(prevSet => new Set(prevSet).add(cableId).add(newCableId));

            return {
                ...prev,
                cables: [...prev.cables.map(c => c.id === cableId ? cable1 : c), cable2],
                ctos: isParentNode ? updatedCTOs : updatedCTOs.map(c => c.id === nodeId ? { ...c, inputCableIds: [...(c.inputCableIds || []), cableId] } : c),
                pops: isParentNode ? updatedPOPs : updatedPOPs.map(p => p.id === nodeId ? { ...p, inputCableIds: [...(p.inputCableIds || []), cableId] } : p)
            };
        });
    }, [updateCurrentNetwork, t, migrateNodeData, setMultiConnectionIds, parentNetwork]);

    const handleUpdateCableGeometry = useCallback((id: string, coords: Coordinates[]) => {
        updateCurrentNetwork(prev => {
            let cable = prev.cables.find(c => c.id === id);
            if (!cable) return prev;

            let updatedCable = { ...cable, coordinates: coords };
            let updatedCTOs = prev.ctos;
            let updatedPOPs = prev.pops;
            const DISCONNECT_THRESHOLD = 0.000001;

            if (updatedCable.fromNodeId) {
                const node = prev.ctos.find(c => c.id === updatedCable.fromNodeId) || prev.pops.find(p => p.id === updatedCable.fromNodeId);
                if (node) {
                    const dist = Math.sqrt(Math.pow(coords[0].lat - node.coordinates.lat, 2) + Math.pow(coords[0].lng - node.coordinates.lng, 2));
                    if (dist > DISCONNECT_THRESHOLD) {
                        updatedCable.fromNodeId = undefined;
                        updatedCTOs = updatedCTOs.map(c => c.id === node.id ? { ...c, inputCableIds: c.inputCableIds?.filter(cid => cid !== id) } : c);
                        updatedPOPs = updatedPOPs.map(p => p.id === node.id ? { ...p, inputCableIds: p.inputCableIds?.filter(cid => cid !== id) } : p);
                        showToast(t('toast_cable_disconnected'));
                    }
                }
            }

            if (updatedCable.toNodeId) {
                const node = prev.ctos.find(c => c.id === updatedCable.toNodeId) || prev.pops.find(p => p.id === updatedCable.toNodeId);
                if (node) {
                    const dist = Math.sqrt(Math.pow(coords[coords.length - 1].lat - node.coordinates.lat, 2) + Math.pow(coords[coords.length - 1].lng - node.coordinates.lng, 2));
                    if (dist > DISCONNECT_THRESHOLD) {
                        updatedCable.toNodeId = undefined;
                        updatedCTOs = updatedCTOs.map(c => c.id === node.id ? { ...c, inputCableIds: c.inputCableIds?.filter(cid => cid !== id) } : c);
                        updatedPOPs = updatedPOPs.map(p => p.id === node.id ? { ...p, inputCableIds: p.inputCableIds?.filter(cid => cid !== id) } : p);
                        showToast(t('toast_cable_disconnected'));
                    }
                }
            }

            const filteredCoords = updatedCable.coordinates.filter((c, i, arr) => i === 0 || Math.sqrt(Math.pow(c.lat - arr[i - 1].lat, 2) + Math.pow(c.lng - arr[i - 1].lng, 2)) > 0.0000001);
            updatedCable.coordinates = filteredCoords;
            return autoSnapNetwork({ ...prev, cables: prev.cables.map(c => c.id === id ? updatedCable : c), ctos: updatedCTOs, pops: updatedPOPs }, systemSettings.snapDistance).state;
        });
    }, [updateCurrentNetwork, t, systemSettings.snapDistance]);

    const handleDisconnectCableFromBox = useCallback((cableId: string, nodeId: string) => {
        updateCurrentNetwork(prev => {
            const cable = prev.cables.find(c => c.id === cableId);
            if (!cable) return prev;
            const newFrom = cable.fromNodeId === nodeId ? undefined : cable.fromNodeId;
            const newTo = cable.toNodeId === nodeId ? undefined : cable.toNodeId;
            const updatedCTOs = prev.ctos.map(c => c.id === nodeId ? { ...c, inputCableIds: c.inputCableIds?.filter(cid => cid !== cableId) } : c);
            const updatedPOPs = prev.pops.map(p => p.id === nodeId ? { ...p, inputCableIds: p.inputCableIds?.filter(cid => cid !== cableId) } : p);
            showToast(t('toast_cable_disconnected'));
            return {
                ...prev,
                cables: prev.cables.map(c => c.id === cableId ? { ...c, fromNodeId: newFrom, toNodeId: newTo } : c),
                ctos: updatedCTOs,
                pops: updatedPOPs
            };
        });
    }, [updateCurrentNetwork, t]);

    const handleDeleteCable = useCallback((id: string) => {
        setEditingCable(null);
        updateCurrentNetwork(prev => ({ ...prev, cables: prev.cables.filter(c => c.id !== id) }));
        showToast(t('toast_cable_deleted'));
    }, [updateCurrentNetwork, t, setEditingCable]);

    const handleSaveCable = useCallback((c: CableData) => { 
        updateCurrentNetwork(prev => ({ ...prev, cables: prev.cables.map(cb => cb.id === c.id ? c : cb) })); 
        setEditingCable(null); 
        setHighlightedCableId(null); 
    }, [updateCurrentNetwork, setEditingCable, setHighlightedCableId]);

    const handleUpdateCable = useCallback((c: CableData) => updateCurrentNetwork(prev => ({ ...prev, cables: prev.cables.map(cb => cb.id === c.id ? c : cb) })), [updateCurrentNetwork]);

    return {
        handleAddPoint,
        handleMoveNode,
        handleDeleteCTO,
        handleDeletePOP,
        handleDeletePole,
        handleSaveCTO,
        handleSavePOP,
        handleSelectPole,
        handleRenameCTO,
        handleUpdateCTOStatus,
        handleRenamePOP,
        handleUpdatePOPStatus,
        finalizeCableCreation,
        handleConnectCable,
        handleUpdateCableGeometry,
        handleDisconnectCableFromBox,
        handleDeleteCable,
        handleSaveCable,
        handleUpdateCable
    };
};
