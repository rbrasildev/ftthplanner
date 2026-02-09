
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'logos');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const getCompanyProfile = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Company ID not found' });

        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        res.json(company);
    } catch (error) {
        console.error('Get company profile error:', error);
        res.status(500).json({ error: 'Failed to fetch company profile' });
    }
};

export const updateCompanyProfile = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Company ID not found' });

        const { name, phone, cnpj, address, city, state, zipCode, businessEmail, website } = req.body;

        const updatedCompany = await prisma.company.update({
            where: { id: companyId },
            data: {
                name,
                phone,
                cnpj,
                address,
                city,
                state,
                zipCode,
                businessEmail,
                website
            }
        });

        res.json(updatedCompany);
    } catch (error) {
        console.error('Update company profile error:', error);
        res.status(500).json({ error: 'Failed to update company profile' });
    }
};

export const uploadCompanyLogo = async (req: AuthRequest, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) return res.status(401).json({ error: 'Company ID not found' });

        const { logoBase64 } = req.body;
        if (!logoBase64) return res.status(400).json({ error: 'Logo data is required' });

        // Extract format and data
        const matches = logoBase64.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        const extension = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `logo_${companyId}_${Date.now()}.${extension}`;

        const filePath = path.join(UPLOADS_DIR, fileName);

        // Delete old logo if it exists
        const currentCompany = await prisma.company.findUnique({ where: { id: companyId } });
        if (currentCompany?.logoUrl) {
            const oldFileName = currentCompany.logoUrl.split('/').pop();
            if (oldFileName) {
                const oldFilePath = path.join(UPLOADS_DIR, oldFileName);
                if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            }
        }

        fs.writeFileSync(filePath, buffer);

        const logoUrl = `/api/uploads/logos/${fileName}`;
        await prisma.company.update({
            where: { id: companyId },
            data: { logoUrl }
        });

        res.json({ success: true, logoUrl });
    } catch (error) {
        console.error('Upload logo error:', error);
        res.status(500).json({ error: 'Failed to upload logo' });
    }
};
