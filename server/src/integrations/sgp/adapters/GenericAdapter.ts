import { ISgpAdapter } from './SgpAdapter.interface';
import { NormalizedSgpEvent, SgpEventType } from '../sgp.types';

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
}
