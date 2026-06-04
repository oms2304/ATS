import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jobsRouter from './routes/jobs.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ATS for Job Seekers API is running' });
});

app.use('/api/jobs', jobsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});