import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, AppError } from './middleware/errorHandler';
import authRouter from './routes/auth.routes';
import usersRouter from './routes/users.routes';

const app: Application = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

// Fallback for undefined routes
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError('NOT_FOUND', 'Route not found', 404));
});

// Centralized error handling
app.use(errorHandler);

export default app;
