
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CTOData, POPData, CableData, Coordinates, CTO_STATUS_COLORS, CABLE_STATUS_COLORS } from '../types';
import { useLanguage } from '../LanguageContext';
import { Layers } from 'lucide-react';

// Fix for default Leaflet icon issues in Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
  iconUrl: '/leaflet/images/marker-icon.png',
  shadowUrl: '/leaflet/images/marker-shadow.png',
});

// --- ICONS HELPERS WITH CACHING ---

// Icon cache to prevent recreation
const iconCache = new Map<string, L.DivIcon>();

const createCTOIcon = (name: string, isSelected: boolean, status: string = 'PLANNED', showLabels: boolean = true) => {
  const cacheKey = `cto-${name}-${isSelected}-${status}-${showLabels}`;

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  // @ts-ignore
  const color = CTO_STATUS_COLORS[status] || CTO_STATUS_COLORS['PLANNED'];

  const icon = L.divIcon({
    className: 'custom-icon',
    html: `
      <div style="
        background-color: ${color};
        border: 2px solid ${isSelected ? '#000000' : '#ffffff'};
        border-radius: 50%;
        width: 20px;
        height: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        transition: border-color 0.2s ease;
      ">
      </div>
      <div style="
        display: ${showLabels ? 'block' : 'none'};
        position: absolute;
        top: 22px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.9);
        color: white;
        padding: 2px 5px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      ">${name}</div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  iconCache.set(cacheKey, icon);
  return icon;
};

const createPOPIcon = (name: string, isSelected: boolean, showLabels: boolean = true) => {
  const cacheKey = `pop-${name}-${isSelected}-${showLabels}`;

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const icon = L.divIcon({
    className: 'custom-icon',
    html: `
      <div style="
        background-color: #6366f1; /* Indigo */
        border: 2px solid ${isSelected ? '#000000' : '#ffffff'};
        border-radius: 4px; /* Square for Building */
        width: 24px;
        height: 24px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div style="
        display: ${showLabels ? 'block' : 'none'};
        position: absolute;
        top: 26px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(79, 70, 229, 0.9);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      ">${name}</div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  iconCache.set(cacheKey, icon);
  return icon;
};

const otdrIcon = L.divIcon({
  className: 'otdr-icon',
  html: `
    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <div style="
            position: absolute;
            width: 30px; height: 30px;
            border-radius: 50%;
            background: rgba(220, 38, 38, 0.3);
            border: 2px solid #ef4444;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
            width: 12px; height: 12px;
            background: #ef4444;
            border: 2px solid white;
            border-radius: 50%;
            z-index: 10;
        "></div>
        <div style="
            position: absolute;
            top: -25px;
            background: #ef4444;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
        ">EVENT</div>
    </div>
    <style>
        @keyframes ping {
            75%, 100% {
                transform: scale(2);
                opacity: 0;
            }
        }
    </style>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const handleIcon = L.divIcon({
  className: 'cable-handle',
  html: `<div style="width: 12px; height: 12px; background: white; border: 2px solid #0ea5e9; border-radius: 50%; cursor: grab; box-shadow: 0 0 6px rgba(0,0,0,0.8);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const startPointIcon = L.divIcon({
  className: 'start-point',
  html: `<div style="width: 10px; height: 10px; background: #fbbf24; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px black;"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5]
});

// --- SUB COMPONENTS (Memoized for Performance) ---

const CTOMarker = React.memo(({
  cto, isSelected, showLabels, mode, onNodeClick, onCableStart, onCableEnd, onMoveNode, cableStartPoint
}: {
  cto: CTOData, isSelected: boolean, showLabels: boolean, mode: string,
  onNodeClick: (id: string, type: 'CTO') => void,
  onCableStart: (id: string) => void,
  onCableEnd: (id: string) => void,
  onMoveNode: (id: string, lat: number, lng: number) => void,
  cableStartPoint: any
}) => {
  const icon = useMemo(() =>
    createCTOIcon(cto.name, isSelected, cto.status, showLabels),
    [cto.name, isSelected, cto.status, showLabels]);

  const eventHandlers = useMemo(() => ({
    click: (e: any) => {
      L.DomEvent.stopPropagation(e);
      if (mode === 'draw_cable') {
        if (!isSelected && !cableStartPoint) onCableStart(cto.id);
        else onCableEnd(cto.id);
      } else if (mode === 'view' || mode === 'move_node') {
        onNodeClick(cto.id, 'CTO');
      }
    },
    dragend: (e: any) => {
      const marker = e.target;
      const position = marker.getLatLng();
      onMoveNode(cto.id, position.lat, position.lng);
    }
  }), [mode, cto.id, isSelected, cableStartPoint, onCableStart, onCableEnd, onNodeClick, onMoveNode]);

  return (
    <Marker
      position={[cto.coordinates.lat, cto.coordinates.lng]}
      icon={icon}
      draggable={mode === 'move_node'}
      eventHandlers={eventHandlers}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
        <div className="text-xs font-bold">{cto.name}</div>
      </Tooltip>
    </Marker>
  );
});

const POPMarker = React.memo(({
  pop, isSelected, showLabels, mode, onNodeClick, onCableStart, onCableEnd, onMoveNode, cableStartPoint
}: {
  pop: POPData, isSelected: boolean, showLabels: boolean, mode: string,
  onNodeClick: (id: string, type: 'POP') => void,
  onCableStart: (id: string) => void,
  onCableEnd: (id: string) => void,
  onMoveNode: (id: string, lat: number, lng: number) => void,
  cableStartPoint: any
}) => {
  const icon = useMemo(() =>
    createPOPIcon(pop.name, isSelected, showLabels),
    [pop.name, isSelected, showLabels]);

  const eventHandlers = useMemo(() => ({
    click: (e: any) => {
      L.DomEvent.stopPropagation(e);
      if (mode === 'draw_cable') {
        if (!isSelected && !cableStartPoint) onCableStart(pop.id);
        else onCableEnd(pop.id);
      } else if (mode === 'view' || mode === 'move_node') {
        onNodeClick(pop.id, 'POP');
      }
    },
    dragend: (e: any) => {
      const marker = e.target;
      const position = marker.getLatLng();
      onMoveNode(pop.id, position.lat, position.lng);
    }
  }), [mode, pop.id, isSelected, cableStartPoint, onCableStart, onCableEnd, onNodeClick, onMoveNode]);

  return (
    <Marker
      position={[pop.coordinates.lat, pop.coordinates.lng]}
      icon={icon}
      draggable={mode === 'move_node'}
      eventHandlers={eventHandlers}
    >
      <Tooltip direction="top" offset={[0, -12]} opacity={0.9}>
        <div className="text-xs font-bold">{pop.name}</div>
      </Tooltip>
    </Marker>
  );
});

const CablePolyline = React.memo(({
  cable, isLit, isActive, isHighlighted, mode, t,
  onClick, onUpdateGeometry, onConnect, snapDistance, ctos, pops
}: {
  cable: CableData, isLit: boolean, isActive: boolean, isHighlighted: boolean, mode: string, t: any,
  onClick: (e: any, cable: CableData) => void,
  onUpdateGeometry?: (id: string, coords: Coordinates[]) => void,
  onConnect?: (cableId: string, nodeId: string, index: number) => void,
  snapDistance: number, ctos: CTOData[], pops: POPData[]
}) => {

  const positions = useMemo(() => cable.coordinates.map(c => [c.lat, c.lng] as [number, number]), [cable.coordinates]);

  const color = useMemo(() => {
    if (isLit) return '#ef4444';
    if (isActive) return '#0f172a';
    if (cable.status === 'NOT_DEPLOYED') return CABLE_STATUS_COLORS['NOT_DEPLOYED'];
    return cable.color || CABLE_STATUS_COLORS['DEPLOYED'];
  }, [isLit, isActive, cable.status, cable.color]);

  const dashArray = useMemo(() => {
    if (isActive) return '10, 10';
    if (cable.status === 'NOT_DEPLOYED') return '5, 5';
    return undefined;
  }, [isActive, cable.status]);

  const handleDragEnd = useCallback((e: any, index: number) => {
    if (!onConnect || !onUpdateGeometry) return;
    const marker = e.target;
    const pos = marker.getLatLng();
    let nearestNode: string | null = null;
    let minDist = Infinity;

    ctos.forEach(cto => {
      const dist = pos.distanceTo(L.latLng(cto.coordinates.lat, cto.coordinates.lng));
      if (dist < snapDistance) { if (dist < minDist) { minDist = dist; nearestNode = cto.id; } }
    });
    pops.forEach(pop => {
      const dist = pos.distanceTo(L.latLng(pop.coordinates.lat, pop.coordinates.lng));
      if (dist < snapDistance) { if (dist < minDist) { minDist = dist; nearestNode = pop.id; } }
    });

    if (nearestNode) {
      onConnect(cable.id, nearestNode, index);
    } else {
      const newCoords = [...cable.coordinates];
      newCoords[index] = { lat: pos.lat, lng: pos.lng };
      onUpdateGeometry(cable.id, newCoords);
    }
  }, [cable.coordinates, cable.id, ctos, pops, snapDistance, onConnect, onUpdateGeometry]);

  const pathOptions = useMemo(() => ({
    color,
    weight: isActive ? 6 : 4,
    opacity: isLit ? 1 : 0.8,
    dashArray
  }), [color, isActive, isLit, dashArray]);

  return (
    <>
      {isLit && (
        <Polyline
          positions={positions}
          pathOptions={{ color: '#ef4444', weight: 10, opacity: 0.4 }}
          interactive={false}
        />
      )}

      {isHighlighted && !isLit && (
        <Polyline
          positions={positions}
          pathOptions={{ color: '#22c55e', weight: 12, opacity: 0.5 }}
          interactive={false}
        />
      )}

      <Polyline
        positions={positions}
        pathOptions={pathOptions}
        eventHandlers={{ click: (e) => onClick(e, cable) }}
      />

      {isActive && mode === 'connect_cable' && cable.coordinates.map((coord, index) => (
        <Marker
          key={`${cable.id}-pt-${index}`}
          position={[coord.lat, coord.lng]}
          icon={handleIcon}
          draggable={true}
          eventHandlers={{ dragend: (e) => handleDragEnd(e, index) }}
        />
      ))}
    </>
  );
});

// --- HELPER COMPONENTS ---

const MapEvents: React.FC<{
  mode: string,
  onMapClick: (lat: number, lng: number) => void,
  onClearSelection: () => void,
  onMapMoveEnd?: (lat: number, lng: number, zoom: number) => void
}> = ({ mode, onMapClick, onClearSelection, onMapMoveEnd }) => {
  useMapEvents({
    click(e) {
      if (mode === 'add_cto' || mode === 'add_pop' || mode === 'draw_cable') {
        onMapClick(e.latlng.lat, e.latlng.lng);
      } else if (mode === 'connect_cable') {
        onClearSelection();
      }
    },
    moveend(e) {
      if (onMapMoveEnd) {
        const c = e.target.getCenter();
        const z = e.target.getZoom();
        onMapMoveEnd(c.lat, c.lng, z);
      }
    }
  });
  return null;
};

const MapResizeHandler = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => { map.invalidateSize(); }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const MapController = ({ bounds, viewKey, center, zoom }: { bounds: any, viewKey?: string, center?: Coordinates, zoom?: number }) => {
  const map = useMap();
  const lastViewKey = React.useRef<string | undefined>(undefined);

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 22, animate: true, duration: 1.5 });
      return;
    }
    // Only update view if we have a center AND it's a new viewKey (project switch) 
    // AND we haven't processed this viewKey yet.
    if (center && zoom && viewKey && viewKey !== lastViewKey.current) {
      map.setView([center.lat, center.lng], zoom);
      lastViewKey.current = viewKey;
    }
  }, [bounds, map, viewKey, center, zoom]);
  return null;
};

function getDistanceFromLine(pt: Coordinates, lineStart: Coordinates, lineEnd: Coordinates) {
  const x = pt.lat; const y = pt.lng; const x1 = lineStart.lat; const y1 = lineStart.lng; const x2 = lineEnd.lat; const y2 = lineEnd.lng;
  const A = x - x1; const B = y - y1; const C = x2 - x1; const D = y2 - y1;
  const dot = A * C + B * D; const len_sq = C * C + D * D;
  let param = -1; if (len_sq !== 0) param = dot / len_sq;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
  const dx = x - xx; const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- MAIN COMPONENT ---

interface MapViewProps {
  ctos: CTOData[];
  pops: POPData[];
  cables: CableData[];
  mode: 'view' | 'add_cto' | 'add_pop' | 'draw_cable' | 'connect_cable' | 'move_node' | 'otdr';
  selectedId: string | null;
  mapBounds?: L.LatLngBoundsExpression | null;
  showLabels?: boolean;
  litCableIds?: Set<string>;
  highlightedCableId?: string | null;
  cableStartPoint?: { lat: number, lng: number } | null;
  snapDistance?: number;
  otdrResult?: Coordinates | null;
  viewKey?: string;
  initialCenter?: Coordinates;
  initialZoom?: number;
  onMapMoveEnd?: (lat: number, lng: number, zoom: number) => void;
  onAddPoint: (lat: number, lng: number) => void;
  onNodeClick: (id: string, type: 'CTO' | 'POP') => void;
  onMoveNode?: (id: string, lat: number, lng: number) => void;
  onCableStart: (nodeId: string) => void;
  onCableEnd: (nodeId: string) => void;
  onConnectCable?: (cableId: string, nodeId: string, pointIndex: number) => void;
  onUpdateCableGeometry?: (cableId: string, newCoordinates: Coordinates[]) => void;
  onCableClick?: (cableId: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  ctos, pops, cables, mode, selectedId, mapBounds, showLabels = false, litCableIds = new Set(),
  highlightedCableId, cableStartPoint, snapDistance = 30, otdrResult, viewKey,
  initialCenter, initialZoom, onMapMoveEnd, onAddPoint, onNodeClick, onMoveNode,
  onCableStart, onCableEnd, onConnectCable, onUpdateCableGeometry, onCableClick
}) => {
  const { t } = useLanguage();
  const [activeCableId, setActiveCableId] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');

  // Visibility States
  const [showCables, setShowCables] = useState(true);
  const [showCTOs, setShowCTOs] = useState(true);
  const [showPOPs, setShowPOPs] = useState(true);
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  // Filter visible elements using useMemo for performance
  const visibleCables = useMemo(() => showCables ? cables : [], [showCables, cables]);
  const visibleCTOs = useMemo(() => showCTOs ? ctos : [], [showCTOs, ctos]);
  const visiblePOPs = useMemo(() => showPOPs ? pops : [], [showPOPs, pops]);

  useEffect(() => {
    if (mode !== 'connect_cable') setActiveCableId(null);
  }, [mode]);

  const handleCableClickInternal = useCallback((e: any, cable: CableData) => {
    L.DomEvent.stopPropagation(e);

    if (mode === 'connect_cable') {
      setActiveCableId(cable.id);
      if (onUpdateCableGeometry) {
        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        let minDistance = Infinity;
        let insertIndex = 1;
        for (let i = 0; i < cable.coordinates.length - 1; i++) {
          const dist = getDistanceFromLine({ lat: clickLat, lng: clickLng }, cable.coordinates[i], cable.coordinates[i + 1]);
          if (dist < minDistance) { minDistance = dist; insertIndex = i + 1; }
        }
        const newCoords = [...cable.coordinates];
        newCoords.splice(insertIndex, 0, { lat: clickLat, lng: clickLng });
        onUpdateCableGeometry(cable.id, newCoords);
      }
    } else if ((mode === 'view' || mode === 'otdr') && onCableClick) {
      onCableClick(cable.id);
    }
  }, [mode, onUpdateCableGeometry, onCableClick]);

  const noOp = () => { };

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
        {/* Map Type Button (Original) */}
        <button
          onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
          className="bg-white border-2 border-slate-300 rounded-lg p-2 shadow-xl hover:bg-slate-50 transition flex items-center gap-2 text-slate-700 text-xs font-bold"
        >
          {mapType === 'street' ? t('map_satellite') : t('map_street')}
        </button>

        {/* Static Visibility Panel */}
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-2 flex flex-col gap-1 min-w-[140px]">
          {/* CTOs Toggle */}
          <button
            onClick={() => setShowCTOs(!showCTOs)}
            className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 transition w-full text-left text-xs font-semibold text-slate-700"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showCTOs ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
              {showCTOs && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <span>{t('layer_ctos')}</span>
          </button>

          {/* POPs Toggle */}
          <button
            onClick={() => setShowPOPs(!showPOPs)}
            className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 transition w-full text-left text-xs font-semibold text-slate-700"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showPOPs ? 'bg-indigo-500 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
              {showPOPs && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <span>{t('layer_pops')}</span>
          </button>

          {/* Cables Toggle */}
          <button
            onClick={() => setShowCables(!showCables)}
            className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 transition w-full text-left text-xs font-semibold text-slate-700"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${showCables ? 'bg-slate-800 border-slate-900 text-white' : 'bg-white border-slate-300'}`}>
              {showCables && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </div>
            <span>{t('layer_cables')}</span>
          </button>
        </div>
      </div>

      <MapContainer
        center={initialCenter ? [initialCenter.lat, initialCenter.lng] : [-23.5505, -46.6333]}
        zoom={initialZoom || 15}
        maxZoom={24}
        style={{ height: '100%', width: '100%', backgroundColor: '#e2e8f0' }}
        className="z-0"
        preferCanvas={true} /* KEY PERFORMANCE OPTIMIZATION */
      >

        <MapResizeHandler />

        {mapType === 'street' ? (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxNativeZoom={19}
            maxZoom={24}
          />
        ) : (
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={19} maxZoom={24}
          />
        )}

        <MapEvents mode={mode} onMapClick={onAddPoint} onClearSelection={() => setActiveCableId(null)} onMapMoveEnd={onMapMoveEnd} />

        <MapController bounds={mapBounds || null} viewKey={viewKey} center={initialCenter} zoom={initialZoom} />

        {visibleCables.map(cable => (
          <CablePolyline
            key={cable.id}
            cable={cable}
            isLit={litCableIds.has(cable.id)}
            isActive={activeCableId === cable.id}
            isHighlighted={highlightedCableId === cable.id}
            mode={mode}
            t={t}
            onClick={handleCableClickInternal}
            onUpdateGeometry={onUpdateCableGeometry}
            onConnect={onConnectCable}
            snapDistance={snapDistance}
            ctos={ctos}
            pops={pops}
          />
        ))}

        {mode === 'draw_cable' && cableStartPoint && (
          <Marker position={[cableStartPoint.lat, cableStartPoint.lng]} icon={startPointIcon} />
        )}

        {visibleCTOs.map(cto => (
          <CTOMarker
            key={cto.id}
            cto={cto}
            isSelected={selectedId === cto.id}
            showLabels={showLabels}
            mode={mode}
            onNodeClick={onNodeClick}
            onMoveNode={onMoveNode || noOp}
            onCableStart={onCableStart}
            onCableEnd={onCableEnd}
            cableStartPoint={cableStartPoint}
          />
        ))}

        {visiblePOPs.map(pop => (
          <POPMarker
            key={pop.id}
            pop={pop}
            isSelected={selectedId === pop.id}
            showLabels={showLabels}
            mode={mode}
            onNodeClick={onNodeClick}
            onMoveNode={onMoveNode || noOp}
            onCableStart={onCableStart}
            onCableEnd={onCableEnd}
            cableStartPoint={cableStartPoint}
          />
        ))}

        {otdrResult && (
          <Marker position={[otdrResult.lat, otdrResult.lng]} icon={otdrIcon}>
            <Tooltip direction="top" permanent offset={[0, -20]} className="font-bold border-0 bg-slate-800 text-white shadow-xl">
              OTDR Event
            </Tooltip>
          </Marker>
        )}

      </MapContainer>
    </div>
  );
};
