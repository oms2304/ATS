import { z } from 'zod';

export const createJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  company: z.string().min(1, 'Company is required'),
  stage: z
    .enum(['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'SAVED'])
    .default('APPLIED'),
  notes: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
});

export const updateJobSchema = createJobSchema.partial();

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;