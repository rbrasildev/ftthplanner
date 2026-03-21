export type SgpEventType = 
    | 'client_created'
    | 'client_updated'
    | 'client_deleted'
    | 'client_port_changed'
    | 'client_status_changed'
    | 'unknown';

export interface NormalizedSgpEvent {
    event: SgpEventType;
    externalCustomerId: string;
    oldPort?: number;
    newPort?: number;
    cto?: string;
    fiberId?: string;
    status?: string;
    name?: string;
    document?: string;
    address?: string;
    lat?: number;
    lng?: number;
    rawPayload: any; // Keep the original payload for logging/conflict resolution
}
