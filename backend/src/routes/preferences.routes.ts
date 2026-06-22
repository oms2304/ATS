import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getPreferences,
  upsertPreferences,
} from '../controllers/preferences.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getPreferences);
router.put('/', upsertPreferences);

export default router;