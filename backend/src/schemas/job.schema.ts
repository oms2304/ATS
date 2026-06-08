import { z } from 'zod';

export const createJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  company: z.string().min(1, 'Company is required'),
  job_posting_body: z.string().min(1, 'Job posting body is required'),
  stage: z
    .enum(['interested', 'applied', 'interview', 'offer', 'rejected'])
    .default('interested'),
  notes: z.string().optional(),
});

export const updateJobSchema = createJobSchema.partial();

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
