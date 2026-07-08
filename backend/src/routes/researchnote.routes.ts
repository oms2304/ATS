import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getResearchNote,
  upsertResearchNote,
  deleteResearchNote,
} from '../controllers/researchnote.controller';

const router = Router();

router.get('/jobs/:jobId/research-note', authMiddleware, getResearchNote);
router.put('/jobs/:jobId/research-note', authMiddleware, upsertResearchNote);
router.delete('/jobs/:jobId/research-note', authMiddleware, deleteResearchNote);

export default router;