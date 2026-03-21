import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export const getCustomers = async (req: Request, res: Response) => {
    const user = (req as AuthRequest).user;
    if (!user || !user.companyId) return res.status(401).send();

    try {
        const { minLat, maxLat, minLng, maxLng, ctoId, search, projectId, page, limit } = req.query;

        const where: any = {
            companyId: user.companyId,
            deletedAt: null
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

        // Search by Name, Document, Email or Phone
        if (search) {
            const searchStr = search as string;
            where.OR = [
                { name: { contains: searchStr, mode: 'insensitive' } },
                { document: { contains: searchStr, mode: 'insensitive' } },
                { email: { contains: searchStr, mode: 'insensitive' } },
                { phone: { contains: searchStr, mode: 'insensitive' } }
            ];
        }

        // Pagination Support
        if (page && limit) {
            const pPage = Math.max(1, parseInt(page as string, 10) || 1);
            const pLimit = Math.max(1, parseInt(limit as string, 10) || 50);
            const skip = (pPage - 1) * pLimit;

            const [customers, total] = await Promise.all([
                prisma.customer.findMany({
                    where,
                    include: { drop: true },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: pLimit
                }),
                prisma.customer.count({ where })
            ]);

            return res.json({
                data: customers,
                total,
                page: pPage,
                limit: pLimit,
                totalPages: Math.ceil(total / pLimit)
            });
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

    const user = (req as AuthRequest).user;


    if (!user || !user.companyId) {

        return res.status(401).send();
    }

    try {


        if (!req.body) {
            throw new Error("Request body is empty or undefined");
        }

        const {
            name, document, phone, email, address,
            lat, lng,
            ctoId, splitterId, splitterPortIndex, fiberId,
            status, onuSerial, onuMac, pppoeService, onuPower,
            projectId,
            connectionStatus
        } = req.body;



        // Parse logic
        const pLat = parseFloat(lat);
        const pLng = parseFloat(lng);
        const pOnuPower = onuPower ? parseFloat(onuPower) : null;

        if (isNaN(pLat) || isNaN(pLng)) {

            return res.status(400).json({ error: "Coordenadas inválidas. Lat/Lng devem ser números." });
        }

        // Validation: Check if port is already occupied
        if (ctoId && splitterId && splitterPortIndex !== undefined) {

            const existing = await prisma.customer.findFirst({
                where: {
                    companyId: user.companyId,
                    ctoId,
                    splitterId,
                    splitterPortIndex: Number(splitterPortIndex),
                    deletedAt: null
                }
            });

            if (existing) {

                return res.status(409).json({
                    error: 'Porta ocupada',
                    details: `Esta porta já está em uso pelo cliente ${existing.name}`
                });
            }
        }

        // New Drop Logic: Extract drop coordinates if present
        const { dropCoordinates } = req.body; // Expecting array of {lat, lng}



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
                    pppoeService,
                    onuPower: onuPower ? parseFloat(onuPower) : null,
                    connectionStatus
                }
            });

            // If drop coordinates are provided (Phase 2 of flow), create Drop record
            if (dropCoordinates && Array.isArray(dropCoordinates) && dropCoordinates.length >= 2 && ctoId) {

                await tx.drop.create({
                    data: {
                        customerId: customer.id,
                        ctoId: ctoId,
                        coordinates: dropCoordinates, // Prisma handles JSON
                        length: 0 // TODO: Calculate length if needed
                    }
                });
            } else if (ctoId) {
                // If NO dropCoordinates but ctoId is present, create a straight-line default drop

                const targetCto = await tx.cto.findUnique({ where: { id: ctoId } });
                if (targetCto) {
                   await tx.drop.create({
                       data: {
                           customerId: customer.id,
                           ctoId: ctoId,
                           coordinates: [
                               { lat: pLat, lng: pLng },
                               { lat: targetCto.lat, lng: targetCto.lng }
                           ],
                           length: 0
                       }
                   });
                }
            }

            return customer;
        });



        // Update CTO client count (outside transaction to avoid locking unrelated stuff if possible, or inside if strict)
        if (ctoId) {

            const count = await prisma.customer.count({ where: { ctoId, deletedAt: null } });
            await prisma.cto.update({
                where: { id: ctoId },
                data: { clientCount: count }
            });
        }

        // Fetch the fully hydrated object so the client gets the drop right away
        const finalCustomer = await prisma.customer.findUnique({
            where: { id: result.id },
            include: { drop: true }
        });

        res.json(finalCustomer);
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
            projectId,
            connectionStatus
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
                    id: { not: id }, // Exclude self
                    deletedAt: null
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
                    projectId: projectId !== undefined ? (projectId || null) : undefined,
                    connectionStatus
                }
            });

            // Update Drop if coordinates are provided
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
            } else if (ctoId) {
                // No dropCoordinates provided, but we have a ctoId. Check if we need to update based on CTO change or MOVE
                const existingDrop = await tx.drop.findUnique({ where: { customerId: id } });
                const targetCto = await tx.cto.findUnique({ where: { id: ctoId } });
                
                const newLat = lat !== undefined ? parseFloat(lat) : currentHelper.lat;
                const newLng = lng !== undefined ? parseFloat(lng) : currentHelper.lng;
                
                if (targetCto) {
                    if (existingDrop) {
                        // If CTO changed OR position changed, regenerate/update coords
                        const ctoChanged = ctoId !== currentHelper.ctoId;
                        const positionChanged = (lat !== undefined || lng !== undefined);
                        
                        if (ctoChanged) {
                            // CTO Changed: Regenerate straight line to new CTO
                            await tx.drop.update({
                                where: { id: existingDrop.id },
                                data: { 
                                    coordinates: [{ lat: newLat, lng: newLng }, { lat: targetCto.lat, lng: targetCto.lng }],
                                    ctoId 
                                }
                            });
                        } else if (positionChanged && Array.isArray(existingDrop.coordinates) && existingDrop.coordinates.length > 0) {
                            // Only position changed: Update just the first point of the existing drop
                            const newCoords = [...existingDrop.coordinates as any[]];
                            newCoords[0] = { lat: newLat, lng: newLng };
                            await tx.drop.update({
                                where: { id: existingDrop.id },
                                data: { coordinates: newCoords }
                            });
                        }
                    } else {
                        // Create NEW default drop
                        await tx.drop.create({
                            data: {
                                customerId: id,
                                ctoId,
                                coordinates: [{ lat: newLat, lng: newLng }, { lat: targetCto.lat, lng: targetCto.lng }],
                                length: 0
                            }
                        });
                    }
                }
            }

            return customer;
        });

        // Update counts logic
        if (ctoId) {
            const count = await prisma.customer.count({ where: { ctoId, deletedAt: null } });
            await prisma.cto.update({ where: { id: ctoId }, data: { clientCount: count } });
        }
        // Also update old CTO count if changed (simplified here)

        // Fetch the fully hydrated object so the client gets the updated drop right away
        const finalCustomer = await prisma.customer.findUnique({
            where: { id: result.id },
            include: { drop: true }
        });

        res.json(finalCustomer);
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

        await prisma.customer.update({ 
            where: { id },
            data: { deletedAt: new Date(), status: 'INACTIVE' }
        });

        // Update CTO count
        if (customer.ctoId) {
            const count = await prisma.customer.count({ where: { ctoId: customer.ctoId, deletedAt: null } });
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
