import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta as any).env.VITE_API_URL || '/api',
    withCredentials: true,
});

// Threshold above which request bodies get gzip'd before sending. Below this,
// compression overhead isn't worth it (small payloads typically compress poorly
// and the round-trip latency dominates anyway).
const GZIP_THRESHOLD_BYTES = 64 * 1024; // 64 KB

async function gzipString(input: string): Promise<Uint8Array> {
    const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
}

api.interceptors.request.use(
    async (config) => {
        const supportToken = localStorage.getItem('ftth_support_token');
        const authToken = localStorage.getItem('ftth_token');

        if (supportToken) {
            config.headers['Authorization'] = `Bearer ${supportToken}`;
        } else if (authToken) {
            config.headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Compress large JSON bodies. Server's body-parser auto-inflates when
        // Content-Encoding=gzip, so no backend changes needed beyond the existing
        // express.json() middleware. Only kicks in for browsers with native
        // CompressionStream (Chrome 80+, Firefox 113+, Safari 16.4+) — older
        // browsers fall through and send uncompressed.
        // Pula bodies binários (ArrayBuffer, Blob, TypedArray) — esses já são
        // payloads brutos que não devem ser JSON.stringify'ados. Sem este check,
        // upload binário (ex: backup .json.gz.enc) virava `"{}"` e quebrava no
        // server. FormData também já tem boundary próprio, não mexer.
        const isBinaryBody = config.data instanceof ArrayBuffer
            || config.data instanceof Blob
            || (typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(config.data));
        const supportsGzip = typeof CompressionStream !== 'undefined';
        if (supportsGzip && config.data && typeof config.data === 'object'
            && !(config.data instanceof FormData)
            && !isBinaryBody) {
            try {
                const json = JSON.stringify(config.data);
                if (json.length >= GZIP_THRESHOLD_BYTES) {
                    const gz = await gzipString(json);
                    config.data = gz;
                    config.headers['Content-Type'] = 'application/json';
                    config.headers['Content-Encoding'] = 'gzip';
                }
            } catch {
                // If anything goes wrong, fall through to the uncompressed path.
            }
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

        // Session expired or revoked — force logout and redirect to login.
        // Mas tem 2 sub-casos importantes:
        //   1. Se o token QUE FALHOU é o de support (e existe um token de admin
        //      válido em paralelo), não faz logout completo — só sai do modo
        //      suporte. Admin volta pra própria conta sem precisar re-logar.
        //   2. Se só tem token de admin (sessão normal), comportamento original
        //      de logout completo.
        if (error.response?.status === 401) {
            const url = error.config?.url || '';
            const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/me');
            if (!isAuthRoute) {
                const supportToken = localStorage.getItem('ftth_support_token');
                const authToken = localStorage.getItem('ftth_token');
                const wasUsingSupport = !!supportToken && error.config?.headers?.Authorization?.includes(supportToken);

                if (wasUsingSupport && authToken) {
                    // Só o support expirou, admin token segue válido
                    localStorage.removeItem('ftth_support_token');
                    window.dispatchEvent(new CustomEvent('ftth-support-expired'));
                } else {
                    // Sessão admin expirou de fato
                    localStorage.removeItem('ftth_token');
                    localStorage.removeItem('ftth_support_token');
                    window.dispatchEvent(new CustomEvent('ftth-session-expired'));
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;
