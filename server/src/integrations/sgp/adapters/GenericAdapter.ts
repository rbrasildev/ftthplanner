import { ISgpAdapter } from './SgpAdapter.interface';
import { NormalizedSgpEvent, SgpEventType } from '../sgp.types';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';

export class GenericAdapter implements ISgpAdapter {
    normalizeWebhookPayload(payload: any): NormalizedSgpEvent {
        // Generic mapping expects payload to be somewhat aligned with our normalized fields
        // or uses typical common names like id, oldPort, etc.
        const eventType = payload.event as SgpEventType || 'unknown';

        return {
            event: eventType,
            externalCustomerId: payload.externalCustomerId?.toString() || payload.id?.toString() || payload.client_id?.toString() || '',
            oldPort: payload.oldPort ? parseInt(payload.oldPort, 10) : undefined,
            newPort: payload.newPort ? parseInt(payload.newPort, 10) : undefined,
            cto: payload.cto?.toString(),
            fiberId: payload.fiberId?.toString(),
            status: payload.status?.toString(),
            name: payload.name?.toString(),
            document: payload.document?.toString(),
            address: payload.address?.toString(),
            lat: payload.lat ? parseFloat(payload.lat) : undefined,
            lng: payload.lng ? parseFloat(payload.lng) : undefined,
            rawPayload: payload
        };
    }

    formatOutgoingPayload(internalEvent: Omit<NormalizedSgpEvent, 'rawPayload'>): any {
        return {
            ...internalEvent
        };
    }

    validateIncomingRequest(headers: any, body: any, secret?: string): boolean {
        if (!secret) return true;
        const token = headers['authorization'] || headers['x-api-key'] || headers['token'];
        if (!token) return false;
        
        return token === secret || token === `Bearer ${secret}`;
    }

    /**
     * Probe the SGP /api/ura/verificaacesso/ endpoint to determine whether a
     * given contract's internet service is currently online. Used as a fallback
     * by the sync paths when the regular customer payload arrives without any
     * ONU data (no serial, no MAC, no conexao.status) — in that case we can't
     * tell offline from "no info", so this endpoint gives us a definitive answer.
     *
     * The endpoint is documented as form-data; the URL-encoded body is accepted
     * by every SGP we've tested and avoids the multipart boundary overhead.
     *
     * Returns 'online' | 'offline' on a confident match, or null when the SGP
     * doesn't respond cleanly — null leaves the existing connectionStatus
     * untouched downstream.
     */
    async checkServiceAccess(
        baseUrl: string,
        app: string | null,
        token: string,
        contratoId: string | number
    ): Promise<'online' | 'offline' | null> {
        const body = new URLSearchParams();
        if (app) body.append('app', app);
        body.append('token', token);
        body.append('contrato', String(contratoId));

        try {
            const res = await fetchWithTimeout(
                `${baseUrl.replace(/\/$/, '')}/api/ura/verificaacesso/`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: body.toString()
                }
            );
            if (!res.ok) return null;
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { return null; }

            // Primary signal: the numeric `status` field (0=offline, 1=online).
            const s = data?.status;
            if (s === 1 || s === '1') return 'online';
            if (s === 0 || s === '0') return 'offline';

            // Fallback: textual `msg` ("Serviço Online" / "Serviço Offline").
            const msg = String(data?.msg || '').toLowerCase();
            if (msg.includes('online')) return 'online';
            if (msg.includes('offline')) return 'offline';

            return null;
        } catch {
            return null;
        }
    }

    async testConnection(baseUrl: string, token: string, apiApp: string | null): Promise<void> {
        const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/ura/clientes/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app: apiApp,
                token,
                limit: 1,
                offset: 0,
                exibir_conexao: 's',
                omitir_titulos: true
            })
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`SGP API error (${response.status}): ${text.substring(0, 200)}`);
        }
    }

    async searchCustomer(baseUrl: string, token: string, apiApp: string | null, query: string): Promise<any> {
        const bodyData = {
            app: apiApp,
            token: token,
            cpfcnpj: query,
            exibir_conexao: true
        };

        const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/ura/clientes/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyData)
        });

        if (!response.ok) {
            let errorDetail = '';
            try {
                const errorData = await response.json();
                errorDetail = JSON.stringify(errorData);
            } catch (e) {
                errorDetail = await response.text();
            }
            throw new Error(`SGP API error (${response.status}): ${errorDetail.substring(0, 200)}`);
        }

        let data: any;
        try {
            data = await response.json();
        } catch (e) {
            const text = await response.text();
            throw new Error(`SGP API returned invalid JSON: ${text.substring(0, 100)}`);
        }
        const clientes = data?.clientes || [];
        const cliente = clientes[0] || null;
        if (!cliente) return null;

        // Enrich the first service with verificaacesso when ONU data is missing,
        // so the frontend's `applySgpService` (which reads onu.conexao.status)
        // gets a concrete online/offline instead of falling to the offline default.
        // Only one extra HTTP call per search and only when needed.
        const mainContract = cliente.contratos?.[0];
        const mainService = mainContract?.servicos?.[0];
        const hasOnuStatus = !!mainService?.onu?.conexao?.status;
        if (!hasOnuStatus && mainContract?.id) {
            const access = await this.checkServiceAccess(baseUrl, apiApp, token, mainContract.id);
            if (access) {
                mainService.onu = mainService.onu || {};
                mainService.onu.conexao = { ...(mainService.onu.conexao || {}), status: access };
            }
        }

        return cliente;
    }
}
