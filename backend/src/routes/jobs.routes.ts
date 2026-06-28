import { Router } from 'express';
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
} from '../controllers/jobs.controller';
import { checkOwnership } from '../middleware/ownership.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
// import { ownershipMiddleware } from '../middleware/ownership.middleware';
import { archiveJob } from '../controllers/jobs.controller';
import { restoreJob } from '../controllers/jobs.controller';

const router = Router();

router.get('/', getJobs);
router.post('/', createJob);
router.get('/:id', checkOwnership('job'), getJobById);
router.patch('/:id', checkOwnership('job'), updateJob);
router.delete('/:id', checkOwnership('job'), deleteJob);
router.patch("/:id/archive", authMiddleware, checkOwnership('job'), archiveJob);
router.patch("/:id/restore", authMiddleware, checkOwnership('job'), restoreJob);

export default router;
