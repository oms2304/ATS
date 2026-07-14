import { Router } from 'express';
import {
  generateResume,
  generateCoverLetter,
  rewriteDraft,
  generateCompanyResearch,
} from '../controllers/ai.controller';
import { aiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(aiLimiter);
router.post('/generate-resume', generateResume);
router.post('/generate-cover-letter', generateCoverLetter);
router.post('/rewrite', rewriteDraft);
router.post('/jobs/:jobId/generate-research', generateCompanyResearch);

export default router;
