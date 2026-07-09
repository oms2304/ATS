import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getPrepNotes,
  createPrepNote,
  updatePrepNote,
  deletePrepNote,
} from '../controllers/prepnote.controller';

const router = Router();

router.get('/jobs/:jobId/prep-notes', authMiddleware, getPrepNotes);
router.post('/jobs/:jobId/prep-notes', authMiddleware, createPrepNote);
router.patch('/prep-notes/:id', authMiddleware, updatePrepNote);
router.delete('/prep-notes/:id', authMiddleware, deletePrepNote);

export default router;