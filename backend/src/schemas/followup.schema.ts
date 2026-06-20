import { z } from 'zod';

export const createFollowUpSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  dueDate: z.string().datetime(),
  completed: z.boolean().default(false),
});

export const updateFollowUpSchema = createFollowUpSchema.partial();

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;