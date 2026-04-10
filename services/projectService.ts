import api from './api';
import { Project, NetworkState, Coordinates, CTOData, POPData, InheritedElementsConfig } from '../types';

export interface ProjectSummary {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    network: NetworkState; // In summary it might be empty
}

export const getProjects = async () => {
    const res = await api.get<Project[]>('/projects');
    return res.data;
};

export const createProject = async (name: string, center: Coordinates) => {
    const res = await api.post<Project>('/projects', {
        name,
        centerLat: center.lat,
        centerLng: center.lng
    });
    return res.data;
};



export const updateProject = async (id: string, name: string, center: Coordinates) => {
    const res = await api.put<Project>(`/projects/${id}`, {
        name,
        centerLat: center.lat,
        centerLng: center.lng
    });
    return res.data;
};

export const deleteProject = async (id: string) => {
    await api.delete(`/projects/${id}`);
};

export const getProject = async (id: string) => {
    const res = await api.get<Project>(`/projects/${id}`);
    return res.data;
};

export const syncProject = async (id: string, network: NetworkState, mapState?: { center: Coordinates, zoom: number }, settings?: any) => {
    await api.post(`/projects/${id}/sync`, { network, mapState, settings });
};

export const updateCTO = async (projectId: string, ctoId: string, cto: CTOData) => {
    const res = await api.put(`/projects/${projectId}/ctos/${ctoId}`, cto);
    return res.data;
};
export const updatePOP = async (projectId: string, popId: string, pop: POPData) => {
    const res = await api.put(`/projects/${projectId}/pops/${popId}`, pop);
    return res.data;
};

// Parent Project
export const setParentProject = async (projectId: string, parentProjectId: string | null, inheritedElements?: InheritedElementsConfig) => {
    const res = await api.put(`/projects/${projectId}/parent`, { parentProjectId, inheritedElements });
    return res.data;
};

export const getParentProjectNetwork = async (projectId: string) => {
    const res = await api.get(`/projects/${projectId}/parent-network`);
    return res.data;
};

export const getChildProjects = async (projectId: string) => {
    const res = await api.get(`/projects/${projectId}/children`);
    return res.data;
};

export const getChildCables = async (projectId: string) => {
    const res = await api.get(`/projects/${projectId}/child-cables`);
    return res.data;
};
