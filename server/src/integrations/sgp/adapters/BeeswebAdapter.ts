import { ISgpAdapter } from './SgpAdapter.interface';
import { NormalizedSgpEvent } from '../sgp.types';
import logger from '../../../lib/logger';

interface CachedToken {
    token: string;
    expiresAt: number;
}

const TOKEN_TTL_MS = 60 * 60 * 1000;

export class BeeswebAdapter implements ISgpAdapter {
    private static tokenCache = new Map<string, CachedToken>();

    private static cacheKey(baseUrl: string, email: string): string {
        return `${baseUrl}::${email}`;
    }

    normalizeWebhookPayload(payload: any): NormalizedSgpEvent {
        return {
            event: 'unknown',
            externalCustomerId: payload?.id?.toString() || payload?.cpf_cnpj?.toString() || '',
            name: payload?.name,
            document: payload?.cpf_cnpj,
            rawPayload: payload
        };
    }

    formatOutgoingPayload(internalEvent: Omit<NormalizedSgpEvent, 'rawPayload'>): any {
        return { ...internalEvent };
    }

    validateIncomingRequest(): boolean {
        return false;
    }

    private static async login(baseUrl: string, email: string, password: string): Promise<string> {
        const url = `${baseUrl.replace(/\/$/, '')}/adm/sessions`;

        let response: Response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ email, password })
            });
        } catch (err: any) {
            throw new Error(`BeesWeb login network error at ${url}: ${err?.message || String(err)}`);
        }

        const rawText = await response.text().catch(() => '');

        if (!response.ok) {
            logger.warn(`[BeesWeb] Login HTTP ${response.status} for ${email} at ${url}: ${rawText.substring(0, 500)}`);
            throw new Error(`BeesWeb login failed (HTTP ${response.status}): ${rawText.substring(0, 200) || 'empty response body'}`);
        }

        let data: any;
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch {
            throw new Error(`BeesWeb login returned non-JSON: ${rawText.substring(0, 200)}`);
        }

        const token =
            data?.api_token ||
            data?.token ||
            data?.access_token ||
            data?.data?.api_token ||
            data?.data?.token ||
            data?.data?.access_token ||
            data?.user?.api_token;

        if (!token) {
            const keys = data && typeof data === 'object' ? Object.keys(data).join(',') : 'non-object';
            logger.warn(`[BeesWeb] Login response missing token. Top-level keys: [${keys}]. Body: ${rawText.substring(0, 500)}`);
            throw new Error(`BeesWeb login response missing api_token (top-level keys: ${keys})`);
        }

        return String(token);
    }

    public static async getBearer(baseUrl: string, email: string, password: string, force = false): Promise<string> {
        const key = this.cacheKey(baseUrl, email);
        const cached = this.tokenCache.get(key);
        if (!force && cached && cached.expiresAt > Date.now()) {
            return cached.token;
        }
        const token = await this.login(baseUrl, email, password);
        this.tokenCache.set(key, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
        return token;
    }

    private static invalidate(baseUrl: string, email: string) {
        this.tokenCache.delete(this.cacheKey(baseUrl, email));
    }

    public static async authedFetch(
        baseUrl: string,
        email: string,
        password: string,
        path: string,
        init: RequestInit = {}
    ): Promise<Response> {
        const url = `${baseUrl.replace(/\/$/, '')}${path}`;

        const doRequest = async (token: string) => {
            const headers = new Headers(init.headers as any || {});
            headers.set('Authorization', `Bearer ${token}`);
            headers.set('Accept', 'application/json');
            return fetch(url, { ...init, headers });
        };

        let token = await this.getBearer(baseUrl, email, password);
        let res = await doRequest(token);
        if (res.status === 401) {
            this.invalidate(baseUrl, email);
            token = await this.getBearer(baseUrl, email, password, true);
            res = await doRequest(token);
        }
        return res;
    }

    public static async fetchCustomersPage(
        baseUrl: string,
        email: string,
        password: string,
        page: number
    ): Promise<any> {
        const res = await this.authedFetch(baseUrl, email, password, `/adm/customers?page=${page}`);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`BeesWeb /customers failed (${res.status}): ${text.substring(0, 200)}`);
        }
        return res.json();
    }

    async searchCustomer(
        baseUrl: string,
        password: string,
        email: string | null,
        query: string
    ): Promise<any> {
        if (!email) {
            throw new Error('BeesWeb integration requires email (apiApp field is empty)');
        }
        if (!password) {
            throw new Error('BeesWeb integration requires password (apiToken field is empty)');
        }

        const rawQuery = String(query || '').trim();
        const cleanDigits = rawQuery.replace(/\D/g, '');
        const searchTerm = cleanDigits.length >= 11 ? cleanDigits : rawQuery;
        if (!searchTerm) return null;

        const path = `/adm/customers?search=${encodeURIComponent(searchTerm)}`;
        const res = await BeeswebAdapter.authedFetch(baseUrl, email, password, path);

        const rawText = await res.text().catch(() => '');

        if (!res.ok) {
            logger.warn(`[BeesWeb] Search HTTP ${res.status} for "${searchTerm}": ${rawText.substring(0, 500)}`);
            throw new Error(`BeesWeb search failed (HTTP ${res.status}): ${rawText.substring(0, 200) || 'empty response body'}`);
        }

        let data: any;
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch {
            throw new Error(`BeesWeb search returned non-JSON: ${rawText.substring(0, 200)}`);
        }

        const list: any[] = data?.data || [];
        if (list.length === 0) return null;

        let match: any = null;
        if (cleanDigits.length >= 11) {
            match = list.find((c: any) => String(c?.cpf_cnpj || '').replace(/\D/g, '') === cleanDigits) || null;
        }
        if (!match) match = list[0] || null;

        return match ? BeeswebAdapter.normalizeCustomer(match) : null;
    }

    /**
     * Translates a raw BeesWeb customer record into the SGP/IXC-like shape the
     * frontend's CustomerModal expects (nome, contratos[].servicos[], endereco, status string).
     * BeesWeb has no contracts or ONU data, so we synthesize a single empty service.
     */
    private static normalizeCustomer(bees: any): any {
        const statusStr = BeeswebAdapter.statusToString(bees);

        const phone = bees?.phone?.number_only || bees?.phone?.number || '';
        const addr = bees?.address || {};

        const endereco = {
            logradouro: addr.street || '',
            numero: addr.number || '',
            bairro: addr.neighborhood || '',
            cidade: addr.city || '',
            uf: addr.state || '',
            cep: addr.zip_code || '',
            complemento: addr.complement || ''
        };

        const contatos = {
            emails: bees?.email ? [bees.email] : [],
            celulares: phone ? [phone] : [],
            telefones: phone ? [phone] : []
        };

        return {
            // SGP-like top-level fields used by CustomerModal.applySgpService
            nome: bees?.name || '',
            cpfcnpj: bees?.cpf_cnpj || '',
            email: bees?.email || '',
            telefone: phone,
            celular: phone,
            contatos,
            endereco,
            status: statusStr,
            // Synthetic single contract + service so the modal's contratos[0].servicos[0] path works
            contratos: [{
                status: statusStr,
                servicos: [{
                    status: statusStr,
                    endereco,
                    onu: {}
                }]
            }],
            // Keep raw BeesWeb data for debugging / future use
            _provider: 'BEESWEB',
            _raw: bees
        };
    }

    private static statusToString(bees: any): 'ativo' | 'suspenso' | 'cancelado' {
        if (bees?.deleted_at) return 'cancelado';
        if (bees?.disabled_at) return 'suspenso';
        const s = bees?.status;
        if (s === 1 || s === '1' || s === true) return 'ativo';
        if (s === 0 || s === '0' || s === false) return 'suspenso';
        return 'ativo';
    }
}
