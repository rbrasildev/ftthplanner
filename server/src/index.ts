import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import adminRoutes from './routes/adminRoutes';
import saasRoutes from './routes/saasRoutes';
import auditRoutes from './routes/auditRoutes';
import catalogRoutes from './routes/catalogRoutes';
import paymentRoutes from './routes/paymentRoutes';
import companyRoutes from './routes/companyRoutes';


// Tratamento de erros globais para debug em produção
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://www.ftthplan.com',
        'https://ftthplan.com',
        'https://ftth.redeconexaonet.com',
        'https://ftthplanner.com.br',
        'https://www.ftthplanner.com.br'
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 204
}));

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'live', time: new Date().toISOString() });
});

// Rota temporÃ¡ria de diagnÃ³stico para verificar caminhos em produÃ§Ã£o
app.get('/api/debug-paths', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const debugInfo = {
        cwd: process.cwd(),
        dirname: __dirname,
        uploadsPath: path.resolve(__dirname, '..', 'uploads'),
        exists: fs.existsSync(path.resolve(__dirname, '..', 'uploads')),
        logos: fs.existsSync(path.resolve(__dirname, '..', 'uploads', 'logos'))
            ? fs.readdirSync(path.resolve(__dirname, '..', 'uploads', 'logos'))
            : 'logos folder not found'
    };
    res.json(debugInfo);
});


// Servir arquivos estáticos de uploads dentro do prefixo /api para facilitar o proxy em produção
const uploadsPath = path.resolve(__dirname, '..', 'uploads');
app.use('/api/uploads', express.static(uploadsPath));
console.log(`[Static] Serving uploads from: ${uploadsPath}`);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
        console.error('Bad JSON received:', err.message);
        return res.status(400).json({ error: 'Invalid JSON request', details: err.message });
    }

    // Global Error Handler
    console.error(`[Global Error] ${req.method} ${req.url}:`, err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({
        error: 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});

app.use(express.json({ limit: '100mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/companies', companyRoutes);


// Import Backup Service and Routes
import backupRoutes from './routes/backupRoutes';
import { BackupService } from './services/BackupService';

app.use('/api/backups', backupRoutes);

// Initialize Scheduler
BackupService.initScheduledBackups();

// Seed Plans and Admin
import { seedDefaultPlans, seedSuperAdmin } from './services/seedService';
seedDefaultPlans();
seedSuperAdmin();

app.get('/', (req, res) => {
    res.send('FTTx Planner API is active');
});


app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (0.0.0.0)`);
});
