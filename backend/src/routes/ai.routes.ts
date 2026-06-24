import { Router } from 'express'
import { generateResume, generateCoverLetter, rewriteDraft } from '../controllers/ai.controller'

const router = Router()

router.post('/generate-resume', generateResume)
router.post('/generate-cover-letter', generateCoverLetter)
router.post('/rewrite', rewriteDraft)

export default router