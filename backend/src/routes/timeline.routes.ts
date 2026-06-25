import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getTimeline } from '../controllers/timeline.controller';

const router = Router();

router.get('/jobs/:jobId/timeline', authMiddleware, getTimeline);

export default router;