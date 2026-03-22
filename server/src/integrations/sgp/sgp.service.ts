import { prisma } from '../../lib/prisma';
import logger from '../../lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { NormalizedSgpEvent, SgpEventType } from './sgp.types';
import { ISgpAdapter } from './adapters/SgpAdapter.interface';
import { IxcAdapter } from './adapters/IxcAdapter';
import { GenericAdapter } from './adapters/GenericAdapter';

export class SgpService {
    
    public static getAdapter(sgpType: string): ISgpAdapter {
        if (sgpType.toUpperCase() === 'IXC') {
            return new IxcAdapter();
        }
        return new GenericAdapter();
    }

    public static async processWebhook(tenantId: string, sgpType: string, payload: any, headers: any): Promise<void> {
        const settings = await prisma.integrationSettings.findFirst({
            where: { userId: tenantId, sgpType }
        });

        if (!settings || !settings.active) {
            logger.warn(`[SGP Webhook] Tenant ${tenantId} received webhook but integration is disabled or not configured.`);
            return;
        }

        const adapter = this.getAdapter(sgpType);

        // Security Validation
        if (adapter.validateIncomingRequest && !adapter.validateIncomingRequest(headers, payload, settings.webhookSecret || undefined)) {
            logger.error(`[SGP Webhook] Invalid signature or token for tenant ${tenantId}`);
            throw new Error('Unauthorized webhook request');
        }

        // Normalize
        const normalizedEvent = adapter.normalizeWebhookPayload(payload);

        // Log Inbound
        await prisma.integrationLog.create({
            data: {
                userId: tenantId,
                event: normalizedEvent.event,
                direction: 'INBOUND',
                payload: payload,
                status: 'PROCESSING'
            }
        });

        if (!normalizedEvent.externalCustomerId) {
            await this.registerConflict(tenantId, null, 'INVALID_DATA', payload, 'Missing externalCustomerId');
            return;
        }

        try {
            switch (normalizedEvent.event) {
                case 'client_port_changed':
                    await this.handlePortChange(tenantId, normalizedEvent);
                    break;
                case 'client_created':
                case 'client_updated':
                case 'client_deleted':
                case 'client_status_changed':
                    // Just log for now, or implement generic sync
                    logger.info(`[SGP Service] Event ${normalizedEvent.event} received for external ID ${normalizedEvent.externalCustomerId}`);
                    break;
                default:
                    logger.warn(`[SGP Service] Unknown event type: ${normalizedEvent.event}`);
                    break;
            }
        } catch (error: any) {
            logger.error(`[SGP Service] Error processing event ${normalizedEvent.event}: ${error.message}`);
            await this.registerConflict(tenantId, normalizedEvent.externalCustomerId, 'PROCESSING_ERROR', payload, error.message);
        }
    }

    private static async handlePortChange(tenantId: string, event: NormalizedSgpEvent): Promise<void> {
        // 1. Find mapping
        let mapping = await prisma.integrationMapping.findFirst({
            where: { 
                userId: tenantId, 
                externalCustomerId: event.externalCustomerId 
            }
        });

        if (!mapping || !mapping.internalCustomerId) {
            // Unmapped customer
            await this.registerConflict(tenantId, event.externalCustomerId, 'NOT_FOUND', event.rawPayload, 'Customer not mapped internally.');
            return;
        }

        const internalCustomerId = mapping.internalCustomerId;

        // 2. Fetch Customer & CTO
        const customer = await prisma.customer.findUnique({
            where: { id: internalCustomerId },
            include: { cto: true }
        });

        if (!customer) {
            await this.registerConflict(tenantId, event.externalCustomerId, 'NOT_FOUND', event.rawPayload, 'Internal customer deleted or missing.');
            return;
        }

        if (!customer.ctoId) {
            await this.registerConflict(tenantId, event.externalCustomerId, 'INVALID_DATA', event.rawPayload, 'Internal customer has no CTO assigned.');
            return;
        }

        const cto = customer.cto;
        
        if (!event.newPort && event.newPort !== 0) {
            await this.registerConflict(tenantId, event.externalCustomerId, 'INVALID_DATA', event.rawPayload, 'Event is missing newPort specification.');
            return;
        }

        // 3. Verify target port on CTO (using splitters logic from typical CTOs)
        let splitters: any[] = [];
        try {
            splitters = typeof cto?.splitters === 'string' ? JSON.parse(cto.splitters as string) : (cto?.splitters || []);
        } catch (e) {
            splitters = (cto?.splitters as any) || [];
        }

        // Find primary splitter or the requested one if it uses abstract indexing
        // Assuming flat indexing for simplify, or finding the open port.
        let targetSplitter = null;
        let foundPort = false;

        // Simplified logic: finds if newPort minus 1 (index) is available
        // Need to be careful. In FTTH Planner, how are ports managed securely?
        // Usually, we check if there's any other customer with the same ctoId and splitterPortIndex.
        const portIndex = event.newPort - 1; // 1-based to 0-based
        
        const existingCustomerInPort = await prisma.customer.findFirst({
            where: {
                ctoId: cto!.id,
                splitterPortIndex: portIndex,
                id: { not: customer.id }
            }
        });

        if (existingCustomerInPort) {
            await this.registerConflict(tenantId, event.externalCustomerId, 'PORT_CONFLICT', event.rawPayload, `Porta ${event.newPort} está ocupada pelo cliente interno ID: ${existingCustomerInPort.id}`);
            return;
        }

        // Check if it's a simple mismatch or already aligned
        if (customer.splitterPortIndex === portIndex) {
            // Already aligned, just update lastSync
            await prisma.integrationMapping.update({
                where: { id: mapping.id },
                data: { lastSyncAt: new Date() }
            });
            return;
        }

        // NEW LOGIC: Instead of auto-updating, we register a conflict for review
        // unless it's an initial mapping (not handled here as handlePortChange implies existing mapping)
        await this.registerConflict(
            tenantId, 
            event.externalCustomerId, 
            'PORT_MISMATCH', 
            {
                ...event.rawPayload,
                plannerPort: (customer.splitterPortIndex ?? -1) + 1,
                sgpPort: event.newPort,
                ctoName: cto?.name
            }, 
            `Desvio de porta detectado para ${customer.name}: Planner=${(customer.splitterPortIndex ?? -1) + 1}, SGP=${event.newPort}`
        );

        // Update Mapping
        await prisma.integrationMapping.update({
            where: { id: mapping.id },
            data: {
                lastSyncAt: new Date(),
                splitterPort: portIndex
            }
        });

        logger.info(`[SGP Service] Customer ${customer.id} (${event.externalCustomerId}) moved to port ${event.newPort} on CTO ${cto?.name}`);
    }

    private static async registerConflict(tenantId: string, externalCustomerId: string | null, type: string, payload: any, message: string) {
        logger.warn(`[SGP Conflict] ${type} for tenant ${tenantId}: ${message}`);
        
        const existing = await prisma.integrationConflict.findFirst({
            where: {
                userId: tenantId,
                customerId: externalCustomerId,
                type: type,
                status: 'PENDING'
            }
        });

        if (existing) {
            // Already a pending conflict of this type for this customer
            return;
        }

        await prisma.integrationConflict.create({
            data: {
                userId: tenantId,
                customerId: externalCustomerId, // keeping external in this generic field
                type: type,
                payload: payload,
                status: 'PENDING'
            }
        });
    }

    // Example of outbound sync
    public static async pushExternalEvent(tenantId: string, sgpType: string, internalEvent: Omit<NormalizedSgpEvent, 'rawPayload'>) {
        const settings = await prisma.integrationSettings.findFirst({
            where: { userId: tenantId, sgpType }
        });

        if (!settings || !settings.active || !settings.apiUrl) {
            return;
        }

        const adapter = this.getAdapter(sgpType);
        const payload = adapter.formatOutgoingPayload(internalEvent);

        try {
           // send request
           // await axios.post(settings.apiUrl, payload, { headers: { Authorization: `Bearer ${settings.apiToken}` } });
           
           await prisma.integrationLog.create({
               data: {
                   userId: tenantId,
                   event: internalEvent.event,
                   direction: 'OUTBOUND',
                   payload: payload as any,
                   status: 'SUCCESS'
               }
           });
        } catch (error: any) {
            logger.error(`[SGP Push] Error sending to external SGP: ${error.message}`);
            // Log error
            await prisma.integrationLog.create({
                data: {
                    userId: tenantId,
                    event: internalEvent.event,
                    direction: 'OUTBOUND',
                    payload: payload as any,
                    status: 'ERROR',
                    errorMessage: error.message
                }
           });
        }
    }
    
    public static async searchCustomer(userId: string, sgpType: string, cpfCnpj: string) {
        // Find the user to get their companyId
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true }
        });

        if (!user || !user.companyId) {
            throw new Error('User company not found');
        }

        // Find any settings for this company
        // We prioritize active settings, but allow inactive ones for search if credentials exist
        const settings = await prisma.integrationSettings.findFirst({
            where: {
                user: { companyId: user.companyId },
                apiUrl: { not: null },
                apiToken: { not: null },
                ...(sgpType && sgpType !== 'auto' ? { sgpType } : {})
            },
            orderBy: [
                { active: 'desc' }, // Active ones first
                { updatedAt: 'desc' } // Most recent ones second
            ],
            include: { user: true }
        });

        if (!settings) {
            logger.warn(`[SGP Service] No active integration settings found for company ${user.companyId}`);
            throw new Error('SGP integration not configured or inactive');
        }

        logger.info(`[SGP Service] Searching customer using ${settings.sgpType} provider for company ${user.companyId}`);

        const baseUrl = settings.apiUrl?.replace(/\/$/, '');
        if (!baseUrl || !settings.apiToken) {
            throw new Error('Integration settings are incomplete (URL or Token missing)');
        }

        const adapter = this.getAdapter(settings.sgpType);
        const result = await adapter.searchCustomer(baseUrl, settings.apiToken, settings.apiApp, cpfCnpj);
        
        if (result) {
            logger.info(`[SGP Service] Search result for ${cpfCnpj}: ${JSON.stringify(result)}`);
        }
        
        return result;
    }

    static async syncAllStatuses(userId: string, sgpType: string) {
        // Find the active integration for this user
        const settings = await prisma.integrationSettings.findFirst({
            where: { userId, sgpType }
        });

        if (!settings || !settings.apiUrl || !settings.apiToken) {
            throw new Error('SGP integration not configured or inactive');
        }

        const baseUrl = settings.apiUrl.replace(/\/$/, '');
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        logger.info(`[SGP Service] Bulk status sync started for company ${user.companyId}`);

        // Fetch all customers that have a document (CPF/CNPJ) for this company
        const customers = await prisma.customer.findMany({
            where: { 
                companyId: user.companyId,
                document: { not: null },
                deletedAt: null
            }
        });

        if (customers.length === 0) return { updated: 0, total: 0 };

        // Create an O(1) in-memory lookup map
        const customerMap = new Map();
        for (const customer of customers) {
            customerMap.set(customer.document, customer);
        }

        let updatedCount = 0;

        logger.info(`[SGP Service] Checking ${customers.length} local customers against SGP...`);

        for (const customer of customers) {
            if (!customer.document) continue;

            try {
                // Query SGP individually for each local customer by CPF/CNPJ
                const bodyData = {
                    app: settings.apiApp,
                    token: settings.apiToken,
                    cpfcnpj: customer.document,
                    exibir_conexao: "s",
                    omitir_titulos: true
                };

                const response = await fetch(`${baseUrl}/api/ura/clientes/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyData)
                });

                if (!response.ok) {
                    logger.warn(`[SGP Service] Failed to fetch SGP for ${customer.document}: ${response.statusText}`);
                    continue;
                }

                const data: any = await response.json();
                const sgpClientes = data?.clientes || [];
                const sgpCustomer = sgpClientes[0] || null;

                if (!sgpCustomer) {
                    logger.info(`[SGP Service] Customer ${customer.document} not found in SGP.`);
                    continue;
                }

                const mainContract = sgpCustomer.contratos?.[0] || {};
                const mainService = mainContract.servicos?.[0] || {};
                const onuData = mainService.onu || {};

                // 1. Connection & Account Status Sync
                const newStatus = onuData.conexao?.status
                    ? String(onuData.conexao.status).toLowerCase().trim()
                    : (onuData.serial || mainService.mac ? 'offline' : null);

                const servicoStatus = mainService.status || mainContract.status || sgpCustomer.status;
                const newAccountStatus = servicoStatus?.toLowerCase() === 'ativo' ? 'ACTIVE' :
                                         (servicoStatus?.toLowerCase() === 'suspenso' ? 'SUSPENDED' :
                                         (servicoStatus?.toLowerCase() === 'cancelado' ? 'INACTIVE' : null));

                const updateData: any = {};
                if (newStatus && newStatus !== (customer as any).connectionStatus) {
                    updateData.connectionStatus = newStatus;
                }
                if (newAccountStatus && newAccountStatus !== (customer as any).status) {
                    updateData.status = newAccountStatus;
                }

                if (Object.keys(updateData).length > 0) {
                    try {
                        await prisma.customer.update({
                            where: { id: customer.id },
                            data: updateData
                        });
                        updatedCount++;
                    } catch (e) {
                        logger.error(`[SGP Service] Database update failed for ${customer.document}`);
                    }
                }

                // 2. Port Mismatch Detection
                const portaStr = onuData.splitter?.porta;
                const porta = portaStr ? parseInt(String(portaStr), 10) : null;

                if (porta !== null && !isNaN(porta)) {
                    const portIndex = porta - 1;
                    if (customer.splitterPortIndex !== portIndex) {
                        await this.registerConflict(
                            userId,
                            customer.document,
                            'PORT_MISMATCH',
                            {
                                plannerPort: (customer.splitterPortIndex ?? -1) + 1,
                                sgpPort: porta,
                                customerName: customer.name
                            },
                            `Sincronização manual: Porta divergente para ${customer.name}. Planner=${(customer.splitterPortIndex ?? -1) + 1}, SGP=${porta}`
                        );
                    }
                }

            } catch (err) {
                logger.error(`[SGP Service] Error checking customer ${customer.document}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        logger.info(`[SGP Service] Bulk status sync completed. Updated ${updatedCount}/${customers.length} customers.`);
        return { updated: updatedCount, total: customers.length };
    }

    public static async runDailySync() {
        logger.info('[SGP Service] Starting daily background synchronization...');
        try {
            const activeSettings = await prisma.integrationSettings.findMany({
                where: { active: true },
                include: { user: true }
            });

            for (const setting of activeSettings) {
                logger.info(`[SGP Service] Synchronizing tenant ${setting.userId} using ${setting.sgpType}`);
                
                // Currently only supporting API polling for GENERIC/SGP instances defined with URL and Token
                if (!setting.apiUrl || !setting.apiToken) {
                    logger.warn(`[SGP Service] Tenant ${setting.userId} mapping lacks apiUrl or apiToken. Skipping polling.`);
                    continue;
                }

                try {
                    // Pre-load mappings and customers to memory to prevent N+1 Queries
                    const userCompanyId = setting.user?.companyId;
                    const mappings = await prisma.integrationMapping.findMany({
                        where: { userId: setting.userId }
                    });
                    
                    const customers = userCompanyId ? await prisma.customer.findMany({
                        where: { companyId: userCompanyId }
                    }) : [];

                    const mappingMap = new Map();
                    for (const m of mappings) mappingMap.set(m.externalCustomerId, m);

                    const customerMap = new Map();
                    for (const c of customers) customerMap.set(c.id, c);

                    // Normalize trailing slashes
                    const baseUrl = setting.apiUrl.replace(/\/$/, '');
                    
                    let offset = 0;
                    const limit = 100; // Chunk size
                    let fetching = true;
                    const processedDailyIds = new Set<string>(); // Reset for each tenant
                    let dailyLoopCount = 0; // Reset for each tenant
                    
                    while (fetching) {
                        dailyLoopCount++;
                        if (dailyLoopCount > 400) { // Hard stop at 40,000 customers max to prevent freeze
                            logger.warn(`[SGP Daily Sync] Hard stop for tenant ${setting.userId} at offset ${offset} to prevent freeze.`);
                            break;
                        }

                        logger.info(`[SGP Service] Fetching clients for tenant ${setting.userId} (offset: ${offset})`);
                        
                        // Fetch customers list from SGP API (paginated) via POST JSON
                        const bodyData = {
                            app: setting.apiApp,
                            token: setting.apiToken,
                            limit: limit,
                            offset: offset,
                            exibir_conexao: "s",
                            omitir_titulos: true
                        };

                        const response = await fetch(`${baseUrl}/api/ura/clientes/`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(bodyData)
                        });

                        if (!response.ok) {
                            logger.error(`[SGP Service] Failed to fetch SGP API for tenant ${setting.userId}: ${response.statusText}`);
                            break; // Stop fetching for this tenant if API throws 4xx/5xx
                        }

                        const data: any = await response.json();
                        const clientes = data?.clientes || [];

                        if (clientes.length === 0) {
                            fetching = false; // No more clients to process
                            break;
                        }

                        // If SGP ignores pagination and returns everything, or we reached the last page:
                        if (clientes.length < limit || clientes.length > limit) {
                            fetching = false;
                        }

                        let duplicateCount = 0;

                        for (const cliente of clientes) {
                            const cpfCnpj = cliente.cpfcnpj;
                            if (!cpfCnpj) continue;

                            if (processedDailyIds.has(cpfCnpj)) {
                                duplicateCount++;
                                continue;
                            }
                            processedDailyIds.add(cpfCnpj);

                            const externalId = String(cpfCnpj);
                            const mapping = mappingMap.get(externalId);

                            const contratos = cliente.contratos || [];
                            for (const contrato of contratos) {
                                const servicos = contrato.servicos || [];
                                for (const servico of servicos) {
                                    // Connection Status Sync Update
                                    if (mapping && mapping.internalCustomerId) {
                                        const customer = customerMap.get(mapping.internalCustomerId);
                                        if (customer) {
                                            const newStatus = servico.onu?.conexao?.status 
                                                ? String(servico.onu.conexao.status).toLowerCase().trim() 
                                                : (servico.onu?.serial || servico.mac ? 'offline' : null);

                                            const servicoStatus = servico.status || cliente.status;
                                            const newAccountStatus = servicoStatus?.toLowerCase() === 'ativo' ? 'ACTIVE' : 
                                                                    (servicoStatus?.toLowerCase() === 'suspenso' ? 'SUSPENDED' : 
                                                                    (servicoStatus?.toLowerCase() === 'cancelado' ? 'INACTIVE' : null));

                                            const updateData: any = {};
                                            if (newStatus && newStatus !== (customer as any).connectionStatus) {
                                                updateData.connectionStatus = newStatus;
                                                (customer as any).connectionStatus = newStatus;
                                            }
                                            if (newAccountStatus && newAccountStatus !== (customer as any).status) {
                                                updateData.status = newAccountStatus;
                                                (customer as any).status = newAccountStatus;
                                            }

                                            if (Object.keys(updateData).length > 0) {
                                                try {
                                                    await prisma.customer.update({
                                                        where: { id: customer.id },
                                                        data: updateData
                                                    });
                                                } catch (e) {
                                                    // Ignore single update failures
                                                }
                                            }
                                        }
                                    }

                                    // Emulating external ID as the Document (CPF/CNPJ) for consistency
                                    const portaStr = servico?.onu?.splitter?.porta;
                                    const porta = portaStr ? parseInt(String(portaStr), 10) : null;
                                    
                                    if (porta !== null && !isNaN(porta)) {
                                        // 2. If mapped, and the port changed over there
                                        if (mapping && mapping.splitterPort !== (porta - 1)) {
                                            logger.info(`[SGP Service] Port mismatch detected for ${externalId}. Planner=${mapping.splitterPort !== null ? mapping.splitterPort + 1 : 'none'}, SGP=${porta}. Syncing...`);
                                            
                                            // Fake an event payload internally
                                            const syntheticEvent: NormalizedSgpEvent = {
                                                event: 'client_port_changed',
                                                externalCustomerId: externalId,
                                                oldPort: mapping.splitterPort !== null ? (mapping.splitterPort + 1) : undefined,
                                                newPort: porta,
                                                rawPayload: servico // Save the context of the discrepancy
                                            };

                                            // Propagate the change handler (which updates DB or triggers a conflict)
                                            await this.handlePortChange(setting.userId, syntheticEvent);
                                            
                                            // Prevent multiple port mismatch triggers for the same mapping in the same loop
                                            mapping.splitterPort = (porta - 1);
                                        }
                                    }
                                }
                            }
                        }

                        // Increment offset by limit to move to the next page
                        offset += limit;
                        
                        // Prevent overloading the SGP API by giving a tiny wait between pages
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    logger.info(`[SGP Service] Finished fetching all pages for tenant ${setting.userId}`);
                    
                } catch(apiError: any) {
                    logger.error(`[SGP Service] API Fetch execution error for tenant ${setting.userId}: ${apiError.message}`);
                }
            }
        } catch (error: any) {
            logger.error(`[SGP Service] Critical error in daily sync: ${error.message}`);
        }
    }
}
