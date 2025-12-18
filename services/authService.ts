import api from './api';

export const login = async (username: string, password?: string) => {
    const pass = password || "123456";

    // "Sign Up or Log In" flow
    try {
        // Try to register first
        await api.post('/auth/register', { username, password: pass });
    } catch (e: any) {
        // If register fails, assume user exists (or other error) and proceed to login
        // We ignore 400 (likely username taken)
        if (e.response && e.response.status !== 400) {
            console.warn("Registration attempt failed", e);
        }
    }

    // Perform Login
    const res = await api.post('/auth/login', { username, password: pass });
    return res.data;
};
