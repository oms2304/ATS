import 'dotenv/config';
/// <reference path="./types/express.d.ts" />
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import jobsRouter from './routes/jobs.routes';
import profileRouter from './routes/profile.routes';

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

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/auth', authRoutes)

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ATS for Job Seekers API is running' });
});

app.use('/api/jobs', jobsRouter);
app.use('/api/profile', profileRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
