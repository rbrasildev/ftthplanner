import { ISgpAdapter } from './SgpAdapter.interface';
import { NormalizedSgpEvent, SgpEventType } from '../sgp.types';
import logger from '../../../lib/logger';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';

export class IxcAdapter implements ISgpAdapter {

    normalizeWebhookPayload(payload: any): NormalizedSgpEvent {
        let eventType: SgpEventType = 'unknown';

        if (payload.event === 'client_port_changed') {
            eventType = 'client_port_changed';
        } else if (payload.event === 'client_created') {
            eventType = 'client_created';
        } else if (payload.event === 'client_deleted') {
            eventType = 'client_deleted';
        } else if (payload.event === 'client_updated') {
            eventType = 'client_updated';
        } else if (payload.event === 'client_status_changed') {
            eventType = 'client_status_changed';
        }

        return {
            event: eventType,
            externalCustomerId: payload.cliente_id?.toString() || payload.id?.toString() || '',
            oldPort: payload.porta_antiga ? parseInt(payload.porta_antiga, 10) : undefined,
            newPort: payload.porta_nova ? parseInt(payload.porta_nova, 10) : undefined,
            cto: payload.cto,
            fiberId: payload.fiber_id || undefined,
            status: payload.status,
            name: payload.nome,
            document: payload.cpf_cnpj,
            address: payload.endereco,
            lat: payload.latitude ? parseFloat(payload.latitude) : undefined,
            lng: payload.longitude ? parseFloat(payload.longitude) : undefined,
            rawPayload: payload
        };
    }

    formatOutgoingPayload(internalEvent: Omit<NormalizedSgpEvent, 'rawPayload'>): any {
        return {
            event: internalEvent.event,
            cliente_id: internalEvent.externalCustomerId,
            porta_antiga: internalEvent.oldPort,
            porta_nova: internalEvent.newPort,
            cto: internalEvent.cto,
            status: internalEvent.status
        };
    }

    validateIncomingRequest(headers: any, body: any, secret?: string): boolean {
        if (!secret) return true;

        const token = headers['authorization'] || headers['ixctoken'];
        if (!token) return false;

        return token === secret || token === `Basic ${secret}` || token === `Bearer ${secret}`;
    }

    /**
     * Build the IXC Authorization + ixcsoft headers.
     * IXC expects: Authorization: Basic base64("userId:token")
     * The token from IXC panel comes as "userId:apiToken" where userId is the IXC user ID.
     * Users may paste the full "61:token" or just the token part.
     */
    public buildAuthHeaders(token: string): Record<string, string> {
        // IXC token format: "userId:apiToken" — base64 encode for Basic Auth
        // If token contains ":", it's already in userId:token format
        // If not, assume it's just the token and we can't guess the userId
        const base64Token = Buffer.from(token).toString('base64');

        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${base64Token}`,
            'ixcsoft': 'listar',
        };
    }

    /**
     * Normalize IXC base URL — strip trailing slashes and any /webservice/v1/... suffix
     * so users can paste either "https://ixc.provedor.com.br" or the full endpoint URL.
     */
    public normalizeBaseUrl(url: string): string {
        return url
            .replace(/\/$/, '')
            .replace(/\/webservice\/v1(\/.*)?$/i, '')
            .replace(/\/api\/v1(\/.*)?$/i, '');
    }

    /**
     * Format digits-only string into CPF (XXX.XXX.XXX-XX) or CNPJ (XX.XXX.XXX/XXXX-XX)
     */
    private formatCpfCnpj(digits: string): string | null {
        if (digits.length === 11) {
            return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
        }
        if (digits.length === 14) {
            return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
        }
        return null;
    }

    async testConnection(baseUrl: string, token: string): Promise<void> {
        const url = `${this.normalizeBaseUrl(baseUrl)}/webservice/v1/cliente`;
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: this.buildAuthHeaders(token),
            body: JSON.stringify({
                qtype: 'cliente.id',
                query: '0',
                oper: '>',
                page: '1',
                rp: '1',
                sortname: 'cliente.id',
                sortorder: 'asc',
            })
        });
        if (response.status === 401 || response.status === 403) {
            throw new Error(`Autenticação falhou (${response.status}). Verifique o token.`);
        }
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`IXC API error (${response.status}): ${text.substring(0, 200)}`);
        }
    }

    async searchCustomer(baseUrl: string, token: string, apiApp: string | null, query: string): Promise<any> {
        const normalizedBase = this.normalizeBaseUrl(baseUrl);
        const headers = this.buildAuthHeaders(token);
        const url = `${normalizedBase}/webservice/v1/cliente`;

        const digits = query.replace(/\D/g, '');
        const formatted = this.formatCpfCnpj(digits);
        const trimmed = query.trim();

        // IXC stores CPF/CNPJ formatted (e.g. "965.236.202-63").
        // Strategy:
        //   - Valid CPF/CNPJ (11/14 digits) → single request on the formatted exact match.
        //     A 200-OK with no records is conclusive ("not in this SGP"); no LIKE fallback needed.
        //   - Anything else (partial digits, free text) → LIKE on digits/text as a best-effort.
        const variants: { query: string; oper: string }[] = [];
        if (formatted) {
            variants.push({ query: formatted, oper: '=' });
        } else if (digits) {
            variants.push({ query: digits, oper: '%' });
        } else if (trimmed) {
            variants.push({ query: trimmed, oper: '%' });
        }

        let lastError = '';

        for (const variant of variants) {
            logger.info(`[IXC Adapter] Searching ${variant.query} (oper: ${variant.oper})`);

            try {
                const response = await fetchWithTimeout(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        qtype: 'cliente.cnpj_cpf',
                        query: variant.query,
                        oper: variant.oper,
                        page: '1',
                        rp: '20',
                        sortname: 'cliente.id',
                        sortorder: 'desc',
                    })
                });

                const responseText = await response.text();

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        throw new Error(`Autenticação falhou (${response.status}). Verifique o token.`);
                    }
                    lastError = `IXC API error (${response.status}): ${responseText.substring(0, 300)}`;
                    logger.warn(`[IXC Adapter] ${lastError}`);
                    continue;
                }

                let data: any;
                try {
                    data = JSON.parse(responseText);
                } catch {
                    logger.warn(`[IXC Adapter] Invalid JSON: ${responseText.substring(0, 200)}`);
                    continue;
                }

                if (data?.type === 'error') {
                    lastError = `IXC: ${data.message || 'Unknown error'}`;
                    logger.warn(`[IXC Adapter] ${lastError}`);
                    continue;
                }

                const ixcClient = (data?.registros || [])[0] || null;
                if (ixcClient) {
                    logger.info(`[IXC Adapter] Found customer ${ixcClient.id} via ${variant.oper}`);
                    return this.normalizeIxcClient(ixcClient, normalizedBase, headers);
                }

                // 200 OK with no records — only fall through to LIKE if we haven't tried it yet.
            } catch (error: any) {
                if (error.message?.includes('Autenticação')) throw error;
                lastError = error.message;
                logger.warn(`[IXC Adapter] Fetch error: ${error.message}`);
                continue;
            }
        }

        if (lastError) {
            logger.error(`[IXC Adapter] All search variants failed. Last error: ${lastError}`);
            throw new Error(lastError);
        }

        logger.info(`[IXC Adapter] Customer not found for query: ${query}`);
        return null;
    }

    /**
     * Normalize IXC client data and optionally fetch contract/service info
     */
    private async normalizeIxcClient(ixcClient: any, baseUrl: string, headers: Record<string, string>): Promise<any> {
        const clientId = ixcClient.id;

        // Try to fetch contracts (cliente_contrato) for richer data
        let contratos: any[] = [];
        try {
            contratos = await this.fetchClientContracts(baseUrl, headers, clientId);
        } catch (err) {
            logger.warn(`[IXC Adapter] Could not fetch contracts for client ${clientId}: ${err}`);
        }

        // If no contracts fetched, build a basic one from client data
        if (contratos.length === 0) {
            contratos = [{
                id: 'ixc-' + clientId,
                status: ixcClient.ativo === 'S' ? 'Ativo' : 'Inativo',
                servicos: [{
                    id: 'ixc-svc-' + clientId,
                    descricao: ixcClient.plano || 'Serviço IXC',
                    status: ixcClient.ativo === 'S' ? 'Ativo' : 'Inativo',
                    onu: {
                        serial: ixcClient.mac || '',
                        conexao: {
                            status: ixcClient.status_internet === 'A' ? 'online' : 'offline'
                        }
                    }
                }]
            }];
        }

        return {
            id: clientId,
            nome: ixcClient.razao || ixcClient.fantasia || '',
            cpfcnpj: ixcClient.cnpj_cpf,
            email: ixcClient.email,
            telefone: ixcClient.telefone_celular || ixcClient.telefone_comercial || '',
            endereco: [ixcClient.endereco, ixcClient.numero, ixcClient.bairro].filter(Boolean).join(', '),
            cidade: ixcClient.cidade,
            cep: ixcClient.cep,
            lat: ixcClient.latitude ? parseFloat(ixcClient.latitude) : null,
            lng: ixcClient.longitude ? parseFloat(ixcClient.longitude) : null,
            status: ixcClient.ativo === 'S' ? 'Ativo' : 'Inativo',
            contratos
        };
    }

    /**
     * Fetch client contracts and their services from IXC
     */
    private async fetchClientContracts(baseUrl: string, headers: Record<string, string>, clientId: string): Promise<any[]> {
        // Try the canonical endpoint first; only fall back on actual errors.
        // Empty results from a 200 response are accepted as-is (don't retry).
        const endpoints = ['/webservice/v1/cliente_contrato', '/api/v1/cliente_contrato'];

        let contractData: any = null;
        for (const endpoint of endpoints) {
            try {
                const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        qtype: 'cliente_contrato.id_cliente',
                        query: String(clientId),
                        oper: '=',
                        page: '1',
                        rp: '10',
                        sortname: 'cliente_contrato.id',
                        sortorder: 'desc'
                    })
                });
                if (!res.ok) continue;
                const text = await res.text();
                try { contractData = JSON.parse(text); } catch { continue; }
                break; // 2xx + valid JSON → trust the response, even if empty
            } catch {
                continue;
            }
        }

        if (!contractData?.registros?.length) return [];

        // Fetch services for all contracts in parallel.
        const servicesByContract = await Promise.all(
            contractData.registros.map((contrato: any) =>
                this.fetchContractServices(baseUrl, headers, contrato.id).catch(() => [])
            )
        );

        const contratos: any[] = [];
        for (let i = 0; i < contractData.registros.length; i++) {
            const contrato = contractData.registros[i];
            let servicos = servicesByContract[i];

            if (servicos.length === 0) {
                servicos = [{
                    id: 'ixc-svc-' + contrato.id,
                    descricao: contrato.obs || 'Serviço',
                    status: contrato.status === 'A' ? 'Ativo' : (contrato.status === 'S' ? 'Suspenso' : 'Inativo'),
                    onu: { serial: '', conexao: { status: 'unknown' } }
                }];
            }

            contratos.push({
                id: contrato.id,
                status: contrato.status === 'A' ? 'Ativo' : (contrato.status === 'S' ? 'Suspenso' : 'Inativo'),
                plano: contrato.id_vd_contrato || '',
                servicos
            });
        }

        return contratos;
    }

    /**
     * Fetch radius users (services/connections) for a contract
     */
    private async fetchContractServices(baseUrl: string, headers: Record<string, string>, contractId: string): Promise<any[]> {
        // Same fallback policy as fetchClientContracts: only retry on transport/HTTP failure.
        // A 200 with empty `registros` means "no services" and is final.
        const endpoints = ['/webservice/v1/radusuarios', '/api/v1/radusuarios'];

        for (const endpoint of endpoints) {
            try {
                const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        qtype: 'radusuarios.id_contrato',
                        query: String(contractId),
                        oper: '=',
                        page: '1',
                        rp: '10',
                        sortname: 'radusuarios.id',
                        sortorder: 'desc'
                    })
                });

                if (!res.ok) continue;
                const text = await res.text();

                let data: any;
                try { data = JSON.parse(text); } catch { continue; }
                const registros: any[] = data?.registros || [];
                if (registros.length === 0) return [];

                return registros.map((rad: any) => ({
                    id: rad.id,
                    descricao: rad.info || rad.login || 'PPPoE',
                    login: rad.login,
                    senha: rad.senha,
                    mac: rad.mac,
                    ip: rad.ip || '',
                    status: rad.ativo === 'S' ? 'Ativo' : (rad.ativo === 'N' ? 'Suspenso' : 'Inativo'),
                    // FTTH fiber data
                    id_caixa_ftth: rad.id_caixa_ftth || '',        // CTO/caixa ID
                    ftth_porta: rad.ftth_porta ? parseInt(rad.ftth_porta, 10) : null,  // Porta na CTO
                    id_transmissor: rad.id_transmissor || '',      // OLT ID
                    conexao_raw: rad.conexao || '',                // slot/port/vlan encoded
                    vlan: rad.vlan || '',
                    latitude: rad.latitude ? parseFloat(rad.latitude) : null,
                    longitude: rad.longitude ? parseFloat(rad.longitude) : null,
                    onu: {
                        serial: rad.onu_mac || rad.mac || '',
                        mac: rad.mac || '',
                        conexao: {
                            status: rad.online === 'S' ? 'online' : 'offline'
                        }
                    }
                }));
            } catch {
                continue;
            }
        }
        return [];
    }
}
