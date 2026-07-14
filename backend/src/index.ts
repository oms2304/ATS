import 'dotenv/config';
/// <reference path="./types/express.d.ts" />
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestId } from './middleware/requestId.middleware';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import { globalLimiter } from './middleware/rateLimit.middleware';
import logger from './lib/logger';
import { prisma } from './lib/prisma';
import { validateStartupEnvironment } from './lib/env';
import authRoutes from './routes/auth.routes';
import jobsRouter from './routes/jobs.routes';
import profileRouter from './routes/profile.routes';
import { authMiddleware } from './middleware/auth.middleware';
import documentsRouter from './routes/documents.routes';
import aiRouter from './routes/ai.routes';
import interviewRouter from './routes/interview.routes';
import followUpRouter from './routes/followup.routes';
import prepNoteRouter from './routes/prepnote.routes';
import researchNoteRouter from './routes/researchnote.routes';
import timelineRouter from './routes/timeline.routes';
import experienceRouter from './routes/experience.routes';
import educationRouter from './routes/education.routes';
import skillRouter from './routes/skill.routes';
import preferencesRouter from './routes/preferences.routes';
import metricsRouter from './routes/metrics.routes';

export const app = express();
const PORT = process.env.PORT || 4000;
const VERSION = '1.0.0';

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(requestId);
app.use(globalLimiter);

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'ATS for Job Seekers API is running' });
});

// Liveness proves the process can answer HTTP without depending on external
// services. Deployment checks should use /readyz below.
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/readyz', async (_req, res) => {
  try {
    await Promise.race([
      prisma.$queryRawUnsafe('SELECT 1'),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Database readiness timed out')),
          5000
        )
      ),
    ]);
    return res.status(200).json({ status: 'ready' });
  } catch (error) {
    logger.error('readiness_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(503).json({ status: 'not_ready' });
  }
});

app.get('/version', (_req, res) => {
  res.status(200).json({
    version: VERSION,
    commit:
      process.env.RENDER_GIT_COMMIT ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      'local',
    environment: process.env.NODE_ENV ?? 'development',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', authMiddleware, jobsRouter);
app.use('/api/profile', authMiddleware, profileRouter);
app.use('/api/documents', authMiddleware, documentsRouter);
app.use('/api/ai', authMiddleware, aiRouter);
app.use('/api', interviewRouter);
app.use('/api', followUpRouter);
app.use('/api', prepNoteRouter);
app.use('/api', researchNoteRouter);
app.use('/api', timelineRouter);
app.use('/api/experience', authMiddleware, experienceRouter);
app.use('/api/education', authMiddleware, educationRouter);
app.use('/api/skills', authMiddleware, skillRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api/metrics', authMiddleware, metricsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export function startServer() {
  validateStartupEnvironment(process.env);
  return app.listen(PORT, () => {
    logger.info('server_started', { port: PORT });
  });
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    logger.error('server_start_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}
