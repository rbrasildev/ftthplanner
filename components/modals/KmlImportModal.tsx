import React, { useState, useEffect } from 'react';
import { X, Upload, FileUp, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as toGeoJSON from '@mapbox/togeojson';
import JSZip from 'jszip';
import { useLanguage } from '../../LanguageContext';
import * as catalogService from '../../services/catalogService';
import { PoleCatalogItem } from '../../services/catalogService';

interface KmlImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (coordinates: Array<{ lat: number, lng: number }>, poleTypeId: string) => void;
}

export const KmlImportModal: React.FC<KmlImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const { t } = useLanguage();
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedPoints, setParsedPoints] = useState<Array<{ lat: number, lng: number }>>([]);
    const [error, setError] = useState<string | null>(null);
    const [poleTypes, setPoleTypes] = useState<PoleCatalogItem[]>([]);
    const [selectedPoleTypeId, setSelectedPoleTypeId] = useState<string>('');
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPoleCatalog();
            // Reset state on open
            setFile(null);
            setParsedPoints([]);
            setError(null);
            setIsParsing(false);
        }
    }, [isOpen]);

    const loadPoleCatalog = async () => {
        setIsLoadingCatalog(true);
        try {
            const types = await catalogService.getPoles();
            setPoleTypes(types);
            if (types.length > 0) {
                setSelectedPoleTypeId(types[0].id);
            }
        } catch (err) {
            console.error("Failed to load pole catalog", err);
            setError("Erro ao carregar catálogo de postes.");
        } finally {
            setIsLoadingCatalog(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);
            setParsedPoints([]);
            await parseFile(selectedFile);
        }
    };

    const parseFile = async (file: File) => {
        setIsParsing(true);
        try {
            let kmlText = '';

            if (file.name.endsWith('.kmz')) {
                const zip = new JSZip();
                const unzipped = await zip.loadAsync(file);
                // KMZ usually contains a doc.kml file
                const kmlFile = Object.values(unzipped.files).find(f => f.name.endsWith('.kml'));
                if (kmlFile) {
                    kmlText = await kmlFile.async('string');
                } else {
                    throw new Error('Arquivo KML não encontrado dentro do KMZ.');
                }
            } else if (file.name.endsWith('.kml')) {
                kmlText = await file.text();
            } else {
                throw new Error('Formato de arquivo inválido. Use .kml ou .kmz');
            }

            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, 'text/xml');
            const geoJson = toGeoJSON.kml(kmlDom);

            const points: Array<{ lat: number, lng: number }> = [];

            /* @ts-ignore */
            if (geoJson.features) {
                geoJson.features.forEach((feature: any) => {
                    if (feature.geometry && feature.geometry.type === 'Point') {
                        const [lng, lat] = feature.geometry.coordinates;
                        points.push({ lat, lng });
                    }
                });
            }

            if (points.length === 0) {
                setError('Nenhum ponto encontrado no arquivo.');
            } else {
                setParsedPoints(points);
            }

        } catch (err: any) {
            console.error("Parse error:", err);
            setError(err.message || 'Erro ao processar o arquivo.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleConfirm = () => {
        if (parsedPoints.length > 0 && selectedPoleTypeId) {
            onImport(parsedPoints, selectedPoleTypeId);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <FileUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Importar Postes (KMZ)</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-6">

                    {/* 1. File Upload Area */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Arquivo KMZ / KML</label>
                        <div className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${file ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                            <input
                                type="file"
                                accept=".kml,.kmz"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isParsing}
                            />
                            {isParsing ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Processando arquivo...</span>
                                </div>
                            ) : file ? (
                                <div className="flex flex-col items-center gap-2">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{file.name}</span>
                                    {parsedPoints.length > 0 && (
                                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full">{parsedPoints.length} pontos encontrados</span>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="w-8 h-8 text-slate-400" />
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Clique ou arraste um arquivo aqui</span>
                                    <span className="text-xs text-slate-400">Suporta .kml e .kmz do Google Earth</span>
                                </div>
                            )}
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-xs font-medium mt-1 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}
                    </div>

                    {/* 2. Pole Type Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tipo de Poste (Catálogo)</label>
                        {isLoadingCatalog ? (
                            <div className="flex items-center gap-2 text-slate-500 text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <Loader2 className="w-4 h-4 animate-spin" /> Carregando catálogo...
                            </div>
                        ) : poleTypes.length > 0 ? (
                            <select
                                value={selectedPoleTypeId}
                                onChange={(e) => setSelectedPoleTypeId(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {poleTypes.map(type => (
                                    <option key={type.id} value={type.id}>
                                        {type.name} ({type.height}m - {type.strength}daN)
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 text-sm rounded-xl border border-amber-100 dark:border-amber-900/30">
                                Nenhum tipo de poste cadastrado. Cadastre um no menu.
                            </div>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400">Este tipo será aplicado a todos os {parsedPoints.length} pontos importados.</p>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={parsedPoints.length === 0 || !selectedPoleTypeId || isParsing}
                        className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        <FileUp className="w-4 h-4" />
                        Importar {parsedPoints.length > 0 ? `(${parsedPoints.length})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};
