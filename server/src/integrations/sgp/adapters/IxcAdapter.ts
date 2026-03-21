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
}
