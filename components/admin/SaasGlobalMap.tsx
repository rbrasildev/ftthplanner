import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as saasService from '../../services/saasService';
import L from 'leaflet';

// Fix Leaflet Default Icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
    iconUrl: '/leaflet/images/marker-icon.png',
    shadowUrl: '/leaflet/images/marker-shadow.png',
});

// Dot pequeno indigo com borda branca — ocupa pouco espaço, suporta zoom out,
// e empilha bem em regiões com muitas empresas (não polui o mapa).
const ProjectIcon = L.divIcon({
    className: 'custom-project-icon',
    html: `
      <div style="
        background-color: #10b981;
        border: 1.5px solid #ffffff;
        border-radius: 50%;
        width: 10px;
        height: 10px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(16,185,129,0.2);
      "></div>
    `,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -6]
});

const MapResizeHandler = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 300);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

type BaseLayer = 'street' | 'satellite';

const BASE_LAYERS: Record<BaseLayer, { url: string; attribution: string; maxZoom?: number }> = {
    street: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    satellite: {
        // Esri World Imagery — tiles gratuitos, sem token, com cobertura mundial.
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Earthstar Geographics',
        maxZoom: 19,
    },
};

export const SaasGlobalMap: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [baseLayer, setBaseLayer] = useState<BaseLayer>('street');

    useEffect(() => {
        const load = async () => {
            try {
                const data = await saasService.getGlobalMapData();
                setProjects(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return <div className="h-full flex items-center justify-center text-slate-400">Loading map data...</div>;
    }

    return (
        <div className="h-full w-full relative z-0 flex flex-col bg-white dark:bg-[#1a1d23] rounded-2xl border border-slate-200 dark:border-slate-700/30 shadow-sm overflow-hidden">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 dark:bg-[#1a1d23]/90 backdrop-blur-sm px-6 py-3 rounded-full border border-slate-200 dark:border-slate-700/30 shadow-lg flex items-center gap-4">
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Global Project Distribution</h3>
                    <p className="text-[10px] text-slate-500 font-medium">{projects.length} Active Projects</p>
                </div>
            </div>

            {/* Base-layer toggle: Mapa (street) ↔ Satélite (Esri World Imagery). */}
            <div className="absolute top-4 right-4 z-[1000] flex items-center gap-0.5 bg-white/95 dark:bg-[#1a1d23]/95 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-700/30 shadow-lg p-1">
                {([
                    { id: 'street' as const, label: 'Mapa' },
                    { id: 'satellite' as const, label: 'Satélite' },
                ]).map(opt => (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBaseLayer(opt.id)}
                        className={`px-3 py-1 text-[11px] font-bold rounded transition-colors ${baseLayer === opt.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/40'}`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 w-full relative">
                <MapContainer
                    center={[-23.5505, -46.6333]}
                    zoom={4}
                    minZoom={2}
                    maxZoom={18}
                    scrollWheelZoom={true}
                    worldCopyJump={false}
                    maxBounds={[[-85, -180], [85, 180]]}
                    style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <MapResizeHandler />
                    <TileLayer
                        key={baseLayer}
                        attribution={BASE_LAYERS[baseLayer].attribution}
                        url={BASE_LAYERS[baseLayer].url}
                        maxZoom={18}
                        maxNativeZoom={BASE_LAYERS[baseLayer].maxZoom ?? 18}
                    />
                    {projects.map(p => (
                        <Marker key={p.id} position={[p.centerLat, p.centerLng]} icon={ProjectIcon}>
                            <Popup>
                                <div className="text-sm">
                                    <strong className="block text-slate-900">{p.name}</strong>
                                    <span className="text-slate-500">{p.company?.name || 'No Company'}</span>
                                    <span className="block text-xs text-slate-400 mt-1">
                                        {new Date(p.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
};
