import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getCustomers = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user || !user.companyId) return res.status(401).send();

    try {
        const { minLat, maxLat, minLng, maxLng, ctoId, search, projectId } = req.query;

        const where: any = {
            companyId: user.companyId
        };

        if (projectId) {
            where.projectId = projectId as string;
        }

        // Spatial Filter (Bounding Box)
        if (minLat && maxLat && minLng && maxLng) {
            where.lat = {
                gte: parseFloat(minLat as string),
                lte: parseFloat(maxLat as string)
            };
            where.lng = {
                gte: parseFloat(minLng as string),
                lte: parseFloat(maxLng as string)
            };
        }

        // Filter by CTO
        if (ctoId) {
            where.ctoId = ctoId as string;
        }

        // Search by Name or Document
        if (search) {
            const searchStr = search as string;
            where.OR = [
                { name: { contains: searchStr, mode: 'insensitive' } },
                { document: { contains: searchStr, mode: 'insensitive' } }
            ];
        }

        const customers = await prisma.customer.findMany({
            where,
            include: { drop: true }, // Include drop geometry
            orderBy: { createdAt: 'desc' }
        });

        res.json(customers);
    } catch (error) {
        console.error("Get Customers Error:", error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
};

export const createCustomer = async (req: Request, res: Response) => {
    console.log("[CreateCustomer] Request received");
    const user = (req as AuthRequest).user;
    console.log("[CreateCustomer] User:", user ? user.username : 'No user');

    if (!user || !user.companyId) {
        console.warn("[CreateCustomer] Unauthorized: No user or companyId");
        return res.status(401).send();
    }

    try {
        console.log("[CreateCustomer] Body:", JSON.stringify(req.body));

        if (!req.body) {
            throw new Error("Request body is empty or undefined");
        }

        const {
            name, document, phone, email, address,
            lat, lng,
            ctoId, splitterId, splitterPortIndex, fiberId,
            status, onuSerial, onuMac, pppoeService, onuPower,
            projectId
        } = req.body;

        console.log(`[CreateCustomer] Extracting data: name=${name}, lat=${lat}, lng=${lng}`);

        // Parse logic
        const pLat = parseFloat(lat);
        const pLng = parseFloat(lng);
        const pOnuPower = onuPower ? parseFloat(onuPower) : null;

        if (isNaN(pLat) || isNaN(pLng)) {
            console.error("[CreateCustomer] Invalid Coordinates:", { lat, lng });
            return res.status(400).json({ error: "Coordenadas inválidas. Lat/Lng devem ser números." });
        }

        // Validation: Check if port is already occupied
        if (ctoId && splitterId && splitterPortIndex !== undefined) {
            console.log("[CreateCustomer] Checking port occupancy...");
            const existing = await prisma.customer.findFirst({
                where: {
                    companyId: user.companyId,
                    ctoId,
                    splitterId,
                    splitterPortIndex: Number(splitterPortIndex)
                }
            });

            if (existing) {
                console.warn("[CreateCustomer] Port occupied by:", existing.name);
                return res.status(409).json({
                    error: 'Porta ocupada',
                    details: `Esta porta já está em uso pelo cliente ${existing.name}`
                });
            }
        }

        // New Drop Logic: Extract drop coordinates if present
        const { dropCoordinates } = req.body; // Expecting array of {lat, lng}

        console.log("[CreateCustomer] Creating in DB...");

        // Transaction to ensure Customer and Drop are created together
        const result = await prisma.$transaction(async (tx) => {
            const customer = await tx.customer.create({
                data: {
                    companyId: user.companyId,
                    projectId: projectId || null,
                    name,
                    document,
                    phone,
                    email,
                    address,
                    lat: pLat,
                    lng: pLng,
                    ctoId,
                    splitterId,
                    // Index is 0-based usually, ensure it's a number
                    splitterPortIndex: splitterPortIndex !== undefined ? Number(splitterPortIndex) : null,
                    fiberId,
                    status: status || 'ACTIVE',
                    onuSerial,
                    onuMac,
                    pppoeService
                }
            });

            // If drop coordinates are provided (Phase 2 of flow), create Drop record
            if (dropCoordinates && Array.isArray(dropCoordinates) && dropCoordinates.length >= 2 && ctoId) {
                console.log("[CreateCustomer] Creating Drop record...");
                await tx.drop.create({
                    data: {
                        customerId: customer.id,
                        ctoId: ctoId,
                        coordinates: dropCoordinates, // Prisma handles JSON
                        length: 0 // TODO: Calculate length if needed
                    }
                });
            }

            return customer;
        });

        console.log("[CreateCustomer] Created:", result.id);

        // Update CTO client count (outside transaction to avoid locking unrelated stuff if possible, or inside if strict)
        if (ctoId) {
            console.log("[CreateCustomer] Updating CTO count...");
            const count = await prisma.customer.count({ where: { ctoId } });
            await prisma.cto.update({
                where: { id: ctoId },
                data: { clientCount: count }
            });
        }

        res.json(result);
    } catch (error: any) {
        console.error("Create Customer Error:", error);
        // Ensure we send a JSON response even if error object is weird
        res.status(500).json({ error: 'Failed to create customer', details: error.message || String(error) });
    }
};

export const updateCustomer = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user || !user.companyId) return res.status(401).send();

    const { id } = req.params;

    try {
        const {
            name, document, phone, email, address,
            lat, lng,
            ctoId, splitterId, splitterPortIndex, fiberId,
            status, onuSerial, onuMac, pppoeService, onuPower,
            projectId
        } = req.body;

        // Verify ownership
        const currentHelper = await prisma.customer.findFirst({ where: { id, companyId: user.companyId } });
        if (!currentHelper) return res.status(404).json({ error: 'Customer not found' });

        // Check occupancy if changing port
        if (
            ctoId && splitterId && splitterPortIndex !== undefined &&
            (
                ctoId !== currentHelper.ctoId ||
                splitterId !== currentHelper.splitterId ||
                splitterPortIndex !== currentHelper.splitterPortIndex
            )
        ) {
            const existing = await prisma.customer.findFirst({
                where: {
                    companyId: user.companyId,
                    ctoId,
                    splitterId,
                    splitterPortIndex: Number(splitterPortIndex),
                    id: { not: id } // Exclude self
                }
            });

            if (existing) {
                return res.status(409).json({
                    error: 'Porta ocupada',
                    details: `Esta porta já está em uso pelo cliente ${existing.name}`
                });
            }
        }

        // New Drop Logic: Extract drop coordinates
        const { dropCoordinates } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // If disconnecting (ctoId explicitly null), we must delete the drop
            if (ctoId === null) {
                await tx.drop.deleteMany({ where: { customerId: id } });
            }

            const customer = await tx.customer.update({
                where: { id },
                data: {
                    name, document, phone, email, address,
                    lat: lat !== undefined ? parseFloat(lat) : undefined,
                    lng: lng !== undefined ? parseFloat(lng) : undefined,
                    ctoId,
                    splitterId,
                    splitterPortIndex: (splitterPortIndex !== undefined && splitterPortIndex !== null) ? Number(splitterPortIndex) : null,
                    fiberId,
                    status,
                    onuSerial,
                    onuMac,
                    pppoeService,
                    onuPower: onuPower !== undefined ? (onuPower ? parseFloat(onuPower) : null) : undefined,
                    projectId: projectId !== undefined ? (projectId || null) : undefined
                }
            });

            // Update Drop if provided
            if (dropCoordinates && Array.isArray(dropCoordinates) && dropCoordinates.length >= 2 && ctoId) {
                // Upsert drop
                const existingDrop = await tx.drop.findUnique({ where: { customerId: id } });
                if (existingDrop) {
                    await tx.drop.update({
                        where: { id: existingDrop.id },
                        data: { coordinates: dropCoordinates, ctoId }
                    });
                } else {
                    await tx.drop.create({
                        data: {
                            customerId: id,
                            ctoId,
                            coordinates: dropCoordinates,
                            length: 0
                        }
                    });
                }
            }

            return customer;
        });

        // Update counts logic
        if (ctoId) {
            const count = await prisma.customer.count({ where: { ctoId } });
            await prisma.cto.update({ where: { id: ctoId }, data: { clientCount: count } });
        }
        // Also update old CTO count if changed (simplified here)

        res.json(result);
    } catch (error) {
        console.error("Update Customer Error:", error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
};

export const deleteCustomer = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user || !user.companyId) return res.status(401).send();
    const { id } = req.params;

    try {
        const customer = await prisma.customer.findFirst({ where: { id, companyId: user.companyId } });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        await prisma.customer.delete({ where: { id } });

        // Update CTO count
        if (customer.ctoId) {
            const count = await prisma.customer.count({ where: { ctoId: customer.ctoId } });
            await prisma.cto.update({
                where: { id: customer.ctoId },
                data: { clientCount: count }
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Delete Customer Error:", error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
};
