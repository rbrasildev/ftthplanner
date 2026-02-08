import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logAudit } from './auditController';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Get all videos (Admin - includes inactive)
export const getVideos = async (req: AuthRequest, res: Response) => {
    try {
        const videos = await prisma.demoVideo.findMany({
            orderBy: { order: 'asc' }
        });
        res.json(videos);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch demo videos',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

// Get public videos (Only active)
export const getPublicVideos = async (req: Request, res: Response) => {
    try {
        const videos = await prisma.demoVideo.findMany({
            where: { active: true },
            orderBy: { order: 'asc' }
        });
        res.json(videos);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch public demo videos',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const createVideo = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, url, icon, order, active } = req.body;
        const video = await prisma.demoVideo.create({
            data: { title, description, url, icon, order: parseInt(order) || 0, active: active !== false }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'CREATE_DEMO_VIDEO', 'DemoVideo', video.id, { title }, req.ip);
        }

        res.status(201).json(video);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create demo video',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateVideo = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, url, icon, order, active } = req.body;
        const video = await prisma.demoVideo.update({
            where: { id },
            data: {
                title,
                description,
                url,
                icon,
                order: order !== undefined ? parseInt(order) : undefined,
                active
            }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'UPDATE_DEMO_VIDEO', 'DemoVideo', video.id, { title }, req.ip);
        }

        res.json(video);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to update demo video',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const deleteVideo = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const video = await prisma.demoVideo.delete({
            where: { id }
        });

        if (req.user?.id) {
            await logAudit(req.user.id, 'DELETE_DEMO_VIDEO', 'DemoVideo', video.id, { title: video.title }, req.ip);
        }

        res.json({ message: 'Demo video deleted successfully' });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete demo video',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};
