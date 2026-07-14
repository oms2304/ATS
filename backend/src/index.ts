import 'dotenv/config';
/// <reference path="./types/express.d.ts" />
import express from 'express';
import cors from 'cors';
import { requestId } from './middleware/requestId.middleware';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import logger from './lib/logger';
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

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in backend/.env');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in backend/.env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  })
)
app.use(express.json());
app.use(requestId);


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

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ATS for Job Seekers API is running' });
});

// Liveness/health probe for deploy health checks (Render, CI smoke tests).
// Public, no auth, no DB dependency so it reflects process health only.
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Unmatched routes -> consistent 404, then the centralized error handler.
// These must be registered after all routes; errorHandler must be last.
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info('server_started', { port: PORT });
});
