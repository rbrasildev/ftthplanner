import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../../services/api';
import { CTOData } from '../../types';

interface ActiveOutage {
    ctoId: string;
    affectedCount: number;
    totalCount: number;
    startedAt: string;
}

interface OutageRingsLayerProps {
    /** Lista atual de CTOs do projeto — usada pra obter lat/lng pelo ctoId. */
    ctos: CTOData[];
    /** Toggle de visibilidade (segue o toggle de CTOs no painel de camadas). */
    visible: boolean;
    /** Intervalo de polling em ms. Default 30s. Match aproximado do ciclo
     *  de 10min do detector + buffer pra ver mudanças sem precisar refresh. */
    pollIntervalMs?: number;
}

/**
 * Renderiza anéis vermelhos pulsantes sobre os CTOs com incident ACTIVE.
 * Polling leve em /api/outages/active-ctos (payload enxuto — só ids + counts).
 *
 * Operacional: quando o cron de 10min detectar 3+ clientes do mesmo CTO
 * offline (>=30%), abre um OutageIncident. Aqui o operador vê o anel
 * pulsando no mapa em até ~30s sem precisar atualizar a página.
 */
export const OutageRingsLayer: React.FC<OutageRingsLayerProps> = ({
    ctos,
    visible,
    pollIntervalMs = 30000,
}) => {
    const map = useMap();
    const [activeOutages, setActiveOutages] = useState<ActiveOutage[]>([]);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());

    // Polling — só dispara quando o layer está visível (não desperdiça
    // requisição em background).
    useEffect(() => {
        if (!visible) return;

        let cancelled = false;
        const fetchActive = async () => {
            try {
                const res = await api.get<ActiveOutage[]>('/outages/active-ctos');
                if (!cancelled) setActiveOutages(res.data || []);
            } catch {
                // Silently fail — não queremos toast ruidoso por falha de polling
            }
        };

        fetchActive();
        const interval = setInterval(fetchActive, pollIntervalMs);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [visible, pollIntervalMs]);

    // Renderiza/atualiza os markers de anel. Usa Leaflet imperativo pra evitar
    // ficar criando/destruindo nós DOM a cada re-render do React (causaria
    // o anel "piscar" durante o polling).
    useEffect(() => {
        const existing = markersRef.current;

        if (!visible) {
            existing.forEach(m => map.removeLayer(m));
            existing.clear();
            return;
        }

        const ctoById = new Map<string, CTOData>(ctos.map(c => [c.id, c]));
        const activeSet = new Set(activeOutages.map(o => o.ctoId));

        // Remove markers de outages que não estão mais ativos
        for (const [ctoId, marker] of existing.entries()) {
            if (!activeSet.has(ctoId)) {
                map.removeLayer(marker);
                existing.delete(ctoId);
            }
        }

        // Adiciona/atualiza markers dos outages ativos
        for (const outage of activeOutages) {
            const cto = ctoById.get(outage.ctoId);
            if (!cto) continue; // CTO pode estar em projeto diferente do atual

            const ratio = outage.totalCount > 0 ? outage.affectedCount / outage.totalCount : 0;
            const startedAt = new Date(outage.startedAt);
            const minutesAgo = Math.floor((Date.now() - startedAt.getTime()) / 60000);
            const durationLabel = minutesAgo < 60
                ? `há ${minutesAgo}min`
                : `há ${Math.floor(minutesAgo / 60)}h${minutesAgo % 60 ? ` ${minutesAgo % 60}min` : ''}`;

            const tooltipHtml = `
                <div style="font-family: system-ui, sans-serif; min-width: 180px;">
                    <div style="font-weight: 700; color: #ef4444; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                        ⚠ Possível rompimento
                    </div>
                    <div style="font-weight: 600; font-size: 13px; color: #0f172a; margin-bottom: 2px;">${cto.name}</div>
                    <div style="font-size: 11px; color: #64748b;">
                        ${outage.affectedCount} de ${outage.totalCount} clientes offline (${Math.round(ratio * 100)}%)
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${durationLabel}</div>
                </div>
            `;

            const icon = L.divIcon({
                className: 'outage-ring-icon',
                html: `
                    <div class="outage-ring-pulse"></div>
                    <div class="outage-ring-core"></div>
                `,
                iconSize: [56, 56],
                iconAnchor: [28, 28],
            });

            const existingMarker = existing.get(outage.ctoId);
            if (existingMarker) {
                existingMarker.setLatLng([cto.coordinates.lat, cto.coordinates.lng]);
                existingMarker.setTooltipContent(tooltipHtml);
            } else {
                const marker = L.marker([cto.coordinates.lat, cto.coordinates.lng], {
                    icon,
                    interactive: true,
                    keyboard: false,
                    zIndexOffset: -1000, // fica ATRÁS do marker real do CTO
                });
                marker.bindTooltip(tooltipHtml, {
                    direction: 'top',
                    offset: [0, -24],
                    opacity: 1,
                    className: 'outage-ring-tooltip',
                });
                marker.addTo(map);
                existing.set(outage.ctoId, marker);
            }
        }
    }, [activeOutages, ctos, visible, map]);

    // Cleanup ao desmontar
    useEffect(() => {
        return () => {
            markersRef.current.forEach(m => map.removeLayer(m));
            markersRef.current.clear();
        };
    }, [map]);

    return null;
};
