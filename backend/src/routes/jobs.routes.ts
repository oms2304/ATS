import { Router } from 'express';
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
} from '../controllers/jobs.controller';
import { checkOwnership } from '../middleware/ownership.middleware';

const router = Router();

router.get('/', getJobs);
router.post('/', createJob);
router.get('/:id', checkOwnership('job'), getJobById);
router.patch('/:id', checkOwnership('job'), updateJob);
router.delete('/:id', checkOwnership('job'), deleteJob);

export default router;
