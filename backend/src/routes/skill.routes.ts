import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { checkOwnership } from '../middleware/ownership.middleware';
import {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  reorderSkills,
} from '../controllers/skill.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getSkills);
router.post('/', createSkill);
router.patch('/:id', checkOwnership('skill'), updateSkill);
router.delete('/:id', checkOwnership('skill'), deleteSkill);
router.post('/reorder', reorderSkills);

export default router;