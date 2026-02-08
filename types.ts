
export enum EquipmentType {
  OLT = 'OLT',
  CTO = 'CTO',
  SPLITTER = 'SPLITTER',
  CABLE = 'CABLE',
  POP = 'POP',
  DIO = 'DIO'
}

export enum CableType {
  DROP = 'DROP',
  DISTRIBUTION = 'DISTRIBUTION', // 12, 24, 48fo
  FEEDER = 'FEEDER' // Backbone
}

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'SUPER_ADMIN';
export type CTOStatus = 'PLANNED' | 'NOT_DEPLOYED' | 'DEPLOYED' | 'CERTIFIED';
export type CableStatus = 'NOT_DEPLOYED' | 'DEPLOYED';

export const CTO_STATUS_COLORS: Record<CTOStatus, string> = {
  'PLANNED': '#ffff00', // Amber/Orange (Em projeto)
  'NOT_DEPLOYED': '#ef4444', // Red (NÃ£o implantado)
  'DEPLOYED': '#00ff00', // Greenish-Blue (Implantado)
  'CERTIFIED': '#22c55e', // Green (Certificado)
};

export const CABLE_STATUS_COLORS: Record<CableStatus, string> = {
  'NOT_DEPLOYED': '#94a3b8', // Slate 400 (Grey/Dashed usually) - or Red depending on pref. Let's use a distinct dashed look or specific color.
  'DEPLOYED': '#0ea5e9' // Default Blue, but usually user defined
};

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface FiberConnection {
  id: string;
  sourceId: string; // ID of the source (e.g., Incoming Cable Fiber ID)
  targetId: string; // ID of the target (e.g., Splitter Input ID)
  color: string;
  points?: { x: number; y: number }[]; // Custom routing points
}

export interface Splitter {
  id: string;
  name: string;
  type: string;
  inputPortId: string;
  outputPortIds: string[];
}

export interface FusionPoint {
  id: string;
  name: string;
  type?: 'generic' | 'tray';
  catalogId?: string;
}

export interface ElementLayout {
  x: number;
  y: number;
  rotation: number;
  mirrored?: boolean; // Controls left/right orientation (flipping)
}

export interface SlotConfig {
  active: boolean;
  portCount: number;
}

// --- NEW EQUIPMENT TYPES ---

export interface OLT {
  id: string;
  name: string;
  ports: number; // Total ports
  portIds: string[];
  status?: CTOStatus;
  type?: 'OLT' | 'SWITCH' | 'ROUTER' | 'SERVER' | 'OTHER';
  structure?: {
    slots: number;
    portsPerSlot: number;
    slotsConfig?: SlotConfig[];
  };
}

export interface DIO {
  id: string;
  name: string;
  ports: number; // Number of ports (e.g., 12, 24, 48)
  portIds: string[];
  status?: CTOStatus;
  inputCableIds?: string[]; // Array of Cable IDs linked to this DIO
  cableLayout?: Record<string, { x: number; y: number }>; // Saved visual position of cables
  trayLayout?: { x: number; y: number }; // Saved position of the splice tray panel
}

export interface POPData {
  id: string;
  name: string;
  status: CTOStatus; // Reusing status type for simplicity
  catalogId?: string; // Reference to CatalogBox (if applicable) or CatalogPop?
  coordinates: Coordinates;
  olts: OLT[];
  dios: DIO[];
  fusions: FusionPoint[]; // Allows splicing inside POP if needed (or fusion trays inside DIO concept)
  connections: FiberConnection[]; // Internal Patch Cords
  inputCableIds: string[];
  layout?: Record<string, ElementLayout>;
  // Customization
  color?: string; // Hex color for the marker
  size?: number; // Size/radius of the marker (default 24)
  poleId?: string; // Associated pole for licensing/anchoring
}

export interface CTOData {
  id: string;
  name: string;
  status: CTOStatus; // New Status Field
  type?: 'CTO' | 'CEO'; // Sub-type
  color?: string; // Visual Color
  reserveLoopLength?: number; // Technical Reserve
  catalogId?: string; // Reference to CatalogBox
  coordinates: Coordinates;
  splitters: Splitter[];
  fusions: FusionPoint[];
  connections: FiberConnection[];
  // Simulating physical structure
  inputCableIds: string[];
  clientCount: number;
  // Visual layout storage (ID -> Position)
  layout?: Record<string, ElementLayout>;
  // Persisted View State
  viewState?: {
    x: number;
    y: number;
    zoom: number;
  };
  poleId?: string; // Associated pole for licensing/anchoring
}

export interface CableData {
  id: string;
  name: string;
  status: CableStatus; // New Status Field
  fiberCount: number;
  looseTubeCount?: number; // Quantity of loose tubes
  color?: string; // Hex color for map visualization (Used when Deployed)
  colorStandard?: 'ABNT' | 'EIA598'; // Standard for fiber colors (Default: ABNT)
  coordinates: Coordinates[]; // Polyline points
  fromNodeId?: string | null; // Optional/Null for free-floating cables
  toNodeId?: string | null;   // Optional/Null for free-floating cables
  catalogId?: string; // Reference to CatalogCable
  technicalReserve?: number; // Comprimento em metros de reserva tÃ©cnica
  reserveLocation?: Coordinates; // LocalizaÃ§Ã£o especÃ­fica para a label de reserva
  showReserveLabel?: boolean; // Toggle individual para mostrar/ocultar a label
}


export type PoleStatus = 'PLANNED' | 'ANALYSING' | 'LICENSED';

export const POLE_STATUS_COLORS: Record<PoleStatus, string> = {
  'PLANNED': '#1b1b1bff', // Black (Em projeto)
  'ANALYSING': '#eab308', // Yellow (Em anÃ¡lise)
  'LICENSED': '#22c55e', // Green (Licenciado)
};

export interface PoleData {
  id: string;
  name: string;
  status: PoleStatus;
  coordinates: Coordinates;
  catalogId?: string; // Reference to CatalogPole
  type?: string;
  height?: number;
  linkedCableIds?: string[]; // Logically linked cables for licensing
}

export interface FusionType {
  id: string;
  name: string;
  attenuation: number;
}

export interface NetworkState {
  // Added POPs
  ctos: CTOData[];
  pops: POPData[];
  cables: CableData[];
  poles: PoleData[]; // Added Poles
  fusionTypes?: FusionType[]; // Modules de FusÃ£o
}

export interface ProjectSettings {
  snapDistance: number; // Distance in meters to auto-connect cables
}

export interface SystemSettings {
  snapDistance: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  network: NetworkState;
  mapState?: {
    center: Coordinates;
    zoom: number;
  };
  settings?: ProjectSettings;
}

// Fiber color code standard (Brazilian/International standard variation)
// 1-Verde, 2-Amarelo, 3-Branco, 4-Azul, 5-Vermelho, 6-Violeta, 7-Marrom, 8-Rosa, 9-Preto, 10-Cinza, 11-Laranja, 12-Aqua
// Fiber color code standard (Brazilian/International)
export const ABNT_COLORS = [
  '#22c55e', // 1 - Green (Verde)
  '#eab308', // 2 - Yellow (Amarelo)
  '#ffffff', // 3 - White (Branco)
  '#0000FF', // 4 - Blue (Azul)
  '#ef4444', // 5 - Red (Vermelho)
  '#a855f7', // 6 - Violet (Violeta)
  '#78350f', // 7 - Brown (Marrom)
  '#ec4899', // 8 - Pink (Rosa)
  '#000000', // 9 - Black (Preto)
  '#9ca3af', // 10 - Gray (Cinza)
  '#f97316', // 11 - Orange (Laranja)
  '#22d3ee', // 12 - Aqua (Turquoise)
];

export const EIA_COLORS = [
  '#0000FF', // 1 - Blue
  '#f97316', // 2 - Orange
  '#22c55e', // 3 - Green
  '#78350f', // 4 - Brown
  '#9ca3af', // 5 - Slate
  '#ffffff', // 6 - White
  '#ef4444', // 7 - Red
  '#000000', // 8 - Black
  '#eab308', // 9 - Yellow
  '#a855f7', // 10 - Violet
  '#ec4899', // 11 - Rose
  '#22d3ee', // 12 - Aqua
];

// Default to ABNT to maintain existing behavior for now
export const FIBER_COLORS = ABNT_COLORS;

export const getFiberColor = (index: number, standard: 'ABNT' | 'EIA598' = 'ABNT') => {
  const palette = standard === 'EIA598' ? EIA_COLORS : ABNT_COLORS;
  return palette[index % palette.length];
};
// --- SAAS CONFIG ---
export interface SaaSConfig {
  id: string;
  appName: string;
  appLogoUrl?: string | null;
  faviconUrl?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  websiteUrl?: string | null;

  // SEO
  appDescription?: string | null;
  appKeywords?: string | null;
  ogImageUrl?: string | null;

  // Social
  socialFacebook?: string | null;
  socialTwitter?: string | null;
  socialInstagram?: string | null;
  socialLinkedin?: string | null;
  socialYoutube?: string | null;

  // Layout & Content
  heroPreviewUrl?: string | null;
  ctaBgImageUrl?: string | null;
  footerDesc?: string | null;
  copyrightText?: string | null;

  updatedAt: string;
}
