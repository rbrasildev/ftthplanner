import React, { useState, useEffect, useMemo } from 'react';
import { X, Upload, FileUp, CheckCircle2, AlertCircle, Loader2, Cable, Box, Building2, Search, CheckSquare, Trash2, Eye, EyeOff, ExternalLink, ArrowRight } from 'lucide-react';
import * as toGeoJSON from '@mapbox/togeojson';
import JSZip from 'jszip';
import { useLanguage } from '../../LanguageContext';
import * as catalogService from '../../services/catalogService';
import { CableCatalogItem, BoxCatalogItem, PoleCatalogItem } from '../../services/catalogService';

interface KmlImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPreview: (data: any) => void;
    onImport: (data: any) => void;
}

type ImportTab = 'cables' | 'ctos' | 'ceos' | 'poles';

interface DetectedItem {
    id: string;
    originalName: string;
    coordinates: any; // GeoJSON coordinates
    properties: any;
    selected: boolean;

    // Classification
    typeId: string; // Catalog ID
    status?: string;

    // Extra Fields
    extra?: any; // e.g. splitter ratio for CTO, splice count for CEO
}

export const AdvancedImportModal: React.FC<KmlImportModalProps> = ({ isOpen, onClose, onPreview, onImport }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<ImportTab>('cables');
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

    // Staging Data
    const [items, setItems] = useState<{
        cables: DetectedItem[];
        ctos: DetectedItem[];
        ceos: DetectedItem[];
        poles: DetectedItem[];
    }>({
        cables: [],
        ctos: [],
        ceos: [],
        poles: []
    });

    // Catalogs
    const [cableTypes, setCableTypes] = useState<CableCatalogItem[]>([]);
    const [boxTypes, setBoxTypes] = useState<BoxCatalogItem[]>([]);
    const [poleTypes, setPoleTypes] = useState<PoleCatalogItem[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadCatalogs();
            // Reset state
            setFile(null);
            setError(null);
            setIsParsing(false);
            setItems({ cables: [], ctos: [], ceos: [], poles: [] });
            onPreview(null);
        }
    }, [isOpen]);

    // Send Preview update whenever items change
    useEffect(() => {
        if (!isOpen) return;
        const previewData = {
            cables: items.cables.map(c => {
                const type = cableTypes.find(t => t.id === c.typeId);
                return {
                    ...c,
                    color: type?.deployedSpec?.color || type?.plannedSpec?.color || '#f59e0b'
                };
            }),
            ctos: items.ctos,
            ceos: items.ceos,
            poles: items.poles
        };
        onPreview(previewData);
    }, [items, cableTypes, isOpen]);

    const loadCatalogs = async () => {
        setIsLoadingCatalog(true);
        try {
            const [cables, boxes, poles] = await Promise.all([
                catalogService.getCables(),
                catalogService.getBoxes(),
                catalogService.getPoles()
            ]);
            setCableTypes(cables);
            setBoxTypes(boxes);
            setPoleTypes(poles);
        } catch (err) {
            console.error("Failed to load catalogs", err);
            setError("Erro ao carregar catálogos.");
        } finally {
            setIsLoadingCatalog(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);
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
                const kmlFile = Object.values(unzipped.files).find(f => f.name.endsWith('.kml'));
                if (kmlFile) kmlText = await kmlFile.async('string');
                else throw new Error('KML não encontrado no KMZ.');
            } else if (file.name.endsWith('.kml')) {
                kmlText = await file.text();
            } else {
                throw new Error('Formato inválido. Use .kml ou .kmz');
            }

            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, 'text/xml');
            const geoJson = toGeoJSON.kml(kmlDom);

            const newItems = {
                cables: [] as DetectedItem[],
                ctos: [] as DetectedItem[],
                ceos: [] as DetectedItem[],
                poles: [] as DetectedItem[],
            };

            const pointFeatures = geoJson.features?.filter((f: any) => f.geometry?.type === 'Point') || [];
            const lineFeatures = geoJson.features?.filter((f: any) => f.geometry?.type === 'LineString') || [];

            // Parse Cables
            newItems.cables = lineFeatures.map((f: any, idx: number) => ({
                id: `cable-${idx}`,
                originalName: f.properties?.name || `Cabo ${idx + 1}`,
                coordinates: f.geometry.coordinates,
                properties: f.properties,
                selected: true,
                typeId: '', // Unclassified
                extra: { length: 0 } // Calculate length if possible (simplified here)
            }));

            // Parse Points (Heuristic Distribution)
            pointFeatures.forEach((f: any, idx: number) => {
                const name = (f.properties?.name || '').toUpperCase();
                const item: DetectedItem = {
                    id: `node-${idx}`,
                    originalName: f.properties?.name || `Ponto ${idx + 1}`,
                    coordinates: f.geometry.coordinates,
                    properties: f.properties,
                    selected: true,
                    typeId: ''
                };

                if (name.includes('CTO') || name.includes('NAP')) {
                    newItems.ctos.push(item);
                } else if (name.includes('CEO') || name.includes('EMENDA') || name.includes('FOSC')) {
                    newItems.ceos.push(item);
                } else if (name.includes('POSTE')) {
                    newItems.poles.push(item);
                } else {
                    // Default to CTO if uncertain, or Poles?
                    // Let's put in 'poles' as catch-all or create a generic 'unknown'?
                    // User asked specifically for Cables, CTO, CEO tabs.
                    // Let's put in Poles for now as it's a safe container, or CTO.
                    newItems.ctos.push(item);
                }
            });

            setItems(newItems);

            // Auto-switch to first populated tab
            if (newItems.cables.length > 0) setActiveTab('cables');
            else if (newItems.ctos.length > 0) setActiveTab('ctos');

        } catch (err: any) {
            console.error("Parse error:", err);
            setError(err.message || 'Erro ao processar arquivo.');
        } finally {
            setIsParsing(false);
        }
    };

    // Bulk Actions
    const handleSelectAll = (checked: boolean) => {
        setItems(prev => ({
            ...prev,
            [activeTab]: prev[activeTab].map(i => ({ ...i, selected: checked }))
        }));
    };

    const handleApplyType = (typeId: string) => {
        setItems(prev => ({
            ...prev,
            [activeTab]: prev[activeTab].map(i => i.selected ? { ...i, typeId } : i)
        }));
    };

    const handleApplyStatus = (status: string) => {
        setItems(prev => ({
            ...prev,
            [activeTab]: prev[activeTab].map(i => i.selected ? { ...i, status } : i)
        }));
    };

    const handleMoveTo = (targetTab: ImportTab) => {
        const toMove = items[activeTab].filter(i => i.selected);
        if (toMove.length === 0) return;

        setItems(prev => ({
            ...prev,
            [activeTab]: prev[activeTab].filter(i => !i.selected),
            [targetTab]: [...prev[targetTab], ...toMove.map(i => ({ ...i, selected: true }))] // Keep selected in new tab
        }));
    };

    // Validation
    const invalidCount = useMemo(() => {
        let count = 0;
        ['cables', 'ctos', 'ceos', 'poles'].forEach((key) => {
            const list = items[key as ImportTab];
            const invalid = list.filter(i => i.selected && !i.typeId).length; // Only selected items need types? Or all? Usually "Import" acts on ALL.
            // Assumption: User wants to import EVERYTHING found. So all must have type.
            // Or maybe only Selected items are imported.
            // Let's assume: ONLY CHECKED ITEMS ARE IMPORTED.
            count += list.filter(i => i.selected && !i.typeId).length;
        });
        return count;
    }, [items]);

    const totalSelected = useMemo(() => {
        return items.cables.filter(i => i.selected).length +
            items.ctos.filter(i => i.selected).length +
            items.ceos.filter(i => i.selected).length +
            items.poles.filter(i => i.selected).length;
    }, [items]);

    const handleConfirm = () => {
        if (invalidCount > 0) return;

        // Prepare Data for Import
        const exportData = {
            cables: items.cables.filter(i => i.selected).map(c => ({ ...c, type: cableTypes.find(t => t.id === c.typeId) })),
            ctos: items.ctos.filter(i => i.selected).map(c => ({ ...c, type: boxTypes.find(t => t.id === c.typeId) })),
            ceos: items.ceos.filter(i => i.selected).map(c => ({ ...c, type: boxTypes.find(t => t.id === c.typeId) })),
            poles: items.poles.filter(i => i.selected).map(p => ({ ...p, type: poleTypes.find(t => t.id === p.typeId) }))
        };

        onImport(exportData);
    };

    if (!isOpen) return null;

    const renderTabButton = (tab: ImportTab, label: string, icon: any, count: number) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === tab
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-900/10'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
        >
            {React.createElement(icon, { className: "w-4 h-4" })}
            <span className="text-sm">{label}</span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 py-0.5 px-2 rounded-full font-mono">{count}</span>
        </button>
    );

    const activeList = items[activeTab];
    const activeCatalog = activeTab === 'cables' ? cableTypes :
        activeTab === 'poles' ? poleTypes :
            boxTypes.filter(b => activeTab === 'ctos' ? b.type === 'CTO' : b.type === 'CEO');

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">

                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <FileUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-slate-800 dark:text-white">Importação Profissional KMZ</h3>
                            <p className="text-xs text-slate-500">Valide e classifique os elementos antes de importar.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* File Upload / Status */}
                {!file ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12">
                        <div className={`relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-all w-full max-w-2xl
                            ${isParsing ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/30'}
                         `}>
                            <input
                                type="file"
                                accept=".kml,.kmz"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isParsing}
                            />
                            {isParsing ? (
                                <div className="flex flex-col items-center gap-4">
                                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                    <h3 className="text-xl font-bold text-slate-700">Processando Arquivo...</h3>
                                    <p className="text-slate-500">Isso pode levar alguns segundos dependendo do tamanho.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-2">
                                        <Upload className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Selecione o arquivo KMZ/KML</h3>
                                    <p className="text-slate-500 max-w-md">O sistema irá identificar automaticamente Cabos, CTOs, CEOs e Postes para você classificar e validar.</p>
                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 mt-4">.kml ou .kmz</span>
                                </div>
                            )}
                        </div>
                        {error && (
                            <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/50">
                                <AlertCircle className="w-5 h-5" /> {error}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
                            {renderTabButton('cables', 'Cabos', Cable, items.cables.length)}
                            {renderTabButton('ctos', 'CTO', Box, items.ctos.length)}
                            {renderTabButton('ceos', 'CEO', Building2, items.ceos.length)}
                            {renderTabButton('poles', 'Postes', CheckSquare, items.poles.length)}
                        </div>

                        {/* Toolbar (Bulk Actions) */}
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 flex items-center gap-4 shrink-0 overflow-x-auto">
                            <div className="flex items-center gap-2 px-2 border-r border-slate-200">
                                <input
                                    type="checkbox"
                                    checked={activeList.length > 0 && activeList.every(i => i.selected)}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                    className="rounded border-slate-300 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold uppercase text-slate-500">Todos</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500">Definir Tipo:</span>
                                <select
                                    className="text-sm p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 min-w-[200px]"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleApplyType(e.target.value);
                                            e.target.value = ""; // Reset
                                        }
                                    }}
                                >
                                    <option value="">-- Selecione para aplicar em massa --</option>
                                    {activeCatalog.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Selector (Bulk) */}
                            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4 border-r pr-4 mr-2">
                                <span className="text-xs font-medium text-slate-500">Status:</span>
                                <select
                                    className="text-sm p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleApplyStatus(e.target.value);
                                            e.target.value = ""; // Reset
                                        }
                                    }}
                                >
                                    <option value="">-- Status --</option>
                                    <option value="DEPLOYED">Implantado</option>
                                    <option value="NOT_DEPLOYED">Não Implantado</option>
                                    {activeTab !== 'cables' && <option value="PLANNED">Em Projeto</option>}
                                </select>
                            </div>

                            {/* Move Items Utility */}
                            {activeTab !== 'cables' && (
                                <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-xs font-medium text-slate-500">Mover para:</span>
                                    <div className="flex gap-1">
                                        {activeTab !== 'ctos' && <button onClick={() => handleMoveTo('ctos')} className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50">CTO</button>}
                                        {activeTab !== 'ceos' && <button onClick={() => handleMoveTo('ceos')} className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50">CEO</button>}
                                        {activeTab !== 'poles' && <button onClick={() => handleMoveTo('poles')} className="px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-slate-50">Poste</button>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
                            {activeList.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <Search className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Nenhum item nesta categoria.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase">
                                        <tr>
                                            <th className="p-3 w-10 text-center">
                                                {/* Check handleSelectAll logic */}
                                            </th>
                                            <th className="p-3">Nome (KMZ)</th>
                                            <th className="p-3">Classificação (Tipo)</th>
                                            <th className="p-3 text-right">Info Extra</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {activeList.map((item) => (
                                            <tr key={item.id} className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors ${!item.selected ? 'opacity-50 grayscale' : ''}`}>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.selected}
                                                        onChange={(e) => {
                                                            const isChecked = e.target.checked;
                                                            setItems(prev => ({
                                                                ...prev,
                                                                [activeTab]: prev[activeTab].map(i => i.id === item.id ? { ...i, selected: isChecked } : i)
                                                            }));
                                                        }}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                                                    {item.originalName}
                                                    {item.properties?.description && (
                                                        <span className="block text-[10px] text-slate-400 font-normal truncate max-w-[200px]">{item.properties.description}</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <select
                                                        value={item.typeId}
                                                        onChange={(e) => {
                                                            const newType = e.target.value;
                                                            setItems(prev => ({
                                                                ...prev,
                                                                [activeTab]: prev[activeTab].map(i => i.id === item.id ? { ...i, typeId: newType } : i)
                                                            }));
                                                        }}
                                                        disabled={!item.selected}
                                                        className={`w-full text-sm p-1.5 rounded border ${!item.typeId && item.selected ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {activeCatalog.map((t: any) => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-3 text-right text-xs text-slate-500 font-mono flex items-center justify-end gap-2">
                                                    {item.status && (
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                                            ${item.status === 'DEPLOYED' ? 'bg-blue-100 text-blue-600' :
                                                                item.status === 'PLANNED' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            {item.status === 'DEPLOYED' ? 'IMPLANTADO' : item.status === 'PLANNED' ? 'PROJETO' : 'NÃO IMPL.'}
                                                        </span>
                                                    )}
                                                    {/* Display helpers driven by type */}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                            <div className="text-sm font-medium">
                                {invalidCount > 0 ? (
                                    <span className="text-red-500 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        {invalidCount} itens selecionados sem classificação.
                                    </span>
                                ) : totalSelected > 0 ? (
                                    <span className="text-emerald-600 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Tudo pronto para importar {totalSelected} itens.
                                    </span>
                                ) : (
                                    <span className="text-slate-400">Nenhum item selecionado.</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={invalidCount > 0 || totalSelected === 0}
                                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95 transition-all"
                                >
                                    <FileUp className="w-5 h-5" />
                                    <span>Confirmar Importação</span>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
