import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRoutes from './routes/uploadRoutes';
import disputeRoutes from './routes/disputeRoutes';
import authRoutes from './routes/authRoutes';
import registryRoutes from './routes/registryRoutes';
import tokenRoutes from './routes/tokenRoutes';
import { logger } from './utils/logger';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dispute', disputeRoutes);
app.use('/api/registry', registryRoutes);
app.use('/api/claim-tokens', tokenRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: 'supabase',
    version: '2.0.0',
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} — DB: Supabase, Hashing: pHash`);
});

export default app;
