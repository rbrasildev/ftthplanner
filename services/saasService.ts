import api from './api';

// Public Plans
export const getPublicPlans = async () => {
    const response = await api.get('/saas/public/plans');
    return response.data;
};

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
export const deleteCompany = async (id: string) => {
    const response = await api.delete(`/saas/companies/${id}`);
    return response.data;
};

export const getUsers = async () => {
    const response = await api.get('/saas/users');
    return response.data;
};

export const updateUser = async (id: string, data: any) => {
    const response = await api.put(`/saas/users/${id}`, data);
    return response.data;
};

// Demo Videos
export const getPublicDemoVideos = async () => {
    const response = await api.get('/saas/public/videos');
    return response.data;
};

export const getDemoVideos = async () => {
    const response = await api.get('/saas/videos');
    return response.data;
};

export const createDemoVideo = async (data: any) => {
    const response = await api.post('/saas/videos', data);
    return response.data;
};

export const updateDemoVideo = async (id: string, data: any) => {
    const response = await api.put(`/saas/videos/${id}`, data);
    return response.data;
};

export const deleteDemoVideo = async (id: string) => {
    const response = await api.delete(`/saas/videos/${id}`);
    return response.data;
};

// Email Settings
export const getSmtpConfig = async () => {
    const response = await api.get('/saas/email/smtp');
    return response.data;
};

export const updateSmtpConfig = async (data: any) => {
    const response = await api.post('/saas/email/smtp', data);
    return response.data;
};

export const testSmtp = async (data: any) => {
    const response = await api.post('/saas/email/smtp/test', data);
    return response.data;
};

// Email Templates
export const getEmailTemplates = async () => {
    const response = await api.get('/saas/email/templates');
    return response.data;
};

export const createEmailTemplate = async (data: any) => {
    const response = await api.post('/saas/email/templates', data);
    return response.data;
};

export const updateEmailTemplate = async (id: string, data: any) => {
    const response = await api.put(`/saas/email/templates/${id}`, data);
    return response.data;
};

export const deleteEmailTemplate = async (id: string) => {
    const response = await api.delete(`/saas/email/templates/${id}`);
    return response.data;
};

export const sendTemplate = async (data: { templateId: string, targetType: string, targetId?: string }) => {
    const response = await api.post('/saas/email/send', data);
    return response.data;
};

// SaaS Global Config
export const getSaaSConfig = async () => {
    const response = await api.get('/saas/config');
    return response.data;
};

export const updateSaaSConfig = async (data: any) => {
    const response = await api.put('/saas/config', data);
    return response.data;
};

export const uploadSaaSLogo = async (logoBase64: string) => {
    const response = await api.post('/saas/config/logo', { logoBase64 });
    return response.data;
};

export const createSupportSession = async (targetUserId: string) => {
    const response = await api.post('/support/session', { targetUserId });
    return response.data;
};

export const endSupportSession = async (sessionId?: string) => {
    const response = await api.post('/support/end', { sessionId });
    return response.data;
};
