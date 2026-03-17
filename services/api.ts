import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta as any).env.VITE_API_URL || '/api',
    withCredentials: true,
});

api.interceptors.request.use(
    (config) => {
        const supportToken = localStorage.getItem('ftth_support_token');
        const authToken = localStorage.getItem('ftth_token');

        if (supportToken) {
            config.headers['Authorization'] = `Bearer ${supportToken}`;
        } else if (authToken) {
            config.headers['Authorization'] = `Bearer ${authToken}`;
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
        // Detect matching network errors (backend down or offline)
        if (!error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error')) {
            window.dispatchEvent(new CustomEvent('ftth-connection-error'));
        }
        return Promise.reject(error);
    }
);

export default api;
