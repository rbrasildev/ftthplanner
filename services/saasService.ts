import api from './api';

export const getPlans = async () => {
    const response = await api.get('/saas/plans');
    return response.data;
};

export const createPlan = async (data: any) => {
    const response = await api.post('/saas/plans', data);
    return response.data;
};

export const getCompanies = async () => {
    const response = await api.get('/saas/companies');
    return response.data;
};

export const updateCompany = async (id: string, data: any) => {
    const response = await api.put(`/saas/companies/${id}`, data);
    return response.data;
};

export const updatePlan = async (id: string, data: any) => {
    const response = await api.put(`/saas/plans/${id}`, data);
    return response.data;
};

export const getAuditLogs = async (params: any = {}) => {
    const response = await api.get('/audit', { params });
    return response.data;
};

export const getGlobalMapData = async () => {
    const response = await api.get('/saas/map-data');
    return response.data;
};
