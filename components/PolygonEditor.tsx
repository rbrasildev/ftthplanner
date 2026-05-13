import React, { useState } from 'react';
import { PolygonData, POLYGON_PALETTE } from '../types';
import { X, Save, Trash2, Hexagon, Palette, AlertTriangle } from 'lucide-react';
import L from 'leaflet';
import { useLanguage } from '../LanguageContext';
import { CustomInput } from './common/CustomInput';

interface PolygonEditorProps {
    polygon: PolygonData;
    onClose: () => void;
    onSave: (updated: PolygonData) => void;
    onDelete: (id: string) => void;
}

function computeAreaSqm(points: { lat: number; lng: number }[]): number {
    if (points.length < 3) return 0;
    const latlngs = points.map(p => L.latLng(p.lat, p.lng));
    // Shoelace on an equirectangular projection at the polygon's centroid latitude.
    const centroidLat = latlngs.reduce((s, ll) => s + ll.lat, 0) / latlngs.length;
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((centroidLat * Math.PI) / 180);
    let area = 0;
    for (let i = 0; i < latlngs.length; i++) {
        const a = latlngs[i];
        const b = latlngs[(i + 1) % latlngs.length];
        const ax = a.lng * mPerDegLng;
        const ay = a.lat * mPerDegLat;
        const bx = b.lng * mPerDegLng;
        const by = b.lat * mPerDegLat;
        area += ax * by - bx * ay;
    }
    return Math.abs(area) / 2;
}

function formatArea(sqm: number): string {
    if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`;
    if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(2)} ha`;
    return `${sqm.toFixed(0)} m²`;
}

export const PolygonEditor: React.FC<PolygonEditorProps> = ({ polygon, onClose, onSave, onDelete }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState<PolygonData>({
        ...polygon,
        fillOpacity: polygon.fillOpacity ?? 0.25,
        weight: polygon.weight ?? 2,
    });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const area = computeAreaSqm(polygon.points);

    const handleSave = () => {
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed top-20 right-4 w-80 bg-white dark:bg-[#22262e] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[2500] animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <Hexagon className="w-5 h-5" style={{ color: formData.color }} />
                    <h3 className="font-bold text-slate-900 dark:text-white">
                        {t('polygon_editor_title') || 'Editar Área'}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    aria-label="Fechar"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4 space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                        {t('name') || 'Nome'}
                    </label>
                    <CustomInput
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t('polygon_default_name') || 'Área'}
                    />
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Palette className="w-3 h-3" />
                        {t('color') || 'Cor'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {POLYGON_PALETTE.map(c => (
                            <button
                                key={c}
                                onClick={() => setFormData({ ...formData, color: c })}
                                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${formData.color === c ? 'border-slate-900 dark:border-white scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#22262e] ring-slate-400' : 'border-white dark:border-slate-600'}`}
                                style={{ backgroundColor: c }}
                                aria-label={c}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                        {t('polygon_fill_opacity') || 'Opacidade do preenchimento'}: {Math.round((formData.fillOpacity ?? 0.25) * 100)}%
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="0.8"
                        step="0.05"
                        value={formData.fillOpacity ?? 0.25}
                        onChange={(e) => setFormData({ ...formData, fillOpacity: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-500"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">
                        {t('polygon_border_weight') || 'Espessura da borda'}: {formData.weight ?? 2}px
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="6"
                        step="1"
                        value={formData.weight ?? 2}
                        onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500"
                    />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        {t('polygon_area') || 'Área'}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatArea(area)}
                    </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        {t('polygon_vertices') || 'Vértices'}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {polygon.points.length}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
                {!showDeleteConfirm ? (
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('delete') || 'Excluir'}
                    </button>
                ) : (
                    <div className="flex items-center gap-2 flex-1">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <button
                            onClick={() => onDelete(polygon.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        >
                            {t('confirm_delete') || 'Confirmar'}
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-2 text-xs font-semibold"
                        >
                            {t('cancel') || 'Cancelar'}
                        </button>
                    </div>
                )}

                <button
                    onClick={handleSave}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    {t('save') || 'Salvar'}
                </button>
            </div>
        </div>
    );
};
