import { Router } from 'express'
import { generateResume, generateCoverLetter } from '../controllers/ai.controller'

const router = Router()

router.post('/generate-resume', generateResume)
router.post('/generate-cover-letter', generateCoverLetter)

export default router