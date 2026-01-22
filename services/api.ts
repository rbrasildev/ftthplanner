import axios from 'axios';

const api = axios.create({
    // Use environment variable or fallback to the confirmed live backend
    baseURL: import.meta.env.VITE_API_URL || 'https://ftth.redeconexaonet.com/api',
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('ftth_planner_token_v1');
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
