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

const ProjectIcon = L.divIcon({
    className: 'custom-project-icon',
    html: `
      <div style="
        background-color: #6366f1;
        border: 2px solid #ffffff;
        border-radius: 4px;
        width: 24px;
        height: 24px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
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

export const SaasGlobalMap: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
        <div className="h-full w-full relative z-0 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-6 py-3 rounded-full border border-slate-200 dark:border-slate-800 shadow-lg flex items-center gap-4">
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Global Project Distribution</h3>
                    <p className="text-[10px] text-slate-500 font-medium">{projects.length} Active Projects</p>
                </div>
            </div>

            <div className="flex-1 w-full relative">
                <MapContainer center={[-23.5505, -46.6333]} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <MapResizeHandler />
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
