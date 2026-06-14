import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from './auditController';
import logger from '../lib/logger';

// Slug auto-gerado pra artigos. Lowercase + ASCII + hifens.
function slugify(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'artigo';
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let i = 1;
    while (true) {
        const existing = await prisma.helpArticle.findUnique({ where: { slug } });
        if (!existing || existing.id === excludeId) return slug;
        i++;
        slug = `${base}-${i}`;
    }
}

// ============================================================================
// PÚBLICO — todos os dados da Ajuda numa request só (clientes não logam aqui)
// ============================================================================

export const getHelpContent = async (_req: Request, res: Response) => {
    try {
        const [faqs, articles, videos, config] = await Promise.all([
            prisma.helpFaq.findMany({
                where: { active: true },
                orderBy: { order: 'asc' },
                select: { id: true, category: true, question: true, answer: true, order: true },
            }),
            prisma.helpArticle.findMany({
                where: { active: true },
                orderBy: { order: 'asc' },
                select: { id: true, title: true, slug: true, category: true, content: true, order: true },
            }),
            prisma.demoVideo.findMany({
                where: { active: true },
                orderBy: { order: 'asc' },
                select: { id: true, title: true, description: true, url: true, icon: true },
            }),
            prisma.saaSConfig.findUnique({
                where: { id: 'global' },
                select: { supportEmail: true, supportPhone: true, supportWhatsapp: true },
            }),
        ]);

        res.json({
            faqs,
            articles,
            videos,
            contact: {
                email: config?.supportEmail || null,
                phone: config?.supportPhone || null,
                whatsapp: config?.supportWhatsapp || null,
            },
        });
    } catch (error) {
        logger.error(`[Help] getHelpContent failed: ${error}`);
        res.status(500).json({
            error: 'Failed to fetch help content',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

// ============================================================================
// ADMIN — FAQs
// ============================================================================

export const listFaqs = async (_req: AuthRequest, res: Response) => {
    try {
        const faqs = await prisma.helpFaq.findMany({
            orderBy: [{ category: 'asc' }, { order: 'asc' }],
        });
        res.json(faqs);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to list FAQs',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

export const createFaq = async (req: AuthRequest, res: Response) => {
    try {
        const { category, question, answer, order, active } = req.body;
        if (!category?.trim() || !question?.trim() || !answer?.trim()) {
            return res.status(400).json({ error: 'category, question, answer obrigatórios' });
        }
        const faq = await prisma.helpFaq.create({
            data: {
                category: category.trim(),
                question: question.trim(),
                answer: answer.trim(),
                order: typeof order === 'number' ? order : 0,
                active: active !== false,
            },
        });
        if (req.user?.id) await logAudit(req.user.id, 'CREATE', 'help_faq', faq.id, { question }, req.ip);
        res.status(201).json(faq);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create FAQ',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

export const updateFaq = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { category, question, answer, order, active } = req.body;
        const faq = await prisma.helpFaq.update({
            where: { id },
            data: {
                ...(category !== undefined && { category: String(category).trim() }),
                ...(question !== undefined && { question: String(question).trim() }),
                ...(answer !== undefined && { answer: String(answer).trim() }),
                ...(order !== undefined && { order: Number(order) }),
                ...(active !== undefined && { active: Boolean(active) }),
            },
        });
        if (req.user?.id) await logAudit(req.user.id, 'UPDATE', 'help_faq', id, req.body, req.ip);
        res.json(faq);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to update FAQ',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

export const deleteFaq = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.helpFaq.delete({ where: { id } });
        if (req.user?.id) await logAudit(req.user.id, 'DELETE', 'help_faq', id, {}, req.ip);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete FAQ',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

// ============================================================================
// ADMIN — Artigos
// ============================================================================

export const listArticles = async (_req: AuthRequest, res: Response) => {
    try {
        const articles = await prisma.helpArticle.findMany({
            orderBy: [{ category: 'asc' }, { order: 'asc' }],
        });
        res.json(articles);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to list articles',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

export const createArticle = async (req: AuthRequest, res: Response) => {
    try {
        const { title, category, content, order, active } = req.body;
        if (!title?.trim() || !category?.trim() || !content?.trim()) {
            return res.status(400).json({ error: 'title, category, content obrigatórios' });
        }
        const slug = await ensureUniqueSlug(slugify(title));
        const article = await prisma.helpArticle.create({
            data: {
                title: title.trim(),
                slug,
                category: category.trim(),
                content,
                order: typeof order === 'number' ? order : 0,
                active: active !== false,
            },
        });
        if (req.user?.id) await logAudit(req.user.id, 'CREATE', 'help_article', article.id, { title, slug }, req.ip);
        res.status(201).json(article);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create article',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

export const updateArticle = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, category, content, order, active } = req.body;
        const data: any = {};
        if (title !== undefined) {
            data.title = String(title).trim();
            // Regenera slug se título mudou (mantém URLs estáveis pra slugs antigos via redirects = futuro)
            const current = await prisma.helpArticle.findUnique({ where: { id }, select: { title: true } });
            if (current && current.title !== data.title) {
                data.slug = await ensureUniqueSlug(slugify(data.title), id);
            }
        }
        if (category !== undefined) data.category = String(category).trim();
        if (content !== undefined) data.content = String(content);
        if (order !== undefined) data.order = Number(order);
        if (active !== undefined) data.active = Boolean(active);

        const article = await prisma.helpArticle.update({ where: { id }, data });
        if (req.user?.id) await logAudit(req.user.id, 'UPDATE', 'help_article', id, req.body, req.ip);
        res.json(article);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to update article',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};

export const deleteArticle = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.helpArticle.delete({ where: { id } });
        if (req.user?.id) await logAudit(req.user.id, 'DELETE', 'help_article', id, {}, req.ip);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete article',
            details: error instanceof Error ? error.message : String(error),
        });
    }
};
