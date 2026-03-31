import { ISgpAdapter } from './SgpAdapter.interface';
import { NormalizedSgpEvent, SgpEventType } from '../sgp.types';
import logger from '../../../lib/logger';

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
     * Build the IXC Authorization header.
     * IXC expects: Authorization: Basic base64("login:token")
     * Users typically paste just the token from IXC panel.
     * We try both "token" as-is (already base64) and "1:token" (login 1 = admin).
     */
    private buildAuthHeaders(token: string): Record<string, string> {
        // If the token already looks like base64 (no colons, no spaces), use it directly
        // IXC docs: the token from the admin panel is already the base64-encoded "login:token"
        // But some users paste the raw token, so we handle both cases
        const isAlreadyBase64 = /^[A-Za-z0-9+/=]+$/.test(token) && !token.includes(':');

        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${isAlreadyBase64 ? token : Buffer.from(token).toString('base64')}`,
        };
    }

    async searchCustomer(baseUrl: string, token: string, apiApp: string | null, query: string): Promise<any> {
        const cleanCpfCnpj = query.replace(/\D/g, '');
        const normalizedBase = baseUrl.replace(/\/$/, '');

        // IXC stores CPF formatted (e.g. "123.456.789-00") so we use LIKE (%) operator
        // Try multiple endpoint patterns since IXC versions differ
        const endpoints = [
            '/webservice/v1/cliente',
            '/api/v1/cliente',
        ];

        const bodyData = {
            qtype: 'cliente.cnpj_cpf',
            query: cleanCpfCnpj,
            oper: '%',           // LIKE — matches even if IXC stores formatted CPF
            page: '1',
            rp: '5',             // Return up to 5 results for better matching
            sortname: 'cliente.id',
            sortorder: 'desc',
            grid_param: JSON.stringify([
                { TB: 'cliente.cnpj_cpf', O: '%', P: cleanCpfCnpj }
            ])
        };

        const headers = this.buildAuthHeaders(token);
        let lastError = '';

        for (const endpoint of endpoints) {
            const url = `${normalizedBase}${endpoint}`;
            logger.info(`[IXC Adapter] Trying ${url} for CPF: ${cleanCpfCnpj}`);

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(bodyData)
                });

                if (!response.ok) {
                    let errorDetail = '';
                    try {
                        const errorData = await response.json();
                        errorDetail = JSON.stringify(errorData);
                    } catch {
                        errorDetail = await response.text();
                    }
                    lastError = `IXC API error (${response.status}): ${errorDetail.substring(0, 300)}`;
                    logger.warn(`[IXC Adapter] ${lastError}`);

                    // If 401/403, don't try the next endpoint — it's an auth problem
                    if (response.status === 401 || response.status === 403) {
                        throw new Error(`Autenticação falhou (${response.status}). Verifique o token.`);
                    }
                    continue; // Try next endpoint
                }

                let data: any;
                try {
                    data = await response.json();
                } catch {
                    const text = await response.text();
                    logger.warn(`[IXC Adapter] Invalid JSON from ${endpoint}: ${text.substring(0, 200)}`);
                    continue;
                }

                logger.info(`[IXC Adapter] Response from ${endpoint}: total=${data?.total}, registros=${Array.isArray(data?.registros) ? data.registros.length : 'N/A'}`);

                const registros = data?.registros || [];

                // IXC returns { total: "0", registros: [] } when no results
                // or sometimes { type: "error", message: "..." }
                if (data?.type === 'error') {
                    lastError = `IXC: ${data.message || 'Unknown error'}`;
                    logger.warn(`[IXC Adapter] ${lastError}`);
                    continue;
                }

                const ixcClient = registros[0] || null;
                if (!ixcClient) {
                    logger.info(`[IXC Adapter] No customer found for CPF ${cleanCpfCnpj}`);
                    return null;
                }

                // Build normalized response
                return this.normalizeIxcClient(ixcClient, normalizedBase, headers);
            } catch (error: any) {
                if (error.message.includes('Autenticação')) throw error;
                lastError = error.message;
                logger.warn(`[IXC Adapter] Fetch error for ${endpoint}: ${error.message}`);
                continue;
            }
        }

        throw new Error(lastError || 'Não foi possível conectar à API IXC');
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
            status: ixcClient.ativo === 'S' ? 'Ativo' : 'Inativo',
            contratos
        };
    }

    /**
     * Fetch client contracts and their services from IXC
     */
    private async fetchClientContracts(baseUrl: string, headers: Record<string, string>, clientId: string): Promise<any[]> {
        // Fetch contracts
        const endpoints = ['/webservice/v1/cliente_contrato', '/api/v1/cliente_contrato'];

        let contractData: any = null;
        for (const endpoint of endpoints) {
            try {
                const res = await fetch(`${baseUrl}${endpoint}`, {
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
                if (res.ok) {
                    contractData = await res.json();
                    if (contractData?.registros?.length > 0) break;
                }
            } catch {
                continue;
            }
        }

        if (!contractData?.registros?.length) return [];

        const contratos: any[] = [];

        for (const contrato of contractData.registros) {
            // Fetch services (radusuarios) for each contract
            let servicos: any[] = [];
            try {
                servicos = await this.fetchContractServices(baseUrl, headers, contrato.id);
            } catch {
                // Use basic service info
            }

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
        const endpoints = ['/webservice/v1/radusuarios', '/api/v1/radusuarios'];

        for (const endpoint of endpoints) {
            try {
                const res = await fetch(`${baseUrl}${endpoint}`, {
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

                const data: any = await res.json();
                if (!data?.registros?.length) continue;

                return data.registros.map((rad: any) => ({
                    id: rad.id,
                    descricao: rad.info || rad.login || 'PPPoE',
                    login: rad.login,
                    senha: rad.senha,
                    mac: rad.mac,
                    status: rad.ativo === 'S' ? 'Ativo' : (rad.ativo === 'N' ? 'Suspenso' : 'Inativo'),
                    onu: {
                        serial: rad.mac || '',
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
