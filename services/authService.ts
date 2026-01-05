import api from './api';

export const login = async (username: string, password?: string) => {
    const pass = password || "123456";

    // Perform Login
    const res = await api.post('/auth/login', { username, password: pass });
    return res.data;
};
