import { useCallback } from 'react';
import { useLanguage } from '../LanguageContext';
import L from 'leaflet';
import { NetworkState, Coordinates } from '../types';

interface UseOpticalTraceProps {
    getCurrentNetwork: () => NetworkState;
    setOtdrResult: (result: Coordinates | null) => void;
    setMapBounds: (bounds: any) => void;
    setEditingCTO: (cto: any) => void;
    setEditingPOP: (pop: any) => void;
    setEditingCable: (cable: any) => void;
    showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const useOpticalTrace = ({
    getCurrentNetwork,
    setOtdrResult,
    setMapBounds,
    setEditingCTO,
    setEditingPOP,
    setEditingCable,
    showToast
}: UseOpticalTraceProps) => {
    const { t } = useLanguage();

    const traceOpticalPath = useCallback((startNodeId: string, startPortId: string, targetDistance: number) => {
        const net = getCurrentNetwork();
        let remainingDist = targetDistance;
        let currentNodeId = startNodeId;
        let currentPortId = startPortId; // Typically "cable-id-fiber-index"

        let loops = 0;

        while (remainingDist > 0 && loops < 50) {
            loops++;

            if (!currentPortId.includes('-fiber-')) {
                showToast(t('otdr_trace_start_error'), "info");
                return;
            }

            const cableId = currentPortId.split('-fiber-')[0];
            const cable = net.cables.find(c => c.id === cableId);

            if (!cable) {
                showToast(t('otdr_cable_not_found'), "info");
                return;
            }

            let path: Coordinates[] = [];
            let nextNodeId: string | null = null;

            if (cable.fromNodeId === currentNodeId) {
                path = [...cable.coordinates];
                nextNodeId = cable.toNodeId || null;
            } else if (cable.toNodeId === currentNodeId) {
                path = [...cable.coordinates].reverse();
                nextNodeId = cable.fromNodeId || null;
            } else {
                showToast(t('otdr_conn_mismatch'), "info");
                return;
            }

            // --- CABLE TECHNICAL RESERVE ---
            if (cable.technicalReserve && cable.technicalReserve > 0) {
                if (remainingDist <= cable.technicalReserve) {
                    const entryPoint = path[0];
                    setOtdrResult(entryPoint);
                    setMapBounds([[entryPoint.lat, entryPoint.lng], [entryPoint.lat, entryPoint.lng]]);
                    showToast(`${t('otdr_result')}: ${t('technical_reserve')} (${cable.name})`);
                    return;
                }
                remainingDist -= cable.technicalReserve;
            }

            let eventPoint: Coordinates | null = null;

            for (let i = 0; i < path.length - 1; i++) {
                const p1 = L.latLng(path[i].lat, path[i].lng);
                const p2 = L.latLng(path[i + 1].lat, path[i + 1].lng);
                const segmentDist = p1.distanceTo(p2);

                if (remainingDist <= segmentDist) {
                    const ratio = remainingDist / segmentDist;
                    const lat = path[i].lat + (path[i + 1].lat - path[i].lat) * ratio;
                    const lng = path[i].lng + (path[i + 1].lng - path[i].lng) * ratio;
                    eventPoint = { lat, lng };
                    break;
                }

                remainingDist -= segmentDist;
            }

            if (eventPoint) {
                setOtdrResult(eventPoint);
                setMapBounds([[eventPoint.lat, eventPoint.lng], [eventPoint.lat, eventPoint.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                setEditingCable(null);
                showToast(`${t('otdr_result')}: ${t('otdr_success_cable', { name: cable.name })} `);
                return;
            }

            if (!nextNodeId) {
                showToast(t('otdr_end_open'), "info");
                const end = path[path.length - 1];
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }

            const nextNode = net.ctos.find(c => c.id === nextNodeId) || net.pops.find(p => p.id === nextNodeId) || (net.poles || []).find(p => p.id === nextNodeId);
            if (!nextNode) {
                showToast(t('otdr_next_node_error'), "info");
                return;
            }

            // --- POLE Auto-Pass-Through ---
            const isPole = (net.poles || []).some(p => p.id === nextNodeId);
            if (isPole) {
                const fiberIndex = currentPortId.split('-fiber-')[1];
                const nextCable = net.cables.find(c =>
                    c.id !== cableId &&
                    (c.fromNodeId === nextNode.id || c.toNodeId === nextNode.id)
                );

                if (nextCable) {
                    showToast(t('otdr_traversing_pole', { name: nextNode.name }), 'info');
                    currentPortId = `${nextCable.id}-fiber-${fiberIndex}`;
                    currentNodeId = nextNode.id;
                    continue;
                } else {
                    showToast(t('otdr_end_open'), "info");
                    const end = nextNode.coordinates;
                    setOtdrResult(end);
                    setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                    return;
                }
            }

            // --- CTO Slack Logic ---
            if ('splitters' in nextNode) {
                const isCTO = net.ctos.some(c => c.id === nextNode.id);
                if (isCTO) {
                    const slack = 13;
                    if (remainingDist <= slack) {
                        showToast(`${t('otdr_result')}: ${t('otdr_inside_cto', { name: nextNode.name })} (${remainingDist.toFixed(1)}m into slack)`, 'info');
                        const end = nextNode.coordinates;
                        setOtdrResult(end);
                        setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                        setEditingCTO(null);
                        setEditingPOP(null);
                        return;
                    }
                    remainingDist -= slack;
                }
            }

            if (!('connections' in nextNode)) {
                showToast(t('otdr_fiber_end_node', { node: nextNode.name }), "info");
                const end = nextNode.coordinates;
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }

            const connection = (nextNode as any).connections.find((c: any) => c.sourceId === currentPortId || c.targetId === currentPortId);

            if (!connection) {
                showToast(t('otdr_fiber_end_node', { node: nextNode.name }), "info");
                const end = nextNode.coordinates;
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }

            let nextPortId = connection.sourceId === currentPortId ? connection.targetId : connection.sourceId;
            let currentInternalConn = connection;
            let visitedInternalPorts = new Set<string>();

            let internalSafety = 0;
            while (!nextPortId.includes('-fiber-') && internalSafety < 20) {
                internalSafety++;
                visitedInternalPorts.add(nextPortId);
                let jumpedPortId: string | null = null;

                if (nextPortId.startsWith('fus-')) {
                    jumpedPortId = nextPortId.endsWith('-a') ? nextPortId.replace('-a', '-b') : nextPortId.replace('-b', '-a');
                } else if (nextPortId.includes('-out-')) {
                    jumpedPortId = nextPortId.split('-out-')[0] + '-in';
                } else {
                    const patchConn = (nextNode as any).connections.find((c: any) => 
                        c !== currentInternalConn && 
                        (c.sourceId === nextPortId || c.targetId === nextPortId) &&
                        !c.sourceId.includes('-fiber-') && !c.targetId.includes('-fiber-') && 
                        (!visitedInternalPorts.has(c.sourceId) && !visitedInternalPorts.has(c.targetId))
                    );
                    if (patchConn) {
                        jumpedPortId = patchConn.sourceId === nextPortId ? patchConn.targetId : patchConn.sourceId;
                        currentInternalConn = patchConn;
                    }
                }

                if (jumpedPortId) {
                    visitedInternalPorts.add(jumpedPortId);
                    const nextInternalConn = (nextNode as any).connections.find((c: any) => 
                        c !== currentInternalConn && 
                        (c.sourceId === jumpedPortId || c.targetId === jumpedPortId)
                    );
                    
                    if (nextInternalConn) {
                        nextPortId = nextInternalConn.sourceId === jumpedPortId ? nextInternalConn.targetId : nextInternalConn.sourceId;
                        currentInternalConn = nextInternalConn;
                        continue; 
                    } else {
                        break; 
                    }
                } else {
                    const directFiberConn = (nextNode as any).connections.find((c: any) => 
                        c !== currentInternalConn &&
                        (c.sourceId === nextPortId || c.targetId === nextPortId) &&
                        (c.sourceId.includes('-fiber-') || c.targetId.includes('-fiber-'))
                    );
                    if (directFiberConn) {
                        nextPortId = directFiberConn.sourceId === nextPortId ? directFiberConn.targetId : directFiberConn.sourceId;
                        currentInternalConn = directFiberConn;
                        continue;
                    }
                    if (visitedInternalPorts.has(nextPortId)) break;
                    break;
                }
            }

            if (nextPortId.includes('-fiber-')) {
                currentPortId = nextPortId;
                currentNodeId = nextNodeId;
            } else {
                showToast(t('otdr_event_equipment', { node: nextNode.name }), "info");
                const end = nextNode.coordinates;
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }
        }
        showToast(t('otdr_max_depth'), "info");
    }, [getCurrentNetwork, setOtdrResult, setMapBounds, setEditingCTO, setEditingPOP, setEditingCable, showToast, t]);

    return { traceOpticalPath };
};
