import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { checkOwnership } from '../middleware/ownership.middleware';
import {
  getEducations,
  createEducation,
  updateEducation,
  deleteEducation,
} from '../controllers/education.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getEducations);
router.post('/', createEducation);
router.patch('/:id', checkOwnership('education'), updateEducation);
router.delete('/:id', checkOwnership('education'), deleteEducation);

export default router;