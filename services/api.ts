import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta as any).env.VITE_API_URL || '/api',
    withCredentials: true,
});

api.interceptors.request.use(
    (config) => {
        const supportToken = localStorage.getItem('ftth_support_token');
        if (supportToken) {
            config.headers['Authorization'] = `Bearer ${supportToken}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Optional: handle global errors or auth redirect
        return Promise.reject(error);
    }
);

export default api;
