import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import adminRoutes from './routes/adminRoutes';
import saasRoutes from './routes/saasRoutes';
import auditRoutes from './routes/auditRoutes';
import catalogRoutes from './routes/catalogRoutes';

dotenv.config();

// Tratamento de erros globais para debug em produção
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de log ultra-simples no topo
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});


// CORS mais permissivo possível para teste
app.use(cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 204
}));

// Rota de teste de sanidade
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'live', time: new Date().toISOString() });
});

// app.use(express.json({ limit: '100mb' }));  <-- REMOVED (Handled conditionally below)

import billingRoutes from './routes/billingRoutes';

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
        console.error('Bad JSON received:', err.message);
        console.error('Raw Body Content:', (err as any).body);
        return res.status(400).json({ error: 'Invalid JSON request', details: err.message });
    }
    next();
});

// JSON Parser (Skip for Webhook to allow raw signature verification)
app.use((req, res, next) => {
    if (req.originalUrl.includes('/api/billing/webhook')) {
        next();
    } else {
        express.json({ limit: '100mb' })(req, res, next);
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/billing', billingRoutes);

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
    res.send('FTTH Master Planner API is active');
});


app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (0.0.0.0)`);
});
