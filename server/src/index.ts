import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';

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

app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

app.get('/', (req, res) => {
    res.send('FTTH Master Planner API is active');
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (0.0.0.0)`);
});
