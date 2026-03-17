import React, { useCallback } from 'react';
import { useLanguage } from '../LanguageContext';
import { Project, NetworkState, CableData, CTOData, PoleData } from '../types';
import * as projectService from '../services/projectService';

interface UseNetworkImportProps {
    currentProjectId: string | null;
    getCurrentNetwork: () => NetworkState;
    setCurrentProject: React.Dispatch<React.SetStateAction<Project | null>>;
    setIsLoadingProjects: (loading: boolean) => void;
    showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
    syncTimeoutRef: React.MutableRefObject<any>;
    setUpgradeModalDetails: (details: string | undefined) => void;
    setShowUpgradeModal: (show: boolean) => void;
}

export const useNetworkImport = ({
    currentProjectId,
    getCurrentNetwork,
    setCurrentProject,
    setIsLoadingProjects,
    showToast,
    syncTimeoutRef,
    setUpgradeModalDetails,
    setShowUpgradeModal
}: UseNetworkImportProps) => {
    const { t } = useLanguage();


    const handleImportPoles = useCallback(async (points: Array<{ lat: number, lng: number }>, poleTypeId: string) => {
        if (!currentProjectId) return;
        setIsLoadingProjects(true);

        try {
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

            const newPoles: PoleData[] = points.map((pt, idx) => ({
                id: crypto.randomUUID(),
                name: `Poste ${idx + 1}`,
                status: 'PLANNED',
                coordinates: pt,
                catalogId: poleTypeId,
            }));

            const updated = { ...getCurrentNetwork() };
            updated.poles = [...(updated.poles || []), ...newPoles];

            await projectService.syncProject(currentProjectId, updated);
            setCurrentProject(prev => prev ? { ...prev, network: updated, updatedAt: Date.now() } : null);
            showToast(t('import_poles_success'), 'success');
        } catch (err: any) {
            console.error(err);
            showToast(t('import_poles_error'), 'error');
        } finally {
            setIsLoadingProjects(false);
        }
    }, [currentProjectId, getCurrentNetwork, setCurrentProject, setIsLoadingProjects, showToast, syncTimeoutRef]);

    const handleAdvancedImport = useCallback(async (data: any) => {
        if (!currentProjectId || !data) return;
        setIsLoadingProjects(true);

        try {
            const updated = { ...getCurrentNetwork() };

            // 1. Process Cables
            if (data.cables && data.cables.length > 0) {
                const newCables: CableData[] = data.cables.map((c: any, idx: number) => ({
                    id: crypto.randomUUID(),
                    name: c.originalName || `Cabo ${idx + 1}`,
                    status: c.status || 'DEPLOYED',
                    fiberCount: c.type?.fiberCount || 1,
                    looseTubeCount: c.type?.looseTubeCount || 1,
                    color: c.type?.deployedSpec?.color || c.type?.plannedSpec?.color || '#0ea5e9',
                    colorStandard: 'ABNT',
                    coordinates: (Array.isArray(c.coordinates) ? c.coordinates : [])
                        .filter((pt: any) => Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]))
                        .map((pt: any) => ({ lat: pt[1], lng: pt[0] })),
                    fromNodeId: null,
                    toNodeId: null,
                    catalogId: c.type?.id
                }));
                updated.cables = [...(updated.cables || []), ...newCables.filter(c => c.coordinates.length >= 2)];
            }

            // 2. Process CTOs/CEOs
            const processBox = (b: any, idx: number, type: 'CTO' | 'CEO'): CTOData => ({
                id: crypto.randomUUID(),
                name: b.originalName || `${type} ${idx + 1}`,
                status: b.status || 'DEPLOYED',
                type: type,
                coordinates: { lat: b.coordinates[1], lng: b.coordinates[0] },
                catalogId: b.type?.id,
                splitters: [],
                fusions: [],
                connections: [],
                inputCableIds: [],
                clientCount: 0
            });

            if (data.ctos && data.ctos.length > 0) {
                const newCTOs = data.ctos.map((c: any, idx: number) => processBox(c, idx, 'CTO'));
                updated.ctos = [...(updated.ctos || []), ...newCTOs];
            }
            if (data.ceos && data.ceos.length > 0) {
                const newCEOs = data.ceos.map((c: any, idx: number) => processBox(c, idx, 'CEO'));
                updated.ctos = [...(updated.ctos || []), ...newCEOs];
            }

            // 3. Process Poles
            if (data.poles && data.poles.length > 0) {
                const newPoles: PoleData[] = data.poles.map((p: any, idx: number) => ({
                    id: crypto.randomUUID(),
                    name: p.originalName || `Poste ${idx + 1}`,
                    status: p.status || 'PLANNED',
                    coordinates: { lat: p.coordinates[1], lng: p.coordinates[0] },
                    catalogId: p.type?.id,
                    type: p.type?.name,
                    height: p.type?.height
                }));
                updated.poles = [...(updated.poles || []), ...newPoles];
            }

            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            await projectService.syncProject(currentProjectId, updated);
            setCurrentProject(prev => prev ? { ...prev, network: updated, updatedAt: Date.now() } : null);
            showToast(t('import_success'), 'success');
        } catch (error: any) {
            console.error("Import failed", error);
            if (error.response && error.response.status === 403) {
                const errorMsg = error.response.data?.error || error.response.data?.details || 'Acesso negado';
                setUpgradeModalDetails(errorMsg);
                setShowUpgradeModal(true);
            } else {
                showToast(t('import_error'), 'error');
            }
        } finally {
            setIsLoadingProjects(false);
        }
    }, [currentProjectId, getCurrentNetwork, setCurrentProject, setIsLoadingProjects, showToast, syncTimeoutRef, setUpgradeModalDetails, setShowUpgradeModal]);

    return { handleImportPoles, handleAdvancedImport };
};
