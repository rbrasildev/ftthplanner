
import api from './api';

export const getCompanyProfile = async () => {
    const response = await api.get('/companies/profile');
    return response.data;
};

export const updateCompanyProfile = async (data: any) => {
    const response = await api.put('/companies/profile', data);
    return response.data;
};

export const uploadCompanyLogo = async (logoBase64: string) => {
    const response = await api.post('/companies/logo', { logoBase64 });
    return response.data;
};
