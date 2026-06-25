import { Router } from 'express'
import { getDashboardMetrics } from '../controllers/metrics.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

router.get('/', authMiddleware, getDashboardMetrics)

export default router