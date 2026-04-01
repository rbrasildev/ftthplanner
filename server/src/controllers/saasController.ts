import { logAudit } from './auditController';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

// --- PLANS ---
export const getPlans = async (req: AuthRequest, res: Response) => {
    try {
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const plans = await prisma.plan.findMany({
            where: isSuperAdmin ? undefined : { active: true },
            orderBy: { price: 'asc' }
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch plans',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// Public Plans Access (No Auth)
export const getPublicPlans = async (req: Request, res: Response) => {
    try {
        const plans = await prisma.plan.findMany({
            where: { active: true },
            orderBy: { price: 'asc' },
            select: {
                id: true,
                name: true,
                price: true,
                priceYearly: true,
                type: true,
                features: true,
                limits: true,
                isRecommended: true
            }
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch public plans',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// Get Global Map Data (Projects & Companies)
export const getGlobalMapData = async (req: AuthRequest, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
                centerLat: true,
                centerLng: true,
                createdAt: true,
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        const formatted = projects.map(p => ({
            ...p,
            createdAt: p.createdAt.getTime()
        }));
        res.json(formatted);
    } catch (error: any) {
        logger.error(`Error fetching map data: ${error.message}`);
        res.status(500).json({
            error: 'Failed to fetch map data',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const createPlan = async (req: AuthRequest, res: Response) => {
    try {
        const { name, price, priceYearly, type, trialDurationDays, limits, features, isRecommended, mercadopagoId, stripeId, active, description, backupEnabled } = req.body;
        const plan = await prisma.plan.create({
            data: { name, price, priceYearly, type, trialDurationDays, limits, features, isRecommended, mercadopagoId, stripeId, active, description, backupEnabled }
        });

        // Audit Log
        if (req.user?.id) {
            await logAudit(req.user.id, 'CREATE_PLAN', 'Plan', plan.id, { name, price, type }, req.ip);
        }

        res.status(201).json(plan);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create plan',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updatePlan = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, priceYearly, type, trialDurationDays, limits, features, isRecommended, mercadopagoId, stripeId, active, description, backupEnabled } = req.body;
        const plan = await prisma.plan.update({
            where: { id },
            data: { name, price, priceYearly, type, trialDurationDays, limits, features, isRecommended, mercadopagoId, stripeId, active, description, backupEnabled }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'UPDATE_PLAN', 'Plan', plan.id, { name, price }, req.ip);
        }

        res.json(plan);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to update plan',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const deletePlan = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const companiesCount = await prisma.company.count({ where: { planId: id } });
        if (companiesCount > 0) {
            return res.status(400).json({ error: 'Cannot delete plan because it is being used by one or more companies.' });
        }

        // Delete associated invoices to avoid foreign key constraint violations
        await prisma.invoice.deleteMany({ where: { planId: id } });

        const plan = await prisma.plan.delete({
            where: { id }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'DELETE_PLAN', 'Plan', id, { name: plan.name }, req.ip);
        }

        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete plan',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// --- COMPANIES ---
export const getCompanies = async (req: AuthRequest, res: Response) => {
    try {
        const companies = await prisma.company.findMany({
            include: {
                plan: true,
                users: {
                    where: { deletedAt: null },
                    select: { id: true, username: true, role: true, lastLoginAt: true, createdAt: true }
                },
                _count: {
                    select: {
                        projects: { where: { deletedAt: null } },
                        users: { where: { deletedAt: null } },
                        ctos: { where: { deletedAt: null } },
                        pops: { where: { deletedAt: null } }
                    }
                },
                projects: {
                    where: { deletedAt: null },
                    select: { id: true, name: true }
                },
                invoices: {
                    select: { id: true, status: true, amount: true, referenceStart: true, referenceEnd: true, createdAt: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Enrich with financial summary
        const enriched = companies.map(c => {
            const overdueInvoices = c.invoices.filter(inv => inv.status === 'OVERDUE');
            const paidInvoices = c.invoices.filter(inv => inv.status === 'PAID');
            return {
                ...c,
                _financial: {
                    overdueCount: overdueInvoices.length,
                    overdueTotal: overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0),
                    paidCount: paidInvoices.length,
                    paidTotal: paidInvoices.reduce((sum, inv) => sum + inv.amount, 0),
                    lastPayment: paidInvoices.length > 0 ? paidInvoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt : null
                }
            };
        });

        res.json(enriched);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch companies',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateCompanyStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const {
            status,
            planId,
            name,
            phone,
            logoUrl,
            cnpj,
            address,
            city,
            state,
            zipCode,
            businessEmail,
            website,
            subscriptionExpiresAt
        } = req.body;

        // Validate that at least one field is being updated
        if (!status && !planId && !name && phone === undefined && logoUrl === undefined && cnpj === undefined && address === undefined && city === undefined && state === undefined && zipCode === undefined && businessEmail === undefined && website === undefined && !subscriptionExpiresAt) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        // Validate status value if provided
        if (status && !['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED', 'OVERDUE'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        const data: any = {};
        if (status) data.status = status;
        if (planId) data.planId = planId;
        if (name) data.name = name;
        if (phone !== undefined) data.phone = phone;
        if (logoUrl !== undefined) data.logoUrl = logoUrl;
        if (cnpj !== undefined) data.cnpj = cnpj;
        if (address !== undefined) data.address = address;
        if (city !== undefined) data.city = city;
        if (state !== undefined) data.state = state;
        if (zipCode !== undefined) data.zipCode = zipCode;
        if (businessEmail !== undefined) data.businessEmail = businessEmail;
        if (website !== undefined) data.website = website;

        // --- EXPIRATION LOGIC: Only update if explicitly provided ---
        // Previously, any status/planId change auto-set 1 year, which overwrote
        // the correct monthly expiration set by payment webhooks (PIX, card, etc.)
        if (subscriptionExpiresAt) {
            data.subscriptionExpiresAt = new Date(subscriptionExpiresAt);
            logger.info(`[saasController] Manually setting expiration for company ${id} to ${data.subscriptionExpiresAt.toISOString()}`);
        }

        const company = await prisma.company.update({
            where: { id },
            data
        });
        logger.info(`[saasController] ✅ Company ${id} updated successfully`);
        res.json(company);
    } catch (error: any) {
        logger.error(`Critical Update Company Error: ${JSON.stringify({
            id: req.params.id,
            errorMessage: error?.message,
            prismaCode: error?.code
        })}`);
        res.status(500).json({
            error: 'Failed to update company',
            details: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code
        });
    }
};

export const deleteCompany = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Prevent deleting the user's own company (safety check)
        if (req.user?.companyId === id) {
            return res.status(400).json({ error: 'Cannot delete your own company while logged in.' });
        }


        // 1. Delete Projects (Manual Cascade)
        // Note: Project elements (Cables, CTOs, etc.) usually cascade from Project if configured,
        // but to be safe we rely on Prisma's relation capabilities or manual if needed.
        // Assuming Project -> User has Cascade, but Project -> Company might not.
        // 1. Soft-Delete Projects (and their children)
        await prisma.project.updateMany({ 
            where: { companyId: id, deletedAt: null },
            data: { deletedAt: new Date() }
        });
        // We should also soft-delete children to be consistent, although project delete usually hides them
        await prisma.cto.updateMany({ where: { companyId: id, deletedAt: null }, data: { deletedAt: new Date() } });
        await prisma.pop.updateMany({ where: { companyId: id, deletedAt: null }, data: { deletedAt: new Date() } });
        await prisma.cable.updateMany({ where: { companyId: id, deletedAt: null }, data: { deletedAt: new Date() } });
        await prisma.pole.updateMany({ where: { companyId: id, deletedAt: null }, data: { deletedAt: new Date() } });
        await prisma.customer.updateMany({ where: { companyId: id, deletedAt: null }, data: { deletedAt: new Date() } });

        // 2. Delete Catalog Items (Manual Cascade for all types)
        await prisma.catalogCable.deleteMany({ where: { companyId: id } });
        await prisma.catalogSplitter.deleteMany({ where: { companyId: id } });
        await prisma.catalogBox.deleteMany({ where: { companyId: id } });
        await prisma.catalogPole.deleteMany({ where: { companyId: id } });
        await prisma.catalogFusion.deleteMany({ where: { companyId: id } });
        await prisma.catalogOLT.deleteMany({ where: { companyId: id } });

        // 3. Delete Invoices & Audit Logs
        await prisma.invoice.deleteMany({ where: { companyId: id } });
        await prisma.auditLog.deleteMany({ where: { companyId: id } });
        await prisma.auditLog.deleteMany({ where: { user: { companyId: id } } });

        // 4. Delete remaining FK-constrained records (via user relation)
        const companyUserIds = (await prisma.user.findMany({ where: { companyId: id }, select: { id: true } })).map(u => u.id);
        if (companyUserIds.length > 0) {
            await prisma.supportConversation.deleteMany({ where: { userId: { in: companyUserIds } } });
            await prisma.integrationSettings.deleteMany({ where: { userId: { in: companyUserIds } } });
            await prisma.integrationMapping.deleteMany({ where: { userId: { in: companyUserIds } } });
            await prisma.integrationConflict.deleteMany({ where: { userId: { in: companyUserIds } } });
        }

        // 5. Soft-Delete Users
        await prisma.user.updateMany({
            where: { companyId: id, deletedAt: null },
            data: { deletedAt: new Date(), active: false }
        });

        // 6. Delete Company
        const company = await prisma.company.delete({
            where: { id }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'DELETE_COMPANY', 'Company', id, { name: company.name }, req.ip);
        }

        res.json({ message: 'Company and all associated data deleted successfully' });
    } catch (error: any) {
        logger.error(`Delete company error: ${error.message}`);
        res.status(500).json({
            error: 'Failed to delete company',
            details: error instanceof Error ? error.message : String(error)
        });

    }
};

// --- USERS MANAGEMENT (SUPER ADMIN) ---
export const getGlobalUsers = async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            where: { deletedAt: null },
            include: {
                company: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Sanitize
        const sanitized = users.map(u => {
            const { passwordHash, ...rest } = u;
            return rest;
        });

        res.json(sanitized);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch users',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateGlobalUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { role, active, password } = req.body;

        const data: any = {};
        if (role) data.role = role;
        if (typeof active === 'boolean') data.active = active;
        if (password && password.length >= 6) {
            data.passwordHash = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            include: { company: true }
        });

        if (req.user?.id) {
            // Log the action
            const action = password ? 'UPDATE_USER_RESET_PASSWORD' : 'UPDATE_USER_ADMIN';
            await logAudit(req.user.id, action, 'User', id, { role, active, company: user.company?.name }, req.ip);
        }

        const { passwordHash, ...rest } = user;
        res.json(rest);
    } catch (error: any) {
        logger.error(`Update user error: ${error.message}`);
        res.status(500).json({
            error: 'Failed to update user',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// --- PROJECTS MANAGEMENT (TRASH BIN) ---
export const getDeletedProjects = async (req: AuthRequest, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: { deletedAt: { not: null } },
            include: {
                company: {
                    select: { id: true, name: true }
                },
                user: {
                    select: { id: true, username: true }
                }
            },
            orderBy: { deletedAt: 'desc' }
        });
        res.json(projects);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch deleted projects',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const restoreProject = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Restore project and all its related resources in a transaction
        const project = await prisma.$transaction(async (tx) => {
            // Restore related resources
            await tx.cto.updateMany({
                where: { projectId: id, deletedAt: { not: null } },
                data: { deletedAt: null }
            });

            await tx.pop.updateMany({
                where: { projectId: id, deletedAt: { not: null } },
                data: { deletedAt: null }
            });

            await tx.cable.updateMany({
                where: { projectId: id, deletedAt: { not: null } },
                data: { deletedAt: null }
            });

            await tx.pole.updateMany({
                where: { projectId: id, deletedAt: { not: null } },
                data: { deletedAt: null }
            });

            await tx.customer.updateMany({
                where: { projectId: id, deletedAt: { not: null } },
                data: { deletedAt: null }
            });

            // Restore project itself
            return await tx.project.update({
                where: { id },
                data: { deletedAt: null }
            });
        });

        // Audit Log
        if (req.user?.id) {
            await logAudit(req.user.id, 'RESTORE_PROJECT', 'Project', id, { name: project.name }, req.ip);
        }

        res.json({ message: 'Project restored successfully', project });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to restore project',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const permanentlyDeleteProject = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Fetch project info for audit before deletion
        const project = await prisma.project.findUnique({
            where: { id },
            select: { name: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Permanent delete
        // Thanks to onDelete: Cascade, this should remove related elements
        await prisma.project.delete({
            where: { id }
        });

        // Audit Log
        if (req.user?.id) {
            await logAudit(req.user.id, 'PERMANENTLY_DELETE_PROJECT', 'Project', id, { name: project.name }, req.ip);
        }

        res.json({ message: 'Project permanently deleted' });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete project permanently',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// --- COMPANY INVOICES (Admin view) ---
export const getCompanyInvoices = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const company = await prisma.company.findUnique({ where: { id } });
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const invoices = await prisma.invoice.findMany({
            where: { companyId: id },
            include: { plan: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(invoices.map(inv => ({
            id: inv.id,
            planName: inv.plan?.name || 'Assinatura',
            amount: inv.amount,
            status: inv.status,
            paymentMethod: inv.paymentMethod,
            createdAt: inv.createdAt,
            expiresAt: inv.expiresAt,
            referenceStart: inv.referenceStart,
            referenceEnd: inv.referenceEnd,
            mercadopagoPaymentId: inv.mercadopagoPaymentId
        })));
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch company invoices',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// --- MANUAL INVOICE PAYMENT (Admin marks invoice as PAID) ---
export const markInvoicePaid = async (req: AuthRequest, res: Response) => {
    try {
        const { invoiceId } = req.params;

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { company: { select: { id: true, name: true, subscriptionExpiresAt: true, planId: true, status: true } } }
        });

        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        if (invoice.status === 'PAID') return res.status(400).json({ error: 'Invoice is already paid' });
        if (!invoice.company) return res.status(400).json({ error: 'Invoice has no associated company' });

        // 1. Mark invoice as PAID
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'PAID', paymentMethod: 'MANUAL' }
        });

        // 2. Recalculate subscription expiration (anchored to billing cycle)
        const company = invoice.company;
        const now = new Date();
        const prevExpiry = company.subscriptionExpiresAt;
        let nextBilling: Date;

        if (prevExpiry) {
            nextBilling = new Date(prevExpiry);
            while (nextBilling <= now) {
                nextBilling.setMonth(nextBilling.getMonth() + 1);
            }
        } else {
            nextBilling = new Date(now);
            nextBilling.setMonth(nextBilling.getMonth() + 1);
        }

        // 3. Check if there are still overdue invoices remaining
        const remainingOverdue = await prisma.invoice.count({
            where: { companyId: company.id, status: 'OVERDUE' }
        });

        // 4. Update company — reactivate if no more overdue invoices
        await prisma.company.update({
            where: { id: company.id },
            data: {
                subscriptionExpiresAt: nextBilling,
                ...(remainingOverdue === 0 ? { status: 'ACTIVE' } : {})
            }
        });

        // 5. Audit
        if (req.user?.id) {
            await logAudit(req.user.id, 'MANUAL_INVOICE_PAYMENT', 'Invoice', invoiceId, {
                companyId: company.id,
                companyName: company.name,
                amount: invoice.amount,
                remainingOverdue
            }, req.ip);
        }

        logger.info(`[saasController] Manual payment: Invoice ${invoiceId} for ${company.name}. Remaining overdue: ${remainingOverdue}. New expiry: ${nextBilling.toISOString()}`);

        return res.json({
            message: 'Invoice marked as paid',
            remainingOverdue,
            newExpiration: nextBilling,
            companyReactivated: remainingOverdue === 0
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to mark invoice as paid',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};
