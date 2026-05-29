import { prisma } from '../../lib/prisma';
import logger from '../../lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { NormalizedSgpEvent, SgpEventType } from './sgp.types';
import { ISgpAdapter } from './adapters/SgpAdapter.interface';
import { IxcAdapter } from './adapters/IxcAdapter';
import { GenericAdapter } from './adapters/GenericAdapter';
import { BeeswebAdapter } from './adapters/BeeswebAdapter';
import { decryptIfNeeded } from '../../lib/encryption';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout';

/** Decrypts sensitive fields in-place so all downstream code reads plaintext. */
function decryptSettings<T extends { apiToken?: string | null; webhookSecret?: string | null }>(settings: T): T {
    if (settings.apiToken) settings.apiToken = decryptIfNeeded(settings.apiToken);
    if (settings.webhookSecret) settings.webhookSecret = decryptIfNeeded(settings.webhookSecret);
    return settings;
}

/**
 * SGP retorna status do contrato/serviço como CÓDIGO NUMÉRICO ou texto.
 *   1 = Ativo, 2 = Inativo, 3 = Cancelado, 4 = Suspenso
 * Versões antigas / variantes podem mandar strings ("Ativo", "Suspenso",
 * "Bloqueado"). Normaliza pra nosso enum interno. Inativo e Cancelado
 * são estados distintos no SGP — preservamos a separação aqui também.
 */
function mapSgpStatusToInternal(raw: any): 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'CANCELLED' | null {
    if (raw === null || raw === undefined || raw === '') return null;
    const key = String(raw).trim().toLowerCase();
    switch (key) {
        case '1': case 'ativo': case 'habilitado': return 'ACTIVE';
        case '4': case 'suspenso': case 'bloqueado': return 'SUSPENDED';
        case '2': case 'inativo': case 'desativado': return 'INACTIVE';
        case '3': case 'cancelado': return 'CANCELLED';
        default: return null;
    }
}

export class SgpService {

    // In-memory last sync timestamp per setting ID (no migration needed)
    private static lastSyncMap = new Map<string, Date>();

    public static getAdapter(sgpType: string): ISgpAdapter {
        const upper = sgpType.toUpperCase();
        if (upper === 'IXC') return new IxcAdapter();
        if (upper === 'BEESWEB') return new BeeswebAdapter();
        return new GenericAdapter();
    }

    /** Map a BeesWeb customer record to our internal account status enum. */
    private static mapBeeswebStatus(beeswebCustomer: any): 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | null {
        if (!beeswebCustomer) return null;
        if (beeswebCustomer.deleted_at) return 'INACTIVE';
        if (beeswebCustomer.disabled_at) return 'SUSPENDED';
        const status = beeswebCustomer.status;
        if (status === 1 || status === '1' || status === true) return 'ACTIVE';
        if (status === 0 || status === '0' || status === false) return 'SUSPENDED';
        return null;
    }

    public static async processWebhook(tenantId: string, sgpType: string, payload: any, headers: any): Promise<void> {
        const settingsRaw = await prisma.integrationSettings.findFirst({
            where: { userId: tenantId, sgpType }
        });

        if (!settingsRaw || !settingsRaw.active) {
            logger.warn(`[SGP Webhook] Tenant ${tenantId} received webhook but integration is disabled or not configured.`);
            return;
        }

        const settings = decryptSettings(settingsRaw);
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
        const settingsRaw = await prisma.integrationSettings.findFirst({
            where: { userId: tenantId, sgpType }
        });

        if (!settingsRaw || !settingsRaw.active || !settingsRaw.apiUrl) {
            return;
        }
        const settings = decryptSettings(settingsRaw);

        const adapter = this.getAdapter(sgpType);
        const payload = adapter.formatOutgoingPayload(internalEvent);

        try {
           // send request
           // await axios.post(settings.apiUrl, payload, { headers: { Authorization: `Bearer ${settings.apiToken}` } });
        } catch (error: any) {
            logger.error(`[SGP Push] Error sending to external SGP: ${error.message}`);
        }
    }
    
    /**
     * Probe SGP credentials/connectivity for a tenant. Cheaper than searchCustomer
     * because it never enters the customer-search pipeline.
     */
    public static async testConnection(userId: string, sgpType: string): Promise<void> {
        const settingsRaw = await prisma.integrationSettings.findFirst({
            where: { userId, sgpType }
        });
        if (!settingsRaw || !settingsRaw.apiUrl || !settingsRaw.apiToken) {
            throw new Error('Integration not configured (URL and token required)');
        }
        const settings = decryptSettings(settingsRaw);
        const baseUrl = settings.apiUrl!.replace(/\/$/, '');
        const adapter = this.getAdapter(sgpType);
        if (!adapter.testConnection) {
            // Fallback for adapters that haven't implemented the probe yet.
            await adapter.searchCustomer(baseUrl, settings.apiToken!, settings.apiApp, '00000000000');
            return;
        }
        await adapter.testConnection(baseUrl, settings.apiToken!, settings.apiApp);
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
        const allSettings = (await prisma.integrationSettings.findMany({
            where: {
                user: { companyId: user.companyId },
                apiUrl: { not: null },
                apiToken: { not: null },
                ...(sgpType && sgpType !== 'auto' ? { sgpType } : {})
            },
            orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
            include: { user: true }
        })).map(s => decryptSettings(s));

        if (allSettings.length === 0) {
            logger.warn(`[SGP Service] No integration settings found for company ${user.companyId}`);
            throw new Error('Integration not configured (URL and Token required)');
        }

        // Specific provider → single attempt with original error semantics.
        if (sgpType !== 'auto') {
            const settings = allSettings[0];
            const baseUrl = settings.apiUrl?.replace(/\/$/, '');
            if (!baseUrl || !settings.apiToken) return null;
            logger.info(`[SGP Service] Searching customer using ${settings.sgpType} for company ${user.companyId}`);
            const adapter = this.getAdapter(settings.sgpType);
            const result = await adapter.searchCustomer(baseUrl, settings.apiToken, settings.apiApp, cpfCnpj);
            if (result) logger.info(`[SGP Service] Found customer via ${settings.sgpType} for ${cpfCnpj}`);
            return result;
        }

        // Auto mode: race all providers in parallel and return the first hit.
        // Each provider's search resolves to a result on success and rejects with
        // a sentinel { empty: true } when there's simply no record (so Promise.any
        // can keep waiting on other providers). Real errors carry their message.
        const usableSettings = allSettings.filter(s => s.apiUrl && s.apiToken);
        if (usableSettings.length === 0) return null;

        type EmptyMiss = { empty: true; provider: string };
        type ProviderError = { empty: false; provider: string; message: string };

        const attempts = usableSettings.map(async (settings) => {
            const baseUrl = settings.apiUrl!.replace(/\/$/, '');
            const adapter = this.getAdapter(settings.sgpType);
            logger.info(`[SGP Service] Searching customer via ${settings.sgpType} (auto) for company ${user.companyId}`);
            try {
                const result = await adapter.searchCustomer(baseUrl, settings.apiToken!, settings.apiApp, cpfCnpj);
                if (result) return result;
                throw { empty: true, provider: settings.sgpType } as EmptyMiss;
            } catch (err: any) {
                if (err && err.empty === true) throw err;
                logger.warn(`[SGP Service] Provider ${settings.sgpType} error: ${err.message}`);
                throw { empty: false, provider: settings.sgpType, message: err.message } as ProviderError;
            }
        });

        try {
            const result = await Promise.any(attempts);
            return result;
        } catch (aggregate: any) {
            const errors: (EmptyMiss | ProviderError)[] = aggregate?.errors || [];
            const realError = errors.find((e): e is ProviderError => e.empty === false);
            if (realError) throw new Error(realError.message);
            return null; // All providers cleanly returned "not found"
        }
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

        if (settings.sgpType === 'BEESWEB') {
            const adapter = this.getAdapter('BEESWEB');
            try {
                sgpCustomer = await adapter.searchCustomer(baseUrl, settings.apiToken, settings.apiApp, customer.document);
            } catch (err) {
                logger.warn(`[SGP Service] BeesWeb search failed for ${customer.document}: ${err instanceof Error ? err.message : String(err)}`);
                return false;
            }
            if (!sgpCustomer) return false;

            // Adapter returns a normalized envelope; unwrap to raw BeesWeb record for status mapping
            const rawBees = sgpCustomer._raw || sgpCustomer;
            const newAccountStatus = this.mapBeeswebStatus(rawBees);

            const updateData: any = {};
            if (newAccountStatus && newAccountStatus !== (customer as any).status) {
                updateData.status = newAccountStatus;
            }

            if (Object.keys(updateData).length === 0) return false;

            try {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: updateData
                });
                return true;
            } catch (e) {
                logger.error(`[SGP Service] BeesWeb DB update failed for ${customer.document}`);
                return false;
            }
        }

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

            const response = await fetchWithTimeout(`${baseUrl}/api/ura/clientes/`, {
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
        // Trust conexao.status when present. When it's missing, prefer the
        // verificaacesso probe (GENERIC only) over guessing 'offline' from
        // serial/MAC presence — having equipment registered doesn't actually
        // mean the link is down.
        let newStatus: string | null = onuData.conexao?.status
            ? String(onuData.conexao.status).toLowerCase().trim()
            : null;

        if (!newStatus && mainContract?.id && settings.sgpType !== 'IXC' && settings.sgpType !== 'BEESWEB') {
            const generic = this.getAdapter('GENERIC') as GenericAdapter;
            const fallback = await generic.checkServiceAccess(baseUrl, settings.apiApp, settings.apiToken, mainContract.id);
            if (fallback) newStatus = fallback;
        }

        // Last-resort heuristic: only if we still have nothing AND the SGP
        // recorded equipment for this customer, assume offline.
        if (!newStatus && (onuData.serial || mainService.mac)) {
            newStatus = 'offline';
        }

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

    /**
     * Stage a customer update (last-write-wins). The actual DB writes are deferred
     * to flushPendingUpdates so we can collapse N customers with identical change
     * sets into a single updateMany.
     */
    private static stagePendingUpdate(
        pending: Map<string, Record<string, any>>,
        customerId: string,
        fields: Record<string, any>
    ) {
        if (Object.keys(fields).length === 0) return;
        const existing = pending.get(customerId);
        pending.set(customerId, existing ? { ...existing, ...fields } : fields);
    }

    /**
     * Flush staged updates. Buckets entries by data shape and issues one
     * updateMany per shape (chunked at 500 IDs to keep query size sane).
     */
    private static async flushPendingUpdates(
        pending: Map<string, Record<string, any>>
    ): Promise<number> {
        if (pending.size === 0) return 0;
        const buckets = new Map<string, { ids: string[]; data: Record<string, any> }>();
        for (const [customerId, data] of pending) {
            const key = JSON.stringify(data);
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { ids: [], data };
                buckets.set(key, bucket);
            }
            bucket.ids.push(customerId);
        }
        let total = 0;
        for (const { ids, data } of buckets.values()) {
            for (let i = 0; i < ids.length; i += 500) {
                try {
                    const res = await prisma.customer.updateMany({
                        where: { id: { in: ids.slice(i, i + 500) } },
                        data
                    });
                    total += res.count;
                } catch (err: any) {
                    logger.warn(`[SGP Service] updateMany batch failed: ${err.message}`);
                }
            }
        }
        pending.clear();
        return total;
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
        const settingsRaw = await prisma.integrationSettings.findFirst({
            where: { userId, sgpType }
        });

        if (!settingsRaw || !settingsRaw.apiUrl || !settingsRaw.apiToken) {
            throw new Error('SGP integration not configured or inactive');
        }
        const settings = decryptSettings(settingsRaw);

        const baseUrl = settings.apiUrl!.replace(/\/$/, '');
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        logger.info(`[SGP Service] Bulk status sync started for company ${user.companyId}`);

        const customers = await prisma.customer.findMany({
            where: {
                companyId: user.companyId,
                document: { not: null },
                deletedAt: null
            },
            select: {
                id: true,
                name: true,
                document: true,
                status: true,
                connectionStatus: true,
                splitterPortIndex: true,
                ctoId: true
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
            const activeSettings = (await prisma.integrationSettings.findMany({
                where: { active: true },
                include: { user: true }
            })).map(s => decryptSettings(s));

            for (const setting of activeSettings) {
                logger.info(`[SGP Service] Synchronizing tenant ${setting.userId} using ${setting.sgpType}`);

                if (!setting.apiUrl || !setting.apiToken) {
                    logger.warn(`[SGP Service] Tenant ${setting.userId} mapping lacks apiUrl or apiToken. Skipping polling.`);
                    continue;
                }

                try {
                    const userCompanyId = setting.user?.companyId;
                    const mappings = await prisma.integrationMapping.findMany({
                        where: { userId: setting.userId },
                        select: {
                            id: true,
                            internalCustomerId: true,
                            externalCustomerId: true,
                            splitterPort: true
                        }
                    });

                    const customers = userCompanyId ? await prisma.customer.findMany({
                        where: { companyId: userCompanyId },
                        select: {
                            id: true,
                            name: true,
                            document: true,
                            status: true,
                            connectionStatus: true,
                            splitterPortIndex: true,
                            ctoId: true
                        }
                    }) : [];

                    const mappingMap = new Map();
                    for (const m of mappings) mappingMap.set(m.externalCustomerId, m);

                    const customerMap = new Map();
                    for (const c of customers) customerMap.set(c.id, c);

                    const baseUrl = setting.apiUrl.replace(/\/$/, '');

                    if (setting.sgpType === 'IXC') {
                        await this.runDailySyncIxc(setting, baseUrl, mappingMap, customerMap);
                    } else if (setting.sgpType === 'BEESWEB') {
                        await this.runDailySyncBeesweb(setting, baseUrl, customerMap);
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

        const rp = 100;
        const processedIds = new Set<string>();
        const pendingUpdates = new Map<string, Record<string, any>>();
        const PAGE_SPACING_MS = 100;

        // Fire one request and return parsed JSON. Throws on HTTP/parse errors.
        const fetchPage = async (pageNum: number): Promise<any> => {
            const response = await fetchWithTimeout(`${baseUrl}/webservice/v1/cliente`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    qtype: 'cliente.id',
                    query: '0',
                    oper: '>',
                    page: String(pageNum),
                    rp: String(rp),
                    sortname: 'cliente.id',
                    sortorder: 'asc',
                })
            });
            if (!response.ok) throw new Error(`API ${response.status}`);
            return response.json();
        };

        // Speculative prefetch: while we process page N, page N+1 is already in flight.
        let page = 1;
        let inFlight: Promise<any> | null = fetchPage(page);
        let loopCount = 0;

        while (inFlight) {
            loopCount++;
            if (loopCount > 400) {
                logger.warn(`[SGP Daily Sync IXC] Hard stop for tenant ${setting.userId} at page ${page}`);
                break;
            }

            logger.info(`[SGP Service] IXC: Processing clients page ${page} for tenant ${setting.userId}`);

            let data: any;
            try {
                data = await inFlight;
            } catch (err: any) {
                logger.error(`[SGP Daily Sync IXC] Fetch error on page ${page}: ${err.message}`);
                break;
            }

            const registros = data?.registros || [];
            const isLastPage = registros.length === 0 || registros.length < rp;

            // Kick off next page in parallel BEFORE processing current,
            // with a small spacing to avoid bursting the SGP server.
            inFlight = isLastPage ? null : (async () => {
                await new Promise(resolve => setTimeout(resolve, PAGE_SPACING_MS));
                return fetchPage(page + 1);
            })();

            for (const cliente of registros) {
                const cpfCnpj = cliente.cnpj_cpf;
                if (!cpfCnpj) continue;

                const cleanDoc = cpfCnpj.replace(/\D/g, '');
                if (processedIds.has(cleanDoc)) continue;
                processedIds.add(cleanDoc);

                const mapping = mappingMap.get(cleanDoc);
                if (!mapping || !mapping.internalCustomerId) continue;

                const customer = customerMap.get(mapping.internalCustomerId);
                if (!customer) continue;

                const newAccountStatus = cliente.ativo === 'S' ? 'ACTIVE' : 'INACTIVE';
                if (newAccountStatus !== (customer as any).status) {
                    this.stagePendingUpdate(pendingUpdates, customer.id, { status: newAccountStatus });
                    (customer as any).status = newAccountStatus;
                }
            }

            page++;
        }

        // Swallow any in-flight error from a discarded prefetch
        if (inFlight) (inFlight as Promise<any>).catch(() => {});

        const updated = await this.flushPendingUpdates(pendingUpdates);
        if (updated > 0) {
            logger.info(`[SGP Daily Sync IXC] Updated ${updated} customers for tenant ${setting.userId}`);
        }
    }

    /**
     * Daily sync for BeesWeb provider — paginated /adm/customers, status-only.
     * Matches by document (cpf_cnpj) and updates account status.
     */
    private static async runDailySyncBeesweb(
        setting: any,
        baseUrl: string,
        customerMap: Map<string, any>
    ) {
        if (!setting.apiApp) {
            logger.warn(`[SGP Daily Sync BEESWEB] Tenant ${setting.userId} missing apiApp (email). Skipping.`);
            return;
        }

        const email = setting.apiApp;
        const password = setting.apiToken;

        const customersByDoc = new Map<string, any>();
        for (const c of customerMap.values()) {
            const doc = String((c as any).document || '').replace(/\D/g, '');
            if (doc) customersByDoc.set(doc, c);
        }

        if (customersByDoc.size === 0) return;

        let page = 1;
        let loopCount = 0;
        const pendingUpdates = new Map<string, Record<string, any>>();

        while (true) {
            loopCount++;
            if (loopCount > 400) {
                logger.warn(`[SGP Daily Sync BEESWEB] Hard stop for tenant ${setting.userId} at page ${page}`);
                break;
            }

            let data: any;
            try {
                data = await BeeswebAdapter.fetchCustomersPage(baseUrl, email, password, page);
            } catch (err: any) {
                logger.error(`[SGP Daily Sync BEESWEB] Fetch error page ${page}: ${err.message}`);
                break;
            }

            const list: any[] = data?.data || [];
            if (list.length === 0) break;

            for (const beesCustomer of list) {
                const doc = String(beesCustomer?.cpf_cnpj || '').replace(/\D/g, '');
                if (!doc) continue;

                const customer = customersByDoc.get(doc);
                if (!customer) continue;

                const newAccountStatus = this.mapBeeswebStatus(beesCustomer);
                if (!newAccountStatus || newAccountStatus === (customer as any).status) continue;

                this.stagePendingUpdate(pendingUpdates, customer.id, { status: newAccountStatus });
                (customer as any).status = newAccountStatus;
            }

            const lastPage = Number(data?.last_page) || page;
            if (page >= lastPage || !data?.next_page_url) break;

            page++;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const updated = await this.flushPendingUpdates(pendingUpdates);
        if (updated > 0) {
            logger.info(`[SGP Daily Sync BEESWEB] Updated ${updated} customers for tenant ${setting.userId}`);
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
        const limit = 100;
        const processedDailyIds = new Set<string>();
        const pendingUpdates = new Map<string, Record<string, any>>();
        const PAGE_SPACING_MS = 100;

        const fetchPage = async (offsetNum: number): Promise<any> => {
            const response = await fetchWithTimeout(`${baseUrl}/api/ura/clientes/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app: setting.apiApp,
                    token: setting.apiToken,
                    limit,
                    offset: offsetNum,
                    exibir_conexao: 's',
                    omitir_titulos: true
                })
            });
            if (!response.ok) throw new Error(`API ${response.status}`);
            return response.json();
        };

        let offset = 0;
        let inFlight: Promise<any> | null = fetchPage(offset);
        let dailyLoopCount = 0;

        while (inFlight) {
            dailyLoopCount++;
            if (dailyLoopCount > 400) {
                logger.warn(`[SGP Daily Sync] Hard stop for tenant ${setting.userId} at offset ${offset} to prevent freeze.`);
                break;
            }

            logger.info(`[SGP Service] Processing clients for tenant ${setting.userId} (offset: ${offset})`);

            let data: any;
            try {
                data = await inFlight;
            } catch (err: any) {
                logger.error(`[SGP Service] Failed to fetch SGP API for tenant ${setting.userId}: ${err.message}`);
                break;
            }

            const clientes = data?.clientes || [];
            const isLastPage = clientes.length === 0 || clientes.length !== limit;

            inFlight = isLastPage ? null : (async () => {
                await new Promise(resolve => setTimeout(resolve, PAGE_SPACING_MS));
                return fetchPage(offset + limit);
            })();

            // Per-page queue of customers needing the verificaacesso fallback
            // (no ONU data in payload). Resolved with bounded concurrency at the
            // end of the page so we don't slow down processing inline.
            const accessFallbackQueue: { customerId: string; contratoId: string | number; equipmentRegistered: boolean }[] = [];

            for (const cliente of clientes) {
                const cpfCnpj = cliente.cpfcnpj;
                if (!cpfCnpj) continue;

                // Canonical mapping key is digits-only CPF/CNPJ (see IntegrationMapping
                // schema doc). Whether the SGP returned formatted or raw, we normalize.
                const externalId = String(cpfCnpj).replace(/\D/g, '');
                if (!externalId) continue;
                if (processedDailyIds.has(externalId)) continue;
                processedDailyIds.add(externalId);

                const mapping = mappingMap.get(externalId);

                const contratos = cliente.contratos || [];
                for (const contrato of contratos) {
                    const servicos = contrato.servicos || [];
                    for (const servico of servicos) {
                        if (mapping && mapping.internalCustomerId) {
                            const customer = customerMap.get(mapping.internalCustomerId);
                            if (customer) {
                                // Prefer verificaacesso over the serial/mac=offline guess —
                                // having equipment doesn't mean the link is down.
                                const liveStatus = servico.onu?.conexao?.status
                                    ? String(servico.onu.conexao.status).toLowerCase().trim()
                                    : null;
                                const equipmentRegistered = !!(servico.onu?.serial || servico.mac);

                                // Status pode vir como número (1/2/3/4) ou texto — helper
                                // mapSgpStatusToInternal lida com ambos. Tenta serviço →
                                // contrato → cliente (contrato costuma ser autoritativo).
                                const rawStatus = servico.status ?? contrato?.status ?? cliente.status;
                                const newAccountStatus = mapSgpStatusToInternal(rawStatus);

                                const updateData: Record<string, any> = {};
                                if (liveStatus && liveStatus !== (customer as any).connectionStatus) {
                                    updateData.connectionStatus = liveStatus;
                                    (customer as any).connectionStatus = liveStatus;
                                }
                                if (newAccountStatus && newAccountStatus !== (customer as any).status) {
                                    updateData.status = newAccountStatus;
                                    (customer as any).status = newAccountStatus;
                                }

                                this.stagePendingUpdate(pendingUpdates, customer.id, updateData);

                                // Queue verificaacesso when there's no live ONU status,
                                // regardless of equipment presence. Mark equipment so
                                // we can fall back to 'offline' if verificaacesso fails.
                                if (!liveStatus && contrato.id) {
                                    accessFallbackQueue.push({
                                        customerId: customer.id,
                                        contratoId: contrato.id,
                                        equipmentRegistered
                                    });
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

            // Resolve verificaacesso fallbacks for this page with bounded
            // concurrency. Runs in parallel with the prefetch of the next page.
            if (accessFallbackQueue.length > 0) {
                const generic = this.getAdapter('GENERIC') as GenericAdapter;
                let resolved = 0;
                const tasks = accessFallbackQueue.map(item => async () => {
                    const status = await generic.checkServiceAccess(
                        baseUrl, setting.apiApp, setting.apiToken, item.contratoId
                    );
                    // Prefer the live verificaacesso answer; fall back to the
                    // 'offline' guess only if the probe failed AND the customer
                    // has equipment registered (mirrors syncSingleCustomer).
                    const finalStatus = status ?? (item.equipmentRegistered ? 'offline' : null);
                    if (finalStatus) {
                        this.stagePendingUpdate(pendingUpdates, item.customerId, { connectionStatus: finalStatus });
                        resolved++;
                    }
                });
                await this.runWithConcurrency(tasks, 3);
                if (resolved > 0) {
                    logger.info(`[SGP Daily Sync GENERIC] verificaacesso fallback resolved ${resolved}/${accessFallbackQueue.length} customers (page offset ${offset})`);
                }
            }

            offset += limit;
        }

        if (inFlight) (inFlight as Promise<any>).catch(() => {});

        const updated = await this.flushPendingUpdates(pendingUpdates);
        if (updated > 0) {
            logger.info(`[SGP Daily Sync GENERIC] Updated ${updated} customers for tenant ${setting.userId}`);
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
            const activeSettings = (await prisma.integrationSettings.findMany({
                where: { active: true },
                include: { user: true }
            })).map(s => decryptSettings(s));

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
            where: { userId: setting.userId },
            select: {
                id: true,
                internalCustomerId: true,
                externalCustomerId: true,
                splitterPort: true
            }
        });
        const mappingByClient = new Map<string, any>();
        for (const m of mappings) mappingByClient.set(m.externalCustomerId, m);

        const userCompanyId = setting.user?.companyId;
        const customers = userCompanyId ? await prisma.customer.findMany({
            where: { companyId: userCompanyId },
            select: {
                id: true,
                name: true,
                document: true,
                status: true,
                connectionStatus: true,
                splitterPortIndex: true,
                ctoId: true
            }
        }) : [];
        const customerMap = new Map<string, any>();
        for (const c of customers) customerMap.set(c.id, c);

        // Query radusuarios updated since last sync, with speculative prefetch
        const rp = 100;
        const pendingUpdates = new Map<string, Record<string, any>>();
        const PAGE_SPACING_MS = 100;

        const fetchPage = async (pageNum: number): Promise<any> => {
            const response = await fetchWithTimeout(`${baseUrl}/webservice/v1/radusuarios`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    qtype: 'radusuarios.ultima_atualizacao',
                    query: sinceStr,
                    oper: '>',
                    page: String(pageNum),
                    rp: String(rp),
                    sortname: 'radusuarios.ultima_atualizacao',
                    sortorder: 'asc',
                })
            });
            const responseText = await response.text();
            if (!response.ok) {
                throw new Error(`API ${response.status}: ${responseText.substring(0, 200)}`);
            }
            return JSON.parse(responseText);
        };

        let page = 1;
        let inFlight: Promise<any> | null = fetchPage(page);

        while (inFlight) {
            let data: any;
            try {
                data = await inFlight;
            } catch (err: any) {
                logger.warn(`[SGP Incremental IXC] Fetch error on page ${page}: ${err.message}`);
                break;
            }

            if (data?.type === 'error') {
                logger.warn(`[SGP Incremental IXC] ${data.message}`);
                break;
            }

            const registros = data?.registros || [];
            const isLastPage = registros.length === 0 || registros.length < rp;

            inFlight = isLastPage ? null : (async () => {
                await new Promise(resolve => setTimeout(resolve, PAGE_SPACING_MS));
                return fetchPage(page + 1);
            })();

            if (registros.length > 0) {
                logger.info(`[SGP Incremental IXC] Found ${registros.length} updated radusuarios (page ${page})`);
            }

            // radusuarios only exposes id_cliente; mappings are keyed by digits-only
            // CPF/CNPJ. Batch-translate id_cliente → CPF in a single IXC call so the
            // mapping lookup below can succeed.
            const uniqueClientIds = [...new Set(registros.map((r: any) => r.id_cliente).filter(Boolean).map(String))];
            const clientIdToDoc = new Map<string, string>();
            if (uniqueClientIds.length > 0) {
                try {
                    const lookupRes = await fetchWithTimeout(`${baseUrl}/webservice/v1/cliente`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            qtype: 'cliente.id',
                            query: uniqueClientIds.join(','),
                            oper: 'IN',
                            page: '1',
                            rp: String(uniqueClientIds.length),
                            sortname: 'cliente.id',
                            sortorder: 'asc',
                        })
                    });
                    if (lookupRes.ok) {
                        const lookupData: any = await lookupRes.json();
                        for (const c of (lookupData?.registros || [])) {
                            const doc = String(c.cnpj_cpf || '').replace(/\D/g, '');
                            if (doc) clientIdToDoc.set(String(c.id), doc);
                        }
                    }
                } catch (err: any) {
                    logger.warn(`[SGP Incremental IXC] id_cliente→CPF batch translate failed: ${err.message}`);
                }
            }

            for (const rad of registros) {
                const clientId = rad.id_cliente;
                if (!clientId) continue;

                const externalKey = clientIdToDoc.get(String(clientId));
                if (!externalKey) continue; // Couldn't translate id_cliente; skip rather than silently no-op

                const mapping = mappingByClient.get(externalKey);
                if (!mapping || !mapping.internalCustomerId) continue;

                const customer = customerMap.get(mapping.internalCustomerId);
                if (!customer) continue;

                const newConnectionStatus = rad.online === 'S' ? 'online' : 'offline';
                const newAccountStatus = rad.ativo === 'S' ? 'ACTIVE' : 'INACTIVE';

                const updateData: Record<string, any> = {};
                if (newConnectionStatus !== (customer as any).connectionStatus) {
                    updateData.connectionStatus = newConnectionStatus;
                    (customer as any).connectionStatus = newConnectionStatus;
                }
                if (newAccountStatus !== (customer as any).status) {
                    updateData.status = newAccountStatus;
                    (customer as any).status = newAccountStatus;
                }

                this.stagePendingUpdate(pendingUpdates, customer.id, updateData);
            }

            page++;
        }

        if (inFlight) (inFlight as Promise<any>).catch(() => {});

        const totalUpdated = await this.flushPendingUpdates(pendingUpdates);
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
            where: { userId: setting.userId },
            select: { internalCustomerId: true }
        });

        if (mappings.length === 0) return;

        const customers = await prisma.customer.findMany({
            where: {
                companyId: userCompanyId,
                document: { not: null },
                deletedAt: null,
                id: { in: mappings.map(m => m.internalCustomerId).filter(Boolean) as string[] }
            },
            select: {
                id: true,
                name: true,
                document: true,
                status: true,
                connectionStatus: true,
                splitterPortIndex: true,
                ctoId: true
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
