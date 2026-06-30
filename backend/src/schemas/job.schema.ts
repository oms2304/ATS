import { z } from 'zod';

// "Archived" is NOT a workflow stage — it's the archivedAt flag set via the
// Archive button. Keeping it out of this enum makes it impossible to overwrite
// a job's real stage with "Archived" through the update API.
export const STAGES = [
  'Interested',
  'Applied',
  'Interview',
  'Offer',
  'Rejected',
] as const;

export const createJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  company: z.string().min(1, 'Company is required'),
  jobPostingBody: z.string().min(1, 'Job posting body is required'),
  stage: z.enum(STAGES).default('Interested'),
  deadline: z.string().datetime().optional().nullable(),
  recruiterNotes: z.string().optional().nullable(),
  outcomeNote: z.string().optional().nullable(),
});

export const updateJobSchema = createJobSchema.partial().extend({
  stage: z.enum(STAGES).optional(),
  // Acknowledgement flag for non-forward stage transitions (S2-BR-007 / C12).
  // Frontend warning dialogs ask the user to confirm before sending this; the
  // controller honors it to bypass the 422 forward-transition guard.
  confirmedOverride: z.boolean().optional().default(false),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;