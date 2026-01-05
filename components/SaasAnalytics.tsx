import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as saasService from '../services/saasService';
import L from 'leaflet';

// Fix Leaflet Default Icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export const SaasAnalytics = () => {
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

    if (loading) return <div className="h-64 flex items-center justify-center text-slate-400">Loading map data...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-lg">Global Project Distribution</h3>
                    <p className="text-sm text-slate-500">Geographic spread of all active projects.</p>
                </div>
                <div className="h-[500px] w-full relative z-0">
                    <MapContainer center={[-23.5505, -46.6333]} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {projects.map(p => (
                            <Marker key={p.id} position={[p.centerLat, p.centerLng]}>
                                <Popup>
                                    <div className="text-sm">
                                        <strong className="block text-slate-900">{p.name}</strong>
                                        <span className="text-slate-500">{p.company?.name || 'No Company'}</span>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Project Density</h3>
                    <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">
                        Example Chart: Projects per Region (Coming Soon)
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Network Growth</h3>
                    <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">
                        Example Chart: New Projects vs Time (Coming Soon)
                    </div>
                </div>
            </div>
        </div>
    );
};
