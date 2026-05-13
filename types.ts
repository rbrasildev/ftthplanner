
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
  'CERTIFIED': '#0EA5E9', // skyblue (Certificado)
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
  portIndex?: number; // Persisted visual index/slot
}

export interface Splitter {
  id: string;
  name: string;
  type: string;
  catalogId?: string; // Link to CatalogSplitter for propagation
  inputPortId: string;
  outputPortIds: string[];
  connectorType?: string; // 'Connectorized' | 'Unconnectorized'
  polishType?: string; // 'APC' | 'UPC' | 'PC'
  allowCustomConnections?: boolean;
  // POP-side splitters live inside a specific DIO's splice tray.
  // CTO splitters don't use this field.
  dioId?: string;
}

export interface FusionPoint {
  id: string;
  name: string;
  type?: 'generic' | 'tray';
  catalogId?: string;
  category?: 'fusion' | 'connector';
  polishType?: string;
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
  name?: string; // Alphanumeric slot identifier (e.g. "A", "B", "GPON1")
}

export interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
}

// --- NEW EQUIPMENT TYPES ---

export interface OLT {
  id: string;
  name: string;
  ports: number; // Total ports
  portIds: string[];
  uplinkPorts?: number;
  uplinkPortIds?: string[];
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
  portLabels?: Record<string, string>; // Optional custom names per portId
  status?: CTOStatus;
  inputCableIds?: string[]; // Array of Cable IDs linked to this DIO
  cableLayout?: Record<string, { x: number; y: number }>; // Saved visual position of cables
  trayLayout?: { x: number; y: number }; // Saved position of the splice tray panel
  splicingLayout?: { col1: string[]; col2: string[]; col3: string[] };
}

// Lightweight DIO used inside the CTO editor.
// Each port exposes two distinct connection points (in / out), so fibers can
// land on either side. Port IDs follow `${id}-port-${i}-in|out`.
export interface DIOInline {
  id: string;
  name: string;
  ports: number;
}

// --- SWITCH / SFP / GBIC ---

export type GbicFormFactor = 'SFP' | 'SFP+' | 'SFP28' | 'QSFP+' | 'QSFP28' | 'XFP' | 'GBIC';
export type GbicFiberMode = 'monomodo' | 'multimodo';
// duplex = 2 fibras (TX/RX separadas); bidi = 1 fibra (WDM TX/RX na mesma fibra)
export type GbicTransmission = 'duplex' | 'bidi';

export interface Gbic {
  id: string;
  catalogId?: string;          // Referência a CatalogGbic
  name?: string;               // Denormalizado para exibição (ex: "1G-BX-10-D")
  tipo: GbicFormFactor;
  modoFibra: GbicFiberMode;
  transmissao: GbicTransmission;
  rateGbps?: number;           // 1, 10, 25, 40, 100
  waveTxNm?: number;           // Lambda TX (ex: 1310, 1490)
  waveRxNm?: number;           // Lambda RX (apenas BiDi)
  reachKm?: number;            // Alcance nominal
  potenciaTx: number;          // dBm (potência óptica de saída)
  sensibilidadeRx: number;     // dBm (mínima recebida para link)
}

// Alocação de uma porta de switch: conecta-se a porta(s) de um DIO
// (patch cord do switch → porta do DIO → splice para fibra do cabo).
// Duplex: txDioPortId !== rxDioPortId.
// BiDi:   txDioPortId === rxDioPortId (mesma porta para TX e RX).
export interface SwitchFiberAllocation {
  dioId: string;
  txDioPortId: string;
  rxDioPortId: string;
}

// Overrides de perdas para o link óptico desta porta. Se omitido,
// usa-se o padrão (0.35 dB/km fibra, 0.5 dB/conector, 0.1 dB/fusão).
export interface LinkLossConfig {
  conectores?: number;
  fusoes?: number;
  atenuacaoFibraDbPorKm?: number;
  perdaPorConectorDb?: number;
  perdaPorFusaoDb?: number;
}

/**
 * Link direto sem DIO. Representa um patch cord ligando a porta SFP deste switch
 * diretamente em outra porta SFP (de outro switch) OU num uplink de OLT.
 *
 * Mutuamente exclusivo com `SwitchPort.allocation`.
 *
 * `peerKind` default: 'switch' (retrocompat com dados antigos).
 * Quando `peerKind='olt'`, o campo `peerSwitchId` armazena o ID da OLT e
 * `peerPortId` o ID da porta de uplink da OLT.
 */
export interface DirectSwitchLink {
  peerKind?: 'switch' | 'olt';
  peerSwitchId: string;    // id da switch OU da OLT (dependendo de peerKind)
  peerPortId: string;
  /**
   * Catálogo GBIC usado do lado do peer — relevante quando `peerKind='olt'`
   * (OLT não tem GBIC modelado em si; o SFP do uplink vive aqui).
   * Se omitido, assume defaults conservadores (TX 0 dBm, RX −24 dBm).
   */
  peerGbicCatalogId?: string;
}

export interface SwitchPort {
  id: string;
  label?: string;              // Ex: "GE1/0/1"
  gbic?: Gbic;
  /** Link via DIO (cabo externo). Modo "Via DIO". */
  allocation?: SwitchFiberAllocation;
  /** Link direto pra outro switch no mesmo POP (patch cord curto). */
  directLink?: DirectSwitchLink;
  linkLossConfig?: LinkLossConfig;
}

export type ActiveEquipmentType = 'SWITCH' | 'ROUTER' | 'SERVER' | 'OTHER';

export interface SwitchData {
  id: string;
  name: string;
  status?: CTOStatus;
  catalogId?: string;
  portCount: number;
  ports: SwitchPort[];
  /**
   * Tipo do ativo — altera apenas label/ícone exibidos. A mecânica (portas
   * SFP/GBIC, alocação em DIO, peer trace) é idêntica para todos os tipos.
   * Default: 'SWITCH'.
   */
  type?: ActiveEquipmentType;
  // Uplinks separados são opcionais; por padrão qualquer porta pode ser uplink
}

// Parâmetros físicos de um link óptico para cálculo de potência RX.
export interface LinkOptico {
  distanciaKm: number;
  conectores: number;          // pares de conectores
  fusoes: number;
  // Overrides opcionais — se omitidos, usar perdas do catálogo (cabo) ou padrão.
  atenuacaoFibraDbPorKm?: number;
  perdaPorConectorDb?: number;
  perdaPorFusaoDb?: number;
}

export type OpticalLinkStatus = 'OK' | 'MARGINAL' | 'NO_SIGNAL';

export interface OpticalLinkResult {
  potenciaTx: number;
  potenciaRx: number;
  perdaTotal: number;
  sensibilidadeRx: number;
  margem: number;              // potenciaRx - sensibilidadeRx
  status: OpticalLinkStatus;
}

export interface CatalogGbic {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  tipo: GbicFormFactor;
  modoFibra: GbicFiberMode;
  transmissao: GbicTransmission;
  rateGbps?: number;
  waveTxNm?: number;
  waveRxNm?: number;
  reachKm?: number;
  potenciaTx: number;
  sensibilidadeRx: number;
  description?: string | null;
}

export interface POPData {
  id: string;
  name: string;
  status: CTOStatus; // Reusing status type for simplicity
  catalogId?: string; // Reference to CatalogBox (if applicable) or CatalogPop?
  coordinates: Coordinates;
  olts: OLT[];
  dios: DIO[];
  splitters?: Splitter[]; // Optical splitters mounted inside the POP (master/secundário)
  switches?: SwitchData[]; // Ethernet switches with SFP/GBIC ports
  fusions: FusionPoint[]; // Allows splicing inside POP if needed (or fusion trays inside DIO concept)
  connections: FiberConnection[]; // Internal Patch Cords
  inputCableIds: string[];
  layout?: Record<string, ElementLayout>;
  patchingLayout?: { col1: string[]; col2: string[]; col3: string[] };
  notes?: Note[];
  // Customization
  color?: string; // Hex color for the marker
  size?: number; // Size/radius of the marker (default 24)
  poleId?: string; // Associated pole for licensing/anchoring
}

// MVP modeling for vertical condominiums: a CTO at the building entrance with
// floors × units. Customers reference floor/unit. Riser splitters per floor are
// not modeled here yet — promote to its own entity if/when needed.
export interface BuildingConfig {
  floors: number;
  unitsPerFloor?: number;
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
  dios?: DIOInline[]; // Optional inline DIOs placed inside the CTO diagram
  connections: FiberConnection[];
  // Simulating physical structure
  inputCableIds: string[];
  clientCount: number;
  notes?: Note[];
  // Visual layout storage (ID -> Position)
  layout?: Record<string, ElementLayout>;
  // Persisted View State
  viewState?: {
    x: number;
    y: number;
    zoom: number;
  };
  poleId?: string; // Associated pole for licensing/anchoring
  building?: BuildingConfig | null; // When set, this CTO is a vertical condominium
}

export interface CableReserve {
  id: string;
  length: number; // metros
  location?: Coordinates;
  showLabel?: boolean;
}

export interface CableData {
  id: string;
  name: string;
  status: CableStatus;
  fiberCount: number;
  looseTubeCount?: number;
  color?: string;
  colorStandard?: 'ABNT' | 'EIA598';
  coordinates: Coordinates[];
  fromNodeId?: string | null;
  toNodeId?: string | null;
  catalogId?: string;
  // Optional explicit subtype. When null/undefined, the UI infers it from
  // fiberCount via getEffectiveCableType() — see utils/cableTypeUtils.ts.
  type?: CableType | null;
  technicalReserve?: number; // @deprecated — usar reserves
  reserveLocation?: Coordinates; // @deprecated — usar reserves
  showReserveLabel?: boolean; // @deprecated — usar reserves
  reserves?: CableReserve[]; // Múltiplas reservas técnicas
  streetName?: string;
  width?: number;
}


export type PoleStatus = 'PLANNED' | 'ANALYSING' | 'LICENSED';

export const POLE_STATUS_COLORS: Record<PoleStatus, string> = {
  'PLANNED': '#1b1b1bff', // Black (Em projeto)
  'ANALYSING': '#eab308', // Yellow (Em anÃ¡lise)
  'LICENSED': '#22c55e', // Green (Licenciado)
};

// Documentação para concessionária
export type PoleSituation = 'EXISTING' | 'NEW' | 'SHARED' | 'REPLACE';
export type PoleRoadSide = 'LEFT' | 'RIGHT';
export type PoleApprovalStatus = 'APPROVED' | 'PENDING' | 'IRREGULAR';

export const POLE_APPROVAL_COLORS: Record<PoleApprovalStatus, string> = {
  'APPROVED': '#22c55e',  // Verde
  'PENDING': '#eab308',   // Amarelo
  'IRREGULAR': '#ef4444', // Vermelho
};

export const POLE_SITUATION_COLORS: Record<PoleSituation, string> = {
  'EXISTING': '#6b7280',  // Cinza
  'NEW': '#3b82f6',       // Azul
  'SHARED': '#8b5cf6',    // Roxo
  'REPLACE': '#f97316',   // Laranja
};

export interface PoleData {
  id: string;
  name: string;
  status: PoleStatus;
  coordinates: Coordinates;
  catalogId?: string;
  type?: string;
  height?: number;
  linkedCableIds?: string[];
  // Campos de documentação para concessionária
  utilityCode?: string;
  shape?: string;
  strength?: number;
  situation?: PoleSituation;
  roadSide?: PoleRoadSide;
  addressReference?: string;
  observations?: string;
  approvalStatus?: PoleApprovalStatus;
  hasPhoto?: boolean;
  lastInspectionDate?: string;
}

export interface PoleEquipmentData {
  id: string;
  poleId: string;
  type: string;
  name: string;
  description?: string;
  quantity: number;
}

export interface PoleSpanData {
  id: string;
  originPoleId: string;
  destinationPoleId: string;
  distanceMeters?: number;
  cableType?: string;
  fiberCount?: number;
  sag?: number;
  minHeight?: number;
  sharing?: string;
  observations?: string;
}

export interface PoleChecklistData {
  id?: string;
  poleId: string;
  hasIdentification: boolean;
  hasPhoto: boolean;
  distanceVerified: boolean;
  heightInformed: boolean;
  cableLinked: boolean;
  ctoOrBoxLinked: boolean;
  noElectricalConflict: boolean;
  readyToSubmit: boolean;
}

export interface PolePhotoData {
  id: string;
  poleId: string;
  url: string;
  caption?: string;
  createdAt?: string;
}

export interface FusionType {
  id: string;
  name: string;
  attenuation: number;
}

export interface PolygonData {
  id: string;
  name: string;
  points: Coordinates[];
  color: string;        // hex (#rrggbb) — borda e preenchimento (com fillOpacity)
  fillOpacity?: number; // default 0.25
  weight?: number;      // espessura da borda em px (default 2)
  createdAt?: number;
}

export const POLYGON_PALETTE: string[] = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#0ea5e9', // sky
  '#6366f1', // indigo
  '#a855f7', // violet
  '#ec4899', // pink
  '#64748b', // slate
];

export interface NetworkState {
  // Added POPs
  ctos: CTOData[];
  pops: POPData[];
  cables: CableData[];
  poles: PoleData[]; // Added Poles
  polygons?: PolygonData[]; // Áreas demarcadas no mapa (cobertura, zonas, anotações)
  fusionTypes?: FusionType[]; // Modules de FusÃ£o
}

export interface InheritedElementsConfig {
  backbone: boolean;
  poles: boolean;
  cables: boolean;
  ctos: boolean;
  ceos: boolean;
  pops: boolean;
  customers: boolean;
}

export const DEFAULT_INHERITED_ELEMENTS: InheritedElementsConfig = {
  backbone: true,
  poles: true,
  cables: true,
  ctos: true,
  ceos: true,
  pops: true,
  customers: false,
};

export interface ProjectSettings {
  snapDistance: number;
  coverageRadius: number; // Raio de cobertura em metros
}

export interface SystemSettings {
  snapDistance: number;
  coverageRadius: number;
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
  parentProjectId?: string | null;
  parentProject?: { id: string; name: string } | null;
  inheritedElements?: InheritedElementsConfig;
  parentNetwork?: (NetworkState & { parentProjectName?: string }) | null;
  childCables?: CableData[];
  counts?: {
    ctos: number;
    pops: number;
    cables: number;
    poles: number;
    deployedCtos: number;
    deployedCables: number;
    childProjects: number;
  };
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

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'PLANNED' | 'SUSPENDED';

export interface Drop {
  id: string;
  customerId: string;
  ctoId: string;
  coordinates: Coordinates[];
  length?: number;
}

export interface Customer {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  ctoId?: string | null;
  splitterId?: string | null;
  splitterPortIndex?: number | null;
  // Alternative to splitterId/splitterPortIndex — when set, the customer is connected
  // directly to a connector (FusionPoint with category='connector') inside the CTO.
  // One customer per connector. Mutually exclusive with splitter attachment.
  connectorId?: string | null;
  fiberId?: string | null;
  drop?: Drop; // Include Drop relation
  status: CustomerStatus;
  createdAt: string; // ISO Date
  updatedAt: string; // ISO Date
  companyId?: string | null;
  onuSerial?: string | null;
  onuMac?: string | null;
  pppoeService?: string | null;
  onuPower?: number | null; // Signal power (e.g., -20.0 dBm)
  dropCoordinates?: Coordinates[]; // Optional for API updates
  projectId?: string | null;
  connectionStatus?: 'online' | 'offline' | null;
  sgpContractId?: string | null;
  // Vertical condominium attachment — only meaningful when ctoId points to a
  // CTO with `building` set. Free-form unit string supports labels like "101", "A-12".
  floor?: number | null;
  unit?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
