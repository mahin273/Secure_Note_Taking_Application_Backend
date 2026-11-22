import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, AppError } from './middleware/errorHandler';
import authRouter from './routes/auth.routes';
import usersRouter from './routes/users.routes';
import notesRouter from './routes/notes.routes';
import adminRouter from './routes/admin.routes';
import postsRouter from './routes/posts.routes';
import reportsRouter from './routes/reports.routes';

const app: Application = express();

// Security and utility middleware
const allowedOrigins = env.CORS_ORIGIN.includes(',')
  ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : env.CORS_ORIGIN === '*'
  ? true
  : env.CORS_ORIGIN;

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'Secure Note-Taking Application REST API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/api/health',
      posts: '/api/posts',
      auth: '/api/auth',
      notes: '/api/notes',
      users: '/api/users',
      reports: '/api/reports',
    },
  });
});

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
app.use('/api/admin/users', usersRouter);
app.use('/api/notes', notesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/posts', postsRouter);
app.use('/api/reports', reportsRouter);

// Fallback for undefined routes
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError('NOT_FOUND', 'Route not found', 404));
});

// Centralized error handling
app.use(errorHandler);

export default app;
