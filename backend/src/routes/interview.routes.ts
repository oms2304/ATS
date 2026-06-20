import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
} from '../controllers/interview.controller';

const router = Router();

router.get('/jobs/:jobId/interviews', authMiddleware, getInterviews);
router.post('/jobs/:jobId/interviews', authMiddleware, createInterview);
router.patch('/interviews/:id', authMiddleware, updateInterview);
router.delete('/interviews/:id', authMiddleware, deleteInterview);

export default router;