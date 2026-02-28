import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use(
    (config) => {
        const supportToken = localStorage.getItem('ftth_support_token');
        const mainToken = localStorage.getItem('ftth_planner_token_v1');
        const token = supportToken || mainToken;
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
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
