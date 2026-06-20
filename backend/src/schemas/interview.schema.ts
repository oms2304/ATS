import { z } from 'zod';

export const ROUND_TYPES = [
  'Phone Screen',
  'Technical',
  'Behavioral',
  'System Design',
  'HR',
  'Final',
  'Other',
] as const;

export const createInterviewSchema = z.object({
  roundType: z.enum(ROUND_TYPES),
  date: z.string().datetime(),
  notes: z.string().optional().nullable(),
});

export const updateInterviewSchema = createInterviewSchema.partial();

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
