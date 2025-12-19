import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Logger no topo para ver se as requisições chegam (inclusive OPTIONS)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log(`Origin: ${req.headers.origin}`);
    next();
});

// 2. CORS robusto com origens explícitas
const allowedOrigins = [
    'https://ftthplanner-vy2e.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(null, false); // Don't throw error, just don't allow
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// 3. Garantir que OPTIONS responde imediatamente
app.options('*', cors());

app.use(express.json({ limit: '50mb' })); // Increased limit for large sync payloads

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

app.get('/', (req, res) => {
    res.send('FTTH Master Planner API is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
