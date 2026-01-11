import api from './api';

export const login = async (email: string, password?: string) => {
    const pass = password || "123456";

    // Perform Login
    const res = await api.post('/auth/login', { email, password: pass });
    return res.data;
};

export const getMe = async () => {
    const res = await api.get('/auth/me');
    return res.data;
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword });
    return res.data;
};
