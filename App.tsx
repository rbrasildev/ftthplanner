import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapView } from './components/MapView';
import { CTOEditor } from './components/CTOEditor';
import { POPEditor } from './components/POPEditor';
import { ProjectManager } from './components/ProjectManager';
import { CableEditor } from './components/CableEditor';
import { CTODetailsPanel } from './components/CTODetailsPanel';
import { POPDetailsPanel } from './components/POPDetailsPanel';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { DashboardPage } from './components/DashboardPage';
import { CTOData, POPData, CableData, NetworkState, Project, Coordinates, CTOStatus, SystemSettings } from './types';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import {
    Network, Settings2, Map as MapIcon, Zap, MousePointer2, FolderOpen, Unplug, CheckCircle2, LogOut, Activity, Eye, EyeOff, Server, Flashlight, Search, Box, Move, Ruler, X, Settings, Moon, Sun, Check, Loader2
} from 'lucide-react';
import JSZip from 'jszip';
import toGeoJSON from '@mapbox/togeojson';
import L from 'leaflet';
import * as projectService from './services/projectService';
import * as authService from './services/authService';
import api from './services/api';

const STORAGE_KEY_TOKEN = 'ftth_planner_token_v1';
const STORAGE_KEY_USER = 'ftth_planner_user_v1';


// Helper type for cable starting point
type CableStart = { type: 'node', id: string } | { type: 'coord', lat: number, lng: number };

// --- GEOMETRY HELPERS ---
function getDistanceToSegment(p: Coordinates, a: Coordinates, b: Coordinates) {
    const x = p.lat;
    const y = p.lng;
    const x1 = a.lat;
    const y1 = a.lng;
    const x2 = b.lat;
    const y2 = b.lng;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;

    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    // Approximate conversion to meters (very rough, but sufficient for short snap distances)
    // 1 degree lat ~ 111km. 
    const distDeg = Math.sqrt(dx * dx + dy * dy);
    const distMeters = distDeg * 111320;

    return {
        dist: distMeters,
        point: { lat: xx, lng: yy },
        isEndpoint: (xx === x1 && yy === y1) || (xx === x2 && yy === y2)
    };
}

// --- AUTO SNAP LOGIC ---
const autoSnapNetwork = (net: NetworkState, snapDistance: number): { state: NetworkState, snappedCount: number } => {
    const nodes = [...net.ctos, ...(net.pops || [])];
    let snappedCount = 0;
    let hasChanges = false;

    // 1. Process Cable Ends (Tips)
    let currentCables = net.cables.map(cable => {
        let cModified = false;
        const coords = cable.coordinates.map(c => ({ ...c }));
        let from = cable.fromNodeId;
        let to = cable.toNodeId;

        // Check Start Point
        if (!from && coords.length > 0) {
            const startPt = L.latLng(coords[0].lat, coords[0].lng);
            let closestNode = null;
            let minDesc = Infinity;

            for (const n of nodes) {
                const dist = startPt.distanceTo(L.latLng(n.coordinates.lat, n.coordinates.lng));
                if (dist <= snapDistance && dist < minDesc) {
                    minDesc = dist;
                    closestNode = n;
                }
            }

            if (closestNode) {
                coords[0] = { ...closestNode.coordinates };
                from = closestNode.id;
                cModified = true;
                snappedCount++;
            }
        }

        // Check End Point
        if (!to && coords.length > 0) {
            const endPt = L.latLng(coords[coords.length - 1].lat, coords[coords.length - 1].lng);
            let closestNode = null;
            let minDesc = Infinity;

            for (const n of nodes) {
                const dist = endPt.distanceTo(L.latLng(n.coordinates.lat, n.coordinates.lng));
                if (dist <= snapDistance && dist < minDesc) {
                    minDesc = dist;
                    closestNode = n;
                }
            }

            if (closestNode) {
                coords[coords.length - 1] = { ...closestNode.coordinates };
                to = closestNode.id;
                cModified = true;
                snappedCount++;
            }
        }

        if (cModified) {
            hasChanges = true;
            return { ...cable, coordinates: coords, fromNodeId: from, toNodeId: to };
        }
        return cable;
    });

    // 2. Process Mid-Span Splits (Sangria)
    // We iterate through the cables resulting from step 1.
    // If a node is close to the middle of a cable, we split the cable.
    const finalCables: CableData[] = [];

    for (const cable of currentCables) {
        if (cable.coordinates.length < 2) {
            finalCables.push(cable);
            continue;
        }

        let bestSplit = null; // { node, segmentIndex, point }

        // Check this cable against all nodes
        for (const node of nodes) {
            // If already connected to this node, skip (prevent infinite splitting of ends)
            if (cable.fromNodeId === node.id || cable.toNodeId === node.id) continue;

            // Check every segment of the cable
            for (let i = 0; i < cable.coordinates.length - 1; i++) {
                const p1 = cable.coordinates[i];
                const p2 = cable.coordinates[i + 1];

                const result = getDistanceToSegment(node.coordinates, p1, p2);

                if (result.dist <= snapDistance) {
                    // Found a candidate. Is it the best one for this cable?
                    if (!bestSplit || result.dist < bestSplit.dist) {
                        bestSplit = { node, segmentIndex: i, point: result.point, dist: result.dist };
                    }
                }
            }
        }

        if (bestSplit) {
            // PERFORM SPLIT
            hasChanges = true;
            snappedCount++;
            const { node, segmentIndex, point } = bestSplit;

            // Coordinates for Cable A (Start -> Node)
            const coordsA = [...cable.coordinates.slice(0, segmentIndex + 1), node.coordinates];
            // Coordinates for Cable B (Node -> End)
            const coordsB = [node.coordinates, ...cable.coordinates.slice(segmentIndex + 1)];

            const cableA: CableData = {
                ...cable,
                coordinates: coordsA,
                toNodeId: node.id, // Connect end of A to Node
                name: `${cable.name} (A)`
            };

            const cableB: CableData = {
                ...cable,
                id: `cable-split-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, // New ID
                fromNodeId: node.id, // Connect start of B to Node
                toNodeId: cable.toNodeId,
                coordinates: coordsB,
                name: `${cable.name.replace(' (A)', '')} (B)`
            };

            finalCables.push(cableA, cableB);
        } else {
            finalCables.push(cable);
        }
    }

    if (!hasChanges) return { state: net, snappedCount: 0 };

    // 3. Update Node References (Input Cables)
    const updateNodeInputs = (node: any) => {
        const connectedCableIds = finalCables
            .filter(c => c.fromNodeId === node.id || c.toNodeId === node.id)
            .map(c => c.id);

        const currentInputs = node.inputCableIds || [];

        const isSame = connectedCableIds.length === currentInputs.length &&
            connectedCableIds.every(id => currentInputs.includes(id));

        if (!isSame) {
            return { ...node, inputCableIds: connectedCableIds };
        }
        return node;
    };

    return {
        state: {
            ...net,
            cables: finalCables,
            ctos: net.ctos.map(updateNodeInputs),
            pops: (net.pops || []).map(updateNodeInputs)
        },
        snappedCount
    };
};

export default function App() {
    const { t, language, setLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();

    const [user, setUser] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_USER));
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_TOKEN));
    const [authView, setAuthView] = useState<'login' | 'register'>('login');

    // Projects List (Summaries)
    const [projects, setProjects] = useState<Project[]>([]);
    // Current Active Project (Full Data)
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);

    // Global System Settings
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({ snapDistance: 30 });

    const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => localStorage.getItem('ftth_current_project_id'));

    useEffect(() => {
        if (currentProjectId) {
            localStorage.setItem('ftth_current_project_id', currentProjectId);
        } else {
            localStorage.removeItem('ftth_current_project_id');
        }
    }, [currentProjectId]);
    const prevProjectIdRef = useRef<string>('');

    const [showProjectManager, setShowProjectManager] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);
    const settingsTimeoutRef = useRef<any>(null);
    const syncTimeoutRef = useRef<any>(null); // For debounce sync

    const [toolMode, setToolMode] = useState<'view' | 'add_cto' | 'add_pop' | 'draw_cable' | 'connect_cable' | 'move_node'>('view');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'info' } | null>(null);
    const [showLabels, setShowLabels] = useState(() => {
        const saved = localStorage.getItem('ftth_show_labels');
        return saved === 'true'; // Default to false if not present or 'false'
    });

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingCTO, setEditingCTO] = useState<CTOData | null>(null);
    const [editingPOP, setEditingPOP] = useState<POPData | null>(null);
    const [editingCable, setEditingCable] = useState<CableData | null>(null);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    // State for highlighting cable on map when hovering in editor
    const [highlightedCableId, setHighlightedCableId] = useState<string | null>(null);

    // New Cable Creation State (Unified)
    const [cableStart, setCableStart] = useState<CableStart | null>(null);

    const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);

    // --- Global VFL State ---
    const [vflSource, setVflSource] = useState<string | null>(null);

    // --- OTDR State ---
    const [otdrResult, setOtdrResult] = useState<Coordinates | null>(null);

    useEffect(() => user ? localStorage.setItem(STORAGE_KEY_USER, user) : localStorage.removeItem(STORAGE_KEY_USER), [user]);
    useEffect(() => token ? localStorage.setItem(STORAGE_KEY_TOKEN, token) : localStorage.removeItem(STORAGE_KEY_TOKEN), [token]);

    // Load Projects on Auth
    useEffect(() => {
        if (token && user) {
            setIsLoadingProjects(true);
            projectService.getProjects()
                .then(setProjects)
                .catch(console.error)
                .finally(() => setIsLoadingProjects(false));
        }
    }, [token, user]);

    // Load Project Details when ID changes
    useEffect(() => {
        if (currentProject) {
            setProjects(prev => prev.map(p => p.id === currentProject.id ? currentProject : p));
        }
    }, [currentProject]);

    useEffect(() => {
        if (currentProjectId && token && currentProjectId !== prevProjectIdRef.current) {
            projectService.getProject(currentProjectId).then(p => {
                setCurrentProject(p);
                if (p.settings) setSystemSettings(p.settings);
            }).catch(err => {
                console.error(err);
                setToast({ msg: 'Failed to load project', type: 'info' });
            });
        } else {
            setCurrentProject(null);
        }
    }, [currentProjectId, token]);

    useEffect(() => {
        localStorage.setItem('ftth_show_labels', showLabels.toString());
    }, [showLabels]);

    // Reset map bounds when project changes
    useEffect(() => {
        if (currentProjectId !== prevProjectIdRef.current) {
            setMapBounds(null);
            prevProjectIdRef.current = currentProjectId || '';
            isInitialLoad.current = true;
        }
    }, [currentProjectId]);

    const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // const currentProject = projects.find(p => p.id === currentProjectId); // REMOVED (using state)
    const getCurrentNetwork = (): NetworkState => {
        return currentProject ? { ctos: currentProject.network.ctos, pops: currentProject.network.pops || [], cables: currentProject.network.cables } : { ctos: [], pops: [], cables: [] };
    };

    const updateCurrentNetwork = (updater: (prev: NetworkState) => NetworkState) => {
        if (!currentProjectId || !currentProject) return;

        setCurrentProject(prev => {
            if (!prev) return null;
            const newNetwork = updater(prev.network);
            return { ...prev, network: newNetwork, updatedAt: Date.now() };
        });

        // DEBOUNCE SYNC
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
            // We need the *latest* state here. 
            // Since we are inside a closure, accessing `currentProject` might be stale if not careful.
            // However, we are scheduling a sync. 
            // Ideally we should use a ref to hold latest network or just pass the computed newNetwork if updater is simple.
            // But updater is a function.
            // The safest way in React functional components for debounce with state dependence is using a ref that tracks state, OR just trusting the latest update triggers a re-render which triggers an effect?
            // Better: Let's use a `useEffect` that watches `currentProject` to sync, but we need to distinguish local updates from load updates.
            // For now, let's just trigger the sync with the computed newNetwork immediately in the timeout logic? 
            // Accessing state in timeout is tricky.
            // Let's rely on `useEffect` [currentProject] with debounce?
            // But `currentProject` changes on LOAD too.
            // Let's implement the sync call right here using the calculating result (newNetwork).
            // Since we can't easily get the result of the state update outside the setter generally, we have to calculate it.
            const prevNet = currentProject.network;
            const nextNet = updater(prevNet);
            // Note: `currentProject.network` in this scope is from the render scope. `updater` might depend on prev state.
            // If we use `setCurrentProject(prev => ...)` above, `prev` is the true latest.
            // We can't access `newNetwork` inside the `setCurrentProject` and export it easily.

            // Alternative: Use a separate `useEffect` to sync changes.
        }, 1000);
    };

    const [isSaving, setIsSaving] = useState(false);

    // Actually, let's use a specific Effect for Syncing changes to backend
    const isInitialLoad = useRef(true);
    const syncErrorCount = useRef(0);
    useEffect(() => {
        if (!currentProject || !token) return;
        if (isInitialLoad.current) { isInitialLoad.current = false; return; }

        setIsSaving(true);
        const timer = setTimeout(() => {
            projectService.syncProject(currentProject.id, currentProject.network, currentProject.mapState, systemSettings)
                .then(() => {
                    console.log(`[Sync] Project ${currentProject.name} saved.`);
                    setIsSaving(false);
                    syncErrorCount.current = 0; // Reset error count on success
                })
                .catch(e => {
                    console.error("Sync failed", e);
                    setIsSaving(false);
                    syncErrorCount.current++;
                    // Only show toast on first 2 errors to avoid spam
                    if (syncErrorCount.current <= 2) {
                        showToast('Erro ao sincronizar com servidor', 'info');
                    }
                });
        }, 2000); // Increased from 300ms to 2000ms (2 seconds)
        return () => clearTimeout(timer);
    }, [currentProject, token]);

    // Helper to trigger snap and notify
    const performAutoSnap = (overrideDistance?: number) => {
        if (!currentProjectId) return;
        const distance = overrideDistance ?? systemSettings.snapDistance;
        let count = 0;
        updateCurrentNetwork(prev => {
            const result = autoSnapNetwork(prev, distance);
            count = result.snappedCount;
            return result.state;
        });
        if (count > 0) {
            showToast(`Auto-connected/Split ${count} locations within ${distance}m.`, 'success');
        }
    };

    // --- TRIGGER AUTO SNAP WHEN SETTINGS CHANGE AUTOMATICALLY ---
    // Using a timeout to debounce slightly if the user is typing fast, but ensuring it runs.
    useEffect(() => {
        if (currentProjectId) {
            const timer = setTimeout(() => {
                performAutoSnap(systemSettings.snapDistance);
            }, 1500); // Increased from 500ms to 1500ms for better performance
            return () => clearTimeout(timer);
        }
    }, [systemSettings.snapDistance, currentProjectId]);


    const handleMapMoveEnd = (lat: number, lng: number, zoom: number) => {
        // Map position saving disabled for better performance
        // The map will reset to project center on reload
    };

    // Search Logic - Optimized
    const searchResults = useMemo(() => {
        const term = searchTerm.trim();

        // Require at least 2 characters to search
        if (term.length < 2) return [];

        const lowerTerm = term.toLowerCase();
        const net = getCurrentNetwork();

        const matchedCtos = net.ctos
            .filter(c => c.name.toLowerCase().includes(lowerTerm))
            .map(c => ({ ...c, type: 'CTO' as const }));

        const matchedPops = (net.pops || [])
            .filter(p => p.name.toLowerCase().includes(lowerTerm))
            .map(p => ({ ...p, type: 'POP' as const }));

        // Limit to 10 results for better performance
        return [...matchedPops, ...matchedCtos].slice(0, 10);
    }, [searchTerm, projects, currentProjectId]);

    const handleSearchResultClick = (item: { id: string, coordinates: Coordinates, type: 'CTO' | 'POP' }) => {
        setSelectedId(item.id);
        setToolMode('view');
        const offset = 0.0015;
        setMapBounds([
            [item.coordinates.lat - offset, item.coordinates.lng - offset],
            [item.coordinates.lat + offset, item.coordinates.lng + offset]
        ]);
        setSearchTerm('');
    };

    // ... (litNetwork logic unchanged) ...
    const litNetwork = useMemo(() => {
        const network = getCurrentNetwork();
        const litPorts = new Set<string>();
        const litCables = new Set<string>();
        const litConnections = new Set<string>();

        if (!vflSource) return { litPorts, litCables, litConnections };

        const queue = [vflSource];
        litPorts.add(vflSource);

        if (vflSource.includes('-fiber-')) {
            const cableId = vflSource.split('-fiber-')[0];
            litCables.add(cableId);
        }

        const allNodes = [...network.ctos, ...network.pops];

        while (queue.length > 0) {
            const curr = queue.shift()!;
            for (const node of allNodes) {
                const attachedConns = node.connections.filter(c => c.sourceId === curr || c.targetId === curr);
                attachedConns.forEach(conn => {
                    if (!litConnections.has(conn.id)) {
                        litConnections.add(conn.id);
                        const neighbor = conn.sourceId === curr ? conn.targetId : conn.sourceId;
                        if (!litPorts.has(neighbor)) {
                            litPorts.add(neighbor);
                            queue.push(neighbor);
                            if (neighbor.includes('-fiber-')) {
                                const cid = neighbor.split('-fiber-')[0];
                                litCables.add(cid);
                            }
                        }
                    }
                });

                if ('splitters' in node) {
                    const splitter = (node as CTOData).splitters.find(s => s.inputPortId === curr || s.outputPortIds.includes(curr));
                    if (splitter) {
                        if (curr === splitter.inputPortId) {
                            splitter.outputPortIds.forEach(out => {
                                if (!litPorts.has(out)) { litPorts.add(out); queue.push(out); }
                            });
                        } else {
                            if (!litPorts.has(splitter.inputPortId)) { litPorts.add(splitter.inputPortId); queue.push(splitter.inputPortId); }
                        }
                    }
                }

                const fusion = node.fusions.find(f => f.id + '-a' === curr || f.id + '-b' === curr);
                if (fusion) {
                    const otherSide = curr.endsWith('-a') ? `${fusion.id}-b` : `${fusion.id}-a`;
                    if (!litPorts.has(otherSide)) { litPorts.add(otherSide); queue.push(otherSide); }
                }
            }
        }
        return { litPorts, litCables, litConnections };
    }, [vflSource, projects, currentProjectId]);

    // ... (handleImportKMZ logic unchanged) ...
    const handleImportKMZ = async (file: File) => {
        try {
            let kmlText = '';
            if (file.name.toLowerCase().endsWith('.kmz')) {
                const zip = new JSZip();
                const loadedZip = await zip.loadAsync(file);
                const kmlFile = Object.values(loadedZip.files).find((f: any) => f.name.toLowerCase().endsWith('.kml'));
                if (kmlFile) {
                    kmlText = await (kmlFile as any).async('string');
                } else {
                    throw new Error("No KML found in KMZ");
                }
            } else {
                kmlText = await file.text();
            }

            const parser = new DOMParser();
            const kml = parser.parseFromString(kmlText, 'text/xml');
            const geoJSON = toGeoJSON.kml(kml);

            const newCTOs: CTOData[] = [];
            const newCables: CableData[] = [];
            let ctoCount = 0;
            let cableCount = 0;

            geoJSON.features.forEach((feature: any) => {
                if (!feature.geometry) return;

                if (feature.geometry.type === 'Point') {
                    const [lng, lat] = feature.geometry.coordinates;
                    newCTOs.push({
                        id: `cto-imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: feature.properties.name || `CTO ${ctoCount + 1}`,
                        status: 'PLANNED',
                        coordinates: { lat, lng },
                        splitters: [], fusions: [], connections: [], inputCableIds: [], clientCount: 0
                    });
                    ctoCount++;
                } else if (feature.geometry.type === 'LineString') {
                    const coords = feature.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
                    newCables.push({
                        id: `cable-imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: feature.properties.name || `Cable ${cableCount + 1}`,
                        status: 'NOT_DEPLOYED',
                        fiberCount: 6,
                        fromNodeId: null,
                        toNodeId: null,
                        coordinates: coords
                    });
                    cableCount++;
                }
            });

            if (ctoCount === 0 && cableCount === 0) {
                showToast(t('import_no_geo'), 'info');
                return;
            }

            // WRAPPED WITH AUTO SNAP
            updateCurrentNetwork(prev => autoSnapNetwork({
                ...prev,
                ctos: [...prev.ctos, ...newCTOs],
                cables: [...prev.cables, ...newCables]
            }, systemSettings.snapDistance).state);

            if (newCTOs.length > 0) {
                const bounds = L.latLngBounds(newCTOs.map(c => [c.coordinates.lat, c.coordinates.lng]));
                setMapBounds(bounds);
            } else if (newCables.length > 0) {
                const allPoints = newCables.flatMap(c => c.coordinates.map(p => [p.lat, p.lng] as [number, number]));
                if (allPoints.length > 0) {
                    setMapBounds(L.latLngBounds(allPoints));
                }
            }

            showToast(t('toast_imported', { ctos: ctoCount, cables: cableCount }));
            setShowProjectManager(false);

        } catch (error) {
            console.error(error);
            showToast(t('import_error'), 'info');
        }
    };

    // ... (finalizeCableCreation, map interactions, move node logic unchanged) ...
    const finalizeCableCreation = (start: CableStart, end: CableStart) => {
        const net = getCurrentNetwork();
        let startCoords: Coordinates, endCoords: Coordinates;
        let fromNodeId: string | null = null;
        let toNodeId: string | null = null;

        if (start.type === 'node') {
            const node = net.ctos.find(c => c.id === start.id) || net.pops.find(p => p.id === start.id);
            if (!node) return;
            startCoords = node.coordinates;
            fromNodeId = node.id;
        } else {
            startCoords = { lat: start.lat, lng: start.lng };
        }

        if (end.type === 'node') {
            const node = net.ctos.find(c => c.id === end.id) || net.pops.find(p => p.id === end.id);
            if (!node) return;
            endCoords = node.coordinates;
            toNodeId = node.id;
        } else {
            endCoords = { lat: end.lat, lng: end.lng };
        }

        const newCable: CableData = {
            id: `cable-${Date.now()}`,
            name: `CBL-${net.cables.length + 1}`,
            status: 'DEPLOYED',
            fiberCount: 12,
            fromNodeId,
            toNodeId,
            coordinates: [startCoords, endCoords]
        };

        const updatedCTOs = net.ctos.map(cto => {
            if (cto.id === toNodeId) return { ...cto, inputCableIds: [...(cto.inputCableIds || []), newCable.id] };
            if (cto.id === fromNodeId) return { ...cto, inputCableIds: [...(cto.inputCableIds || []), newCable.id] };
            return cto;
        });
        const updatedPOPs = net.pops.map(pop => {
            if (pop.id === toNodeId) return { ...pop, inputCableIds: [...(pop.inputCableIds || []), newCable.id] };
            if (pop.id === fromNodeId) return { ...pop, inputCableIds: [...(pop.inputCableIds || []), newCable.id] };
            return pop;
        });

        // WRAPPED WITH AUTO SNAP (Checks if ends are near other nodes if not explicitly connected)
        updateCurrentNetwork(prev => autoSnapNetwork({
            ...prev,
            cables: [...prev.cables, newCable],
            ctos: updatedCTOs,
            pops: updatedPOPs
        }, systemSettings.snapDistance).state);

        showToast(t('toast_cable_created'));
        setCableStart(null);
        setToolMode('view');
    };

    const handleAddPoint = (lat: number, lng: number) => {
        if (toolMode === 'add_cto') {
            const newCTO: CTOData = {
                id: `cto-${Date.now()}`,
                name: `CTO-${getCurrentNetwork().ctos.length + 1}`,
                status: 'PLANNED',
                coordinates: { lat, lng },
                splitters: [], fusions: [], connections: [], inputCableIds: [], clientCount: 0
            };
            // WRAPPED WITH AUTO SNAP - Snaps nearby cable ends to this new CTO
            updateCurrentNetwork(prev => autoSnapNetwork({ ...prev, ctos: [...prev.ctos, newCTO] }, systemSettings.snapDistance).state);
            showToast(t('toast_cto_added'));
            setToolMode('view');
        } else if (toolMode === 'add_pop') {
            const newPOP: POPData = {
                id: `pop-${Date.now()}`,
                name: `POP-${(getCurrentNetwork().pops?.length || 0) + 1}`,
                status: 'PLANNED',
                coordinates: { lat, lng },
                olts: [], dios: [], fusions: [], connections: [], inputCableIds: []
            };
            // WRAPPED WITH AUTO SNAP
            updateCurrentNetwork(prev => autoSnapNetwork({ ...prev, pops: [...(prev.pops || []), newPOP] }, systemSettings.snapDistance).state);
            showToast(t('toast_pop_added'));
            setToolMode('view');
        } else if (toolMode === 'draw_cable') {
            if (!cableStart) {
                setCableStart({ type: 'coord', lat, lng });
            } else {
                finalizeCableCreation(cableStart, { type: 'coord', lat, lng });
            }
        }
    };

    const handleNodeClick = (id: string, type: 'CTO' | 'POP') => {
        if (toolMode === 'view' || toolMode === 'move_node') {
            setSelectedId(id);
        }
    };

    const handleNodeForCable = (nodeId: string) => {
        if (!cableStart) {
            setCableStart({ type: 'node', id: nodeId });
        } else {
            if (cableStart.type === 'node' && cableStart.id === nodeId) {
                setCableStart(null);
                return;
            }
            finalizeCableCreation(cableStart, { type: 'node', id: nodeId });
        }
    };

    const handleMoveNode = (id: string, lat: number, lng: number) => {
        updateCurrentNetwork(prev => {
            let updatedCTOs = prev.ctos;
            let updatedPOPs = prev.pops;

            if (prev.ctos.some(c => c.id === id)) {
                updatedCTOs = prev.ctos.map(c => c.id === id ? { ...c, coordinates: { lat, lng } } : c);
            }
            else if (prev.pops.some(p => p.id === id)) {
                updatedPOPs = prev.pops.map(p => p.id === id ? { ...p, coordinates: { lat, lng } } : p);
            }

            const updatedCables = prev.cables.map(cable => {
                const newCoords = [...cable.coordinates];
                if (cable.fromNodeId === id) {
                    newCoords[0] = { lat, lng };
                }
                if (cable.toNodeId === id) {
                    newCoords[newCoords.length - 1] = { lat, lng };
                }
                return { ...cable, coordinates: newCoords };
            });

            // WRAPPED WITH AUTO SNAP - Checks if the new position snaps to any loose cables
            return autoSnapNetwork({ ...prev, ctos: updatedCTOs, pops: updatedPOPs, cables: updatedCables }, systemSettings.snapDistance).state;
        });
    };

    const handleSavePOP = (updatedPOP: POPData) => {
        updateCurrentNetwork(prev => ({
            ...prev,
            pops: prev.pops.map(p => p.id === updatedPOP.id ? updatedPOP : p)
        }));
        setEditingPOP(null);
        setHighlightedCableId(null);
        showToast(t('toast_pop_saved'));
    };
    const handleRenamePOP = (id: string, name: string) => updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.map(p => p.id === id ? { ...p, name } : p) }));
    const handleUpdatePOPStatus = (status: CTOStatus) => selectedId && updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.map(p => p.id === selectedId ? { ...p, status } : p) }));
    const handleDeletePOP = (id: string) => {
        setSelectedId(null);
        updateCurrentNetwork(prev => ({ ...prev, pops: prev.pops.filter(p => p.id !== id) }));
        showToast(t('toast_pop_deleted'));
    };

    const handleConnectCable = (cableId: string, nodeId: string, pointIndex: number) => {
        const net = getCurrentNetwork();
        const cable = net.cables.find(c => c.id === cableId);
        const node = net.ctos.find(c => c.id === nodeId) || net.pops.find(p => p.id === nodeId);
        if (!cable || !node) return;

        if (pointIndex === 0 || pointIndex === cable.coordinates.length - 1) {
            const newCoords = [...cable.coordinates];
            newCoords[pointIndex] = node.coordinates;
            updateCurrentNetwork(prev => ({
                ...prev,
                cables: prev.cables.map(c => c.id === cableId ? {
                    ...c,
                    coordinates: newCoords,
                    [pointIndex === 0 ? 'fromNodeId' : 'toNodeId']: node.id
                } : c),
                ctos: prev.ctos.map(c => c.id === nodeId ? { ...c, inputCableIds: [...(c.inputCableIds || []), cable.id] } : c),
                pops: prev.pops.map(p => p.id === nodeId ? { ...p, inputCableIds: [...(p.inputCableIds || []), cable.id] } : p)
            }));
            showToast(t(pointIndex === 0 ? 'toast_cable_connected_start' : 'toast_cable_connected_end', { name: node.name }));
            return;
        }

        const coordSegment1 = cable.coordinates.slice(0, pointIndex + 1);
        const coordSegment2 = cable.coordinates.slice(pointIndex);
        coordSegment1[coordSegment1.length - 1] = node.coordinates;
        coordSegment2[0] = node.coordinates;
        const newCableId = `cable-${Date.now()}-split`;

        const cable1 = { ...cable, coordinates: coordSegment1, toNodeId: node.id, name: `${cable.name} (A)` };
        const cable2 = { ...cable, id: newCableId, name: `${cable.name.replace(' (A)', '')} (B)`, fromNodeId: node.id, toNodeId: cable.toNodeId, coordinates: coordSegment2 };

        updateCurrentNetwork(prev => ({
            ...prev,
            cables: [...prev.cables.map(c => c.id === cableId ? cable1 : c), cable2],
            ctos: prev.ctos.map(c => c.id === nodeId ? { ...c, inputCableIds: [...(c.inputCableIds || []), cableId] } : c),
            pops: prev.pops.map(p => p.id === nodeId ? { ...p, inputCableIds: [...(p.inputCableIds || []), cableId] } : p)
        }));
        showToast(t('toast_cable_split', { name: node.name }));
    };

    const handleSaveCTO = (updatedCTO: CTOData) => {
        updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.map(c => c.id === updatedCTO.id ? updatedCTO : c) }));
        setEditingCTO(null);
        setHighlightedCableId(null);
        showToast(t('toast_cto_splicing_saved'));
    };
    const handleRenameCTO = (id: string, name: string) => updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.map(c => c.id === id ? { ...c, name } : c) }));
    const handleUpdateCTOStatus = (status: CTOStatus) => selectedId && updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.map(c => c.id === selectedId ? { ...c, status } : c) }));
    const handleDeleteCTO = (id: string) => {
        setSelectedId(null);
        updateCurrentNetwork(prev => ({ ...prev, ctos: prev.ctos.filter(c => c.id !== id) }));
        showToast(t('toast_cto_deleted'));
    };
    const handleSaveCable = (c: CableData) => { updateCurrentNetwork(prev => ({ ...prev, cables: prev.cables.map(cb => cb.id === c.id ? c : cb) })); setEditingCable(null); };
    const handleDeleteCable = (id: string) => { setEditingCable(null); updateCurrentNetwork(prev => ({ ...prev, cables: prev.cables.filter(c => c.id !== id) })); showToast(t('toast_cable_deleted')); };

    // ... (OTDR Trace Logic Unchanged) ...
    const traceOpticalPath = (startNodeId: string, startPortId: string, targetDistance: number) => {
        // ... (Implementation unchanged from previous version) ...
        // For brevity, using the existing OTDR logic here.
        // Assuming it's the exact same block as before.
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
                showToast(`${t('otdr_result')}: ${t('otdr_success_cable', { name: cable.name })}`);
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

            const nextNode = net.ctos.find(c => c.id === nextNodeId) || net.pops.find(p => p.id === nextNodeId);
            if (!nextNode) {
                showToast(t('otdr_next_node_error'), "info");
                return;
            }

            const connection = nextNode.connections.find(c => c.sourceId === currentPortId || c.targetId === currentPortId);

            if (!connection) {
                showToast(t('otdr_fiber_end_node', { node: nextNode.name }), "info");
                const end = nextNode.coordinates;
                setOtdrResult(end);
                setMapBounds([[end.lat, end.lng], [end.lat, end.lng]]);
                setEditingCTO(null);
                setEditingPOP(null);
                return;
            }

            const nextPortId = connection.sourceId === currentPortId ? connection.targetId : connection.sourceId;

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
    };


    const handleLogin = async (username: string, password?: string) => {
        try {
            const data = await authService.login(username, password);
            setUser(data.user.username);
            setToken(data.token);
        } catch (e) {
            showToast('Login failed', 'info');
        }
    };

    const handleRegister = async (username: string, password?: string) => {
        try {
            // Re-using the logic from authService if we had a separate register, 
            // but authService.login already has a silent register.
            // However, we want to be explicit here.
            await api.post('/auth/register', { username, password: password || "123456" });
            showToast(t('registration_success'), 'success');
            setAuthView('login');
        } catch (e) {
            showToast(t('registration_failed'), 'info');
        }
    };

    if (!user) {
        if (authView === 'register') {
            return <RegisterPage onRegister={handleRegister} onBackToLogin={() => setAuthView('login')} />;
        }
        return <LoginPage onLogin={handleLogin} onRegisterClick={() => setAuthView('register')} />;
    }

    if (!currentProjectId) return <DashboardPage username={user} projects={projects} isLoading={isLoadingProjects} onOpenProject={setCurrentProjectId}
        onCreateProject={async (name, center) => {
            if (!token) return;
            try {
                const newProject = await projectService.createProject(name, center || { lat: -23.5505, lng: -46.6333 });
                setProjects(prev => [newProject, ...prev]);
                setCurrentProjectId(newProject.id);
                showToast(t('toast_project_created'), 'success');
            } catch (e) {
                showToast('Failed to create project', 'info');
            }
        }}
        onDeleteProject={async (id) => {
            try {
                await projectService.deleteProject(id);
                setProjects(prev => prev.filter(p => p.id !== id));
                showToast(t('toast_project_deleted'));
            } catch (e) {
                showToast('Failed to delete project', 'info');
            }
        }}
        onLogout={() => { setUser(null); setToken(null); setProjects([]); setCurrentProjectId(null); setCurrentProject(null); }}
    />;

    // Loading State for specific project
    if (currentProjectId && !currentProject) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
                <Loader2 className="w-12 h-12 text-sky-500 animate-spin" />
                <div className="text-xl font-bold tracking-tight">{t('processing')}</div>
            </div>
        );
    }

    const deploymentProgress = Math.round(((getCurrentNetwork().ctos.filter(c => c.status === 'DEPLOYED').length + (getCurrentNetwork().pops?.length || 0)) / (getCurrentNetwork().ctos.length + (getCurrentNetwork().pops?.length || 1))) * 100) || 0;

    return (
        <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
            {toast && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] animate-in fade-in slide-in-from-top-5">
                    <div className={`px-4 py-2 rounded-lg shadow-lg border flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/90 border-emerald-500 text-emerald-800 dark:text-white' : 'bg-sky-100 dark:bg-sky-900/90 border-sky-500 text-sky-800 dark:text-white'}`}>
                        <CheckCircle2 className="w-4 h-4" /> <span className="text-sm font-medium">{toast.msg}</span>
                    </div>
                </div>
            )}

            <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl relative transition-colors duration-300">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-sky-600 rounded flex items-center justify-center"><Network className="text-white w-5 h-5" /></div><h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">{t('app_title')}</h1></div>
                        <button onClick={() => setCurrentProjectId(null)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition" title={t('exit_project')}><LogOut className="w-4 h-4" /></button>
                    </div>
                    <button onClick={() => setShowProjectManager(true)} className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-slate-700 transition-colors">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FolderOpen className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                            <span className="truncate max-w-[120px] font-medium text-slate-700 dark:text-slate-300">{projects.find(p => p.id === currentProjectId)?.name}</span>
                        </div>
                        {isSaving ? (
                            <Loader2 className="w-3 h-3 text-sky-500 animate-spin" />
                        ) : (
                            <Settings2 className="w-3 h-3 text-slate-400" />
                        )}
                    </button>
                </div>

                {/* VFL Status Indicator in Sidebar */}
                {vflSource && (
                    <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/50">
                        <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-xs font-bold uppercase mb-1">
                            <Flashlight className="w-3 h-3 animate-pulse" /> {t('vfl_active_status')}
                        </div>
                        <div className="text-[10px] text-red-400 dark:text-red-300 truncate">
                            {t('vfl_source_label', { name: vflSource })}
                        </div>
                        <button onClick={() => setVflSource(null)} className="mt-2 w-full py-1 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-white text-[10px] rounded border border-red-300 dark:border-red-700">{t('turn_off')}</button>
                    </div>
                )}

                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1"><span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {t('deployment_progress')}</span><span className="text-emerald-500 dark:text-emerald-400">{deploymentProgress}%</span></div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${deploymentProgress}%` }}></div></div>
                </div>

                <div className="p-4 flex flex-col gap-2 shrink-0 flex-1 overflow-visible">

                    {/* Search Bar */}
                    <div className="relative mb-2 group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('search_placeholder')}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                        />
                        {/* Search Results Dropdown */}
                        {searchTerm.trim() !== '' && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl z-[3000] max-h-60 overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    searchResults.map((item, idx) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSearchResultClick(item)}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 ${idx !== searchResults.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
                                        >
                                            {item.type === 'POP' ? <Server className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> : <Box className="w-3 h-3 text-orange-500 dark:text-orange-400" />}
                                            <span className="text-slate-700 dark:text-slate-200 font-medium truncate">{item.name}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-3 text-xs text-slate-500 text-center italic">{t('search_no_results')}</div>
                                )}
                            </div>
                        )}
                    </div>

                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('tools')}</p>
                    {[
                        { id: 'view', icon: MousePointer2, label: t('mode_view') },
                        { id: 'move_node', icon: Move, label: t('mode_move') },
                        { id: 'add_cto', icon: MapIcon, label: t('mode_add_cto') },
                        { id: 'add_pop', icon: Server, label: t('mode_add_pop') },
                        { id: 'draw_cable', icon: Zap, label: t('mode_draw_cable') },
                        { id: 'connect_cable', icon: Unplug, label: t('mode_connect_cable') }
                    ].map(tool => (
                        <button key={tool.id} onClick={() => { setToolMode(tool.id as any); setSelectedId(null); setCableStart(null); setOtdrResult(null); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${toolMode === tool.id ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            <tool.icon className="w-4 h-4" /> {tool.label}
                        </button>
                    ))}
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2">{t('settings')}</p>
                    <div className="flex justify-center gap-2">
                        <button onClick={() => setShowLabels(!showLabels)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">{showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                        <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"><Settings className="w-4 h-4" /> </button>
                        <button onClick={toggleTheme} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all">
                            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 relative bg-slate-100 dark:bg-slate-900">
                <MapView
                    ctos={getCurrentNetwork().ctos}
                    pops={getCurrentNetwork().pops || []}
                    cables={getCurrentNetwork().cables}
                    mode={toolMode}
                    selectedId={selectedId}
                    mapBounds={mapBounds}
                    showLabels={showLabels}
                    litCableIds={litNetwork.litCables}
                    highlightedCableId={highlightedCableId}
                    cableStartPoint={cableStart?.type === 'coord' ? { lat: cableStart.lat, lng: cableStart.lng } : null}
                    snapDistance={systemSettings.snapDistance}

                    viewKey={currentProjectId || undefined}
                    initialCenter={currentProject?.mapState?.center}
                    initialZoom={currentProject?.mapState?.zoom}
                    onMapMoveEnd={handleMapMoveEnd}

                    onAddPoint={handleAddPoint}
                    onNodeClick={handleNodeClick}
                    onMoveNode={handleMoveNode}
                    onCableStart={handleNodeForCable}
                    onCableEnd={handleNodeForCable}
                    onConnectCable={handleConnectCable}
                    onUpdateCableGeometry={(id, coords) => updateCurrentNetwork(p => autoSnapNetwork({ ...p, cables: p.cables.map(c => c.id === id ? { ...c, coordinates: coords } : c) }, systemSettings.snapDistance).state)}
                    onCableClick={(id) => {
                        if (toolMode === 'view') {
                            setEditingCable(getCurrentNetwork().cables.find(c => c.id === id) || null);
                        }
                    }}
                    // Pass OTDR Result Point to MapView to render marker
                    otdrResult={otdrResult}
                />

                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur text-slate-700 dark:text-white px-4 py-2 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 text-xs font-medium z-[1000] pointer-events-none">
                    {toolMode === 'view' && t('tooltip_view')}
                    {toolMode === 'move_node' && t('tooltip_move')}
                    {toolMode === 'add_cto' && t('tooltip_add_cto')}
                    {toolMode === 'add_pop' && t('tooltip_add_pop')}
                    {toolMode === 'draw_cable' && (!cableStart ? t('tooltip_draw_cable_start') : t('tooltip_draw_cable'))}
                    {toolMode === 'connect_cable' && t('tooltip_connect')}
                </div>
            </main>

            {/* Editors */}
            {editingPOP && (
                <POPEditor
                    pop={editingPOP}
                    incomingCables={getCurrentNetwork().cables.filter(c => c.fromNodeId === editingPOP.id || c.toNodeId === editingPOP.id)}
                    litPorts={litNetwork.litPorts}
                    vflSource={vflSource}
                    onToggleVfl={(portId) => setVflSource(prev => prev === portId ? null : portId)}
                    onClose={() => { setEditingPOP(null); setHighlightedCableId(null); }}
                    onSave={handleSavePOP}
                    onHoverCable={(id) => setHighlightedCableId(id)}
                    onOtdrTrace={(portId, dist) => traceOpticalPath(editingPOP.id, portId, dist)}
                />
            )}
            {editingCTO && (
                <CTOEditor
                    cto={editingCTO}
                    projectName={currentProject?.name || ''}
                    incomingCables={getCurrentNetwork().cables.filter(c => c.fromNodeId === editingCTO.id || c.toNodeId === editingCTO.id || editingCTO.inputCableIds?.includes(c.id))}
                    litPorts={litNetwork.litPorts}
                    vflSource={vflSource}
                    onToggleVfl={(portId) => setVflSource(prev => prev === portId ? null : portId)}
                    onClose={() => { setEditingCTO(null); setHighlightedCableId(null); }}
                    onSave={handleSaveCTO}
                    onHoverCable={(id) => setHighlightedCableId(id)}
                    onOtdrTrace={(portId, dist) => traceOpticalPath(editingCTO.id, portId, dist)}
                />
            )}

            {/* Detail Panels (Mini-Editors/Actions) */}
            {selectedId && !editingCTO && toolMode === 'view' && getCurrentNetwork().ctos.find(c => c.id === selectedId) && (
                <CTODetailsPanel
                    cto={getCurrentNetwork().ctos.find(c => c.id === selectedId)!}
                    onRename={handleRenameCTO}
                    onUpdateStatus={handleUpdateCTOStatus}
                    onOpenSplicing={() => { setEditingCTO(getCurrentNetwork().ctos.find(c => c.id === selectedId)!); setSelectedId(null); }}
                    onDelete={handleDeleteCTO}
                    onClose={() => setSelectedId(null)}
                />
            )}

            {selectedId && !editingPOP && toolMode === 'view' && getCurrentNetwork().pops?.find(p => p.id === selectedId) && (
                <POPDetailsPanel
                    pop={getCurrentNetwork().pops?.find(p => p.id === selectedId)!}
                    onRename={handleRenamePOP}
                    onUpdateStatus={handleUpdatePOPStatus}
                    onOpenRack={() => { setEditingPOP(getCurrentNetwork().pops?.find(p => p.id === selectedId)!); setSelectedId(null); }}
                    onDelete={handleDeletePOP}
                    onClose={() => setSelectedId(null)}
                />
            )}

            {editingCable && (
                <CableEditor
                    cable={editingCable}
                    onClose={() => setEditingCable(null)}
                    onSave={handleSaveCable}
                    onDelete={handleDeleteCable}
                />
            )}
            {showProjectManager && (
                <ProjectManager
                    projects={projects}
                    currentProjectId={currentProjectId!}
                    onSelectProject={(id) => { setCurrentProjectId(id); setShowProjectManager(false); }}
                    onDeleteProject={(id) => setProjects(p => p.filter(x => x.id !== id))}
                    onImportKMZ={handleImportKMZ}
                    onClose={() => setShowProjectManager(false)}
                />
            )}

            {/* --- SYSTEM SETTINGS MODAL --- */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowSettingsModal(false)}>
                    <div
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden transition-colors"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="h-12 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Settings className="w-4 h-4" /> {t('system_settings')}
                            </h3>
                            <button onClick={() => setShowSettingsModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-2">
                                    <Ruler className="w-3 h-3" /> {t('snap_distance_lbl')}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        min="1"
                                        max="200"
                                        value={systemSettings.snapDistance}
                                        onChange={(e) => {
                                            const val = Math.max(1, parseInt(e.target.value) || 1);
                                            setSystemSettings(prev => ({ ...prev, snapDistance: val }));
                                            setSettingsSaved(true);
                                            if (settingsTimeoutRef.current) clearTimeout(settingsTimeoutRef.current);
                                            settingsTimeoutRef.current = setTimeout(() => setSettingsSaved(false), 2000);
                                        }}
                                        className="w-24 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                                    />
                                    <span className="text-sm text-slate-500">meters</span>
                                    {settingsSaved && (
                                        <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold animate-in fade-in slide-in-from-left-2">
                                            <Check className="w-3 h-3" /> Saved
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    {t('snap_distance_help')}
                                </p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                            <button
                                onClick={() => {
                                    performAutoSnap(systemSettings.snapDistance);
                                    setShowSettingsModal(false);
                                }}
                                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-bold transition"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}