import { NormalizedSgpEvent } from '../sgp.types';

export interface ISgpAdapter {
    /**
     * Parses the incoming raw webhook request into a normalized SGP event.
     * @param payload The raw JSON payload received from the SGP webhook
     */
    normalizeWebhookPayload(payload: any): NormalizedSgpEvent;

    /**
     * Formats an outgoing event to be sent to the SGP API.
     * @param internalEvent The normalized data to send out
     */
    formatOutgoingPayload(internalEvent: Omit<NormalizedSgpEvent, 'rawPayload'>): any;

    /**
     * Validates the webhook signature if applicable.
     */
    validateIncomingRequest?(headers: any, body: any, secret?: string): boolean;

    /**
     * Searches for a customer in the external system by CPF/CNPJ.
     */
    searchCustomer(baseUrl: string, token: string, apiApp: string | null, query: string): Promise<any>;
}
