import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Exporta o app para uso no Vercel (serverless) (legacy support)
export default app;

// Inicia o servidor apenas se não estiver rodando como module (localmente)
if (require.main === module) {
    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`Server running on port ${PORT} (0.0.0.0)`);
    });
}
