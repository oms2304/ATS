import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
} from '../controllers/followup.controller';

const router = Router();

router.get('/jobs/:jobId/followups', authMiddleware, getFollowUps);
router.post('/jobs/:jobId/followups', authMiddleware, createFollowUp);
router.patch('/followups/:id', authMiddleware, updateFollowUp);
router.delete('/followups/:id', authMiddleware, deleteFollowUp);

export default router;