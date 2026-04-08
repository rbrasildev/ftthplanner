import api from './api';
import { PoleEquipmentData, PoleChecklistData, PoleSpanData, PolePhotoData } from '../types';

// Pole documentation details
export const getPoleDetails = async (projectId: string, poleId: string) => {
    const response = await api.get(`/pole-doc/${projectId}/poles/${poleId}/details`);
    return response.data;
};

export const updatePoleDetails = async (projectId: string, poleId: string, data: Record<string, any>) => {
    const response = await api.put(`/pole-doc/${projectId}/poles/${poleId}/details`, data);
    return response.data;
};

// Equipments
export const getPoleEquipments = async (projectId: string, poleId: string): Promise<PoleEquipmentData[]> => {
    const response = await api.get(`/pole-doc/${projectId}/poles/${poleId}/equipments`);
    return response.data;
};

export const createPoleEquipment = async (projectId: string, poleId: string, data: Omit<PoleEquipmentData, 'id' | 'poleId'>) => {
    const response = await api.post(`/pole-doc/${projectId}/poles/${poleId}/equipments`, data);
    return response.data;
};

export const updatePoleEquipment = async (projectId: string, poleId: string, equipmentId: string, data: Partial<PoleEquipmentData>) => {
    const response = await api.put(`/pole-doc/${projectId}/poles/${poleId}/equipments/${equipmentId}`, data);
    return response.data;
};

export const deletePoleEquipment = async (projectId: string, poleId: string, equipmentId: string) => {
    const response = await api.delete(`/pole-doc/${projectId}/poles/${poleId}/equipments/${equipmentId}`);
    return response.data;
};

// Checklist
export const getPoleChecklist = async (projectId: string, poleId: string): Promise<PoleChecklistData> => {
    const response = await api.get(`/pole-doc/${projectId}/poles/${poleId}/checklist`);
    return response.data;
};

export const upsertPoleChecklist = async (projectId: string, poleId: string, data: Partial<PoleChecklistData>) => {
    const response = await api.put(`/pole-doc/${projectId}/poles/${poleId}/checklist`, data);
    return response.data;
};

// Photos
export const getPolePhotos = async (projectId: string, poleId: string): Promise<PolePhotoData[]> => {
    const response = await api.get(`/pole-doc/${projectId}/poles/${poleId}/photos`);
    return response.data;
};

export const addPolePhoto = async (projectId: string, poleId: string, data: { url: string; caption?: string }) => {
    const response = await api.post(`/pole-doc/${projectId}/poles/${poleId}/photos`, data);
    return response.data;
};

export const deletePolePhoto = async (projectId: string, poleId: string, photoId: string) => {
    const response = await api.delete(`/pole-doc/${projectId}/poles/${poleId}/photos/${photoId}`);
    return response.data;
};

// Spans (Vãos)
export const getProjectSpans = async (projectId: string): Promise<PoleSpanData[]> => {
    const response = await api.get(`/pole-doc/${projectId}/spans`);
    return response.data;
};

export const createSpan = async (projectId: string, data: Omit<PoleSpanData, 'id'>) => {
    const response = await api.post(`/pole-doc/${projectId}/spans`, data);
    return response.data;
};

export const updateSpan = async (projectId: string, spanId: string, data: Partial<PoleSpanData>) => {
    const response = await api.put(`/pole-doc/${projectId}/spans/${spanId}`, data);
    return response.data;
};

export const deleteSpan = async (projectId: string, spanId: string) => {
    const response = await api.delete(`/pole-doc/${projectId}/spans/${spanId}`);
    return response.data;
};

// Report
export const getProjectReport = async (projectId: string) => {
    const response = await api.get(`/pole-doc/${projectId}/report`);
    return response.data;
};
