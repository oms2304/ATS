import 'dotenv/config';
/// <reference path="./types/express.d.ts" />
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import jobsRouter from './routes/jobs.routes';
import profileRouter from './routes/profile.routes';
import { authMiddleware } from './middleware/auth.middleware';
import documentsRouter from './routes/documents.routes';
import aiRouter from './routes/ai.routes';

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

const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000']
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

app.use('/api/auth', authRoutes);
app.use('/api/jobs', authMiddleware, jobsRouter);
app.use('/api/profile', authMiddleware, profileRouter);
app.use('/api/documents', authMiddleware, documentsRouter);
app.use('/api/ai', authMiddleware, aiRouter);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ATS for Job Seekers API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
