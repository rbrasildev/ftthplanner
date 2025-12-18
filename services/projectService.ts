import api from './api';
import { Project, NetworkState, Coordinates } from '../types';

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
