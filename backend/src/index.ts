import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRouter from './routes/auth.routes'
import jobsRouter from './routes/jobs.routes'
import profileRouter from './routes/profile.routes'
import documentsRouter from './routes/documents.routes'
import aiRouter from './routes/ai.routes'
import { authMiddleware } from './middleware/auth.middleware'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/jobs', authMiddleware, jobsRouter)
app.use('/api/profile', authMiddleware, profileRouter)
app.use('/api/documents', authMiddleware, documentsRouter)
app.use('/api/ai', authMiddleware, aiRouter)

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ATS for Job Seekers API is running' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})