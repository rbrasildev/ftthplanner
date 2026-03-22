import { ISgpAdapter } from './SgpAdapter.interface';
import { NormalizedSgpEvent, SgpEventType } from '../sgp.types';

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
        if (!secret) return true; // if no secret configured, accept all (not recommended)
        
        // Typical IXC token pass in header ixctoken or authorization
        const token = headers['authorization'] || headers['ixctoken'];
        if (!token) return false;
        
        return token === secret || token === `Basic ${secret}` || token === `Bearer ${secret}`;
    }

    async searchCustomer(baseUrl: string, token: string, apiApp: string | null, query: string): Promise<any> {
        // IXC API typically expects only numbers for CPF/CNPJ queries
        const cleanCpfCnpj = query.replace(/\D/g, '');

        const bodyData = {
            qtype: 'cliente.cnpj_cpf',
            query: cleanCpfCnpj,
            oper: '=',
            page: '1',
            rp: '1',
            sortname: 'cliente.id',
            sortorder: 'desc'
        };

        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/cliente`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ixctoken': token,
                'Authorization': `Basic ${Buffer.from(token).toString('base64')}` // Some IXC installs use Basic
            },
            body: JSON.stringify(bodyData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`IXC API error (${response.status}): ${errorText}`);
        }

        const data: any = await response.json();
        const registros = data?.registros || [];
        const ixcClient = registros[0] || null;

        if (!ixcClient) return null;

        // Normalize IXC client to SGP-like format for the frontend
        // This avoids breaking the frontend which is already used to SGP fields
        return {
            id: ixcClient.id,
            nome: ixcClient.razao,
            cpfcnpj: ixcClient.cnpj_cpf,
            email: ixcClient.email,
            telefone: ixcClient.telefone_celular || ixcClient.telefone_fixo,
            endereco: `${ixcClient.endereco}, ${ixcClient.numero} - ${ixcClient.bairro}`,
            cidade: ixcClient.cidade,
            status: ixcClient.ativo === 'S' ? 'Ativo' : 'Inativo',
            // Mocking contratos structure to keep frontend compatibility
            contratos: [
                {
                    id: 'ixc-' + ixcClient.id,
                    status: ixcClient.ativo === 'S' ? 'Ativo' : 'Inativo',
                    servicos: [
                        {
                            status: ixcClient.ativo === 'S' ? 'Ativo' : 'Inativo',
                            onu: {
                                conexao: {
                                    status: ixcClient.status_internet === 'A' ? 'online' : 'offline'
                                }
                            }
                        }
                    ]
                }
            ]
        };
    }
}
