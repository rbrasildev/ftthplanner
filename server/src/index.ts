import dotenv from 'dotenv';
dotenv.config();
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import logger from './lib/logger';

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
    logger.error(`Uncaught Exception: ${err.message}`);
    logger.error(err.stack || '');
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
});

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cookieParser());
const PORT = process.env.PORT || 3000;

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn(`CORS bloqueado para a origem: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));

// Rate Limiters
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Muitas tentativas de login, tente novamente em 15 minutos.' }
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { error: 'Muitas solicitações de senha, tente novamente em 1 hora.' }
});

const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições, tente novamente em breve.' }
});

// Aplicar Rate Limiters
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use(generalLimiter);

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'live', time: new Date().toISOString() });
});


// Servir arquivos estáticos de uploads dentro do prefixo /api para facilitar o proxy em produção
const uploadsPath = path.resolve(__dirname, '..', 'uploads');
app.use('/api/uploads', express.static(uploadsPath));

app.use(express.json({ 
    limit: '5mb',
    verify: (req: any, res, buf) => {
        if (req.originalUrl && req.originalUrl.includes('/stripe-webhook')) {
            req.rawBody = buf;
        }
    }
}));

app.use(express.urlencoded({ limit: '5mb', extended: true }));

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
        logger.error(`Bad JSON received: ${err.message}`);
        return res.status(400).json({ error: 'Invalid JSON request', details: err.message });
    }

    logger.error(`[Global Error] ${req.method} ${req.url}: ${err.message}`);
    logger.error(err.stack || '');
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
    logger.info(`[Server] API and Socket.io running on port ${PORT} (0.0.0.0)`);
});
