import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { checkOwnership } from '../middleware/ownership.middleware';
import {
  getExperiences,
  createExperience,
  updateExperience,
  deleteExperience,
  reorderExperiences,
} from '../controllers/experience.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getExperiences);
router.post('/', createExperience);
router.patch('/:id', checkOwnership('experience'), updateExperience);
router.delete('/:id', checkOwnership('experience'), deleteExperience);
router.post('/reorder', reorderExperiences);

export default router;