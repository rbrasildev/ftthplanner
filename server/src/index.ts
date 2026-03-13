import dotenv from 'dotenv';
dotenv.config();

// =========================================================
// GLOBAL LOG SILENCER (BACKEND)
// =========================================================
// Remove or set to false to see all backend logs again
const MUTE_LOGS = false;

if (MUTE_LOGS) {
    // Only muting log, info and debug. Keeping warn and error.
    console.log = function () { };
    console.info = function () { };
    console.debug = function () { };
}

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
import customerRoutes from './routes/customerRoutes';
import supportRoutes from './routes/supportRoutes';
import supportChatRoutes from './routes/supportChatRoutes';
import { initCronJobs } from './jobs/cronJobs';
import { createServer } from 'http';
import { SocketService } from './services/SocketService';


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
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://www.ftthplan.com',
    'https://ftthplan.com',
    'https://ftth.redeconexaonet.com',
    'https://ftthplanner.com.br',
    'https://www.ftthplanner.com.br',
    'https://api.ftthplanner.com.br',
    'https://www.api.ftthplanner.com.br'
];

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Verifica se a origem está na lista permitida ou é um subdomínio válido
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.ftthplanner.com.br') || origin.endsWith('.ftthplan.com')) {
            callback(null, true);
        } else {
            console.log('CORS Tentativa Não Mapeada (permitindo temporariamente para evitar 503):', origin);
            callback(null, true); // Evita lançar um Error duro que causa o 503 no Express/Nginx
        }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'live', time: new Date().toISOString() });
});


// Servir arquivos estáticos de uploads dentro do prefixo /api para facilitar o proxy em produção
const uploadsPath = path.resolve(__dirname, '..', 'uploads');
app.use('/api/uploads', express.static(uploadsPath));

app.use(express.json({ 
    limit: '100mb',
    verify: (req: any, res, buf) => {
        if (req.originalUrl && req.originalUrl.includes('/stripe-webhook')) {
            req.rawBody = buf;
        }
    }
}));

app.use((req, res, next) => {
    // console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/support/chat', supportChatRoutes);

// Backup and Cron
import backupRoutes from './routes/backupRoutes';
import { BackupService } from './services/BackupService';

app.use('/api/backups', backupRoutes);

// Error Handler - DEVE SER O ÚLTIMO
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
        console.error('Bad JSON received:', err.message);
        return res.status(400).json({ error: 'Invalid JSON request', details: err.message });
    }

    console.error(`[Global Error] ${req.method} ${req.url}:`, err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({
        error: 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});

app.get('/', (req, res) => {
    res.send('FTTx Planner API is active');
});

// Initialize Scheduler
BackupService.initScheduledBackups();
initCronJobs();

const httpServer = createServer(app);
SocketService.init(httpServer);

httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] API and Socket.io running on port ${PORT} (0.0.0.0)`);
});
