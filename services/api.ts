import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Use relative path to avoid CORS/Protocol issues
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
