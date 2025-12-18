import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, passwordHash: hashedPassword },
        });
        res.json({ id: user.id, username: user.username });
    } catch (error) {
        res.status(400).json({ error: 'Username already exists or invalid data' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { username } });

        if (user && (await bcrypt.compare(password, user.passwordHash))) {
            const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET as string);
            res.json({ token, user: { id: user.id, username: user.username } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
