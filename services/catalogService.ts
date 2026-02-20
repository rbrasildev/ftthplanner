import api from './api';

export interface SplitterCatalogItem {
    id: string;
    name: string;
    type: string;
    mode: string;
    inputs: number;
    outputs: number;
    connectorType?: string;
    allowCustomConnections?: boolean;
    attenuation: Record<string, any>;
    description?: string;
    updatedAt?: string;
}

export const getSplitters = async (): Promise<SplitterCatalogItem[]> => {
    const response = await api.get('/catalog/splitters');
    return response.data;
};

export const createSplitter = async (data: Omit<SplitterCatalogItem, 'id' | 'updatedAt'>): Promise<SplitterCatalogItem> => {
    const response = await api.post('/catalog/splitters', data);
    return response.data;
};

export const updateSplitter = async (id: string, data: Partial<SplitterCatalogItem>): Promise<SplitterCatalogItem> => {
    const response = await api.put(`/catalog/splitters/${id}`, data);
    return response.data;
};

export const deleteSplitter = async (id: string): Promise<void> => {
    await api.delete(`/catalog/splitters/${id}`);
};

export interface CableCatalogItem {
    id: string;
    name: string;
    brand?: string;
    model?: string;
    defaultLevel?: string;
    fiberCount: number;
    looseTubeCount: number;
    fibersPerTube: number;
    attenuation?: number;
    fiberProfile?: string;
    description?: string;
    deployedSpec?: { color: string; width: number };
    plannedSpec?: { color: string; width: number };
    updatedAt?: string;
}

export const getCables = async (): Promise<CableCatalogItem[]> => {
    const response = await api.get('/catalog/cables');
    return response.data;
};

export const createCable = async (data: Omit<CableCatalogItem, 'id' | 'updatedAt'>): Promise<CableCatalogItem> => {
    const response = await api.post('/catalog/cables', data);
    return response.data;
};

export const updateCable = async (id: string, data: Partial<CableCatalogItem>): Promise<CableCatalogItem> => {
    const response = await api.put(`/catalog/cables/${id}`, data);
    return response.data;
};

export const deleteCable = async (id: string): Promise<void> => {
    await api.delete(`/catalog/cables/${id}`);
};

export interface BoxCatalogItem {
    id: string;
    name: string;
    brand?: string;
    model?: string;
    type: 'CTO' | 'CEO';
    reserveLoopLength?: number;
    color?: string;
    description?: string;
    updatedAt?: string;
}

export const getBoxes = async (): Promise<BoxCatalogItem[]> => {
    const response = await api.get('/catalog/boxes');
    return response.data;
};

export const createBox = async (data: Omit<BoxCatalogItem, 'id' | 'updatedAt'>): Promise<BoxCatalogItem> => {
    const response = await api.post('/catalog/boxes', data);
    return response.data;
};

export const updateBox = async (id: string, data: Partial<BoxCatalogItem>): Promise<BoxCatalogItem> => {
    const response = await api.put(`/catalog/boxes/${id}`, data);
    return response.data;
};

export const deleteBox = async (id: string): Promise<void> => {
    await api.delete(`/catalog/boxes/${id}`);
};

export interface PoleCatalogItem {
    id: string;
    name: string;
    type: string;
    height: number;
    strength: number;
    shape: string;
    description?: string;
    updatedAt?: string;
}

export const getPoles = async (): Promise<PoleCatalogItem[]> => {
    const response = await api.get('/catalog/poles');
    return response.data;
};

export const createPole = async (data: Omit<PoleCatalogItem, 'id' | 'updatedAt'>): Promise<PoleCatalogItem> => {
    const response = await api.post('/catalog/poles', data);
    return response.data;
};

export const updatePole = async (id: string, data: Partial<PoleCatalogItem>): Promise<PoleCatalogItem> => {
    const response = await api.put(`/catalog/poles/${id}`, data);
    return response.data;
};


export const deletePole = async (id: string): Promise<void> => {
    await api.delete(`/catalog/poles/${id}`);
};


// --- FUSIONS ---

export interface FusionCatalogItem {
    id: string;
    name: string;
    attenuation: number;
    updatedAt?: string;
}

export const getFusions = async (): Promise<FusionCatalogItem[]> => {
    const response = await api.get('/catalog/fusions');
    return response.data;
};

export const createFusion = async (data: Omit<FusionCatalogItem, 'id' | 'updatedAt'>): Promise<FusionCatalogItem> => {
    const response = await api.post('/catalog/fusions', data);
    return response.data;
};

export const updateFusion = async (id: string, data: Partial<FusionCatalogItem>): Promise<FusionCatalogItem> => {
    const response = await api.put(`/catalog/fusions/${id}`, data);
    return response.data;
};

export const deleteFusion = async (id: string): Promise<void> => {
    await api.delete(`/catalog/fusions/${id}`);
};

// --- OLTS ---

export interface OLTCatalogItem {
    id: string;
    name: string;
    type?: string;
    outputPower: number; // dBm
    slots?: number;
    portsPerSlot?: number;
    description?: string;
    updatedAt?: string;
}

export const getOLTs = async (): Promise<OLTCatalogItem[]> => {
    const response = await api.get('/catalog/olts');
    return response.data;
};

export const createOLT = async (data: Omit<OLTCatalogItem, 'id' | 'updatedAt'>): Promise<OLTCatalogItem> => {
    const response = await api.post('/catalog/olts', data);
    return response.data;
};

export const updateOLT = async (id: string, data: Partial<OLTCatalogItem>): Promise<OLTCatalogItem> => {
    const response = await api.put(`/catalog/olts/${id}`, data);
    return response.data;
};

export const deleteOLT = async (id: string): Promise<void> => {
    await api.delete(`/catalog/olts/${id}`);
};

