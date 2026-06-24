import { Router } from 'express'
import { generateResume } from '../controllers/ai.controller'

const router = Router()

router.post('/generate-resume', generateResume)

export default router