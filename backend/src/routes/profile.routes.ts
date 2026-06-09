import { Router } from 'express';
import {
  getProfile,
  createProfile,
  updateProfile,
  getCompletionScore,
} from '../controllers/profile.controller';

const router = Router();

router.get('/', getProfile);
router.post('/', createProfile);
router.patch('/', updateProfile);
router.get('/completion', getCompletionScore);

export default router;
