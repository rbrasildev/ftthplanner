import { prisma } from '../../lib/prisma';
import logger from '../../lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { NormalizedSgpEvent, SgpEventType } from './sgp.types';
import { ISgpAdapter } from './adapters/SgpAdapter.interface';
import { IxcAdapter } from './adapters/IxcAdapter';
import { GenericAdapter } from './adapters/GenericAdapter';

export class SgpService {

    // In-memory last sync timestamp per setting ID (no migration needed)
    private static lastSyncMap = new Map<string, Date>();

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

        // Normalized
        const normalizedEvent = adapter.normalizeWebhookPayload(payload);

        if (!normalizedEvent.externalCustomerId) {
            await this.registerConflict(tenantId, null, 'INVALID_DATA', payload, 'Missing externalCustomerId', sgpType);
            return;
        }

        try {
            switch (normalizedEvent.event) {
                case 'client_port_changed':
                    await this.handlePortChange(tenantId, normalizedEvent, sgpType);
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
            await this.registerConflict(tenantId, normalizedEvent.externalCustomerId, 'PROCESSING_ERROR', payload, error.message, sgpType);
        }
    }

    private static async handlePortChange(tenantId: string, event: NormalizedSgpEvent, sgpType: string = 'GENERIC'): Promise<void> {
        // 1. Find mapping
        let mapping = await prisma.integrationMapping.findFirst({
            where: { 
                userId: tenantId, 
                externalCustomerId: event.externalCustomerId 
            }
        });

        if (!mapping || !mapping.internalCustomerId) {
            // Unmapped customer
            await this.registerConflict(tenantId, event.externalCustomerId, 'NOT_FOUND', event.rawPayload, 'Customer not mapped internally.', sgpType);
            return;
        }

        const internalCustomerId = mapping.internalCustomerId;

        // 2. Fetch Customer & CTO
        const customer = await prisma.customer.findUnique({
            where: { id: internalCustomerId },
            include: { cto: true }
        });

        if (!customer) {
            await this.registerConflict(tenantId, event.externalCustomerId, 'NOT_FOUND', event.rawPayload, 'Internal customer deleted or missing.', sgpType);
            return;
        }

        if (!customer.ctoId) {
            await this.registerConflict(tenantId, event.externalCustomerId, 'INVALID_DATA', event.rawPayload, 'Internal customer has no CTO assigned.', sgpType);
            return;
        }

        const cto = customer.cto;

        if (!event.newPort && event.newPort !== 0) {
            await this.registerConflict(tenantId, event.externalCustomerId, 'INVALID_DATA', event.rawPayload, 'Event is missing newPort specification.', sgpType);
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
            await this.registerConflict(tenantId, event.externalCustomerId, 'PORT_CONFLICT', event.rawPayload, `Porta ${event.newPort} está ocupada pelo cliente interno ID: ${existingCustomerInPort.id}`, sgpType);
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
                ctoName: cto?.name,
                customerName: customer.name
            },
            `Desvio de porta detectado para ${customer.name}: Planner=${(customer.splitterPortIndex ?? -1) + 1}, SGP=${event.newPort}`,
            sgpType
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

    private static async registerConflict(tenantId: string, externalCustomerId: string | null, type: string, payload: any, message: string, sgpType?: string) {
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
            return;
        }

        await prisma.integrationConflict.create({
            data: {
                userId: tenantId,
                customerId: externalCustomerId,
                type: type,
                payload: { ...(typeof payload === 'object' ? payload : {}), message, sgpType: sgpType || 'GENERIC' },
                status: 'PENDING'
            }
        });
    }

    public static async applyConflict(userId: string, conflictId: string): Promise<{ applied: boolean; message: string }> {
        const conflict = await prisma.integrationConflict.findFirst({
            where: { id: conflictId, userId, status: 'PENDING' }
        });

        if (!conflict) {
            throw new Error('Conflito não encontrado ou já resolvido.');
        }

        const payload = conflict.payload as any;
        const sgpPort = payload?.sgpPort;

        if (conflict.type !== 'PORT_MISMATCH' || typeof sgpPort !== 'number') {
            throw new Error('Este tipo de conflito não suporta aplicação automática.');
        }

        // Find the user's company
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
        if (!user?.companyId) throw new Error('Empresa do usuário não encontrada.');

        // Find the internal customer by CPF/CNPJ (stored in conflict.customerId as external ID)
        const customer = await prisma.customer.findFirst({
            where: { document: conflict.customerId ?? '', companyId: user.companyId }
        });

        if (!customer) {
            throw new Error('Cliente interno não encontrado para aplicar a alteração.');
        }

        const newPortIndex = sgpPort - 1; // 1-based → 0-based

        // Check if that port is already taken by another customer
        if (customer.ctoId) {
            const portConflict = await prisma.customer.findFirst({
                where: { ctoId: customer.ctoId, splitterPortIndex: newPortIndex, id: { not: customer.id } }
            });
            if (portConflict) {
                throw new Error(`Porta ${sgpPort} já está ocupada pelo cliente "${portConflict.name}".`);
            }
        }

        // Apply the port change
        await prisma.customer.update({
            where: { id: customer.id },
            data: { splitterPortIndex: newPortIndex }
        });

        // Mark conflict as resolved
        await prisma.integrationConflict.update({
            where: { id: conflictId },
            data: { status: 'RESOLVED' }
        });

        logger.info(`[SGP Conflict] Applied PORT_MISMATCH for customer ${customer.id}: port → ${sgpPort}`);
        return { applied: true, message: `Porta atualizada para ${sgpPort} com sucesso.` };
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
        } catch (error: any) {
            logger.error(`[SGP Push] Error sending to external SGP: ${error.message}`);
        }
    }
    
    public static async searchCustomer(userId: string, sgpType: string, cpfCnpj: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true }
        });

        if (!user || !user.companyId) {
            throw new Error('User company not found');
        }

        // Find all matching settings for this company
        const allSettings = await prisma.integrationSettings.findMany({
            where: {
                user: { companyId: user.companyId },
                apiUrl: { not: null },
                apiToken: { not: null },
                ...(sgpType && sgpType !== 'auto' ? { sgpType } : {})
            },
            orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
            include: { user: true }
        });

        if (allSettings.length === 0) {
            logger.warn(`[SGP Service] No integration settings found for company ${user.companyId}`);
            throw new Error('Integration not configured (URL and Token required)');
        }

        // If specific sgpType requested, use only that one. If 'auto', try all providers.
        const settingsToTry = sgpType === 'auto' ? allSettings : [allSettings[0]];
        let lastError = '';

        for (const settings of settingsToTry) {
            const baseUrl = settings.apiUrl?.replace(/\/$/, '');
            if (!baseUrl || !settings.apiToken) continue;

            logger.info(`[SGP Service] Searching customer using ${settings.sgpType} provider (Active: ${settings.active}) for company ${user.companyId}`);

            const adapter = this.getAdapter(settings.sgpType);
            try {
                const result = await adapter.searchCustomer(baseUrl, settings.apiToken, settings.apiApp, cpfCnpj);
                if (result) {
                    logger.info(`[SGP Service] Found customer via ${settings.sgpType} for ${cpfCnpj}`);
                    return result;
                }
                logger.info(`[SGP Service] No customer found via ${settings.sgpType} for ${cpfCnpj}`);
            } catch (error: any) {
                lastError = error.message;
                logger.warn(`[SGP Service] Provider ${settings.sgpType} error: ${error.message}`);
                // Continue to next provider in auto mode
                if (sgpType !== 'auto') throw error;
            }
        }

        // If all providers had errors (not just empty results), throw the last one
        if (lastError && sgpType === 'auto') {
            throw new Error(lastError);
        }

        return null;
    }

    // Process a single customer sync against SGP API (supports both IXC and GENERIC providers)
    private static async syncSingleCustomer(
        customer: any,
        baseUrl: string,
        settings: any,
        userId: string
    ): Promise<boolean> {
        if (!customer.document) return false;

        let sgpCustomer: any = null;

        if (settings.sgpType === 'IXC') {
            // Use IXC adapter for search
            const adapter = this.getAdapter('IXC');
            try {
                sgpCustomer = await adapter.searchCustomer(baseUrl, settings.apiToken, settings.apiApp, customer.document);
            } catch (err) {
                logger.warn(`[SGP Service] IXC search failed for ${customer.document}: ${err instanceof Error ? err.message : String(err)}`);
                return false;
            }
            if (!sgpCustomer) return false;
        } else {
            // GENERIC SGP provider
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
                return false;
            }

            const data: any = await response.json();
            sgpCustomer = (data?.clientes || [])[0] || null;
            if (!sgpCustomer) return false;
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

        let updated = false;
        if (Object.keys(updateData).length > 0) {
            try {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: updateData
                });
                updated = true;
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
                    `Sincronização manual: Porta divergente para ${customer.name}. Planner=${(customer.splitterPortIndex ?? -1) + 1}, SGP=${porta}`,
                    settings.sgpType
                );
            }
        }

        return updated;
    }

    // Run async tasks with a concurrency limit
    private static async runWithConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
        const results: T[] = [];
        let index = 0;

        async function worker() {
            while (index < tasks.length) {
                const currentIndex = index++;
                results[currentIndex] = await tasks[currentIndex]();
            }
        }

        const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
        await Promise.all(workers);
        return results;
    }

    static async syncAllStatuses(userId: string, sgpType: string) {
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

        const customers = await prisma.customer.findMany({
            where: {
                companyId: user.companyId,
                document: { not: null },
                deletedAt: null
            }
        });

        if (customers.length === 0) return { updated: 0, total: 0 };

        logger.info(`[SGP Service] Syncing ${customers.length} customers with concurrency=5...`);

        const CONCURRENCY = 5;
        const tasks = customers.map(customer => async () => {
            try {
                return await this.syncSingleCustomer(customer, baseUrl, settings, userId);
            } catch (err) {
                logger.error(`[SGP Service] Error checking customer ${customer.document}: ${err instanceof Error ? err.message : String(err)}`);
                return false;
            }
        });

        const results = await this.runWithConcurrency(tasks, CONCURRENCY);
        const updatedCount = results.filter(Boolean).length;

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

                if (!setting.apiUrl || !setting.apiToken) {
                    logger.warn(`[SGP Service] Tenant ${setting.userId} mapping lacks apiUrl or apiToken. Skipping polling.`);
                    continue;
                }

                try {
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

                    const baseUrl = setting.apiUrl.replace(/\/$/, '');

                    if (setting.sgpType === 'IXC') {
                        await this.runDailySyncIxc(setting, baseUrl, mappingMap, customerMap);
                    } else {
                        await this.runDailySyncGeneric(setting, baseUrl, mappingMap, customerMap);
                    }

                    logger.info(`[SGP Service] Finished sync for tenant ${setting.userId}`);

                } catch(apiError: any) {
                    logger.error(`[SGP Service] API Fetch execution error for tenant ${setting.userId}: ${apiError.message}`);
                }
            }
        } catch (error: any) {
            logger.error(`[SGP Service] Critical error in daily sync: ${error.message}`);
        }
    }

    /**
     * Daily sync for IXC provider — uses /webservice/v1/cliente with page/rp pagination
     */
    private static async runDailySyncIxc(
        setting: any,
        baseUrl: string,
        mappingMap: Map<string, any>,
        customerMap: Map<string, any>
    ) {
        const adapter = this.getAdapter('IXC') as IxcAdapter;
        const token = setting.apiToken;
        // Normalize URL and build IXC auth headers (includes ixcsoft: listar)
        baseUrl = adapter.normalizeBaseUrl(baseUrl);
        const headers = adapter.buildAuthHeaders(token);

        let page = 1;
        const rp = 100;
        const processedIds = new Set<string>();
        let loopCount = 0;

        while (true) {
            loopCount++;
            if (loopCount > 400) {
                logger.warn(`[SGP Daily Sync IXC] Hard stop for tenant ${setting.userId} at page ${page}`);
                break;
            }

            logger.info(`[SGP Service] IXC: Fetching clients page ${page} for tenant ${setting.userId}`);

            const bodyData = {
                qtype: 'cliente.id',
                query: '0',
                oper: '>',
                page: String(page),
                rp: String(rp),
                sortname: 'cliente.id',
                sortorder: 'asc',
            };

            try {
                const response = await fetch(`${baseUrl}/webservice/v1/cliente`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(bodyData)
                });

                if (!response.ok) {
                    logger.error(`[SGP Daily Sync IXC] API error ${response.status} for tenant ${setting.userId}`);
                    break;
                }

                const data: any = await response.json();
                const registros = data?.registros || [];

                if (registros.length === 0) break;

                for (const cliente of registros) {
                    const cpfCnpj = cliente.cnpj_cpf;
                    if (!cpfCnpj) continue;

                    const cleanDoc = cpfCnpj.replace(/\D/g, '');
                    if (processedIds.has(cleanDoc)) continue;
                    processedIds.add(cleanDoc);

                    const externalId = cleanDoc;
                    const mapping = mappingMap.get(externalId);

                    // Status sync
                    if (mapping && mapping.internalCustomerId) {
                        const customer = customerMap.get(mapping.internalCustomerId);
                        if (customer) {
                            const isAtivo = cliente.ativo === 'S';
                            const newAccountStatus = isAtivo ? 'ACTIVE' : 'INACTIVE';

                            const updateData: any = {};
                            if (newAccountStatus !== (customer as any).status) {
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
                }

                if (registros.length < rp) break; // Last page

                page++;
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err: any) {
                logger.error(`[SGP Daily Sync IXC] Fetch error: ${err.message}`);
                break;
            }
        }
    }

    /**
     * Daily sync for GENERIC SGP provider — uses /api/ura/clientes/ with offset/limit pagination
     */
    private static async runDailySyncGeneric(
        setting: any,
        baseUrl: string,
        mappingMap: Map<string, any>,
        customerMap: Map<string, any>
    ) {
        let offset = 0;
        const limit = 100;
        let fetching = true;
        const processedDailyIds = new Set<string>();
        let dailyLoopCount = 0;

        while (fetching) {
            dailyLoopCount++;
            if (dailyLoopCount > 400) {
                logger.warn(`[SGP Daily Sync] Hard stop for tenant ${setting.userId} at offset ${offset} to prevent freeze.`);
                break;
            }

            logger.info(`[SGP Service] Fetching clients for tenant ${setting.userId} (offset: ${offset})`);

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
                break;
            }

            const data: any = await response.json();
            const clientes = data?.clientes || [];

            if (clientes.length === 0) {
                fetching = false;
                break;
            }

            if (clientes.length < limit || clientes.length > limit) {
                fetching = false;
            }

            for (const cliente of clientes) {
                const cpfCnpj = cliente.cpfcnpj;
                if (!cpfCnpj) continue;

                if (processedDailyIds.has(cpfCnpj)) continue;
                processedDailyIds.add(cpfCnpj);

                const externalId = String(cpfCnpj);
                const mapping = mappingMap.get(externalId);

                const contratos = cliente.contratos || [];
                for (const contrato of contratos) {
                    const servicos = contrato.servicos || [];
                    for (const servico of servicos) {
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

                        const portaStr = servico?.onu?.splitter?.porta;
                        const porta = portaStr ? parseInt(String(portaStr), 10) : null;

                        if (porta !== null && !isNaN(porta)) {
                            if (mapping && mapping.splitterPort !== (porta - 1)) {
                                logger.info(`[SGP Service] Port mismatch detected for ${externalId}. Planner=${mapping.splitterPort !== null ? mapping.splitterPort + 1 : 'none'}, SGP=${porta}. Syncing...`);

                                const syntheticEvent: NormalizedSgpEvent = {
                                    event: 'client_port_changed',
                                    externalCustomerId: externalId,
                                    oldPort: mapping.splitterPort !== null ? (mapping.splitterPort + 1) : undefined,
                                    newPort: porta,
                                    rawPayload: servico
                                };

                                await this.handlePortChange(setting.userId, syntheticEvent, setting.sgpType);
                                mapping.splitterPort = (porta - 1);
                            }
                        }
                    }
                }
            }

            offset += limit;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    /**
     * Incremental sync — only fetches records updated since lastSyncAt.
     * Runs every 10 min. Much lighter than full sync.
     * IXC: queries radusuarios with ultima_atualizacao > lastSyncAt
     * GENERIC: uses syncSingleCustomer for mapped customers only
     */
    public static async runIncrementalSync() {
        logger.info('[SGP Service] Starting incremental synchronization...');
        try {
            const activeSettings = await prisma.integrationSettings.findMany({
                where: { active: true },
                include: { user: true }
            });

            for (const setting of activeSettings) {
                if (!setting.apiUrl || !setting.apiToken) continue;

                try {
                    const baseUrl = setting.apiUrl.replace(/\/$/, '');
                    const now = new Date();
                    // Default to 15 min ago if never synced (slightly wider than 10 min for overlap safety)
                    const since = this.lastSyncMap.get(setting.id) || new Date(now.getTime() - 15 * 60 * 1000);
                    const sinceStr = since.toISOString().replace('T', ' ').substring(0, 19); // "2026-03-31 21:00:00"

                    logger.info(`[SGP Incremental] Tenant ${setting.userId} (${setting.sgpType}) — checking changes since ${sinceStr}`);

                    if (setting.sgpType === 'IXC') {
                        await this.runIncrementalSyncIxc(setting, baseUrl, sinceStr);
                    } else {
                        await this.runIncrementalSyncGeneric(setting, baseUrl);
                    }

                    // Update last sync timestamp in memory
                    this.lastSyncMap.set(setting.id, now);
                } catch (err: any) {
                    logger.error(`[SGP Incremental] Error for tenant ${setting.userId}: ${err.message}`);
                }
            }
        } catch (error: any) {
            logger.error(`[SGP Incremental] Critical error: ${error.message}`);
        }
    }

    /**
     * IXC incremental sync — fetch radusuarios updated since `sinceStr`
     * and update matching mapped customers.
     */
    private static async runIncrementalSyncIxc(setting: any, baseUrl: string, sinceStr: string) {
        const adapter = this.getAdapter('IXC') as IxcAdapter;
        baseUrl = adapter.normalizeBaseUrl(baseUrl);
        const headers = adapter.buildAuthHeaders(setting.apiToken);

        // Load mappings for this tenant
        const mappings = await prisma.integrationMapping.findMany({
            where: { userId: setting.userId }
        });
        const mappingByClient = new Map<string, any>();
        for (const m of mappings) mappingByClient.set(m.externalCustomerId, m);

        const userCompanyId = setting.user?.companyId;
        const customers = userCompanyId ? await prisma.customer.findMany({
            where: { companyId: userCompanyId }
        }) : [];
        const customerMap = new Map<string, any>();
        for (const c of customers) customerMap.set(c.id, c);

        // Query radusuarios updated since last sync
        let page = 1;
        const rp = 100;
        let totalUpdated = 0;

        while (true) {
            const bodyData = {
                qtype: 'radusuarios.ultima_atualizacao',
                query: sinceStr,
                oper: '>',
                page: String(page),
                rp: String(rp),
                sortname: 'radusuarios.ultima_atualizacao',
                sortorder: 'asc',
            };

            try {
                const response = await fetch(`${baseUrl}/webservice/v1/radusuarios`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(bodyData)
                });

                const responseText = await response.text();
                if (!response.ok) {
                    logger.warn(`[SGP Incremental IXC] API error ${response.status}: ${responseText.substring(0, 200)}`);
                    break;
                }

                let data: any;
                try { data = JSON.parse(responseText); } catch { break; }

                if (data?.type === 'error') {
                    logger.warn(`[SGP Incremental IXC] ${data.message}`);
                    break;
                }

                const registros = data?.registros || [];
                if (registros.length === 0) break;

                logger.info(`[SGP Incremental IXC] Found ${registros.length} updated radusuarios (page ${page})`);

                for (const rad of registros) {
                    const clientId = rad.id_cliente;
                    if (!clientId) continue;

                    // Try to find this client in our mappings (by clientId or document)
                    // We need the customer's document to match mappings
                    const mapping = mappingByClient.get(String(clientId));
                    if (!mapping || !mapping.internalCustomerId) continue;

                    const customer = customerMap.get(mapping.internalCustomerId);
                    if (!customer) continue;

                    // Update connection status
                    const isOnline = rad.online === 'S';
                    const isAtivo = rad.ativo === 'S';
                    const newConnectionStatus = isOnline ? 'online' : 'offline';
                    const newAccountStatus = isAtivo ? 'ACTIVE' : 'INACTIVE';

                    const updateData: any = {};
                    if (newConnectionStatus !== (customer as any).connectionStatus) {
                        updateData.connectionStatus = newConnectionStatus;
                        (customer as any).connectionStatus = newConnectionStatus;
                    }
                    if (newAccountStatus !== (customer as any).status) {
                        updateData.status = newAccountStatus;
                        (customer as any).status = newAccountStatus;
                    }

                    if (Object.keys(updateData).length > 0) {
                        try {
                            await prisma.customer.update({
                                where: { id: customer.id },
                                data: updateData
                            });
                            totalUpdated++;
                        } catch {
                            // Ignore individual update failures
                        }
                    }
                }

                if (registros.length < rp) break; // Last page
                page++;
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (err: any) {
                logger.error(`[SGP Incremental IXC] Fetch error: ${err.message}`);
                break;
            }
        }

        if (totalUpdated > 0) {
            logger.info(`[SGP Incremental IXC] Updated ${totalUpdated} customers for tenant ${setting.userId}`);
        }
    }

    /**
     * GENERIC incremental sync — re-syncs only mapped customers individually.
     * Much lighter than full sync since it only checks known customers.
     */
    private static async runIncrementalSyncGeneric(setting: any, baseUrl: string) {
        const userCompanyId = setting.user?.companyId;
        if (!userCompanyId) return;

        // Only sync customers that have an active mapping
        const mappings = await prisma.integrationMapping.findMany({
            where: { userId: setting.userId }
        });

        if (mappings.length === 0) return;

        const customers = await prisma.customer.findMany({
            where: {
                companyId: userCompanyId,
                document: { not: null },
                deletedAt: null,
                id: { in: mappings.map(m => m.internalCustomerId).filter(Boolean) as string[] }
            }
        });

        if (customers.length === 0) return;

        logger.info(`[SGP Incremental GENERIC] Syncing ${customers.length} mapped customers for tenant ${setting.userId}`);

        const CONCURRENCY = 3;
        let totalUpdated = 0;

        const tasks = customers.map(customer => async () => {
            try {
                const updated = await this.syncSingleCustomer(customer, baseUrl, setting, setting.userId);
                if (updated) totalUpdated++;
            } catch {
                // Ignore individual failures
            }
        });

        await this.runWithConcurrency(tasks, CONCURRENCY);

        if (totalUpdated > 0) {
            logger.info(`[SGP Incremental GENERIC] Updated ${totalUpdated}/${customers.length} customers for tenant ${setting.userId}`);
        }
    }
}
